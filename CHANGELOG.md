# Changelog

## Unreleased

## 0.5.2 (2026-10-09)

- Released in lockstep with the other Desktop Accounting API packages; no entries for this package.

## 0.5.1 (2026-10-09)

- Released in lockstep with the other Desktop Accounting API packages; no entries for this package.

## 0.5.0 (2026-10-09)

- `list_api_endpoints` finds the searches its description suggests: "profit and loss" and "open invoices" now return the report operation and name the matching `reportType` (for example `profit_and_loss_standard`, `open_invoices`). Words match as tokens against the operation name, resource, summary, description, path, parameter names and report types; case, plurals and stop words do not matter, common synonyms count (P&L, A/R, supplier for vendor), and results come best match first. An exact operation or tool name (`qbd.salesOrders.list`, `qbd_sales_orders_list`, `generalSummary`) is found and listed first.

## 0.4.0 (2026-10-08)

- The endpoint catalog follows the API contract: employee responses carry the warning `QBD_PERSONAL_DATA_WITHHELD` for each Social Security number QuickBooks withheld, integration connections report `personalDataAccess`, and a failed passthrough's error `details.requests` lists the status of every qbXML message.

## 0.3.0 (2026-10-08)

- Error results give the error catalog's cause and fixes before the `<untrusted-data>` envelope, so the model follows them; the message and details, which can quote QuickBooks data, stay inside it.
- A write whose outcome is pending and one whose outcome is unknown get different guidance, and both name the request that keeps running (`details.requestId`) instead of the HTTP call's ID. A read timeout gets a next step, a non-JSON error on a write says to resend only with the same idempotency key, and `Retry-After` is passed on.
- The endpoint catalog follows the API contract: `qbd.reports.budgetSummary` requires `fiscalYear`, the inventory valuation summary no longer takes `basis` (QuickBooks rejects it), and the `connection.company_file_remarked` webhook event is listed.

## 0.2.1 (2026-10-07)

- The endpoint catalog follows API contract sha256 `b5774d24bc81` (documentation only): `revisionNumber` and `updatedAt` change at most once per second, the status 3261 personal-data fixes, and what item sites return without Advanced Inventory.

## 0.2.0 (2026-10-07)

- QuickBooks data in tool results, and error details that may quote it, is wrapped in an `<untrusted-data>` envelope with a fixed note telling the model not to follow instructions inside it. `<` is escaped, so the data cannot close the envelope.
- `destructiveHint` marks every write tool except additive ones (creates, and testing or resending a webhook), so clients ask before an update, delete, void, cancel, passthrough, secret rotation or company file reset.
- Without `--read-only`, the server recognizes a read-only secret key, with a check that changes nothing, and hides the write tools.
- `--code-allow-http-gets`, Conductor's read-only flag, is accepted as an alias of `--read-only`, and `handleMcpRequest` treats Conductor's `x-stainless-mcp-client-permissions` header as read-only.
- The endpoint catalog follows the API contract: with `ids` or `refNumbers`, `limit` is ignored (every match comes in one page) instead of rejected.

## 0.1.1 (2026-10-06)

- The README is rewritten: setup for each MCP client, read-only keys, the tools and library use. Its code samples are type-checked against the package before release.

## 0.1.0 (2026-10-06)

First release of `@desktopaccountingapi/quickbooks-desktop-mcp`, generated from API contract sha256 `1cc3058cecb5` (API version 1.0.0, 275 operations).

- Local MCP server over stdio: `npx -y @desktopaccountingapi/quickbooks-desktop-mcp`. Node.js 20 or later on Windows, macOS and Linux; no other runtime and no runtime dependencies.
- Tools: `list_end_users`, `list_api_endpoints`, `get_api_endpoint_schema`, `invoke_api_endpoint`, `search_docs`; optional one tool per operation with `--resources`.
- Writes carry an `Idempotency-Key`; an unknown outcome is reported with recovery steps, never resent.
- `--read-only` hides and refuses writes; read-only secret keys are enforced by the API.
- Library exports (`McpServer`, `handleMcpRequest`, `Tools`) to embed the server in your own process.
