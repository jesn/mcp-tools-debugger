// Profile 持久化层。
//
// 设计要点：
// 1. 顶层 storage key 用 `mcpDebuggerProfiles_v1`，与现有 `inspectorConfig_v1` 命名风格一致，并预留 schema 升级空间。
// 2. 首次加载时若发现旧的 14 个 last* 字段（来自 Inspector 原始实现），自动迁移成一份名为"默认"的 Profile，
//    避免老用户配置丢失；迁移完成后写入 `mcpDebuggerProfiles_v1_migrated` 标志位防止重复迁移。
// 3. 迁移仅做"读旧 key → 拼装 Profile → 写入新 key"，不主动删除旧 key——保留兜底，便于异常时回滚。

import type {
  ConnectionProfile,
  ProfilesState,
  TransportType,
  ConnectionType,
} from "./types";
import {
  type CustomHeaders,
  migrateFromLegacyAuth,
} from "@/lib/types/customHeaders";

export const PROFILES_STORAGE_KEY = "mcpDebuggerProfiles_v1";
export const PROFILES_MIGRATION_FLAG = "mcpDebuggerProfiles_v1_migrated";

const DEFAULT_PROFILE_NAME = "默认";

// 旧版 localStorage key（来自上游 Inspector 实现），用于一次性迁移。
const LEGACY_KEYS = {
  transportType: "lastTransportType",
  connectionType: "lastConnectionType",
  command: "lastCommand",
  args: "lastArgs",
  sseUrl: "lastSseUrl",
  oauthClientId: "lastOauthClientId",
  oauthClientSecret: "lastOauthClientSecret",
  oauthScope: "lastOauthScope",
  customHeaders: "lastCustomHeaders",
  bearerToken: "lastBearerToken",
  headerName: "lastHeaderName",
} as const;

const isTransportType = (v: unknown): v is TransportType =>
  v === "stdio" || v === "sse" || v === "streamable-http";

const isConnectionType = (v: unknown): v is ConnectionType =>
  v === "direct" || v === "proxy";

const generateId = (): string => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  // 兜底：测试环境若 crypto.randomUUID 不可用，用足够随机的字符串。
  return `profile_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

const now = (): number => Date.now();

/** 创建一份字段全为默认值的 Profile（用于全新用户或新建按钮） */
export const createDefaultProfile = (
  name: string = DEFAULT_PROFILE_NAME,
): ConnectionProfile => {
  const ts = now();
  return {
    id: generateId(),
    name,
    transportType: "stdio",
    connectionType: "proxy",
    command: "mcp-server-everything",
    args: "",
    sseUrl: "http://localhost:3001/sse",
    env: {},
    oauth: { clientId: "", clientSecret: "", scope: "" },
    customHeaders: [{ name: "Authorization", value: "Bearer ", enabled: false }],
    createdAt: ts,
    updatedAt: ts,
  };
};

const readLegacyCustomHeaders = (): CustomHeaders | null => {
  const saved = localStorage.getItem(LEGACY_KEYS.customHeaders);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) return parsed as CustomHeaders;
    } catch {
      // 损坏的数据，走 legacy bearer token 兜底
    }
  }
  const legacyToken = localStorage.getItem(LEGACY_KEYS.bearerToken) || "";
  const legacyHeaderName = localStorage.getItem(LEGACY_KEYS.headerName) || "";
  if (legacyToken) {
    return migrateFromLegacyAuth(legacyToken, legacyHeaderName);
  }
  return null;
};

/** 从旧 localStorage key 构造一份默认 Profile（迁移路径） */
export const migrateFromLegacy = (): ConnectionProfile => {
  const profile = createDefaultProfile();

  const transport = localStorage.getItem(LEGACY_KEYS.transportType);
  if (isTransportType(transport)) profile.transportType = transport;

  const connection = localStorage.getItem(LEGACY_KEYS.connectionType);
  if (isConnectionType(connection)) profile.connectionType = connection;

  const command = localStorage.getItem(LEGACY_KEYS.command);
  if (command) profile.command = command;

  const args = localStorage.getItem(LEGACY_KEYS.args);
  if (args !== null) profile.args = args;

  const sseUrl = localStorage.getItem(LEGACY_KEYS.sseUrl);
  if (sseUrl) profile.sseUrl = sseUrl;

  profile.oauth = {
    clientId: localStorage.getItem(LEGACY_KEYS.oauthClientId) || "",
    clientSecret: localStorage.getItem(LEGACY_KEYS.oauthClientSecret) || "",
    scope: localStorage.getItem(LEGACY_KEYS.oauthScope) || "",
  };

  const customHeaders = readLegacyCustomHeaders();
  if (customHeaders) profile.customHeaders = customHeaders;

  return profile;
};

const isValidProfile = (v: unknown): v is ConnectionProfile => {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    typeof p.name === "string" &&
    isTransportType(p.transportType) &&
    isConnectionType(p.connectionType) &&
    typeof p.command === "string" &&
    typeof p.args === "string" &&
    typeof p.sseUrl === "string" &&
    typeof p.env === "object" &&
    p.env !== null &&
    typeof p.oauth === "object" &&
    p.oauth !== null &&
    Array.isArray(p.customHeaders)
  );
};

const isValidState = (v: unknown): v is ProfilesState => {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  if (typeof s.activeId !== "string") return false;
  if (!s.profiles || typeof s.profiles !== "object") return false;
  const profiles = s.profiles as Record<string, unknown>;
  if (!profiles[s.activeId]) return false;
  return Object.values(profiles).every(isValidProfile);
};

/** 读取持久化状态；不存在/损坏时返回 null 由调用方决定走迁移或新建 */
export const readProfilesState = (): ProfilesState | null => {
  const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (isValidState(parsed)) return parsed;
  } catch {
    // 损坏数据走 null 分支
  }
  return null;
};

/**
 * 加载 Profile 状态：
 * 1. 已有 v1 数据 → 直接返回
 * 2. 未迁移过 → 从旧 last* key 构造默认 Profile 并写入 v1
 * 3. 全新用户 → 创建空白默认 Profile
 */
export const loadProfiles = (): ProfilesState => {
  const existing = readProfilesState();
  if (existing) return existing;

  const migrated = localStorage.getItem(PROFILES_MIGRATION_FLAG) === "true";
  const profile = migrated ? createDefaultProfile() : migrateFromLegacy();
  const state: ProfilesState = {
    activeId: profile.id,
    profiles: { [profile.id]: profile },
  };

  saveProfiles(state);
  if (!migrated) {
    localStorage.setItem(PROFILES_MIGRATION_FLAG, "true");
  }
  return state;
};

/** 持久化整份状态 */
export const saveProfiles = (state: ProfilesState): void => {
  localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(state));
};
