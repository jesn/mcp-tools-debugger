import type { CompatibilityCallToolResult } from "@modelcontextprotocol/sdk/types.js";

/**
 * Tool 调用历史记录项
 */
export interface ToolHistoryEntry {
  /** 唯一 ID */
  id: string;
  /** Tool 名称 */
  toolName: string;
  /** 调用参数 */
  params: Record<string, unknown>;
  /** 调用结果 */
  result: CompatibilityCallToolResult;
  /** 调用时间戳 */
  timestamp: number;
  /** 元数据（可选） */
  metadata?: Record<string, unknown>;
  /** 是否成功 */
  isSuccess: boolean;
  /** 执行耗时（毫秒） */
  duration?: number;
}

/**
 * Tool 调用历史状态
 */
export interface ToolHistoryState {
  /** 历史记录列表 */
  entries: ToolHistoryEntry[];
  /** 最大保存数量 */
  maxEntries: number;
}
