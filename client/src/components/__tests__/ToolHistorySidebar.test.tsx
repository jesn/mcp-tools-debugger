import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, it, expect, jest } from "@jest/globals";
import ToolHistorySidebar from "../ToolHistorySidebar";
import type { ToolHistoryEntry } from "@/lib/types/toolHistory";
import type { CompatibilityCallToolResult } from "@modelcontextprotocol/sdk/types.js";

const createMockEntry = (
  toolName: string,
  isSuccess: boolean,
): ToolHistoryEntry => ({
  id: `${toolName}-${Date.now()}`,
  toolName,
  params: { query: "test" },
  result: {
    content: [{ type: "text", text: isSuccess ? "success" : "error" }],
    isError: !isSuccess,
  } as CompatibilityCallToolResult,
  timestamp: Date.now(),
  isSuccess,
  duration: 100,
});

describe("ToolHistorySidebar", () => {
  it("显示历史记录数量", () => {
    const entries = [
      createMockEntry("tool1", true),
      createMockEntry("tool2", true),
    ];

    render(
      <ToolHistorySidebar
        entries={entries}
        onClearHistory={jest.fn()}
        onDeleteEntry={jest.fn()}
        onExportHistory={jest.fn()}
        onReplay={jest.fn()}
      />,
    );

    expect(screen.getByText(/调用历史 \(2\)/)).toBeInTheDocument();
  });

  it("空历史时显示提示", () => {
    render(
      <ToolHistorySidebar
        entries={[]}
        onClearHistory={jest.fn()}
        onDeleteEntry={jest.fn()}
        onExportHistory={jest.fn()}
        onReplay={jest.fn()}
      />,
    );

    const trigger = screen.getByText(/调用历史 \(0\)/);
    fireEvent.click(trigger);

    expect(screen.getByText("暂无调用历史")).toBeInTheDocument();
  });

  it("显示成功和失败的图标", () => {
    const entries = [
      createMockEntry("success-tool", true),
      createMockEntry("error-tool", false),
    ];

    render(
      <ToolHistorySidebar
        entries={entries}
        onClearHistory={jest.fn()}
        onDeleteEntry={jest.fn()}
        onExportHistory={jest.fn()}
        onReplay={jest.fn()}
      />,
    );

    const trigger = screen.getByText(/调用历史/);
    fireEvent.click(trigger);

    expect(screen.getByText("success-tool")).toBeInTheDocument();
    expect(screen.getByText("error-tool")).toBeInTheDocument();
  });

  it("点击清空历史按钮", () => {
    const onClearHistory = jest.fn();
    const entries = [createMockEntry("tool1", true)];

    render(
      <ToolHistorySidebar
        entries={entries}
        onClearHistory={onClearHistory}
        onDeleteEntry={jest.fn()}
        onExportHistory={jest.fn()}
        onReplay={jest.fn()}
      />,
    );

    const trigger = screen.getByText(/调用历史/);
    fireEvent.click(trigger);

    const clearBtn = screen.getByText("清空历史");
    // 点击打开确认对话框
    fireEvent.click(clearBtn);
    expect(onClearHistory).not.toHaveBeenCalled();

    // 在对话框中点击确认按钮
    const confirmBtn = screen.getByRole("button", { name: "清空" });
    fireEvent.click(confirmBtn);
    expect(onClearHistory).toHaveBeenCalled();
  });

  it("点击导出按钮", () => {
    const onExportHistory = jest.fn();
    const entries = [createMockEntry("tool1", true)];

    render(
      <ToolHistorySidebar
        entries={entries}
        onClearHistory={jest.fn()}
        onDeleteEntry={jest.fn()}
        onExportHistory={onExportHistory}
        onReplay={jest.fn()}
      />,
    );

    const trigger = screen.getByText(/调用历史/);
    fireEvent.click(trigger);

    const exportBtn = screen.getByText("导出 JSON");
    fireEvent.click(exportBtn);

    expect(onExportHistory).toHaveBeenCalled();
  });

  it("点击删除单条记录", () => {
    const onDeleteEntry = jest.fn();
    const entry = createMockEntry("tool1", true);

    render(
      <ToolHistorySidebar
        entries={[entry]}
        onClearHistory={jest.fn()}
        onDeleteEntry={onDeleteEntry}
        onExportHistory={jest.fn()}
        onReplay={jest.fn()}
      />,
    );

    const trigger = screen.getByText(/调用历史/);
    fireEvent.click(trigger);

    const deleteButtons = screen.getAllByTitle("删除此记录");
    // 点击打开确认对话框
    fireEvent.click(deleteButtons[0]);
    expect(onDeleteEntry).not.toHaveBeenCalled();

    // 在对话框中点击确认按钮
    const confirmButton = screen.getByRole("button", { name: "删除" });
    fireEvent.click(confirmButton);
    expect(onDeleteEntry).toHaveBeenCalledWith(entry.id);
  });

  it("点击回放按钮", () => {
    const onReplay = jest.fn();
    const entry = createMockEntry("tool1", true);

    render(
      <ToolHistorySidebar
        entries={[entry]}
        onClearHistory={jest.fn()}
        onDeleteEntry={jest.fn()}
        onExportHistory={jest.fn()}
        onReplay={onReplay}
      />,
    );

    const trigger = screen.getByText(/调用历史/);
    fireEvent.click(trigger);

    const replayButtons = screen.getAllByTitle("回放此调用");
    fireEvent.click(replayButtons[0]);

    expect(onReplay).toHaveBeenCalledWith(entry);
  });

  it("展开和收起详情", () => {
    const entry = createMockEntry("tool1", true);

    render(
      <ToolHistorySidebar
        entries={[entry]}
        onClearHistory={jest.fn()}
        onDeleteEntry={jest.fn()}
        onExportHistory={jest.fn()}
        onReplay={jest.fn()}
      />,
    );

    const trigger = screen.getByText(/调用历史/);
    fireEvent.click(trigger);

    const expandBtn = screen.getByText("展开详情");
    fireEvent.click(expandBtn);

    expect(screen.getByText("参数:")).toBeInTheDocument();
    expect(screen.getByText("结果:")).toBeInTheDocument();

    const collapseBtn = screen.getByText("收起详情");
    fireEvent.click(collapseBtn);

    expect(screen.queryByText("参数:")).not.toBeInTheDocument();
  });

  it("空历史时禁用清空和导出按钮", () => {
    render(
      <ToolHistorySidebar
        entries={[]}
        onClearHistory={jest.fn()}
        onDeleteEntry={jest.fn()}
        onExportHistory={jest.fn()}
        onReplay={jest.fn()}
      />,
    );

    const trigger = screen.getByText(/调用历史/);
    fireEvent.click(trigger);

    const clearBtn = screen.getByText("清空历史");
    const exportBtn = screen.getByText("导出 JSON");

    expect(clearBtn).toBeDisabled();
    expect(exportBtn).toBeDisabled();
  });
});
