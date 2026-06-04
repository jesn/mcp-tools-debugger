import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const desktopDir = resolve(scriptDir, "..");
const projectRoot = resolve(desktopDir, "..");
const runtimeDir = join(desktopDir, "runtime");

const readJson = (filePath) => JSON.parse(readFileSync(filePath, "utf-8"));

const rootPackage = readJson(join(projectRoot, "package.json"));
const clientPackage = readJson(join(projectRoot, "client", "package.json"));
const serverPackage = readJson(join(projectRoot, "server", "package.json"));
const desktopPackage = readJson(join(desktopDir, "package.json"));

const requiredRuntimeDependencies = ["node-fetch"];
const buildOnlyDependencies = new Set(["shx"]);

const assertExists = (filePath, label) => {
  if (!existsSync(filePath)) {
    throw new Error(`${label} is missing: ${filePath}`);
  }
};

const copyDirectory = (from, to) => {
  assertExists(from, "Source directory");
  mkdirSync(dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true, dereference: false });
};

const getRuntimeDependencies = () => {
  const dependencies = { ...(serverPackage.dependencies ?? {}) };

  for (const dependencyName of buildOnlyDependencies) {
    delete dependencies[dependencyName];
  }

  for (const dependencyName of requiredRuntimeDependencies) {
    const version =
      dependencies[dependencyName] ??
      rootPackage.dependencies?.[dependencyName];

    if (!version) {
      throw new Error(
        `Required runtime dependency ${dependencyName} is not declared in root or server package.json`,
      );
    }

    dependencies[dependencyName] = version;
  }

  return Object.fromEntries(
    Object.entries(dependencies).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
};

const listInstalledPackages = (nodeModulesPath) => {
  if (!existsSync(nodeModulesPath)) return [];

  return readdirSync(nodeModulesPath).flatMap((entry) => {
    if (entry === ".bin") return [];

    const entryPath = join(nodeModulesPath, entry);
    if (entry.startsWith("@")) {
      return readdirSync(entryPath).map((scopedEntry) => ({
        name: `${entry}/${scopedEntry}`,
        path: join(entryPath, scopedEntry),
      }));
    }

    return [{ name: entry, path: entryPath }];
  });
};

const assertNoWorkspaceSymlink = () => {
  const workspacePackageNames = new Set(
    [
      rootPackage.name,
      clientPackage.name,
      serverPackage.name,
      desktopPackage.name,
    ].filter(Boolean),
  );
  const installedPackages = listInstalledPackages(
    join(runtimeDir, "node_modules"),
  );
  const linkedWorkspaces = installedPackages.filter(
    (installedPackage) =>
      workspacePackageNames.has(installedPackage.name) &&
      lstatSync(installedPackage.path).isSymbolicLink(),
  );

  if (linkedWorkspaces.length > 0) {
    throw new Error(
      `Runtime contains workspace symlinks: ${linkedWorkspaces
        .map((installedPackage) => installedPackage.name)
        .join(", ")}`,
    );
  }
};

const assertRuntimeDependenciesInstalled = (dependencies) => {
  for (const dependencyName of Object.keys(dependencies)) {
    assertExists(
      join(runtimeDir, "node_modules", dependencyName),
      `Runtime dependency ${dependencyName}`,
    );
  }
};

const installRuntimeDependencies = (dependencies) => {
  const installDir = mkdtempSync(
    join(tmpdir(), "mcp-tools-debugger-desktop-runtime-"),
  );

  try {
    writeFileSync(
      join(installDir, "package.json"),
      `${JSON.stringify(
        {
          name: "mcp-tools-debugger-desktop-runtime-install",
          private: true,
          type: "module",
          dependencies,
        },
        null,
        2,
      )}\n`,
    );

    const installResult = spawnSync(
      "npm",
      [
        "install",
        "--omit=dev",
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        "--package-lock=false",
      ],
      {
        cwd: installDir,
        stdio: "inherit",
      },
    );

    if (installResult.status !== 0) {
      throw new Error(
        `Runtime dependency installation failed with exit code ${installResult.status ?? "unknown"}`,
      );
    }

    copyDirectory(
      join(installDir, "node_modules"),
      join(runtimeDir, "node_modules"),
    );
    rmSync(join(runtimeDir, "node_modules", ".bin"), {
      recursive: true,
      force: true,
    });
  } finally {
    rmSync(installDir, { recursive: true, force: true });
  }
};

const clientDist = join(projectRoot, "client", "dist");
const serverBuild = join(projectRoot, "server", "build");
const serverEntry = join(serverBuild, "index.js");
const serverStatic = join(projectRoot, "server", "static");

assertExists(clientDist, "Client build output");
assertExists(serverEntry, "Server build entry");
assertExists(serverStatic, "Server static assets");

rmSync(runtimeDir, { recursive: true, force: true });
mkdirSync(runtimeDir, { recursive: true });

copyDirectory(clientDist, join(runtimeDir, "client", "dist"));
copyDirectory(serverBuild, join(runtimeDir, "server", "build"));
copyDirectory(serverStatic, join(runtimeDir, "server", "static"));

const runtimeDependencies = getRuntimeDependencies();

writeFileSync(
  join(runtimeDir, "package.json"),
  `${JSON.stringify(
    {
      name: "mcp-tools-debugger-desktop-runtime",
      private: true,
      type: "module",
      dependencies: runtimeDependencies,
    },
    null,
    2,
  )}\n`,
);

installRuntimeDependencies(runtimeDependencies);
assertRuntimeDependenciesInstalled(runtimeDependencies);
assertNoWorkspaceSymlink();

console.log(`Prepared desktop runtime at ${runtimeDir}`);
