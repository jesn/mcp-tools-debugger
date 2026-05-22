import { useState, useCallback, useEffect, useRef } from "react";
import type { ParamTemplate, ParamTemplateState } from "../types/paramTemplate";
import type { JsonValue } from "@/utils/jsonUtils";

const STORAGE_KEY_PREFIX = "mcp-inspector-param-templates";

// 每个 Profile 独立存储 key
const getStorageKey = (profileId?: string): string =>
  `${STORAGE_KEY_PREFIX}-${profileId ?? "default"}`;

const loadTemplates = (profileId?: string): ParamTemplate[] => {
  try {
    const stored = localStorage.getItem(getStorageKey(profileId));
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error("Failed to load param templates:", error);
    return [];
  }
};

const saveTemplates = (templates: ParamTemplate[], profileId?: string) => {
  try {
    localStorage.setItem(
      getStorageKey(profileId),
      JSON.stringify(templates),
    );
  } catch (error) {
    console.error("Failed to save param templates:", error);
  }
};

/**
 * 参数模板管理 Hook（按 Profile 隔离存储）
 */
export const useParamTemplates = (profileId?: string) => {
  const [state, setState] = useState<ParamTemplateState>(() => ({
    templates: loadTemplates(profileId),
  }));

  // 切换 Profile：重新加载对应命名空间的模板
  const profileIdRef = useRef(profileId);
  useEffect(() => {
    if (profileIdRef.current === profileId) return;
    profileIdRef.current = profileId;
    setState({ templates: loadTemplates(profileId) });
  }, [profileId]);

  // 持久化辅助：避免 useEffect 在 profileId 切换瞬间将旧数据写入新 key
  const persistAndSet = useCallback(
    (updater: (prev: ParamTemplateState) => ParamTemplateState) => {
      setState((prev) => {
        const next = updater(prev);
        saveTemplates(next.templates, profileIdRef.current);
        return next;
      });
    },
    [],
  );

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

      persistAndSet((prev) => ({
        templates: [...prev.templates, template],
      }));

      return template;
    },
    [persistAndSet],
  );

  const updateTemplate = useCallback(
    (
      id: string,
      updates: Partial<Omit<ParamTemplate, "id" | "toolName" | "createdAt">>,
    ) => {
      persistAndSet((prev) => ({
        templates: prev.templates.map((t) =>
          t.id === id ? { ...t, ...updates } : t,
        ),
      }));
    },
    [persistAndSet],
  );

  const deleteTemplate = useCallback(
    (id: string) => {
      persistAndSet((prev) => ({
        templates: prev.templates.filter((t) => t.id !== id),
      }));
    },
    [persistAndSet],
  );

  const getTemplatesForTool = useCallback(
    (toolName: string): ParamTemplate[] => {
      return state.templates.filter((t) => t.toolName === toolName);
    },
    [state.templates],
  );

  const useTemplate = useCallback(
    (id: string) => {
      persistAndSet((prev) => ({
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
    },
    [persistAndSet],
  );

  const clearAllTemplates = useCallback(() => {
    persistAndSet(() => ({ templates: [] }));
  }, [persistAndSet]);

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
