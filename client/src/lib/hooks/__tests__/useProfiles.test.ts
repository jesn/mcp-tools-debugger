// useProfiles hook 单测：覆盖 CRUD + 持久化 + activeId 切换 + 不变性约束。

import { describe, it, expect, beforeEach } from "@jest/globals";
import { renderHook, act } from "@testing-library/react";
import { useProfiles } from "../useProfiles";
import {
  PROFILES_STORAGE_KEY,
  PROFILES_MIGRATION_FLAG,
} from "@/lib/profiles/storage";

beforeEach(() => {
  localStorage.clear();
});

describe("useProfiles", () => {
  it("首次挂载创建默认 Profile 并标记为已迁移", () => {
    const { result } = renderHook(() => useProfiles());

    expect(result.current.activeProfile).toBeDefined();
    expect(result.current.activeProfile.transportType).toBe("stdio");
    expect(localStorage.getItem(PROFILES_MIGRATION_FLAG)).toBe("true");
    expect(localStorage.getItem(PROFILES_STORAGE_KEY)).toBeTruthy();
  });

  it("updateActiveProfile 部分更新当前 Profile 且持久化", () => {
    const { result } = renderHook(() => useProfiles());

    act(() => {
      result.current.updateActiveProfile({ command: "node", args: "x" });
    });

    expect(result.current.activeProfile.command).toBe("node");
    expect(result.current.activeProfile.args).toBe("x");
    expect(result.current.activeProfile.sseUrl).toBe(
      "http://localhost:3001/sse",
    ); // 未触及字段保留

    const raw = JSON.parse(
      localStorage.getItem(PROFILES_STORAGE_KEY) as string,
    );
    expect(raw.profiles[raw.activeId].command).toBe("node");
  });

  it("updateActiveProfile 不会改写 id 与 createdAt，但会更新 updatedAt", () => {
    const { result } = renderHook(() => useProfiles());
    const before = result.current.activeProfile;

    // 强制时间推进以避免 updatedAt 相等
    const originalNow = Date.now;
    Date.now = () => before.updatedAt + 100;
    try {
      act(() => {
        // @ts-expect-error 故意尝试覆盖被保护字段
        result.current.updateActiveProfile({ id: "X", createdAt: 0 });
      });
    } finally {
      Date.now = originalNow;
    }

    const after = result.current.activeProfile;
    expect(after.id).toBe(before.id);
    expect(after.createdAt).toBe(before.createdAt);
    expect(after.updatedAt).toBeGreaterThan(before.updatedAt);
  });

  it("createProfile 创建并立即激活", () => {
    const { result } = renderHook(() => useProfiles());
    const initialId = result.current.activeProfile.id;

    let newId = "";
    act(() => {
      newId = result.current.createProfile("staging");
    });

    expect(newId).not.toBe(initialId);
    expect(result.current.activeProfile.id).toBe(newId);
    expect(result.current.activeProfile.name).toBe("staging");
    expect(Object.keys(result.current.state.profiles)).toHaveLength(2);
  });

  it("setActiveProfile 切换 active；id 非法时无操作", () => {
    const { result } = renderHook(() => useProfiles());
    const firstId = result.current.activeProfile.id;
    let secondId = "";

    act(() => {
      secondId = result.current.createProfile("p2");
    });
    act(() => {
      result.current.setActiveProfile(firstId);
    });
    expect(result.current.activeProfile.id).toBe(firstId);

    act(() => {
      result.current.setActiveProfile("does-not-exist");
    });
    expect(result.current.activeProfile.id).toBe(firstId); // 未变

    act(() => {
      result.current.setActiveProfile(secondId);
    });
    expect(result.current.activeProfile.id).toBe(secondId);
  });

  it("renameProfile 修改名称", () => {
    const { result } = renderHook(() => useProfiles());
    const id = result.current.activeProfile.id;

    act(() => {
      result.current.renameProfile(id, "新名字");
    });
    expect(result.current.activeProfile.name).toBe("新名字");
  });

  it("deleteProfile 删除非 active 项", () => {
    const { result } = renderHook(() => useProfiles());
    const first = result.current.activeProfile.id;
    let second = "";
    act(() => {
      second = result.current.createProfile("p2");
    });
    // 当前 active = second，先切回 first，再删 second
    act(() => {
      result.current.setActiveProfile(first);
    });
    act(() => {
      result.current.deleteProfile(second);
    });

    expect(result.current.activeProfile.id).toBe(first);
    expect(Object.keys(result.current.state.profiles)).toHaveLength(1);
  });

  it("deleteProfile 删除 active 时自动切到剩余的第一个", () => {
    const { result } = renderHook(() => useProfiles());
    const first = result.current.activeProfile.id;
    act(() => {
      result.current.createProfile("p2");
    });
    const activeBeforeDelete = result.current.activeProfile.id;

    act(() => {
      result.current.deleteProfile(activeBeforeDelete);
    });

    expect(result.current.activeProfile.id).toBe(first);
  });

  it("最后一个 Profile 不允许删除", () => {
    const { result } = renderHook(() => useProfiles());
    const onlyId = result.current.activeProfile.id;

    act(() => {
      result.current.deleteProfile(onlyId);
    });

    expect(Object.keys(result.current.state.profiles)).toHaveLength(1);
    expect(result.current.activeProfile.id).toBe(onlyId);
  });
});
