import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "@jest/globals";
import { useToolHistory } from "../useToolHistory";
import type { CompatibilityCallToolResult } from "@modelcontextprotocol/sdk/types.js";

describe("useToolHistory", () => {
  beforeEach(() => {
    // 清理 localStorage
    localStorage.clear();
  });

  it("初始状态为空", () => {
    const { result } = renderHook(() => useToolHistory());
    expect(result.current.entries).toEqual([]);
  });

  it("添加历史记录", () => {
    const { result } = renderHook(() => useToolHistory());

    const params = { query: "test" };
    const toolResult: CompatibilityCallToolResult = {
      content: [{ type: "text", text: "result" }],
      isError: false,
    };

    act(() => {
      result.current.addEntry("test-tool", params, toolResult, undefined, 100);
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].toolName).toBe("test-tool");
    expect(result.current.entries[0].params).toEqual(params);
    expect(result.current.entries[0].result).toEqual(toolResult);
    expect(result.current.entries[0].isSuccess).toBe(true);
    expect(result.current.entries[0].duration).toBe(100);
  });

  it("添加错误结果", () => {
    const { result } = renderHook(() => useToolHistory());

    const errorResult: CompatibilityCallToolResult = {
      content: [{ type: "text", text: "error" }],
      isError: true,
    };

    act(() => {
      result.current.addEntry("test-tool", {}, errorResult);
    });

    expect(result.current.entries[0].isSuccess).toBe(false);
  });

  it("新记录添加到列表开头", () => {
    const { result } = renderHook(() => useToolHistory());

    const result1: CompatibilityCallToolResult = {
      content: [{ type: "text", text: "result1" }],
      isError: false,
    };
    const result2: CompatibilityCallToolResult = {
      content: [{ type: "text", text: "result2" }],
      isError: false,
    };

    act(() => {
      result.current.addEntry("tool1", {}, result1);
    });

    act(() => {
      result.current.addEntry("tool2", {}, result2);
    });

    expect(result.current.entries).toHaveLength(2);
    expect(result.current.entries[0].toolName).toBe("tool2");
    expect(result.current.entries[1].toolName).toBe("tool1");
  });

  it("清空历史记录", () => {
    const { result } = renderHook(() => useToolHistory());

    const toolResult: CompatibilityCallToolResult = {
      content: [{ type: "text", text: "result" }],
      isError: false,
    };

    act(() => {
      result.current.addEntry("test-tool", {}, toolResult);
    });

    expect(result.current.entries).toHaveLength(1);

    act(() => {
      result.current.clearHistory();
    });

    expect(result.current.entries).toEqual([]);
  });

  it("删除单条记录", () => {
    const { result } = renderHook(() => useToolHistory());

    const toolResult: CompatibilityCallToolResult = {
      content: [{ type: "text", text: "result" }],
      isError: false,
    };

    act(() => {
      result.current.addEntry("tool1", {}, toolResult);
      result.current.addEntry("tool2", {}, toolResult);
    });

    expect(result.current.entries).toHaveLength(2);

    const idToDelete = result.current.entries[0].id;

    act(() => {
      result.current.deleteEntry(idToDelete);
    });

    expect(result.current.entries).toHaveLength(1);
    expect(result.current.entries[0].id).not.toBe(idToDelete);
  });

  it("保持最大数量限制", () => {
    const { result } = renderHook(() => useToolHistory());

    const toolResult: CompatibilityCallToolResult = {
      content: [{ type: "text", text: "result" }],
      isError: false,
    };

    // 添加 101 条记录（超过最大限制 100）
    act(() => {
      for (let i = 0; i < 101; i++) {
        result.current.addEntry(`tool-${i}`, {}, toolResult);
      }
    });

    // 应该只保留最新的 100 条
    expect(result.current.entries).toHaveLength(100);
    expect(result.current.entries[0].toolName).toBe("tool-100");
    expect(result.current.entries[99].toolName).toBe("tool-1");
  });

  it("生成唯一 ID", () => {
    const { result } = renderHook(() => useToolHistory());

    const toolResult: CompatibilityCallToolResult = {
      content: [{ type: "text", text: "result" }],
      isError: false,
    };

    act(() => {
      result.current.addEntry("tool1", {}, toolResult);
      result.current.addEntry("tool2", {}, toolResult);
    });

    const ids = result.current.entries.map((e) => e.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("记录时间戳", () => {
    const { result } = renderHook(() => useToolHistory());

    const toolResult: CompatibilityCallToolResult = {
      content: [{ type: "text", text: "result" }],
      isError: false,
    };

    const beforeTime = Date.now();

    act(() => {
      result.current.addEntry("test-tool", {}, toolResult);
    });

    const afterTime = Date.now();

    expect(result.current.entries[0].timestamp).toBeGreaterThanOrEqual(
      beforeTime,
    );
    expect(result.current.entries[0].timestamp).toBeLessThanOrEqual(afterTime);
  });
});
