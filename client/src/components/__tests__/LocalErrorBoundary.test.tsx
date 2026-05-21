import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { describe, it, expect } from "@jest/globals";
import { LocalErrorBoundary } from "../LocalErrorBoundary";
import { useState } from "react";

const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error("测试错误");
  }
  return <div>正常内容</div>;
};

const TestWrapper = () => {
  const [shouldThrow, setShouldThrow] = useState(true);
  return (
    <div>
      <button onClick={() => setShouldThrow(false)}>修复错误</button>
      <LocalErrorBoundary area="测试区域">
        <ThrowError shouldThrow={shouldThrow} />
      </LocalErrorBoundary>
    </div>
  );
};

describe("LocalErrorBoundary", () => {
  it("正常渲染子组件", () => {
    render(
      <LocalErrorBoundary area="测试区域">
        <ThrowError shouldThrow={false} />
      </LocalErrorBoundary>,
    );
    expect(screen.getByText("正常内容")).toBeInTheDocument();
  });

  it("捕获错误并显示错误 UI", () => {
    // 抑制 console.error 输出
    const consoleError = console.error;
    console.error = () => {};

    render(
      <LocalErrorBoundary area="测试区域">
        <ThrowError shouldThrow={true} />
      </LocalErrorBoundary>,
    );

    expect(screen.getByText("测试区域 出错了")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();

    console.error = consoleError;
  });

  it("显示自定义错误消息", () => {
    const consoleError = console.error;
    console.error = () => {};

    render(
      <LocalErrorBoundary area="测试区域" customMessage="自定义提示信息">
        <ThrowError shouldThrow={true} />
      </LocalErrorBoundary>,
    );

    expect(screen.getByText("自定义提示信息")).toBeInTheDocument();

    console.error = consoleError;
  });

  it("显示默认错误消息", () => {
    const consoleError = console.error;
    console.error = () => {};

    render(
      <LocalErrorBoundary area="工具调用">
        <ThrowError shouldThrow={true} />
      </LocalErrorBoundary>,
    );

    expect(
      screen.getByText(/工具调用渲染时出现异常/),
    ).toBeInTheDocument();

    console.error = consoleError;
  });

  it("显示错误详情", () => {
    const consoleError = console.error;
    console.error = () => {};

    render(
      <LocalErrorBoundary area="测试区域">
        <ThrowError shouldThrow={true} />
      </LocalErrorBoundary>,
    );

    const details = screen.getByText("查看错误详情");
    expect(details).toBeInTheDocument();

    fireEvent.click(details);
    expect(screen.getByText("测试错误")).toBeInTheDocument();

    console.error = consoleError;
  });

  it("点击重置按钮清除错误状态", () => {
    const consoleError = console.error;
    console.error = () => {};

    render(<TestWrapper />);

    expect(screen.getByText("测试区域 出错了")).toBeInTheDocument();

    // 先修复错误源
    const fixBtn = screen.getByText("修复错误");
    fireEvent.click(fixBtn);

    // 然后点击重置按钮
    const resetBtn = screen.getByRole("button", { name: /重置此区域/ });
    fireEvent.click(resetBtn);

    // 重置后应该显示正常内容
    expect(screen.getByText("正常内容")).toBeInTheDocument();

    console.error = consoleError;
  });

  it("显示工具调用区域的恢复建议", () => {
    const consoleError = console.error;
    console.error = () => {};

    render(
      <LocalErrorBoundary area="工具调用">
        <ThrowError shouldThrow={true} />
      </LocalErrorBoundary>,
    );

    expect(
      screen.getByText(/如果工具返回的数据格式异常/),
    ).toBeInTheDocument();

    console.error = consoleError;
  });

  it("显示配置面板区域的恢复建议", () => {
    const consoleError = console.error;
    console.error = () => {};

    render(
      <LocalErrorBoundary area="配置面板">
        <ThrowError shouldThrow={true} />
      </LocalErrorBoundary>,
    );

    expect(
      screen.getByText(/如果配置数据损坏/),
    ).toBeInTheDocument();

    console.error = consoleError;
  });

  it("显示 Profile 管理区域的恢复建议", () => {
    const consoleError = console.error;
    console.error = () => {};

    render(
      <LocalErrorBoundary area="Profile 管理">
        <ThrowError shouldThrow={true} />
      </LocalErrorBoundary>,
    );

    expect(
      screen.getByText(/如果 Profile 数据异常/),
    ).toBeInTheDocument();

    console.error = consoleError;
  });

  it("未知区域不显示恢复建议", () => {
    const consoleError = console.error;
    console.error = () => {};

    render(
      <LocalErrorBoundary area="未知区域">
        <ThrowError shouldThrow={true} />
      </LocalErrorBoundary>,
    );

    expect(screen.queryByText(/提示：/)).not.toBeInTheDocument();

    console.error = consoleError;
  });
});
