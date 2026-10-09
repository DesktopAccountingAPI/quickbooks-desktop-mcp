# Changelog

## Unreleased

- `list_api_endpoints` finds the searches its description suggests: "profit and loss" and "open invoices" now return the report operation and name the matching `reportType` (for example `profit_and_loss_standard`, `open_invoices`). Words match as tokens against the operation name, resource, summary, description, path, parameter names and report types; case, plurals and stop words do not matter, common synonyms count (P&L, A/R, supplier for vendor), and results come best match first. An exact operation or tool name (`qbd.salesOrders.list`, `qbd_sales_orders_list`, `generalSummary`) is found and listed first.

## 0.1.0

First release of `@desktopaccountingapi/quickbooks-desktop-mcp`, generated from API contract sha256 `1fc5496cc47b` (API version 1.0.0, 275 operations).

- Local MCP server over stdio: `npx -y @desktopaccountingapi/quickbooks-desktop-mcp`. Node.js 20 or later on Windows, macOS and Linux; no other runtime and no runtime dependencies.
- Tools: `list_end_users`, `list_api_endpoints`, `get_api_endpoint_schema`, `invoke_api_endpoint`, `search_docs`; optional one tool per operation with `--resources`.
- Writes carry an `Idempotency-Key`; an unknown outcome is reported with recovery steps, never resent.
- `--read-only` hides and refuses writes; read-only secret keys are enforced by the API.
- Library exports (`McpServer`, `handleMcpRequest`, `Tools`) to embed the server in your own process.
