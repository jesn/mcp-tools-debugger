import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * 简单的 React 错误边界：捕获子树渲染期异常，避免整页白屏。
 *
 * 注意：不会捕获事件回调、setTimeout、async 错误——这些场景需要在调用方
 * 显式 try/catch 后调用 toast。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div
        role="alert"
        className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-background p-6 text-foreground"
      >
        <h1 className="text-2xl font-semibold">出错了</h1>
        <p className="max-w-xl text-center text-sm text-muted-foreground">
          页面渲染时出现异常。请尝试重置后继续；若反复出现，请检查浏览器控制台获取详细堆栈，并将错误反馈到项目仓库。
        </p>
        <pre className="max-w-2xl overflow-auto rounded bg-muted p-3 text-xs text-muted-foreground">
          {error.message}
        </pre>
        <button
          type="button"
          onClick={this.reset}
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          重置
        </button>
      </div>
    );
  }
}
