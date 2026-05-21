import { useState, useCallback, useEffect } from "react";
import type { ToolHistoryEntry, ToolHistoryState } from "../types/toolHistory";
import type { CompatibilityCallToolResult } from "@modelcontextprotocol/sdk/types.js";

const MAX_HISTORY_ENTRIES = 100;
const STORAGE_KEY = "mcp-inspector-tool-history";

/**
 * 从 localStorage 加载历史记录
 */
const loadHistory = (): ToolHistoryEntry[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error("Failed to load tool history:", error);
    return [];
  }
};

/**
 * 保存历史记录到 localStorage
 */
const saveHistory = (entries: ToolHistoryEntry[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.error("Failed to save tool history:", error);
  }
};

/**
 * Tool 调用历史管理 Hook
 */
export const useToolHistory = () => {
  const [state, setState] = useState<ToolHistoryState>(() => ({
    entries: loadHistory(),
    maxEntries: MAX_HISTORY_ENTRIES,
  }));

  // 自动保存到 localStorage
  useEffect(() => {
    saveHistory(state.entries);
  }, [state.entries]);

  /**
   * 添加历史记录
   */
  const addEntry = useCallback(
    (
      toolName: string,
      params: Record<string, unknown>,
      result: CompatibilityCallToolResult,
      metadata?: Record<string, unknown>,
      duration?: number,
    ) => {
      const entry: ToolHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        toolName,
        params,
        result,
        timestamp: Date.now(),
        metadata,
        isSuccess: !result.isError,
        duration,
      };

      setState((prev) => {
        const newEntries = [entry, ...prev.entries];
        // 保持最大数量限制
        if (newEntries.length > prev.maxEntries) {
          newEntries.pop();
        }
        return { ...prev, entries: newEntries };
      });
    },
    [],
  );

  /**
   * 清空历史记录
   */
  const clearHistory = useCallback(() => {
    setState((prev) => ({ ...prev, entries: [] }));
  }, []);

  /**
   * 删除单条记录
   */
  const deleteEntry = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      entries: prev.entries.filter((e) => e.id !== id),
    }));
  }, []);

  /**
   * 导出历史记录为 JSON
   */
  const exportHistory = useCallback(() => {
    const data = JSON.stringify(state.entries, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tool-history-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [state.entries]);

  return {
    entries: state.entries,
    addEntry,
    clearHistory,
    deleteEntry,
    exportHistory,
  };
};
