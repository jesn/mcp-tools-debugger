// ProfileSwitcher：连接配置实体的切换/管理入口。
//
// 设计点：
// - Popover + cmdk 列表，与项目里现有的 Combobox 风格一致。
// - 4 个底部动作：新建 / 克隆 / 重命名 / 删除；inline 输入新建与重命名，无对话框，最快。
// - 删除使用嵌套小 Popover 二次确认；最后一份 Profile 禁用删除。
// - 不直接处理"切换时断开旧连接"的副作用 —— 那是 App.tsx 监听 activeProfile.id 变化时的事。

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ChevronsUpDown,
  Plus,
  Copy,
  Pencil,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ConnectionProfile } from "@/lib/profiles/types";
import type { UseProfilesResult } from "@/lib/hooks/useProfiles";

export interface ProfileSwitcherProps {
  state: UseProfilesResult["state"];
  activeProfile: ConnectionProfile;
  setActiveProfile: UseProfilesResult["setActiveProfile"];
  createProfile: UseProfilesResult["createProfile"];
  renameProfile: UseProfilesResult["renameProfile"];
  deleteProfile: UseProfilesResult["deleteProfile"];
  /** 克隆当前 Profile：把所有可编辑字段复制到一份新 Profile 并激活 */
  cloneActiveProfile: () => void;
}

const transportLabel = (p: ConnectionProfile): string => {
  switch (p.transportType) {
    case "stdio":
      return p.command || "(空命令)";
    case "sse":
    case "streamable-http":
      try {
        const url = new URL(p.sseUrl);
        return url.host || p.sseUrl;
      } catch {
        return p.sseUrl || "(未设置 URL)";
      }
  }
};

const ProfileSwitcher = ({
  state,
  activeProfile,
  setActiveProfile,
  createProfile,
  renameProfile,
  deleteProfile,
  cloneActiveProfile,
}: ProfileSwitcherProps) => {
  const [open, setOpen] = useState(false);
  // inline 表单模式："create" 新建，"rename" 重命名当前，"confirmDelete" 删除二次确认
  const [mode, setMode] = useState<
    "list" | "create" | "rename" | "confirmDelete"
  >("list");
  const [draftName, setDraftName] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 每次打开/切换模式时聚焦输入框
  useEffect(() => {
    if ((mode === "create" || mode === "rename") && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [mode]);

  const profiles = Object.values(state.profiles).sort(
    (a, b) => a.createdAt - b.createdAt,
  );
  const onlyOne = profiles.length <= 1;

  const resetToList = () => {
    setMode("list");
    setDraftName("");
  };

  const closeAll = () => {
    setOpen(false);
    resetToList();
  };

  const handleSelect = (id: string) => {
    setActiveProfile(id);
    closeAll();
  };

  const handleStartCreate = () => {
    setDraftName("");
    setMode("create");
  };

  const handleStartRename = () => {
    setDraftName(activeProfile.name);
    setMode("rename");
  };

  const handleStartDelete = () => {
    if (onlyOne) return;
    setMode("confirmDelete");
  };

  const handleConfirmName = () => {
    const trimmed = draftName.trim();
    if (!trimmed) {
      resetToList();
      return;
    }
    if (mode === "create") {
      createProfile(trimmed);
    } else if (mode === "rename") {
      renameProfile(activeProfile.id, trimmed);
    }
    closeAll();
  };

  const handleConfirmDelete = () => {
    deleteProfile(activeProfile.id);
    closeAll();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetToList();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-label="切换连接配置"
          aria-expanded={open}
          className="w-full justify-between h-auto py-2"
        >
          <span className="flex flex-col items-start min-w-0">
            <span className="text-sm font-medium truncate w-full text-left">
              {activeProfile.name}
            </span>
            <span className="text-xs text-muted-foreground truncate w-full text-left">
              {activeProfile.transportType} · {transportLabel(activeProfile)}
            </span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[var(--radix-popover-trigger-width)] min-w-[260px]"
        align="start"
      >
        {mode === "list" && (
          <Command>
            <CommandInput placeholder="搜索 Profile..." />
            <CommandList>
              <CommandEmpty>没有匹配的 Profile</CommandEmpty>
              <CommandGroup>
                {profiles.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`${p.name} ${p.transportType} ${transportLabel(p)}`}
                    onSelect={() => handleSelect(p.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        p.id === activeProfile.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="flex flex-col min-w-0">
                      <span className="truncate">{p.name}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {p.transportType} · {transportLabel(p)}
                      </span>
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={handleStartCreate}
                  value="__action_new__"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  新建 Profile
                </CommandItem>
                <CommandItem
                  onSelect={cloneActiveProfile}
                  value="__action_clone__"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  克隆当前
                </CommandItem>
                <CommandItem
                  onSelect={handleStartRename}
                  value="__action_rename__"
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  重命名当前
                </CommandItem>
                <CommandItem
                  onSelect={handleStartDelete}
                  value="__action_delete__"
                  disabled={onlyOne}
                  className={cn(
                    "text-destructive data-[selected=true]:text-destructive",
                    onlyOne && "opacity-50",
                  )}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  删除当前{onlyOne ? "（仅剩一份不可删除）" : ""}
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        )}

        {(mode === "create" || mode === "rename") && (
          <form
            className="p-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleConfirmName();
            }}
          >
            <label className="text-xs text-muted-foreground">
              {mode === "create" ? "新 Profile 名称" : "重命名当前 Profile"}
            </label>
            <Input
              ref={inputRef}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  resetToList();
                }
              }}
              placeholder={mode === "create" ? "例如：生产环境" : ""}
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetToList}
              >
                取消
              </Button>
              <Button type="submit" size="sm" disabled={!draftName.trim()}>
                {mode === "create" ? "新建" : "保存"}
              </Button>
            </div>
          </form>
        )}

        {mode === "confirmDelete" && (
          <div className="p-3 space-y-3">
            <p className="text-sm">
              确认删除 Profile
              <span className="font-medium"> "{activeProfile.name}" </span>
              ？此操作不可撤销。
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={resetToList}>
                取消
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmDelete}
              >
                删除
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default ProfileSwitcher;
