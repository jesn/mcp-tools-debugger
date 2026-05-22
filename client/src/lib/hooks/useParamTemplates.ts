import { useState, useCallback, useEffect } from "react";
import type { ParamTemplate, ParamTemplateState } from "../types/paramTemplate";
import type { JsonValue } from "@/utils/jsonUtils";

const STORAGE_KEY = "mcp-inspector-param-templates";

/**
 * 从 localStorage 加载模板
 */
const loadTemplates = (): ParamTemplate[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error("Failed to load param templates:", error);
    return [];
  }
};

/**
 * 保存模板到 localStorage
 */
const saveTemplates = (templates: ParamTemplate[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch (error) {
    console.error("Failed to save param templates:", error);
  }
};

/**
 * 参数模板管理 Hook
 */
export const useParamTemplates = () => {
  const [state, setState] = useState<ParamTemplateState>(() => ({
    templates: loadTemplates(),
  }));

  // 自动保存到 localStorage
  useEffect(() => {
    saveTemplates(state.templates);
  }, [state.templates]);

  /**
   * 创建新模板
   */
  const createTemplate = useCallback(
    (
      name: string,
      toolName: string,
      params: Record<string, JsonValue>,
      description?: string,
    ) => {
      const template: ParamTemplate = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        toolName,
        params,
        createdAt: Date.now(),
        usageCount: 0,
        description,
      };

      setState((prev) => ({
        templates: [...prev.templates, template],
      }));

      return template;
    },
    [],
  );

  /**
   * 更新模板
   */
  const updateTemplate = useCallback(
    (
      id: string,
      updates: Partial<Omit<ParamTemplate, "id" | "toolName" | "createdAt">>,
    ) => {
      setState((prev) => ({
        templates: prev.templates.map((t) =>
          t.id === id ? { ...t, ...updates } : t,
        ),
      }));
    },
    [],
  );

  /**
   * 删除模板
   */
  const deleteTemplate = useCallback((id: string) => {
    setState((prev) => ({
      templates: prev.templates.filter((t) => t.id !== id),
    }));
  }, []);

  /**
   * 获取指定 Tool 的所有模板
   */
  const getTemplatesForTool = useCallback(
    (toolName: string): ParamTemplate[] => {
      return state.templates.filter((t) => t.toolName === toolName);
    },
    [state.templates],
  );

  /**
   * 使用模板（更新最后使用时间和使用次数）
   */
  const useTemplate = useCallback((id: string) => {
    setState((prev) => ({
      templates: prev.templates.map((t) =>
        t.id === id
          ? {
              ...t,
              lastUsedAt: Date.now(),
              usageCount: (t.usageCount ?? 0) + 1,
            }
          : t,
      ),
    }));
  }, []);

  /**
   * 清空所有模板
   */
  const clearAllTemplates = useCallback(() => {
    setState({ templates: [] });
  }, []);

  return {
    templates: state.templates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    getTemplatesForTool,
    useTemplate,
    clearAllTemplates,
  };
};
