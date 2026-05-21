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
import { Textarea } from "@/components/ui/textarea";
import {
  BookmarkPlus,
  Bookmark,
  Trash2,
  Clock,
  Edit2,
  Check,
  X,
} from "lucide-react";
import type { ParamTemplate } from "@/lib/types/paramTemplate";
import type { JsonValue } from "@/utils/jsonUtils";
import { useState } from "react";

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

  const handleCreate = () => {
    if (!newTemplateName.trim()) return;
    onCreateTemplate(
      newTemplateName.trim(),
      newTemplateDesc.trim() || undefined,
    );
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
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setEditDesc("");
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
              className="mb-4 w-full"
            >
              <BookmarkPlus className="w-4 h-4 mr-2" />
              保存当前参数为模板
            </Button>
          )}

          {templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Bookmark className="w-12 h-12 mb-2 opacity-20" />
              <p className="text-sm">暂无参数模板</p>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="border rounded-lg p-3 hover:bg-accent/50 transition-colors"
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
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold truncate">
                            {template.name}
                          </h4>
                          {template.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {template.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              创建: {formatTimestamp(template.createdAt)}
                            </span>
                            {template.lastUsedAt && (
                              <span>
                                最后使用: {formatTimestamp(template.lastUsedAt)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
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
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStartEdit(template)}
                            title="编辑模板"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDeleteTemplate(template.id)}
                            title="删除模板"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
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
