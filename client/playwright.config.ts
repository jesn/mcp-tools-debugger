import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright 配置：仅运行最小冒烟流程，覆盖客户端构建产物可启动且关键 UI 元素渲染。
 *
 * 注：未在 webServer 中起 MCP 代理与 mock MCP server，因此当前用例不验证“连接 -> 调用工具”
 * 的端到端链路；后续如需 happy-path E2E，可在 globalSetup 中拉起 server + 一个 mock streamable-http 服务。
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:6275",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run build && npx vite preview --port 6275 --strictPort",
    url: "http://127.0.0.1:6275",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
