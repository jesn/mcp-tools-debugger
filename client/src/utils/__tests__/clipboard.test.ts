import { copyTextToClipboard } from "../clipboard";

describe("copyTextToClipboard", () => {
  const originalClipboard = navigator.clipboard;
  const originalExecCommand = document.execCommand;

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      configurable: true,
    });
    document.execCommand = originalExecCommand;
    document.body.innerHTML = "";
    jest.restoreAllMocks();
  });

  it("优先使用 Clipboard API", async () => {
    const writeText = jest.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    await copyTextToClipboard("hello");

    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("Clipboard API 不存在时回退到 textarea copy", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    document.execCommand = jest.fn(() => true);

    await copyTextToClipboard("remote ip copy");

    expect(document.execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("所有复制方式都不可用时抛出明确错误", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      configurable: true,
    });
    document.execCommand = jest.fn(() => false);

    await expect(copyTextToClipboard("text")).rejects.toThrow(
      "Clipboard copy is unavailable in this browser context.",
    );
  });
});
