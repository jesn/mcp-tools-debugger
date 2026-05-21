import type { JsonValue } from "@/utils/jsonUtils";

/**
 * 参数模板项
 */
export interface ParamTemplate {
  /** 唯一 ID */
  id: string;
  /** 模板名称 */
  name: string;
  /** 所属 Tool 名称 */
  toolName: string;
  /** 参数值 */
  params: Record<string, JsonValue>;
  /** 创建时间戳 */
  createdAt: number;
  /** 最后使用时间戳 */
  lastUsedAt?: number;
  /** 描述（可选） */
  description?: string;
}

/**
 * 参数模板状态
 */
export interface ParamTemplateState {
  /** 模板列表 */
  templates: ParamTemplate[];
}
