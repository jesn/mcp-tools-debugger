// storage.ts 单测：聚焦"老用户配置无损迁移"这一最关键路径，
// 因为迁移失败 = 用户配置丢失 = 不可恢复的产品事故。

import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  PROFILES_STORAGE_KEY,
  PROFILES_MIGRATION_FLAG,
  createDefaultProfile,
  loadProfiles,
  saveProfiles,
  migrateFromLegacy,
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

describe("migrateFromLegacy", () => {
  it("无任何旧 key 时返回纯默认 Profile", () => {
    const profile = migrateFromLegacy();
    expect(profile.transportType).toBe("stdio");
    expect(profile.command).toBe("mcp-server-everything");
    expect(profile.sseUrl).toBe("http://localhost:3001/sse");
  });

  it("从 lastTransportType / lastCommand / lastArgs / lastSseUrl 读取", () => {
    localStorage.setItem("lastTransportType", "streamable-http");
    localStorage.setItem("lastCommand", "node");
    localStorage.setItem("lastArgs", "--debug");
    localStorage.setItem("lastSseUrl", "https://example.com/mcp");

    const profile = migrateFromLegacy();
    expect(profile.transportType).toBe("streamable-http");
    expect(profile.command).toBe("node");
    expect(profile.args).toBe("--debug");
    expect(profile.sseUrl).toBe("https://example.com/mcp");
  });

  it("非法的 transportType 被忽略，回落到默认", () => {
    localStorage.setItem("lastTransportType", "bogus");
    expect(migrateFromLegacy().transportType).toBe("stdio");
  });

  it("聚合 OAuth 三个字段", () => {
    localStorage.setItem("lastOauthClientId", "cid");
    localStorage.setItem("lastOauthClientSecret", "sec");
    localStorage.setItem("lastOauthScope", "read write");
    expect(migrateFromLegacy().oauth).toEqual({
      clientId: "cid",
      clientSecret: "sec",
      scope: "read write",
    });
  });

  it("优先使用 lastCustomHeaders（JSON），其次回退 legacy bearer token", () => {
    localStorage.setItem(
      "lastCustomHeaders",
      JSON.stringify([{ name: "X-Foo", value: "bar", enabled: true }]),
    );
    expect(migrateFromLegacy().customHeaders).toEqual([
      { name: "X-Foo", value: "bar", enabled: true },
    ]);
  });

  it("lastCustomHeaders 缺失时从 legacy bearer token + headerName 构造", () => {
    localStorage.setItem("lastBearerToken", "abc123");
    localStorage.setItem("lastHeaderName", "X-Auth");
    const profile = migrateFromLegacy();
    expect(profile.customHeaders).toEqual([
      { name: "X-Auth", value: "abc123", enabled: true },
    ]);
  });

  it("lastCustomHeaders JSON 损坏时回退到 legacy bearer token", () => {
    localStorage.setItem("lastCustomHeaders", "{not-json");
    localStorage.setItem("lastBearerToken", "abc");
    expect(migrateFromLegacy().customHeaders).toEqual([
      { name: "Authorization", value: "Bearer abc", enabled: true },
    ]);
  });
});

describe("loadProfiles", () => {
  it("首次访问且无旧数据：创建默认 Profile 并写入 v1 + 迁移标志", () => {
    const state = loadProfiles();
    expect(Object.keys(state.profiles)).toHaveLength(1);
    expect(state.profiles[state.activeId]).toBeDefined();
    expect(localStorage.getItem(PROFILES_STORAGE_KEY)).toBeTruthy();
    expect(localStorage.getItem(PROFILES_MIGRATION_FLAG)).toBe("true");
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

  it("无 v1 数据但有旧 last* key：迁移成默认 Profile", () => {
    localStorage.setItem("lastCommand", "python");
    localStorage.setItem("lastArgs", "-m server");

    const state = loadProfiles();
    const profile = state.profiles[state.activeId];
    expect(profile.command).toBe("python");
    expect(profile.args).toBe("-m server");
  });

  it("已迁移过（标志位为 true）但 v1 被手动清除：创建空白默认 Profile", () => {
    localStorage.setItem(PROFILES_MIGRATION_FLAG, "true");
    localStorage.setItem("lastCommand", "should-be-ignored");

    const state = loadProfiles();
    const profile = state.profiles[state.activeId];
    expect(profile.command).toBe("mcp-server-everything");
  });

  it("v1 数据损坏时降级到迁移流程", () => {
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
