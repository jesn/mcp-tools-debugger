# MCP Tools Debugger

A standalone debugger for **Model Context Protocol (MCP)** server tools — connect to any MCP server and interactively inspect & call its `tools/*` API.

> Forked & extracted from the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) project, focused exclusively on the tools-debugging workflow. Other capabilities (resources, prompts, sampling, roots, elicitation, tasks, apps) have been intentionally removed to keep the surface area minimal.

## What it does

- **Left pane** — Connection configuration: Transport Type (`stdio` / `sse` / `streamable-http`), URL, Connection Type (direct / proxy), Stdio command + args + env, OAuth 2.0, Custom Headers.
- **Right pane** — Tools workspace: list tools, view JSON Schemas, fill arguments via a dynamic form, call tools and inspect responses, copy outputs.

## Quick start

```bash
npm install
npm run build
npm start
```

Open `http://localhost:6274`.

### Development

```bash
npm run dev
```

This starts the client (Vite on `6274`) and the proxy server (`6277`) concurrently with hot reload.

### Tests

```bash
cd client && npm test
```

## Project layout

```
client/   # React + Vite UI (Sidebar + ToolsTab)
server/   # Express-based MCP proxy
```

## Configuration

The MCP proxy server is reused from MCP Inspector as a transparent transport layer (stdio / SSE / streamable-HTTP). Behavior is configured through query params on first load:

- `MCP_PROXY_PORT` — proxy server port (default `6277`)
- `MCP_PROXY_AUTH_TOKEN` — auth token for proxy access

Persistent prefs (transport, URL, OAuth client id, custom headers) are stored in `localStorage`.

## OAuth flow

The OAuth Debugger lets you walk through the full PKCE flow step-by-step. The browser must allow the callback paths:

- `/oauth/callback`
- `/oauth/callback/debug`

Vite dev server and the production static serve both fall back to `index.html` for unknown routes.

## License

MIT — see [LICENSE](./LICENSE).

## Acknowledgements

- [Model Context Protocol](https://modelcontextprotocol.io/) team and the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) project — the codebase this debugger was extracted from.
- All `client/src/lib/`, `client/src/utils/`, `client/src/components/ui/`, and `server/` code originates from the upstream MIT-licensed project.
