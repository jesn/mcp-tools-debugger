import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import {
  dirname,
  extname,
  join,
  normalize,
  relative,
  resolve,
  sep,
} from "node:path";
import { randomBytes } from "node:crypto";
import { app, BrowserWindow, dialog, shell } from "electron";

const HOST = "localhost";
const LOOPBACK_HOST = "127.0.0.1";
const LOCAL_HOSTNAMES = new Set([HOST, LOOPBACK_HOST, "::1", "[::1]"]);
const PORT_RANGE_START = 49152;
const PORT_RANGE_END = 65535;
const STARTUP_TIMEOUT_MS = 15_000;
const STARTUP_POLL_INTERVAL_MS = 200;
const MAX_PROXY_LOG_LINES = 100;
const OAUTH_NAVIGATION_WINDOW_MS = 10 * 60 * 1000;
const DESKTOP_PORT_STATE_FILE = "desktop-port.json";

type DesktopPortState = {
  clientPort?: number;
};

type DesktopRuntimeQuery = {
  MCP_PROXY_AUTH_TOKEN: string;
  MCP_PROXY_FULL_ADDRESS: string;
  MCP_PROXY_PORT: string;
};

type RuntimePaths = {
  clientDist: string;
  serverEntry: string;
};

type DesktopRuntime = {
  window?: BrowserWindow;
  staticServer: Server;
  proxyProcess: ChildProcess;
};

let runtime: DesktopRuntime | null = null;
let isQuitting = false;
let proxyLogLines: string[] = [];

const delay = (ms: number) =>
  new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

const appendProxyLog = (prefix: "stdout" | "stderr", chunk: Buffer) => {
  const text = chunk.toString();
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  proxyLogLines.push(...lines.map((line) => `[${prefix}] ${line}`));
  proxyLogLines = proxyLogLines.slice(-MAX_PROXY_LOG_LINES);

  const target = prefix === "stdout" ? process.stdout : process.stderr;
  target.write(`[proxy] ${text}`);
};

const getProxyLogTail = () => proxyLogLines.slice(-20).join("\n");

const withDesktopRuntimeQuery = (
  targetUrl: string,
  runtimeQuery: DesktopRuntimeQuery,
) => {
  const target = new URL(targetUrl);
  Object.entries(runtimeQuery).forEach(([key, value]) => {
    target.searchParams.set(key, value);
  });
  return target.toString();
};

const hasDesktopRuntimeQuery = (
  targetUrl: string,
  runtimeQuery: DesktopRuntimeQuery,
) => {
  try {
    const target = new URL(targetUrl);
    return Object.entries(runtimeQuery).every(
      ([key, value]) => target.searchParams.get(key) === value,
    );
  } catch {
    return false;
  }
};

const getDesktopPortStatePath = () =>
  join(app.getPath("userData"), DESKTOP_PORT_STATE_FILE);

const readDesktopPortState = (): DesktopPortState => {
  try {
    const state = JSON.parse(readFileSync(getDesktopPortStatePath(), "utf-8"));
    if (typeof state.clientPort === "number") return state;
  } catch {
    // Missing or invalid state falls back to a new dynamic port.
  }

  return {};
};

const writeDesktopPortState = (state: DesktopPortState) => {
  const statePath = getDesktopPortStatePath();
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, JSON.stringify(state, null, 2));
};

const getRuntimePaths = (): RuntimePaths => {
  if (app.isPackaged) {
    const resourcesPath = process.resourcesPath;
    return {
      clientDist: join(resourcesPath, "runtime", "client", "dist"),
      serverEntry: join(
        resourcesPath,
        "runtime",
        "server",
        "build",
        "index.js",
      ),
    };
  }

  const projectRoot = resolve(app.getAppPath(), "..");
  return {
    clientDist: join(projectRoot, "client", "dist"),
    serverEntry: join(projectRoot, "server", "build", "index.js"),
  };
};

const assertRequiredBuildArtifacts = ({
  clientDist,
  serverEntry,
}: RuntimePaths) => {
  const missing: string[] = [];
  if (!existsSync(clientDist)) missing.push(clientDist);
  if (!existsSync(serverEntry)) missing.push(serverEntry);

  if (missing.length > 0) {
    throw new Error(
      `Missing desktop runtime artifacts. Run npm run desktop:build first.\n\n${missing.join("\n")}`,
    );
  }
};

const getMimeType = (filePath: string) => {
  switch (extname(filePath).toLowerCase()) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".webp":
      return "image/webp";
    case ".ico":
      return "image/x-icon";
    case ".woff":
      return "font/woff";
    case ".woff2":
      return "font/woff2";
    default:
      return "application/octet-stream";
  }
};

const isPathInside = (basePath: string, targetPath: string) => {
  const rel = relative(basePath, targetPath);
  return rel === "" || (!rel.startsWith("..") && !rel.startsWith(sep));
};

const resolveStaticFile = (clientDist: string, requestUrl = "/") => {
  const url = new URL(requestUrl, `http://${HOST}`);
  const decodedPathname = decodeURIComponent(url.pathname);
  const normalizedPathname = normalize(decodedPathname).replace(/^[/\\]+/, "");
  const requestedPath = join(clientDist, normalizedPathname || "index.html");

  if (!isPathInside(clientDist, requestedPath)) {
    return null;
  }

  if (existsSync(requestedPath) && statSync(requestedPath).isFile()) {
    return requestedPath;
  }

  return join(clientDist, "index.html");
};

const tryListenOnPort = async (
  server: Server,
  port: number,
): Promise<number | null> =>
  new Promise<number | null>((resolveListen) => {
    const onError = () => {
      server.off("listening", onListening);
      resolveListen(null);
    };
    const onListening = () => {
      server.off("error", onError);
      resolveListen(port);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, HOST);
  });

const listenOnRandomPort = async (server: Server): Promise<number> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const port =
      PORT_RANGE_START +
      Math.floor(Math.random() * (PORT_RANGE_END - PORT_RANGE_START));
    const listened = await tryListenOnPort(server, port);

    if (listened !== null) {
      return listened;
    }
  }

  throw new Error("Unable to allocate a local port for the desktop app.");
};

const listenOnPreferredPort = async (
  server: Server,
  preferredPort?: number,
): Promise<number> => {
  if (
    typeof preferredPort === "number" &&
    Number.isInteger(preferredPort) &&
    preferredPort >= PORT_RANGE_START &&
    preferredPort <= PORT_RANGE_END
  ) {
    const listened = await tryListenOnPort(server, preferredPort);
    if (listened !== null) return listened;
  }

  return listenOnRandomPort(server);
};

const startStaticServer = async (
  clientDist: string,
  preferredPort?: number,
): Promise<{ server: Server; port: number }> => {
  const server = createServer((request, response) => {
    try {
      const filePath = resolveStaticFile(clientDist, request.url);
      if (!filePath || !existsSync(filePath)) {
        response.writeHead(404, {
          "Content-Type": "text/plain; charset=utf-8",
        });
        response.end("Not found");
        return;
      }

      const isAsset = normalize(filePath).includes(`${sep}assets${sep}`);
      response.writeHead(200, {
        "Content-Type": getMimeType(filePath),
        "Cache-Control": isAsset
          ? "public, max-age=31536000, immutable"
          : "no-cache, no-store, max-age=0",
      });
      createReadStream(filePath).pipe(response);
    } catch (error) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(error instanceof Error ? error.message : String(error));
    }
  });

  const port = await listenOnPreferredPort(server, preferredPort);
  return { server, port };
};

const getProxyEnvironment = ({
  clientPort,
  serverPort,
  sessionToken,
}: {
  clientPort: number;
  serverPort: number;
  sessionToken: string;
}) => {
  const env = { ...process.env };
  delete env.DANGEROUSLY_OMIT_AUTH;
  delete env.HOST;
  delete env.CLIENT_PORT;
  delete env.SERVER_PORT;
  delete env.ALLOWED_ORIGINS;
  delete env.MCP_PROXY_AUTH_TOKEN;
  delete env.MCP_AUTO_OPEN_ENABLED;

  return {
    ...env,
    ELECTRON_RUN_AS_NODE: "1",
    HOST,
    CLIENT_PORT: String(clientPort),
    SERVER_PORT: String(serverPort),
    MCP_PROXY_AUTH_TOKEN: sessionToken,
    MCP_AUTO_OPEN_ENABLED: "false",
    ALLOWED_ORIGINS: [
      `http://${HOST}:${clientPort}`,
      `http://${LOOPBACK_HOST}:${clientPort}`,
      `http://[::1]:${clientPort}`,
    ].join(","),
  };
};

const startProxyProcess = ({
  serverEntry,
  clientPort,
  serverPort,
  sessionToken,
}: {
  serverEntry: string;
  clientPort: number;
  serverPort: number;
  sessionToken: string;
}) => {
  const proxyProcess = spawn(process.execPath, [serverEntry], {
    env: getProxyEnvironment({ clientPort, serverPort, sessionToken }),
    stdio: ["ignore", "pipe", "pipe"],
  });

  proxyProcess.stdout?.on("data", (chunk: Buffer) => {
    appendProxyLog("stdout", chunk);
  });

  proxyProcess.stderr?.on("data", (chunk: Buffer) => {
    appendProxyLog("stderr", chunk);
  });

  proxyProcess.on("error", (error) => {
    appendProxyLog("stderr", Buffer.from(error.message));
  });

  return proxyProcess;
};

const waitForProxy = async (port: number, proxyProcess: ChildProcess) => {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  let lastError: unknown;

  while (Date.now() < deadline) {
    if (proxyProcess.exitCode !== null || proxyProcess.signalCode !== null) {
      const logTail = getProxyLogTail();
      throw new Error(
        `Proxy process exited with ${
          proxyProcess.exitCode !== null
            ? `code ${proxyProcess.exitCode}`
            : `signal ${proxyProcess.signalCode}`
        }.${logTail ? `\n\nRecent proxy logs:\n${logTail}` : ""}`,
      );
    }

    try {
      const response = await fetch(`http://${HOST}:${port}/health`);
      if (response.ok) {
        const body = await response.json();
        if (body?.status === "ok") return;
      }
    } catch (error) {
      lastError = error;
    }

    await delay(STARTUP_POLL_INTERVAL_MS);
  }

  const logTail = getProxyLogTail();
  throw new Error(
    `Proxy did not become ready in ${STARTUP_TIMEOUT_MS}ms. ${
      lastError instanceof Error ? lastError.message : ""
    }${logTail ? `\n\nRecent proxy logs:\n${logTail}` : ""}`,
  );
};

const isOAuthCallbackUrl = (targetUrl: string, callbackOrigin: string) => {
  try {
    const target = new URL(targetUrl);
    return (
      target.origin === callbackOrigin &&
      (target.pathname === "/oauth/callback" ||
        target.pathname === "/oauth/callback/debug")
    );
  } catch {
    return false;
  }
};

const isExternalHttpUrl = (targetUrl: string) => {
  try {
    const target = new URL(targetUrl);
    return (
      (target.protocol === "http:" || target.protocol === "https:") &&
      !LOCAL_HOSTNAMES.has(target.hostname)
    );
  } catch {
    return false;
  }
};

const openExternalHttpUrl = (targetUrl: string) => {
  if (isExternalHttpUrl(targetUrl)) {
    void shell.openExternal(targetUrl);
  }
};

const isOAuthAuthorizationUrl = (targetUrl: string, callbackOrigin: string) => {
  try {
    const target = new URL(targetUrl);
    const redirectUri = target.searchParams.get("redirect_uri");

    return (
      isExternalHttpUrl(targetUrl) &&
      !!redirectUri &&
      isOAuthCallbackUrl(redirectUri, callbackOrigin)
    );
  } catch {
    return false;
  }
};

const createDesktopWindow = (
  url: string,
  runtimeQuery: DesktopRuntimeQuery,
) => {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "MCP Tools Debugger",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const desktopOrigin = new URL(url).origin;
  let allowOAuthNavigationUntil = 0;

  const isDesktopWindowUrl = (targetUrl: string) => {
    try {
      return new URL(targetUrl).origin === desktopOrigin;
    } catch {
      return false;
    }
  };

  const loadDesktopUrl = (targetUrl: string) => {
    void window.loadURL(withDesktopRuntimeQuery(targetUrl, runtimeQuery));
  };

  const allowOAuthNavigation = () => {
    allowOAuthNavigationUntil = Date.now() + OAUTH_NAVIGATION_WINDOW_MS;
  };

  const isOAuthNavigationAllowed = () => Date.now() < allowOAuthNavigationUntil;

  window.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (isDesktopWindowUrl(targetUrl)) {
      loadDesktopUrl(targetUrl);
      return { action: "deny" };
    }

    if (isOAuthAuthorizationUrl(targetUrl, desktopOrigin)) {
      allowOAuthNavigation();
      void window.loadURL(targetUrl);
      return { action: "deny" };
    }

    openExternalHttpUrl(targetUrl);
    return { action: "deny" };
  });

  window.webContents.on("will-navigate", (event, targetUrl) => {
    if (isDesktopWindowUrl(targetUrl)) {
      if (!hasDesktopRuntimeQuery(targetUrl, runtimeQuery)) {
        event.preventDefault();
        loadDesktopUrl(targetUrl);
        return;
      }

      if (isOAuthCallbackUrl(targetUrl, desktopOrigin)) {
        allowOAuthNavigationUntil = 0;
      }
      return;
    }

    if (isOAuthAuthorizationUrl(targetUrl, desktopOrigin)) {
      allowOAuthNavigation();
      return;
    }

    if (isExternalHttpUrl(targetUrl) && isOAuthNavigationAllowed()) {
      return;
    }

    event.preventDefault();
    openExternalHttpUrl(targetUrl);
  });

  window.on("closed", () => {
    if (!isQuitting && runtime?.window === window) {
      stopRuntime();
    }
  });

  void window.loadURL(url);
  return window;
};

const stopRuntime = () => {
  if (!runtime) return;

  const { staticServer, proxyProcess } = runtime;
  runtime = null;
  staticServer.close();

  if (proxyProcess.exitCode === null && proxyProcess.signalCode === null) {
    proxyProcess.kill();
    setTimeout(() => {
      if (proxyProcess.exitCode === null && proxyProcess.signalCode === null) {
        proxyProcess.kill("SIGKILL");
      }
    }, 1_000);
  }
};

const startDesktopRuntime = async () => {
  proxyLogLines = [];

  const paths = getRuntimePaths();
  assertRequiredBuildArtifacts(paths);

  const portState = readDesktopPortState();
  const { server: staticServer, port: clientPort } = await startStaticServer(
    paths.clientDist,
    portState.clientPort,
  );
  writeDesktopPortState({ clientPort });

  const proxyProbeServer = createServer();
  const serverPort = await listenOnRandomPort(proxyProbeServer);
  await new Promise<void>((resolveClose) =>
    proxyProbeServer.close(() => resolveClose()),
  );

  const sessionToken = randomBytes(32).toString("hex");
  const proxyProcess = startProxyProcess({
    serverEntry: paths.serverEntry,
    clientPort,
    serverPort,
    sessionToken,
  });
  runtime = { staticServer, proxyProcess };

  try {
    await waitForProxy(serverPort, proxyProcess);
  } catch (error) {
    stopRuntime();
    throw error;
  }

  const proxyUrl = `http://${HOST}:${serverPort}`;
  const runtimeQuery: DesktopRuntimeQuery = {
    MCP_PROXY_AUTH_TOKEN: sessionToken,
    MCP_PROXY_FULL_ADDRESS: proxyUrl,
    MCP_PROXY_PORT: String(serverPort),
  };
  const window = createDesktopWindow(
    withDesktopRuntimeQuery(`http://${HOST}:${clientPort}/`, runtimeQuery),
    runtimeQuery,
  );
  runtime = { window, staticServer, proxyProcess };

  proxyProcess.once("exit", (code, signal) => {
    if (isQuitting || runtime?.proxyProcess !== proxyProcess) return;

    const logTail = getProxyLogTail();
    const detail = [
      `Proxy process exited unexpectedly${
        code !== null ? ` with code ${code}` : ""
      }${signal ? ` from signal ${signal}` : ""}.`,
      logTail ? `Recent proxy logs:\n${logTail}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    stopRuntime();
    void dialog
      .showMessageBox(window, {
        type: "error",
        title: "MCP Proxy stopped",
        message: "MCP Proxy stopped unexpectedly.",
        detail,
      })
      .finally(() => {
        if (!isQuitting) app.quit();
      });
  });
};

const requestAppQuit = () => {
  isQuitting = true;
  stopRuntime();
  app.quit();
  setTimeout(() => process.exit(0), 1_500).unref();
};

app.on("before-quit", () => {
  isQuitting = true;
  stopRuntime();
});

process.once("SIGTERM", requestAppQuit);
process.once("SIGINT", requestAppQuit);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (!runtime && !isQuitting) {
    void startDesktopRuntime().catch(showStartupError);
  }
});

const showStartupError = async (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  await dialog.showMessageBox({
    type: "error",
    title: "MCP Tools Debugger failed to start",
    message: "MCP Tools Debugger failed to start.",
    detail: message,
  });
  app.quit();
};

app.whenReady().then(() => {
  void startDesktopRuntime().catch(showStartupError);
});
