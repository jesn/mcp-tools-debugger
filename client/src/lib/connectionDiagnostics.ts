import { McpError } from "@modelcontextprotocol/sdk/types.js";
import { MCP_PROXY_TRANSPORT_ERROR_CODE } from "./constants";

export type ConnectionDiagnosticCode =
  | "cors-blocked"
  | "proxy-unauthorized"
  | "proxy-origin-forbidden"
  | "target-not-found"
  | "connection-refused"
  | "unknown";

export interface ConnectionDiagnostic {
  code: ConnectionDiagnosticCode;
  title: string;
  reason: string;
  suggestion: string;
}

interface ExplainConnectionFailureInput {
  error: unknown;
  connectionType: "direct" | "proxy";
  transportType: "stdio" | "sse" | "streamable-http";
  proxyAuthTokenPresent?: boolean;
  serverUrl?: string;
}

const stringifyError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const extractHttpStatus = (error: unknown, message: string): number | null => {
  if (
    error instanceof McpError &&
    error.code === MCP_PROXY_TRANSPORT_ERROR_CODE &&
    error.data &&
    typeof error.data === "object" &&
    "httpStatus" in error.data
  ) {
    const status = (error.data as { httpStatus?: unknown }).httpStatus;
    if (typeof status === "number") return status;
  }

  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "number" && code >= 400 && code < 600) return code;
  }

  const match = message.match(/\b(?:HTTP\s*)?(401|403|404)\b/i);
  return match ? Number(match[1]) : null;
};

export function explainConnectionFailure({
  error,
  connectionType,
  transportType,
  proxyAuthTokenPresent,
}: ExplainConnectionFailureInput): ConnectionDiagnostic {
  const message = stringifyError(error);
  const normalized = message.toLowerCase();
  const httpStatus = extractHttpStatus(error, message);

  if (
    connectionType === "direct" &&
    (normalized.includes("cors") ||
      normalized.includes("blocked by cors policy") ||
      normalized.includes("failed to fetch"))
  ) {
    return {
      code: "cors-blocked",
      title: "浏览器 CORS 拦截",
      reason:
        "浏览器直连第三方 SSE 或 Streamable HTTP 时，目标服务没有允许当前页面 Origin，因此预检或请求被拦截。",
      suggestion:
        "请切换为 Proxy 连接，让调试器代理请求；或在目标 MCP 服务上明确允许当前 Web UI 的 Origin。",
    };
  }

  if (connectionType === "proxy" && httpStatus === 401) {
    return {
      code: "proxy-unauthorized",
      title: "Proxy Session Token 无效",
      reason: proxyAuthTokenPresent
        ? "Proxy 返回 401，通常表示当前 session token 不正确或已不匹配正在运行的 proxy。"
        : "Proxy 返回 401，通常表示缺少 session token。",
      suggestion:
        "请使用带 MCP_PROXY_AUTH_TOKEN 的调试器地址打开页面，或在 Configuration 中填写正在运行的 proxy 输出的正确 token。",
    };
  }

  if (connectionType === "proxy" && httpStatus === 403) {
    return {
      code: "proxy-origin-forbidden",
      title: "Proxy 拒绝当前 Origin",
      reason:
        "Proxy 返回 403，说明当前 Web UI 的 Origin 不在允许范围内，常见于远程 Docker 或内网 IP 访问。",
      suggestion:
        "请检查 ALLOWED_ORIGINS，或确认 Web UI 与 Proxy 使用同一主机地址和正确端口访问。",
    };
  }

  if (httpStatus === 404) {
    return {
      code: "target-not-found",
      title: "目标 Endpoint 不存在",
      reason:
        "连接返回 404，通常是 MCP endpoint 路径错误，或选择的 transport 类型与目标服务实际暴露的 endpoint 不一致。",
      suggestion:
        "请核对 URL 路径，并确认 transport 选择正确：SSE 使用 SSE endpoint，Streamable HTTP 使用 HTTP MCP endpoint。",
    };
  }

  if (
    normalized.includes("econnrefused") ||
    normalized.includes("err_connection_refused") ||
    normalized.includes("connection refused")
  ) {
    return {
      code: "connection-refused",
      title: "目标服务无法连接",
      reason:
        "底层网络拒绝连接，通常表示目标 MCP 服务未启动、端口不对，或容器网络无法访问目标地址。",
      suggestion:
        "请确认服务进程和端口已启动；在 Docker 场景下检查容器网络、host.docker.internal、内网 IP 与端口映射。",
    };
  }

  return {
    code: "unknown",
    title: "连接失败",
    reason: `${transportType} 连接没有匹配到已知错误模式。原始错误：${message}`,
    suggestion:
      "请优先检查目标 URL、transport 类型、Proxy token、浏览器控制台和 proxy 服务日志。",
  };
}
