import { useState, useCallback, useEffect, useRef } from "react";
import type { ToolHistoryEntry, ToolHistoryState } from "../types/toolHistory";
import type { CompatibilityCallToolResult } from "@modelcontextprotocol/sdk/types.js";

const MAX_HISTORY_ENTRIES = 100;
const STORAGE_KEY_PREFIX = "mcp-inspector-tool-history";

// 每个 Profile 独立存储 key，未指定时回落到 default 命名空间，保持向下兼容
const getStorageKey = (profileId?: string): string =>
  `${STORAGE_KEY_PREFIX}-${profileId ?? "default"}`;

const loadHistory = (profileId?: string): ToolHistoryEntry[] => {
  try {
    const stored = localStorage.getItem(getStorageKey(profileId));
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error("Failed to load tool history:", error);
    return [];
  }
};

const saveHistory = (entries: ToolHistoryEntry[], profileId?: string) => {
  try {
    localStorage.setItem(getStorageKey(profileId), JSON.stringify(entries));
  } catch (error) {
    console.error("Failed to save tool history:", error);
  }
};

/**
 * Tool 调用历史管理 Hook（按 Profile 隔离存储）
 */
export const useToolHistory = (profileId?: string) => {
  const [state, setState] = useState<ToolHistoryState>(() => ({
    entries: loadHistory(profileId),
    maxEntries: MAX_HISTORY_ENTRIES,
  }));

  // 切换 Profile：重新加载对应命名空间的历史
  const profileIdRef = useRef(profileId);
  useEffect(() => {
    if (profileIdRef.current === profileId) return;
    profileIdRef.current = profileId;
    setState({
      entries: loadHistory(profileId),
      maxEntries: MAX_HISTORY_ENTRIES,
    });
  }, [profileId]);

  // 持久化辅助：避免 useEffect 在 profileId 切换瞬间将旧数据写入新 key
  const persistAndSet = useCallback(
    (updater: (prev: ToolHistoryState) => ToolHistoryState) => {
      setState((prev) => {
        const next = updater(prev);
        saveHistory(next.entries, profileIdRef.current);
        return next;
      });
    },
    [],
  );

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

      persistAndSet((prev) => {
        const newEntries = [entry, ...prev.entries];
        if (newEntries.length > prev.maxEntries) {
          newEntries.pop();
        }
        return { ...prev, entries: newEntries };
      });
    },
    [persistAndSet],
  );

  const clearHistory = useCallback(() => {
    persistAndSet((prev) => ({ ...prev, entries: [] }));
  }, [persistAndSet]);

  const deleteEntry = useCallback(
    (id: string) => {
      persistAndSet((prev) => ({
        ...prev,
        entries: prev.entries.filter((e) => e.id !== id),
      }));
    },
    [persistAndSet],
  );

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
