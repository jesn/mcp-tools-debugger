# MCP Tools Debugger

MCP Tools Debugger 是基于 [modelcontextprotocol/inspector](https://github.com/modelcontextprotocol/inspector) 的二开项目。

原始 MCP Inspector 覆盖了 tools、resources、prompts、sampling、roots、elicitation、tasks、apps 等多类 MCP 调试能力；本项目只提炼并保留 **MCP Tool 调试**相关功能，目标是让页面更聚焦于工具列表查看、参数填写、工具调用和结果检查。

## 项目定位

本项目不是完整 MCP Inspector 的替代品，而是面向 MCP Tool 联调场景的轻量调试器。

保留的主流程：

- 连接 MCP Server。
- 获取并展示 `tools/list` 返回的工具列表。
- 查看 Tool 的 JSON Schema、注解和参数要求。
- 基于 Schema 填写参数并发起 `tools/call`。
- 查看工具返回结果、错误信息和资源链接。

## Docker 使用

Docker 镜像页面：
[mcp-tools-debugger](https://cnb.cool/rich/public/mcp-tools-debugger/-/packages/docker/mcp-tools-debugger)

镜像地址：

```text
docker.cnb.cool/rich/public/mcp-tools-debugger:latest
```

拉取镜像：

```bash
docker pull docker.cnb.cool/rich/public/mcp-tools-debugger:latest
```

启动容器：

```bash
docker run -d \
  --name mcp-tools-debugger \
  -p 6274:6274 \
  -p 6277:6277 \
  -e HOST=0.0.0.0 \
  -e MCP_PROXY_AUTH_TOKEN=<随机长 token> \
  docker.cnb.cool/rich/public/mcp-tools-debugger:latest
```

启动后访问：

```text
http://<服务器 IP>:6274/?MCP_PROXY_AUTH_TOKEN=<随机长 token>
```

其中 `6274` 是 Web UI 端口，`6277` 是 MCP Proxy 端口。Windows 环境也可以直接使用仓库中的 `start-mcp-debugger.bat` 启动同一个镜像。

### Proxy 鉴权

MCP Proxy 默认开启 session token 鉴权。浏览器页面调用 `6277` 端口时必须带上 `MCP_PROXY_AUTH_TOKEN`，否则 proxy 会返回 `401 Unauthorized`。如果只打开 `http://<服务器 IP>:6274`，页面能加载，但连接 MCP Server 时会因为缺少 proxy token 失败。

推荐在 Docker 启动时显式设置固定 token，并使用带 query 参数的地址打开页面：

```bash
docker run -d \
  --name mcp-tools-debugger \
  -p 6274:6274 \
  -p 6277:6277 \
  -e HOST=0.0.0.0 \
  -e MCP_PROXY_AUTH_TOKEN=<随机长 token> \
  docker.cnb.cool/rich/public/mcp-tools-debugger:latest
```

```text
http://<服务器 IP>:6274/?MCP_PROXY_AUTH_TOKEN=<随机长 token>
```

如果未设置 `MCP_PROXY_AUTH_TOKEN`，服务会在启动时随机生成 token，可以通过 `docker logs mcp-tools-debugger` 查看启动日志中的 `Session token`，再把它填到页面 `Configuration` 里的 `Proxy Session Token`。

### Origin 校验

MCP Proxy 会校验浏览器请求的 `Origin`，用于降低 DNS rebinding 风险。Docker 默认配置支持通过 `http://<服务器 IP>:6274` 访问 Web UI，并允许同一服务器 IP 上的 Web UI 调用 `6277` 端口的 proxy。

如果通过固定域名、反向代理或非默认端口访问 Web UI，需要显式配置允许来源：

```bash
docker run -d \
  --name mcp-tools-debugger \
  -p 6274:6274 \
  -p 6277:6277 \
  -e HOST=0.0.0.0 \
  -e ALLOWED_ORIGINS=http://debug.example.com \
  docker.cnb.cool/rich/public/mcp-tools-debugger:latest
```

## 二开新增功能

### 左侧栏折叠

左侧连接配置区支持折叠和展开。调试工具返回结果或查看复杂 Schema 时，可以收起左侧栏，把主要屏幕空间留给右侧 Tool 工作区。

折叠状态会保存在浏览器本地，下次打开页面时继续使用上次状态。

### 多 Profile

连接配置从单份配置升级为多 Profile 管理。每个 Profile 可以独立保存一组 MCP Server 连接信息，包括：

- Transport Type。
- Connection Type。
- stdio command、args、env。
- SSE / Streamable HTTP URL。
- OAuth 配置。
- 自定义 Headers。

Profile 支持新建、切换、重命名、克隆和删除。切换 Profile 时，工具调用历史和参数模板也会切换到对应 Profile 的数据空间，避免不同 MCP Server 的调试数据混在一起。

### 调用历史

Tool 调用会记录到调用历史中，便于回看之前的调试过程。

历史记录包含：

- Tool 名称。
- 调用参数。
- 调用结果或错误。
- 调用耗时。
- 调用时间。
- Tool metadata。

调用历史按 Profile 隔离保存，支持清空和导出，适合排查“同一个工具在不同参数下行为不一致”的问题。

### 参数模板

常用 Tool 参数可以保存为参数模板。后续调试同一个 Tool 时，可以直接套用模板，减少重复填写。

参数模板支持：

- 基于当前参数快速保存。
- 按 Tool 名称筛选可用模板。
- 使用模板回填表单。
- 更新、删除和清空模板。
- 记录模板使用次数和最后使用时间。

参数模板同样按 Profile 隔离保存。

### 浏览器缓存数据

本项目把调试侧的轻量状态保存在浏览器 `localStorage` 中，不依赖后端数据库。

主要本地数据包括：

- Profile 配置。
- 左侧栏折叠状态。
- 每个 Profile 的调用历史。
- 每个 Profile 的参数模板。
- Inspector 全局配置。

这种设计让调试器保持独立部署和无服务端存储，同时也意味着浏览器清理站点数据后，上述 Profile、历史和模板会被删除。

## 与上游 Inspector 的关系

本项目复用了 MCP Inspector 中与 MCP 连接、OAuth、Proxy、Tool Schema 展示和 Tool 调用相关的基础能力，并围绕 Tool 调试体验做了裁剪和增强。

主要差异：

- 功能范围更窄：只服务 MCP Tool 调试。
- 页面信息更集中：核心区域围绕 Tool 列表、参数表单和调用结果组织。
- 增加多 Profile、调用历史、参数模板和左侧栏折叠。
- 本地缓存结构更明确：连接配置、历史、模板都按 Profile 保存。

## 许可证

MIT，详见 [LICENSE](./LICENSE)。

## 来源说明

- 感谢 [Model Context Protocol](https://modelcontextprotocol.io/) 团队和 [MCP Inspector](https://github.com/modelcontextprotocol/inspector) 项目。
- `client/src/lib/`、`client/src/utils/`、`client/src/components/ui/` 和 `server/` 中的大量代码来源于上游 MIT 许可项目，并在本项目中围绕 MCP Tool 调试场景做了裁剪和调整。
- 感谢 [LINUX DO](https://linux.do/)
