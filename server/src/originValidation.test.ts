import assert from "node:assert/strict";
import test from "node:test";
import { isAllowedOrigin } from "./originValidation.js";

test("默认允许同主机 Web UI 访问不同端口的 proxy", () => {
  assert.equal(
    isAllowedOrigin({
      origin: "http://10.7.14.153:6274",
      requestHost: "10.7.14.153:6277",
      clientPort: "6274",
    }),
    true,
  );
});

test("默认允许 localhost 和 127.0.0.1 client origin", () => {
  assert.equal(
    isAllowedOrigin({
      origin: "http://localhost:6274",
      requestHost: "localhost:6277",
      clientPort: "6274",
    }),
    true,
  );

  assert.equal(
    isAllowedOrigin({
      origin: "http://127.0.0.1:6274",
      requestHost: "127.0.0.1:6277",
      clientPort: "6274",
    }),
    true,
  );
});

test("默认拒绝不同主机的 origin", () => {
  assert.equal(
    isAllowedOrigin({
      origin: "http://evil.example:6274",
      requestHost: "10.7.14.153:6277",
      clientPort: "6274",
    }),
    false,
  );
});

test("默认拒绝同域名但非 IP 的 origin，避免绕过 DNS rebinding 防护", () => {
  assert.equal(
    isAllowedOrigin({
      origin: "http://evil.example:6274",
      requestHost: "evil.example:6277",
      clientPort: "6274",
    }),
    false,
  );
});

test("设置 ALLOWED_ORIGINS 后只接受显式白名单", () => {
  assert.equal(
    isAllowedOrigin({
      origin: "http://10.7.14.153:6274",
      requestHost: "10.7.14.153:6277",
      clientPort: "6274",
      allowedOriginsEnv: "http://debug.example.com",
    }),
    false,
  );

  assert.equal(
    isAllowedOrigin({
      origin: "http://debug.example.com",
      requestHost: "10.7.14.153:6277",
      clientPort: "6274",
      allowedOriginsEnv: "http://debug.example.com",
    }),
    true,
  );
});

test("无 Origin 的非浏览器请求允许继续", () => {
  assert.equal(
    isAllowedOrigin({
      requestHost: "10.7.14.153:6277",
      clientPort: "6274",
    }),
    true,
  );
});
