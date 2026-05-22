import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  BookmarkPlus,
  Bookmark,
  Trash2,
  Clock,
  Edit2,
  Check,
  X,
  Eye,
  EyeOff,
  Search,
  ArrowUpDown,
} from "lucide-react";
import type { ParamTemplate } from "@/lib/types/paramTemplate";
import type { JsonValue } from "@/utils/jsonUtils";
import { useMemo, useState } from "react";
import { useToast } from "@/lib/hooks/useToast";
import JsonView from "./JsonView";

type SortOption = "recent" | "created" | "name" | "usage";

const SORT_LABELS: Record<SortOption, string> = {
  recent: "最近使用",
  created: "最近创建",
  name: "名称 A-Z",
  usage: "使用次数",
};

interface ParamTemplateManagerProps {
  toolName: string;
  currentParams: Record<string, JsonValue>;
  templates: ParamTemplate[];
  onCreateTemplate: (name: string, description?: string) => void;
  onApplyTemplate: (template: ParamTemplate) => void;
  onDeleteTemplate: (id: string) => void;
  onUpdateTemplate: (
    id: string,
    updates: { name?: string; description?: string },
  ) => void;
  onUseTemplate?: (id: string) => void;
}

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function ParamTemplateManager({
  toolName,
  templates,
  onCreateTemplate,
  onApplyTemplate,
  onDeleteTemplate,
  onUpdateTemplate,
  onUseTemplate,
}: ParamTemplateManagerProps) {
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateDesc, setNewTemplateDesc] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const { toast } = useToast();

  const visibleTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = query
      ? templates.filter(
          (t) =>
            t.name.toLowerCase().includes(query) ||
            (t.description?.toLowerCase().includes(query) ?? false),
        )
      : templates;

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "recent":
          return (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0);
        case "created":
          return b.createdAt - a.createdAt;
        case "name":
          return a.name.localeCompare(b.name, "zh-CN");
        case "usage":
          return (b.usageCount ?? 0) - (a.usageCount ?? 0);
        default:
          return 0;
      }
    });
    return sorted;
  }, [templates, searchQuery, sortBy]);

  const handleCreate = () => {
    if (!newTemplateName.trim()) return;
    onCreateTemplate(
      newTemplateName.trim(),
      newTemplateDesc.trim() || undefined,
    );
    toast({
      title: "模板已保存",
      description: `模板"${newTemplateName.trim()}"已成功保存`,
    });
    setNewTemplateName("");
    setNewTemplateDesc("");
    setIsCreateMode(false);
  };

  const handleStartEdit = (template: ParamTemplate) => {
    setEditingId(template.id);
    setEditName(template.name);
    setEditDesc(template.description || "");
  };

  const handleSaveEdit = () => {
    if (!editingId || !editName.trim()) return;
    onUpdateTemplate(editingId, {
      name: editName.trim(),
      description: editDesc.trim() || undefined,
    });
    toast({
      title: "模板已更新",
      description: `模板"${editName.trim()}"已成功更新`,
    });
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditDesc("");
  };

  const handleDelete = (template: ParamTemplate) => {
    onDeleteTemplate(template.id);
    toast({
      title: "模板已删除",
      description: `模板"${template.name}"已被删除`,
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Bookmark className="w-4 h-4 mr-2" />
          参数模板 ({templates.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>参数模板 - {toolName}</DialogTitle>
          <DialogDescription>
            保存和管理常用参数配置，快速填充表单
          </DialogDescription>
        </DialogHeader>

        {templates.length > 0 && (
          <div className="flex items-center gap-2 pt-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索模板名称或描述..."
                className="pl-9"
                aria-label="搜索模板"
              />
            </div>
            <Select
              value={sortBy}
              onValueChange={(value) => setSortBy(value as SortOption)}
            >
              <SelectTrigger className="w-[150px]" aria-label="排序方式">
                <ArrowUpDown className="w-4 h-4 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
                  <SelectItem key={option} value={option}>
                    {SORT_LABELS[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-2">
          {isCreateMode ? (
            <div className="border rounded-lg p-4 mb-4 bg-accent/20">
              <h4 className="font-semibold mb-3">新建模板</h4>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="template-name">模板名称 *</Label>
                  <Input
                    id="template-name"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    placeholder="例如：测试环境配置"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="template-desc">描述（可选）</Label>
                  <Textarea
                    id="template-desc"
                    value={newTemplateDesc}
                    onChange={(e) => setNewTemplateDesc(e.target.value)}
                    placeholder="简要说明此模板的用途"
                    className="mt-1"
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleCreate}
                    disabled={!newTemplateName.trim()}
                  >
                    <Check className="w-4 h-4 mr-2" />
                    保存
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setIsCreateMode(false);
                      setNewTemplateName("");
                      setNewTemplateDesc("");
                    }}
                  >
                    <X className="w-4 h-4 mr-2" />
                    取消
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreateMode(true)}
              className="mb-4 w-full border-dashed hover:border-primary hover:bg-primary/5"
            >
              <BookmarkPlus className="w-4 h-4 mr-2" />
              保存当前参数为模板
            </Button>
          )}

          {templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground border-2 border-dashed rounded-lg">
              <Bookmark className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm font-medium mb-1">暂无参数模板</p>
              <p className="text-xs">填写参数后点击上方按钮保存为模板</p>
            </div>
          ) : visibleTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground border-2 border-dashed rounded-lg">
              <Search className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-sm">没有匹配的模板</p>
              <p className="text-xs">试试其他关键词</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleTemplates.map((template) => (
                <div
                  key={template.id}
                  className="border rounded-lg p-4 hover:bg-accent/30 transition-colors shadow-sm"
                >
                  {editingId === template.id ? (
                    <div className="space-y-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="模板名称"
                      />
                      <Textarea
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="描述（可选）"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveEdit}>
                          <Check className="w-4 h-4 mr-2" />
                          保存
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelEdit}
                        >
                          <X className="w-4 h-4 mr-2" />
                          取消
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-base truncate">
                              {template.name}
                            </h4>
                            {(template.usageCount ?? 0) > 0 && (
                              <span
                                className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 flex-shrink-0"
                                title={`已使用 ${template.usageCount} 次`}
                              >
                                {template.usageCount}×
                              </span>
                            )}
                          </div>
                          {template.description && (
                            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                              {template.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTimestamp(template.createdAt)}
                            </span>
                            {template.lastUsedAt && (
                              <span className="flex items-center gap-1">
                                <span className="text-green-600 dark:text-green-400">
                                  ●
                                </span>
                                最近使用: {formatTimestamp(template.lastUsedAt)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0 items-start">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setPreviewId(
                                previewId === template.id ? null : template.id,
                              )
                            }
                            title={
                              previewId === template.id
                                ? "隐藏预览"
                                : "预览参数"
                            }
                            className="h-8 w-8 p-0"
                          >
                            {previewId === template.id ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              onApplyTemplate(template);
                              if (onUseTemplate) {
                                onUseTemplate(template.id);
                              }
                            }}
                            title="应用此模板"
                            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStartEdit(template)}
                            title="编辑模板"
                            className="h-8 w-8 p-0"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(template)}
                            title="删除模板"
                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      {previewId === template.id && (
                        <div className="mt-3 p-3 bg-muted rounded-md">
                          <div className="text-xs font-semibold mb-2 text-muted-foreground">
                            参数预览:
                          </div>
                          <JsonView
                            data={template.params}
                            className="max-h-60 overflow-auto"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
