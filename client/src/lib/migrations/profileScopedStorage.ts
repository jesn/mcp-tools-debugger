// 一次性数据迁移：将早期版本中按全局 key 存储的"调用历史/参数模板"
// 迁移到当前 Profile 命名空间，迁移完成后写入 MIGRATION_FLAG 防止重复执行
const MIGRATION_FLAG = "mcp-inspector-profile-scoped-migration-done";

interface MigrationEntry {
  /** 旧的全局 key */
  oldKey: string;
  /** 新 key 的前缀，新 key = `${prefix}-${profileId}` */
  prefix: string;
}

const ENTRIES: MigrationEntry[] = [
  {
    oldKey: "mcp-inspector-tool-history",
    prefix: "mcp-inspector-tool-history",
  },
  {
    oldKey: "mcp-inspector-param-templates",
    prefix: "mcp-inspector-param-templates",
  },
];

/**
 * 将早期全局存储的数据迁移到指定 profile 的命名空间。
 * 仅在目标 key 不存在数据时迁移，避免覆盖现有数据。
 */
export function migrateGlobalStorageToProfile(profileId: string): void {
  if (!profileId) return;
  if (localStorage.getItem(MIGRATION_FLAG) === "true") return;

  for (const { oldKey, prefix } of ENTRIES) {
    const oldData = localStorage.getItem(oldKey);
    if (!oldData) continue;

    const newKey = `${prefix}-${profileId}`;
    if (!localStorage.getItem(newKey)) {
      localStorage.setItem(newKey, oldData);
    }
    localStorage.removeItem(oldKey);
  }

  localStorage.setItem(MIGRATION_FLAG, "true");
}
