import { describe, expect, it } from "@jest/globals";
import { explainConnectionFailure } from "../connectionDiagnostics";

describe("explainConnectionFailure", () => {
  it("explains browser CORS failures for direct remote SSE connections", () => {
    const diagnostic = explainConnectionFailure({
      error: new Error(
        "Access to fetch at 'https://example.com/sse' from origin 'http://10.7.14.153:6274' has been blocked by CORS policy",
      ),
      connectionType: "direct",
      transportType: "sse",
      serverUrl: "https://example.com/sse",
    });

    expect(diagnostic.code).toBe("cors-blocked");
    expect(diagnostic.title).toBe("浏览器 CORS 拦截");
    expect(diagnostic.reason).toContain("浏览器直连");
    expect(diagnostic.suggestion).toContain("Proxy");
  });

  it("explains proxy 401 as a missing or invalid proxy session token", () => {
    const diagnostic = explainConnectionFailure({
      error: new Error("HTTP 401: Unauthorized"),
      connectionType: "proxy",
      transportType: "sse",
      proxyAuthTokenPresent: false,
    });

    expect(diagnostic.code).toBe("proxy-unauthorized");
    expect(diagnostic.title).toBe("Proxy Session Token 无效");
    expect(diagnostic.reason).toContain("缺少");
    expect(diagnostic.suggestion).toContain("MCP_PROXY_AUTH_TOKEN");
  });

  it("explains proxy 403 as an origin allowlist failure", () => {
    const diagnostic = explainConnectionFailure({
      error: new Error("HTTP 403: Forbidden"),
      connectionType: "proxy",
      transportType: "streamable-http",
      proxyAuthTokenPresent: true,
    });

    expect(diagnostic.code).toBe("proxy-origin-forbidden");
    expect(diagnostic.title).toBe("Proxy 拒绝当前 Origin");
    expect(diagnostic.reason).toContain("Origin");
    expect(diagnostic.suggestion).toContain("ALLOWED_ORIGINS");
  });

  it("explains 404 as an endpoint or transport mismatch", () => {
    const diagnostic = explainConnectionFailure({
      error: new Error("HTTP 404: Not Found"),
      connectionType: "proxy",
      transportType: "streamable-http",
      proxyAuthTokenPresent: true,
      serverUrl: "https://example.com/sse",
    });

    expect(diagnostic.code).toBe("target-not-found");
    expect(diagnostic.title).toBe("目标 Endpoint 不存在");
    expect(diagnostic.reason).toContain("404");
    expect(diagnostic.suggestion).toContain("transport");
  });

  it("explains refused connections as stopped services or unreachable container networks", () => {
    const diagnostic = explainConnectionFailure({
      error: new Error("connect ECONNREFUSED 127.0.0.1:3302"),
      connectionType: "proxy",
      transportType: "sse",
      proxyAuthTokenPresent: true,
    });

    expect(diagnostic.code).toBe("connection-refused");
    expect(diagnostic.title).toBe("目标服务无法连接");
    expect(diagnostic.reason).toContain("拒绝连接");
    expect(diagnostic.suggestion).toContain("容器网络");
  });
});
