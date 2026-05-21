import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  History,
  Trash2,
  Download,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
} from "lucide-react";
import type { ToolHistoryEntry } from "@/lib/types/toolHistory";
import { useState } from "react";
import JsonView from "./JsonView";

interface ToolHistorySidebarProps {
  entries: ToolHistoryEntry[];
  onClearHistory: () => void;
  onDeleteEntry: (id: string) => void;
  onExportHistory: () => void;
  onReplay: (entry: ToolHistoryEntry) => void;
}

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;

  return date.toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDuration = (duration?: number): string => {
  if (!duration) return "-";
  if (duration < 1000) return `${duration}ms`;
  return `${(duration / 1000).toFixed(2)}s`;
};

export default function ToolHistorySidebar({
  entries,
  onClearHistory,
  onDeleteEntry,
  onExportHistory,
  onReplay,
}: ToolHistorySidebarProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleDelete = (id: string) => {
    if (confirmDelete === id) {
      onDeleteEntry(id);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
      // 3秒后自动取消确认状态
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  };

  const handleClear = () => {
    if (confirmClear) {
      onClearHistory();
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
      // 3秒后自动取消确认状态
      setTimeout(() => setConfirmClear(false), 3000);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="w-4 h-4 mr-2" />
          调用历史 ({entries.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Tool 调用历史</DialogTitle>
          <DialogDescription>
            查看和管理所有 Tool 调用记录，支持回放和导出
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onExportHistory}
            disabled={entries.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            导出 JSON
          </Button>
          <Button
            variant={confirmClear ? "destructive" : "outline"}
            size="sm"
            onClick={handleClear}
            disabled={entries.length === 0}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {confirmClear ? "确认清空？" : "清空历史"}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2">
          {entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <History className="w-12 h-12 mb-2 opacity-20" />
              <p className="text-sm">暂无调用历史</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="border rounded-lg p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {entry.isSuccess ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        )}
                        <span className="font-mono text-sm font-semibold truncate">
                          {entry.toolName}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(entry.timestamp)}
                        </span>
                        <span>耗时: {formatDuration(entry.duration)}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onReplay(entry)}
                        title="回放此调用"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={
                          confirmDelete === entry.id ? "destructive" : "ghost"
                        }
                        size="sm"
                        onClick={() => handleDelete(entry.id)}
                        title={
                          confirmDelete === entry.id
                            ? "确认删除？"
                            : "删除此记录"
                        }
                      >
                        {confirmDelete === entry.id ? (
                          "确认？"
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {expandedId === entry.id && (
                    <div className="mt-3 space-y-2 text-xs">
                      <div>
                        <div className="font-semibold mb-1">参数:</div>
                        <JsonView
                          data={entry.params}
                          className="max-h-40 overflow-auto"
                        />
                      </div>
                      <div>
                        <div className="font-semibold mb-1">结果:</div>
                        <JsonView
                          data={entry.result}
                          className="max-h-40 overflow-auto"
                        />
                      </div>
                      {entry.metadata && (
                        <div>
                          <div className="font-semibold mb-1">元数据:</div>
                          <JsonView
                            data={entry.metadata}
                            className="max-h-40 overflow-auto"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2 text-xs"
                    onClick={() =>
                      setExpandedId(expandedId === entry.id ? null : entry.id)
                    }
                  >
                    {expandedId === entry.id ? "收起详情" : "展开详情"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
