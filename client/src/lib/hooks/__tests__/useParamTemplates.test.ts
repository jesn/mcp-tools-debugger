import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { useParamTemplates } from "../useParamTemplates";

describe("useParamTemplates", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("初始状态为空", () => {
    const { result } = renderHook(() => useParamTemplates());
    expect(result.current.templates).toEqual([]);
  });

  it("创建模板", () => {
    const { result } = renderHook(() => useParamTemplates());

    act(() => {
      result.current.createTemplate(
        "测试模板",
        "test-tool",
        { query: "test" },
        "测试描述",
      );
    });

    expect(result.current.templates).toHaveLength(1);
    expect(result.current.templates[0].name).toBe("测试模板");
    expect(result.current.templates[0].toolName).toBe("test-tool");
    expect(result.current.templates[0].params).toEqual({ query: "test" });
    expect(result.current.templates[0].description).toBe("测试描述");
  });

  it("更新模板", () => {
    const { result } = renderHook(() => useParamTemplates());

    let templateId: string;

    act(() => {
      const template = result.current.createTemplate(
        "原始名称",
        "test-tool",
        {},
      );
      templateId = template.id;
    });

    act(() => {
      result.current.updateTemplate(templateId, {
        name: "新名称",
        description: "新描述",
      });
    });

    expect(result.current.templates[0].name).toBe("新名称");
    expect(result.current.templates[0].description).toBe("新描述");
  });

  it("删除模板", () => {
    const { result } = renderHook(() => useParamTemplates());

    let templateId: string;

    act(() => {
      const template = result.current.createTemplate(
        "测试模板",
        "test-tool",
        {},
      );
      templateId = template.id;
    });

    expect(result.current.templates).toHaveLength(1);

    act(() => {
      result.current.deleteTemplate(templateId);
    });

    expect(result.current.templates).toHaveLength(0);
  });

  it("获取指定 Tool 的模板", () => {
    const { result } = renderHook(() => useParamTemplates());

    act(() => {
      result.current.createTemplate("模板1", "tool-a", {});
      result.current.createTemplate("模板2", "tool-b", {});
      result.current.createTemplate("模板3", "tool-a", {});
    });

    const toolATemplates = result.current.getTemplatesForTool("tool-a");
    expect(toolATemplates).toHaveLength(2);
    expect(toolATemplates[0].name).toBe("模板1");
    expect(toolATemplates[1].name).toBe("模板3");
  });

  it("使用模板更新最后使用时间", () => {
    const { result } = renderHook(() => useParamTemplates());

    let templateId: string;

    act(() => {
      const template = result.current.createTemplate(
        "测试模板",
        "test-tool",
        {},
      );
      templateId = template.id;
    });

    expect(result.current.templates[0].lastUsedAt).toBeUndefined();

    act(() => {
      result.current.useTemplate(templateId);
    });

    expect(result.current.templates[0].lastUsedAt).toBeDefined();
    expect(result.current.templates[0].lastUsedAt).toBeGreaterThan(0);
  });

  it("使用模板时累加使用次数", () => {
    const { result } = renderHook(() => useParamTemplates());

    let templateId: string;

    act(() => {
      const template = result.current.createTemplate(
        "计数模板",
        "test-tool",
        {},
      );
      templateId = template.id;
    });

    expect(result.current.templates[0].usageCount).toBe(0);

    act(() => {
      result.current.useTemplate(templateId);
    });
    expect(result.current.templates[0].usageCount).toBe(1);

    act(() => {
      result.current.useTemplate(templateId);
      result.current.useTemplate(templateId);
    });
    expect(result.current.templates[0].usageCount).toBe(3);
  });

  it("清空所有模板", () => {
    const { result } = renderHook(() => useParamTemplates());

    act(() => {
      result.current.createTemplate("模板1", "tool-a", {});
      result.current.createTemplate("模板2", "tool-b", {});
    });

    expect(result.current.templates).toHaveLength(2);

    act(() => {
      result.current.clearAllTemplates();
    });

    expect(result.current.templates).toEqual([]);
  });

  it("持久化到 localStorage", () => {
    const { result } = renderHook(() => useParamTemplates());

    act(() => {
      result.current.createTemplate("测试模板", "test-tool", { key: "value" });
    });

    // 重新创建 hook，应该从 localStorage 加载
    const { result: result2 } = renderHook(() => useParamTemplates());

    expect(result2.current.templates).toHaveLength(1);
    expect(result2.current.templates[0].name).toBe("测试模板");
    expect(result2.current.templates[0].params).toEqual({ key: "value" });
  });

  it("生成唯一 ID", () => {
    const { result } = renderHook(() => useParamTemplates());

    act(() => {
      result.current.createTemplate("模板1", "tool-a", {});
      result.current.createTemplate("模板2", "tool-a", {});
    });

    const ids = result.current.templates.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});
