import { migrateGlobalStorageToProfile } from "../profileScopedStorage";

const MIGRATION_FLAG = "mcp-inspector-profile-scoped-migration-done";

describe("migrateGlobalStorageToProfile", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("把旧全局 key 数据迁移到指定 profile 命名空间", () => {
    const historyData = JSON.stringify([{ id: "h1", toolName: "search" }]);
    const templateData = JSON.stringify([{ id: "t1", name: "示例" }]);
    localStorage.setItem("mcp-inspector-tool-history", historyData);
    localStorage.setItem("mcp-inspector-param-templates", templateData);

    migrateGlobalStorageToProfile("profile-A");

    expect(localStorage.getItem("mcp-inspector-tool-history-profile-A")).toBe(
      historyData,
    );
    expect(
      localStorage.getItem("mcp-inspector-param-templates-profile-A"),
    ).toBe(templateData);
    expect(localStorage.getItem("mcp-inspector-tool-history")).toBeNull();
    expect(localStorage.getItem("mcp-inspector-param-templates")).toBeNull();
    expect(localStorage.getItem(MIGRATION_FLAG)).toBe("true");
  });

  it("已迁移过的不再重复执行", () => {
    localStorage.setItem(MIGRATION_FLAG, "true");
    localStorage.setItem(
      "mcp-inspector-tool-history",
      JSON.stringify([{ id: "should-not-move" }]),
    );

    migrateGlobalStorageToProfile("profile-A");

    expect(localStorage.getItem("mcp-inspector-tool-history-profile-A")).toBeNull();
    expect(localStorage.getItem("mcp-inspector-tool-history")).not.toBeNull();
  });

  it("目标 key 已有数据时不覆盖，但仍清理旧 key", () => {
    const existingData = JSON.stringify([{ id: "existing" }]);
    const oldData = JSON.stringify([{ id: "old" }]);
    localStorage.setItem("mcp-inspector-tool-history-profile-A", existingData);
    localStorage.setItem("mcp-inspector-tool-history", oldData);

    migrateGlobalStorageToProfile("profile-A");

    expect(localStorage.getItem("mcp-inspector-tool-history-profile-A")).toBe(
      existingData,
    );
    expect(localStorage.getItem("mcp-inspector-tool-history")).toBeNull();
  });

  it("profileId 为空字符串时跳过", () => {
    localStorage.setItem(
      "mcp-inspector-tool-history",
      JSON.stringify([{ id: "x" }]),
    );

    migrateGlobalStorageToProfile("");

    expect(localStorage.getItem("mcp-inspector-tool-history")).not.toBeNull();
    expect(localStorage.getItem(MIGRATION_FLAG)).toBeNull();
  });

  it("没有旧数据时直接标记完成", () => {
    migrateGlobalStorageToProfile("profile-A");
    expect(localStorage.getItem(MIGRATION_FLAG)).toBe("true");
  });
});
