import {
  ClientRequest,
  CompatibilityCallToolResult,
  CompatibilityCallToolResultSchema,
  ListToolsResultSchema,
  ServerNotification,
  Tool,
  LoggingLevel,
} from "@modelcontextprotocol/sdk/types.js";
import { OAuthTokensSchema } from "@modelcontextprotocol/sdk/shared/auth.js";
import type {
  AnySchema,
  SchemaOutput,
} from "@modelcontextprotocol/sdk/server/zod-compat.js";
import { SESSION_KEYS, getServerSpecificKey } from "./lib/constants";
import { AuthDebuggerState, EMPTY_DEBUGGER_STATE } from "./lib/auth-types";
import { OAuthStateMachine } from "./lib/oauth-state-machine";
import { createProxyFetch } from "./lib/proxyFetch";
import { cacheToolOutputSchemas } from "./utils/schemaUtils";
import { cleanParams } from "./utils/paramUtils";
import type { JsonSchemaType } from "./utils/jsonUtils";
import React, {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useConnection } from "./lib/hooks/useConnection";
import { useDraggableSidebar } from "./lib/hooks/useDraggablePane";

import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Key, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { z } from "zod";
import "./App.css";

import AuthDebugger from "./components/AuthDebugger";
import Sidebar from "./components/Sidebar";
import ToolsTab from "./components/ToolsTab";
import { InspectorConfig } from "./lib/configurationTypes";
import {
  getInitialSseUrl,
  getInitialTransportType,
  getInitialCommand,
  getInitialArgs,
  initializeInspectorConfig,
} from "./utils/configUtils";
import {
  CustomHeaders,
  migrateFromLegacyAuth,
} from "./lib/types/customHeaders";

const CONFIG_LOCAL_STORAGE_KEY = "inspectorConfig_v1";

const App = () => {
  // ---- Connection params ----
  const [command, setCommand] = useState<string>(getInitialCommand);
  const [args, setArgs] = useState<string>(getInitialArgs);
  const [sseUrl, setSseUrl] = useState<string>(getInitialSseUrl);
  const [transportType, setTransportType] = useState<
    "stdio" | "sse" | "streamable-http"
  >(getInitialTransportType);
  const [connectionType, setConnectionType] = useState<"direct" | "proxy">(
    () =>
      (localStorage.getItem("lastConnectionType") as "direct" | "proxy") ||
      "proxy",
  );
  const [logLevel, setLogLevel] = useState<LoggingLevel>("debug");
  const [env, setEnv] = useState<Record<string, string>>({});
  const [config, setConfig] = useState<InspectorConfig>(() =>
    initializeInspectorConfig(CONFIG_LOCAL_STORAGE_KEY),
  );

  // ---- OAuth state ----
  const [oauthClientId, setOauthClientId] = useState<string>(
    () => localStorage.getItem("lastOauthClientId") || "",
  );
  const [oauthScope, setOauthScope] = useState<string>(
    () => localStorage.getItem("lastOauthScope") || "",
  );
  const [oauthClientSecret, setOauthClientSecret] = useState<string>(
    () => localStorage.getItem("lastOauthClientSecret") || "",
  );
  const [customHeaders, setCustomHeaders] = useState<CustomHeaders>(() => {
    const savedHeaders = localStorage.getItem("lastCustomHeaders");
    if (savedHeaders) {
      try {
        return JSON.parse(savedHeaders);
      } catch (error) {
        console.warn("Failed to parse custom headers", error);
      }
    }
    const legacyToken = localStorage.getItem("lastBearerToken") || "";
    const legacyHeaderName = localStorage.getItem("lastHeaderName") || "";
    if (legacyToken) {
      return migrateFromLegacyAuth(legacyToken, legacyHeaderName);
    }
    return [{ name: "Authorization", value: "Bearer ", enabled: false }];
  });

  const [isAuthDebuggerVisible, setIsAuthDebuggerVisible] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(
    () => localStorage.getItem("sidebarCollapsed") === "true",
  );
  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", String(sidebarCollapsed));
  }, [sidebarCollapsed]);
  const [authState, setAuthState] = useState<AuthDebuggerState>(
    EMPTY_DEBUGGER_STATE,
  );

  const updateAuthState = useCallback((updates: Partial<AuthDebuggerState>) => {
    setAuthState((prev) => ({ ...prev, ...updates }));
  }, []);

  // ---- Tools state ----
  const [tools, setTools] = useState<Tool[]>([]);
  const [toolResult, setToolResult] =
    useState<CompatibilityCallToolResult | null>(null);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [nextToolCursor, setNextToolCursor] = useState<string | undefined>();
  const [toolError, setToolError] = useState<string | null>(null);

  // Notifications storage (kept for completeness but no UI side-effects)
  const [, setNotifications] = useState<ServerNotification[]>([]);

  const progressTokenRef = useRef(0);

  // Sidebar resizing
  const {
    width: sidebarWidth,
    isDragging: isSidebarDragging,
    handleDragStart: handleSidebarDragStart,
  } = useDraggableSidebar(320);

  // Persist connection prefs
  useEffect(() => {
    localStorage.setItem("lastConnectionType", connectionType);
  }, [connectionType]);
  useEffect(() => {
    localStorage.setItem("lastOauthClientId", oauthClientId);
  }, [oauthClientId]);
  useEffect(() => {
    localStorage.setItem("lastOauthScope", oauthScope);
  }, [oauthScope]);
  useEffect(() => {
    localStorage.setItem("lastOauthClientSecret", oauthClientSecret);
  }, [oauthClientSecret]);
  useEffect(() => {
    localStorage.setItem("lastCustomHeaders", JSON.stringify(customHeaders));
  }, [customHeaders]);

  // ---- MCP Connection (no cross-tab side-effects) ----
  const {
    connectionStatus,
    serverCapabilities,
    serverImplementation,
    mcpClient,
    connect: connectMcpServer,
    disconnect: disconnectMcpServer,
    makeRequest,
  } = useConnection({
    transportType,
    command,
    args,
    sseUrl,
    env,
    customHeaders,
    oauthClientId,
    oauthClientSecret,
    oauthScope,
    config,
    connectionType,
    onNotification: (notification) => {
      // Pure notification storage — no tab switching or other side effects
      setNotifications((prev) => [...prev, notification as ServerNotification]);
    },
    defaultLoggingLevel: logLevel,
  });

  const sendMCPRequest = async <T extends AnySchema>(
    request: ClientRequest,
    schema: T,
    tabKey?: string,
  ): Promise<SchemaOutput<T>> => {
    try {
      return await makeRequest(request, schema);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (tabKey === "tools") setToolError(msg);
      throw e;
    }
  };

  // ---- Tools API ----
  const listTools = async () => {
    const response = await sendMCPRequest(
      {
        method: "tools/list" as const,
        params: nextToolCursor ? { cursor: nextToolCursor } : {},
      },
      ListToolsResultSchema,
      "tools",
    );
    setTools(response.tools);
    setNextToolCursor(response.nextCursor);
    cacheToolOutputSchemas(response.tools);
  };

  const callTool = async (
    name: string,
    params: Record<string, unknown>,
    toolMetadata?: Record<string, unknown>,
  ): Promise<CompatibilityCallToolResult> => {
    try {
      const tool = tools.find((t) => t.name === name);
      const cleanedParams = tool?.inputSchema
        ? cleanParams(params, tool.inputSchema as JsonSchemaType)
        : params;

      const mergedMetadata = {
        progressToken: progressTokenRef.current++,
        ...toolMetadata,
      };

      const request: ClientRequest = {
        method: "tools/call" as const,
        params: {
          name,
          arguments: cleanedParams,
          _meta: mergedMetadata,
        },
      };

      const response = await sendMCPRequest(
        request,
        CompatibilityCallToolResultSchema,
        "tools",
      );
      const directResult = response as CompatibilityCallToolResult;
      setToolResult(directResult);
      setToolError(null);
      return directResult;
    } catch (e) {
      const errorResult: CompatibilityCallToolResult = {
        content: [
          { type: "text", text: e instanceof Error ? e.message : String(e) },
        ],
        isError: true,
      };
      setToolResult(errorResult);
      setToolError(null);
      return errorResult;
    }
  };

  // ---- Auto-list tools on connect ----
  useEffect(() => {
    if (mcpClient && serverCapabilities?.tools) {
      void listTools();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mcpClient, serverCapabilities?.tools]);

  // ---- OAuth handlers ----
  const onOAuthConnect = useCallback(
    (serverUrl: string) => {
      setSseUrl(serverUrl);
      setIsAuthDebuggerVisible(false);
      void connectMcpServer();
    },
    [connectMcpServer],
  );

  const onOAuthDebugConnect = useCallback(
    async ({
      authorizationCode,
      errorMsg,
      restoredState,
    }: {
      authorizationCode?: string;
      errorMsg?: string;
      restoredState?: AuthDebuggerState;
    }) => {
      setIsAuthDebuggerVisible(true);

      if (errorMsg) {
        updateAuthState({ latestError: new Error(errorMsg) });
        return;
      }

      if (restoredState && authorizationCode) {
        let currentState: AuthDebuggerState = {
          ...restoredState,
          authorizationCode,
          oauthStep: "token_request",
          isInitiatingAuth: true,
          statusMessage: null,
          latestError: null,
        };

        try {
          const fetchFn =
            connectionType === "proxy" && config
              ? createProxyFetch(config)
              : undefined;
          const stateMachine = new OAuthStateMachine(
            sseUrl,
            (updates) => {
              currentState = { ...currentState, ...updates };
            },
            fetchFn,
          );

          while (
            currentState.oauthStep !== "complete" &&
            currentState.oauthStep !== "authorization_code"
          ) {
            await stateMachine.executeStep(currentState);
          }

          if (currentState.oauthStep === "complete") {
            updateAuthState({
              ...currentState,
              statusMessage: {
                type: "success",
                message: "Authentication completed successfully",
              },
              isInitiatingAuth: false,
            });
          }
        } catch (error) {
          console.error("OAuth continuation error:", error);
          updateAuthState({
            latestError:
              error instanceof Error ? error : new Error(String(error)),
            statusMessage: {
              type: "error",
              message: `Failed to complete OAuth flow: ${error instanceof Error ? error.message : String(error)}`,
            },
            isInitiatingAuth: false,
          });
        }
      } else if (authorizationCode) {
        updateAuthState({
          authorizationCode,
          oauthStep: "token_request",
        });
      }
    },
    [sseUrl, connectionType, config, updateAuthState],
  );

  // Restore OAuth tokens
  useEffect(() => {
    const loadOAuthTokens = async () => {
      try {
        if (sseUrl) {
          const key = getServerSpecificKey(SESSION_KEYS.TOKENS, sseUrl);
          const tokens = sessionStorage.getItem(key);
          if (tokens) {
            const parsedTokens = await OAuthTokensSchema.parseAsync(
              JSON.parse(tokens),
            );
            updateAuthState({
              oauthTokens: parsedTokens,
              oauthStep: "complete",
            });
          }
        }
      } catch (e) {
        console.error("Error loading OAuth tokens:", e);
      }
    };
    void loadOAuthTokens();
  }, [sseUrl, updateAuthState]);

  const sendLogLevelRequest = async (level: LoggingLevel) => {
    await sendMCPRequest(
      { method: "logging/setLevel" as const, params: { level } },
      z.object({}),
    );
    setLogLevel(level);
  };

  // ---- OAuth callback routing ----
  if (window.location.pathname === "/oauth/callback") {
    const OAuthCallback = React.lazy(
      () => import("./components/OAuthCallback"),
    );
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <OAuthCallback onConnect={onOAuthConnect} />
      </Suspense>
    );
  }

  if (window.location.pathname === "/oauth/callback/debug") {
    const OAuthDebugCallback = React.lazy(
      () => import("./components/OAuthDebugCallback"),
    );
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <OAuthDebugCallback onConnect={onOAuthDebugConnect} />
      </Suspense>
    );
  }

  // ---- Main UI ----
  return (
    <div className="flex h-screen bg-background">
      {!sidebarCollapsed && (
        <div
          style={{
            width: sidebarWidth,
            minWidth: 200,
            maxWidth: 600,
            transition: isSidebarDragging ? "none" : "width 0.15s",
          }}
          className="bg-card border-r border-border flex flex-col h-full relative"
        >
          <button
            type="button"
            onClick={() => setSidebarCollapsed(true)}
            aria-label="Collapse sidebar"
            className="absolute top-3 right-3 z-20 p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
          <Sidebar
            connectionStatus={connectionStatus}
            transportType={transportType}
            setTransportType={setTransportType}
            command={command}
            setCommand={setCommand}
            args={args}
            setArgs={setArgs}
            sseUrl={sseUrl}
            setSseUrl={setSseUrl}
            env={env}
            setEnv={setEnv}
            config={config}
            setConfig={setConfig}
            customHeaders={customHeaders}
            setCustomHeaders={setCustomHeaders}
            oauthClientId={oauthClientId}
            setOauthClientId={setOauthClientId}
            oauthClientSecret={oauthClientSecret}
            setOauthClientSecret={setOauthClientSecret}
            oauthScope={oauthScope}
            setOauthScope={setOauthScope}
            onConnect={connectMcpServer}
            onDisconnect={disconnectMcpServer}
            logLevel={logLevel}
            sendLogLevelRequest={sendLogLevelRequest}
            loggingSupported={!!serverCapabilities?.logging || false}
            connectionType={connectionType}
            setConnectionType={setConnectionType}
            serverImplementation={serverImplementation}
          />
          <div
            onMouseDown={handleSidebarDragStart}
            style={{
              cursor: "col-resize",
              position: "absolute",
              top: 0,
              right: 0,
              width: 6,
              height: "100%",
              zIndex: 10,
              background: isSidebarDragging
                ? "rgba(0,0,0,0.08)"
                : "transparent",
            }}
            aria-label="Resize sidebar"
            data-testid="sidebar-drag-handle"
          />
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden relative">
        {sidebarCollapsed && (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            aria-label="Expand sidebar"
            className="absolute top-3 left-3 z-20 p-1.5 rounded-md bg-card border border-border shadow-sm hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Expand sidebar"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}
        <div className="flex-1 overflow-auto p-4">
          {isAuthDebuggerVisible ? (
            <AuthDebugger
              serverUrl={sseUrl}
              onBack={() => setIsAuthDebuggerVisible(false)}
              authState={authState}
              updateAuthState={updateAuthState}
              config={config}
              connectionType={connectionType}
            />
          ) : mcpClient ? (
            serverCapabilities?.tools ? (
              <Tabs value="tools" className="w-full">
                <ToolsTab
                  serverSupportsTaskRequests={false}
                  tools={tools}
                  listTools={() => {
                    setToolError(null);
                    void listTools();
                  }}
                  clearTools={() => {
                    setTools([]);
                    setNextToolCursor(undefined);
                    cacheToolOutputSchemas([]);
                  }}
                  callTool={async (name, params, metadata) => {
                    setToolError(null);
                    setToolResult(null);
                    return await callTool(name, params, metadata);
                  }}
                  selectedTool={selectedTool}
                  setSelectedTool={(tool) => {
                    setToolError(null);
                    setSelectedTool(tool);
                    setToolResult(null);
                  }}
                  toolResult={toolResult}
                  isPollingTask={false}
                  nextCursor={nextToolCursor}
                  error={toolError}
                  resourceContent={{}}
                />
              </Tabs>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                <p className="text-lg">
                  Connected server does not advertise <code>tools</code>{" "}
                  capability.
                </p>
                <p className="text-sm">
                  This debugger only supports MCP servers that expose tools.
                </p>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
              <p className="text-xl font-semibold">MCP Tools Debugger</p>
              <p className="text-sm max-w-md text-center">
                Configure connection on the left and click{" "}
                <strong>Connect</strong> to begin debugging tools exposed by
                your MCP server.
              </p>
              <Button
                variant="outline"
                onClick={() => setIsAuthDebuggerVisible(true)}
              >
                <Key className="w-4 h-4 mr-2" />
                Open Auth Debugger
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
