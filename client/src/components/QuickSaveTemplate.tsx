import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BookmarkPlus } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/lib/hooks/useToast";

interface QuickSaveTemplateProps {
  onSave: (name: string, description?: string) => void;
  disabled?: boolean;
}

export default function QuickSaveTemplate({
  onSave,
  disabled,
}: QuickSaveTemplateProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const { toast } = useToast();

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim(), description.trim() || undefined);
    toast({
      title: "模板已保存",
      description: `模板"${name.trim()}"已成功保存`,
    });
    setName("");
    setDescription("");
    setOpen(false);
  };

  const handleCancel = () => {
    setName("");
    setDescription("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title="将当前参数保存为模板"
      >
        <BookmarkPlus className="w-4 h-4 mr-2" />
        保存为模板
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>保存参数模板</DialogTitle>
          <DialogDescription>
            将当前填写的参数保存为模板，方便下次快速复用
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="quick-template-name">模板名称 *</Label>
            <Input
              id="quick-template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：测试环境配置"
              className="mt-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) {
                  handleSave();
                }
              }}
            />
          </div>
          <div>
            <Label htmlFor="quick-template-desc">描述（可选）</Label>
            <Textarea
              id="quick-template-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="简要说明此模板的用途"
              className="mt-1"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={!name.trim()}>
            <BookmarkPlus className="w-4 h-4 mr-2" />
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
