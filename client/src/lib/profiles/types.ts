// 连接配置实体（Profile）相关类型。
//
// 将原本散落在 App.tsx 中的 14 个 useState（command/args/sseUrl/transportType/connectionType/env/oauth*/customHeaders）
// 聚合成一个明确的"连接配置实体"，为后续多 Profile、调用历史、参数模板、链接分享等功能提供统一的数据载体。

import type { CustomHeaders } from "@/lib/types/customHeaders";

export type TransportType = "stdio" | "sse" | "streamable-http";
export type ConnectionType = "direct" | "proxy";

/** OAuth 客户端凭据 */
export interface ProfileOAuth {
  clientId: string;
  clientSecret: string;
  scope: string;
}

/** 连接配置实体：一份完整的、可命名的、可持久化的连接参数集合 */
export interface ConnectionProfile {
  id: string;
  name: string;
  transportType: TransportType;
  connectionType: ConnectionType;
  command: string;
  args: string;
  sseUrl: string;
  env: Record<string, string>;
  oauth: ProfileOAuth;
  customHeaders: CustomHeaders;
  createdAt: number;
  updatedAt: number;
}

/** 持久化在 localStorage 中的多 Profile 状态 schema（v1） */
export interface ProfilesState {
  activeId: string;
  profiles: Record<string, ConnectionProfile>;
}

/** 用于 updateActiveProfile 的部分更新；id/createdAt 不允许直接覆盖 */
export type ConnectionProfilePatch = Partial<
  Omit<ConnectionProfile, "id" | "createdAt" | "updatedAt">
>;
