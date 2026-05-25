// Profile 持久化层。
//
// 设计要点：
// 1. 顶层 storage key 用 `mcpDebuggerProfiles_v1`，与现有 `inspectorConfig_v1` 命名风格一致，并预留 schema 升级空间。
// 2. 这是新项目的数据模型，不读取上游 Inspector 的 last* 旧缓存，避免过期配置污染当前 Profile。

import type {
  ConnectionProfile,
  ProfilesState,
  TransportType,
  ConnectionType,
} from "./types";

export const PROFILES_STORAGE_KEY = "mcpDebuggerProfiles_v1";

const DEFAULT_PROFILE_NAME = "默认";

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
    customHeaders: [
      { name: "Authorization", value: "Bearer ", enabled: false },
    ],
    createdAt: ts,
    updatedAt: ts,
  };
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

/** 读取持久化状态；不存在/损坏时返回 null 由调用方创建默认 Profile */
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
 * 2. 无 v1 数据或数据损坏 → 创建默认 Profile 并写入 v1
 */
export const loadProfiles = (): ProfilesState => {
  const existing = readProfilesState();
  if (existing) return existing;

  const profile = createDefaultProfile();
  const state: ProfilesState = {
    activeId: profile.id,
    profiles: { [profile.id]: profile },
  };

  saveProfiles(state);
  return state;
};

/** 持久化整份状态 */
export const saveProfiles = (state: ProfilesState): void => {
  localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(state));
};
