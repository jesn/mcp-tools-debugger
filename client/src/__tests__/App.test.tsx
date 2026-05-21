import { render, screen, fireEvent, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, it, beforeEach, jest } from "@jest/globals";
import { TooltipProvider } from "@/components/ui/tooltip";

// --- Mock useConnection: 提供一个可被测试改写的返回值。 ---
type UseConnectionResult = {
  connectionStatus: string;
  serverCapabilities: { tools?: unknown } | null;
  serverImplementation: unknown;
  mcpClient: unknown;
  connect: jest.Mock;
  disconnect: jest.Mock;
  makeRequest: jest.Mock;
};

const baseConnectionResult: UseConnectionResult = {
  connectionStatus: "disconnected",
  serverCapabilities: null,
  serverImplementation: null,
  mcpClient: null,
  connect: jest.fn(),
  disconnect: jest.fn(),
  makeRequest: jest.fn(),
};

let mockConnectionResult: UseConnectionResult = baseConnectionResult;

jest.mock("../lib/hooks/useConnection", () => ({
  useConnection: () => mockConnectionResult,
}));

// useDraggableSidebar 内部使用 DOM event listener，测试里给一个简单实现避免副作用。
jest.mock("../lib/hooks/useDraggablePane", () => ({
  useDraggableSidebar: () => ({
    width: 320,
    isDragging: false,
    handleDragStart: jest.fn(),
  }),
}));

// 屏蔽 toast，避免 Sidebar 等子组件触发副作用。
jest.mock("@/lib/hooks/useToast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

// SDK auth 模块依赖 pkce-challenge（仅 ESM，jest 环境无法解析），整体打桩。
jest.mock("@modelcontextprotocol/sdk/client/auth.js", () => ({
  auth: jest.fn(),
  discoverAuthorizationServerMetadata: jest.fn(),
  discoverOAuthProtectedResourceMetadata: jest.fn(),
}));

// theme hook
jest.mock("../lib/hooks/useTheme", () => ({
  __esModule: true,
  default: () => ["light", jest.fn()],
}));

// 屏蔽 clipboard
Object.defineProperty(navigator, "clipboard", {
  value: { writeText: jest.fn(() => Promise.resolve()) },
  configurable: true,
});

import App from "../App";

const renderApp = () =>
  render(
    <TooltipProvider>
      <App />
    </TooltipProvider>,
  );

beforeEach(() => {
  mockConnectionResult = { ...baseConnectionResult };
  localStorage.clear();
  // 重置 path 防止上一个 case 残留 /oauth/callback
  window.history.replaceState({}, "", "/");
});

describe("App", () => {
  it("断开连接时渲染欢迎信息与 Open Auth Debugger 按钮", () => {
    renderApp();
    expect(screen.getByText("MCP Tools Debugger")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /open auth debugger/i }),
    ).toBeInTheDocument();
  });

  it("默认显示左侧栏，可折叠/展开", () => {
    renderApp();

    const collapseBtn = screen.getByRole("button", {
      name: /collapse sidebar/i,
    });
    expect(collapseBtn).toBeInTheDocument();

    act(() => {
      fireEvent.click(collapseBtn);
    });

    const expandBtn = screen.getByRole("button", {
      name: /expand sidebar/i,
    });
    expect(expandBtn).toBeInTheDocument();
    expect(localStorage.getItem("sidebarCollapsed")).toBe("true");

    act(() => {
      fireEvent.click(expandBtn);
    });
    expect(
      screen.getByRole("button", { name: /collapse sidebar/i }),
    ).toBeInTheDocument();
    expect(localStorage.getItem("sidebarCollapsed")).toBe("false");
  });

  it("已连接但服务器未声明 tools 能力时给出明确提示", () => {
    mockConnectionResult = {
      ...baseConnectionResult,
      connectionStatus: "connected",
      mcpClient: {} as unknown,
      serverCapabilities: {},
    };
    renderApp();

    expect(
      screen.getByText(/does not advertise/i, { exact: false }),
    ).toBeInTheDocument();
  });

  it("路径为 /oauth/callback 时显示 Loading 占位", () => {
    window.history.replaceState({}, "", "/oauth/callback");
    renderApp();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("旧版 last* localStorage 存在时，挂载后自动迁移到 v1 Profile", () => {
    localStorage.setItem("lastCommand", "python");
    localStorage.setItem("lastArgs", "-m srv");
    localStorage.setItem("lastSseUrl", "https://legacy.example.com/sse");

    renderApp();

    const raw = localStorage.getItem("mcpDebuggerProfiles_v1");
    expect(raw).toBeTruthy();
    const state = JSON.parse(raw as string);
    const profile = state.profiles[state.activeId];
    expect(profile.command).toBe("python");
    expect(profile.args).toBe("-m srv");
    expect(profile.sseUrl).toBe("https://legacy.example.com/sse");
    expect(localStorage.getItem("mcpDebuggerProfiles_v1_migrated")).toBe(
      "true",
    );
  });
});
