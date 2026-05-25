// storage.ts 单测：聚焦 Profile 初始化、读取和持久化。

import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  PROFILES_STORAGE_KEY,
  createDefaultProfile,
  loadProfiles,
  saveProfiles,
  readProfilesState,
} from "../storage";
import type { ProfilesState } from "../types";

beforeEach(() => {
  localStorage.clear();
});

describe("createDefaultProfile", () => {
  it("生成的 Profile 字段齐备且 id 唯一", () => {
    const a = createDefaultProfile();
    const b = createDefaultProfile();
    expect(a.id).not.toBe(b.id);
    expect(a.transportType).toBe("stdio");
    expect(a.connectionType).toBe("proxy");
    expect(a.sseUrl).toBe("http://localhost:3001/sse");
    expect(a.oauth).toEqual({ clientId: "", clientSecret: "", scope: "" });
    expect(a.customHeaders).toHaveLength(1);
    expect(a.name).toBe("默认");
  });

  it("允许自定义名称", () => {
    expect(createDefaultProfile("生产环境").name).toBe("生产环境");
  });
});

describe("loadProfiles", () => {
  it("首次访问创建默认 Profile 并写入 v1", () => {
    const state = loadProfiles();
    expect(Object.keys(state.profiles)).toHaveLength(1);
    expect(state.profiles[state.activeId]).toBeDefined();
    expect(localStorage.getItem(PROFILES_STORAGE_KEY)).toBeTruthy();
  });

  it("已有 v1 数据：直接返回不动迁移逻辑", () => {
    const initial: ProfilesState = {
      activeId: "p1",
      profiles: {
        p1: {
          ...createDefaultProfile("已存在"),
          id: "p1",
        },
      },
    };
    saveProfiles(initial);

    const state = loadProfiles();
    expect(state.activeId).toBe("p1");
    expect(state.profiles["p1"].name).toBe("已存在");
  });

  it("无 v1 数据但有旧 last* key：忽略旧缓存并创建默认 Profile", () => {
    localStorage.setItem("lastCommand", "python");
    localStorage.setItem("lastArgs", "-m server");

    const state = loadProfiles();
    const profile = state.profiles[state.activeId];
    expect(profile.command).toBe("mcp-server-everything");
    expect(profile.args).toBe("");
    expect(localStorage.getItem("mcpDebuggerProfiles_v1_migrated")).toBeNull();
  });

  it("v1 数据损坏时创建默认 Profile", () => {
    localStorage.setItem(PROFILES_STORAGE_KEY, "{ broken json");
    const state = loadProfiles();
    expect(Object.keys(state.profiles)).toHaveLength(1);
  });

  it("v1 数据 activeId 不在 profiles 中视为损坏", () => {
    localStorage.setItem(
      PROFILES_STORAGE_KEY,
      JSON.stringify({ activeId: "missing", profiles: {} }),
    );
    expect(readProfilesState()).toBeNull();
  });
});

describe("saveProfiles", () => {
  it("整体序列化写入 v1 key", () => {
    const state: ProfilesState = {
      activeId: "x",
      profiles: { x: { ...createDefaultProfile(), id: "x" } },
    };
    saveProfiles(state);
    const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw as string).activeId).toBe("x");
  });
});
