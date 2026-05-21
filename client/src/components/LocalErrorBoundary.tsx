import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  /** 错误区域名称，用于日志和提示 */
  area: string;
  /** 自定义错误提示（可选） */
  customMessage?: string;
}

interface State {
  error: Error | null;
}

/**
 * 局部错误边界：捕获特定区域的渲染错误，显示友好提示，不影响其他区域。
 *
 * 使用场景：
 * - ToolsTab：工具调用区域
 * - Sidebar：配置区域
 * - ProfileSwitcher：Profile 管理
 */
export class LocalErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[LocalErrorBoundary:${this.props.area}]`,
      error,
      info.componentStack,
    );
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { area, customMessage } = this.props;

    return (
      <div
        role="alert"
        className="flex flex-col items-center justify-center gap-4 p-8 border border-destructive/20 rounded-lg bg-destructive/5"
      >
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="w-5 h-5" />
          <h3 className="font-semibold">{area} 出错了</h3>
        </div>

        <p className="text-sm text-muted-foreground text-center max-w-md">
          {customMessage ||
            `${area}渲染时出现异常。请尝试重置后继续，若反复出现请检查浏览器控制台。`}
        </p>

        <details className="w-full max-w-md">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
            查看错误详情
          </summary>
          <pre className="mt-2 p-3 text-xs bg-muted rounded overflow-auto max-h-32">
            {error.message}
          </pre>
        </details>

        <Button onClick={this.reset} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          重置此区域
        </Button>

        {this.getRecoverySuggestion(area)}
      </div>
    );
  }

  private getRecoverySuggestion(area: string): ReactNode {
    const suggestions: Record<string, string> = {
      工具调用:
        "提示：如果工具返回的数据格式异常，可以尝试断开连接后重新连接服务器。",
      配置面板:
        "提示：如果配置数据损坏，可以尝试切换到其他 Profile 或新建一个 Profile。",
      "Profile 管理":
        "提示：如果 Profile 数据异常，可以尝试清除浏览器 localStorage 后刷新页面。",
    };

    const suggestion = suggestions[area];
    if (!suggestion) return null;

    return (
      <p className="text-xs text-muted-foreground italic max-w-md text-center">
        {suggestion}
      </p>
    );
  }
}
