# Changelog

## 0.1.0

First release of `@desktopaccountingapi/quickbooks-desktop-mcp`, generated from API contract sha256 `1cc3058cecb5` (API version 1.0.0, 275 operations).

- Local MCP server over stdio: `npx -y @desktopaccountingapi/quickbooks-desktop-mcp`. Node.js 20 or later on Windows, macOS and Linux; no other runtime and no runtime dependencies.
- Tools: `list_end_users`, `list_api_endpoints`, `get_api_endpoint_schema`, `invoke_api_endpoint`, `search_docs`; optional one tool per operation with `--resources`.
- Writes carry an `Idempotency-Key`; an unknown outcome is reported with recovery steps, never resent.
- `--read-only` hides and refuses writes; read-only secret keys are enforced by the API.
- Library exports (`McpServer`, `handleMcpRequest`, `Tools`) to embed the server in your own process.
