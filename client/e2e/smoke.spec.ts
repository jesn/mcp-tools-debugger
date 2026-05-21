import { test, expect } from "@playwright/test";

/**
 * 冒烟流程：验证客户端构建产物可以启动，且关键的入口 UI 元素被渲染。
 * 不依赖 MCP 代理或 mock MCP 服务，避免在 E2E 层引入额外基础设施。
 */
test.describe("MCP Tools Debugger 冒烟", () => {
  test("首屏渲染欢迎信息与侧边栏折叠/展开按钮", async ({ page }) => {
    await page.goto("/");

    // 主标题与欢迎信息（断开连接时的占位）
    await expect(
      page.getByText("MCP Tools Debugger", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /open auth debugger/i }),
    ).toBeVisible();

    // 默认显示侧边栏，存在折叠按钮
    const collapseBtn = page.getByRole("button", { name: /collapse sidebar/i });
    await expect(collapseBtn).toBeVisible();

    // 折叠后应显示展开按钮
    await collapseBtn.click();
    await expect(
      page.getByRole("button", { name: /expand sidebar/i }),
    ).toBeVisible();
  });

  test("Connect 按钮在缺少必填项时可见", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: /connect/i }).first(),
    ).toBeVisible();
  });
});
