// useProfiles：连接配置实体的统一读写入口。
//
// Phase 1 仅在 App.tsx 接入 activeProfile + updateActiveProfile，列表 CRUD API 留给后续多 Profile 选择器 UI 使用。
// 内部一次性 loadProfiles（含旧数据迁移），所有变更都同步写回 localStorage，避免 App.tsx 残留分散的 useEffect。

import { useCallback, useState } from "react";
import {
  type ConnectionProfile,
  type ConnectionProfilePatch,
  type ProfilesState,
} from "@/lib/profiles/types";
import {
  createDefaultProfile,
  loadProfiles,
  saveProfiles,
} from "@/lib/profiles/storage";

export interface UseProfilesResult {
  /** 全量状态（含所有 profile + activeId），用于选择器 UI */
  state: ProfilesState;
  /** 当前激活的 Profile（保证非空：load 时必创建） */
  activeProfile: ConnectionProfile;
  /** 部分更新当前 Profile，自动写持久化与 updatedAt */
  updateActiveProfile: (patch: ConnectionProfilePatch) => void;
  /** 切换激活 Profile；id 非法时无操作 */
  setActiveProfile: (id: string) => void;
  /** 新建 Profile 并立即激活，返回新 id */
  createProfile: (name?: string) => string;
  /** 重命名 */
  renameProfile: (id: string, name: string) => void;
  /** 删除指定 Profile；删除当前激活时自动切到剩余的第一个；最后一个不允许删 */
  deleteProfile: (id: string) => void;
}

const withPersist = (next: ProfilesState): ProfilesState => {
  saveProfiles(next);
  return next;
};

export const useProfiles = (): UseProfilesResult => {
  const [state, setState] = useState<ProfilesState>(() => loadProfiles());

  const activeProfile = state.profiles[state.activeId];

  const updateActiveProfile = useCallback((patch: ConnectionProfilePatch) => {
    setState((prev) => {
      const current = prev.profiles[prev.activeId];
      if (!current) return prev;
      const updated: ConnectionProfile = {
        ...current,
        ...patch,
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: Date.now(),
      };
      return withPersist({
        ...prev,
        profiles: { ...prev.profiles, [updated.id]: updated },
      });
    });
  }, []);

  const setActiveProfile = useCallback((id: string) => {
    setState((prev) => {
      if (!prev.profiles[id] || prev.activeId === id) return prev;
      return withPersist({ ...prev, activeId: id });
    });
  }, []);

  const createProfile = useCallback((name?: string): string => {
    const fresh = createDefaultProfile(name);
    setState((prev) =>
      withPersist({
        activeId: fresh.id,
        profiles: { ...prev.profiles, [fresh.id]: fresh },
      }),
    );
    return fresh.id;
  }, []);

  const renameProfile = useCallback((id: string, name: string) => {
    setState((prev) => {
      const target = prev.profiles[id];
      if (!target) return prev;
      const updated: ConnectionProfile = {
        ...target,
        name,
        updatedAt: Date.now(),
      };
      return withPersist({
        ...prev,
        profiles: { ...prev.profiles, [id]: updated },
      });
    });
  }, []);

  const deleteProfile = useCallback((id: string) => {
    setState((prev) => {
      const remainingEntries = Object.entries(prev.profiles).filter(
        ([key]) => key !== id,
      );
      if (remainingEntries.length === 0) return prev; // 至少保留 1 份
      const nextProfiles = Object.fromEntries(remainingEntries);
      const nextActiveId =
        prev.activeId === id ? remainingEntries[0][0] : prev.activeId;
      return withPersist({ activeId: nextActiveId, profiles: nextProfiles });
    });
  }, []);

  return {
    state,
    activeProfile,
    updateActiveProfile,
    setActiveProfile,
    createProfile,
    renameProfile,
    deleteProfile,
  };
};
