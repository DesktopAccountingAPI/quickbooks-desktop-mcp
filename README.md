# Desktop Accounting API MCP server

`@desktopaccountingapi/quickbooks-desktop-mcp` is the local [Model Context Protocol](https://modelcontextprotocol.io) server for [Desktop Accounting API](https://www.desktopaccountingapi.com/docs/), the REST API for QuickBooks Desktop. It lets Claude, Cursor, VS Code, Codex and other AI tools look up and change QuickBooks Desktop data in plain English: overdue invoices, a vendor's payment history, last month's profit and loss.

It runs over stdio with Node.js 20 or later on Windows, macOS and Linux, and has no runtime dependencies. It covers all 275 operations of API version 1.0.0.

If your client supports remote servers with a header, you can skip the install and use the hosted server at `https://mcp.desktopaccountingapi.com/`. Setup for every client: [MCP guide](https://www.desktopaccountingapi.com/docs/guides/mcp/).

## Setup

You need a secret key from the dashboard (**API keys**) and at least one connected QuickBooks Desktop company file.

Claude Desktop (`claude_desktop_config.json`, **Settings > Developer > Edit Config**):

```json
{
  "mcpServers": {
    "quickbooks-desktop": {
      "command": "npx",
      "args": ["-y", "@desktopaccountingapi/quickbooks-desktop-mcp"],
      "env": { "DAAPI_SECRET_KEY": "sk_live_..." }
    }
  }
}
```

Claude Code:

```sh
claude mcp add quickbooks-desktop --env DAAPI_SECRET_KEY=sk_live_... -- npx -y @desktopaccountingapi/quickbooks-desktop-mcp
```

Any other stdio client: run `npx -y @desktopaccountingapi/quickbooks-desktop-mcp` with `DAAPI_SECRET_KEY` set.

## Options

| Flag | Environment | Meaning |
| --- | --- | --- |
| | `DAAPI_SECRET_KEY` | Secret key (`sk_live_...` or `sk_test_...`). |
| `--read-only` | `DAAPI_MCP_READ_ONLY=true` | Hide and refuse operations that change data. |
| `--resources invoices,customers` | `DAAPI_MCP_RESOURCES` | Also expose one tool per operation for these resources (`all` for every operation). |
| `--end-user-id eu_...` | `DAAPI_END_USER_ID` | Default end user (company file) for QuickBooks operations. |
| `--base-url <url>` | `DAAPI_BASE_URL` | API origin. Default `https://api.desktopaccountingapi.com`. |

For a limit the API itself enforces, create a **read-only** secret key in the dashboard. The API rejects every write made with it (`403 API_KEY_READ_ONLY`), whatever the client does.

## Tools

| Tool | What it does |
| --- | --- |
| `list_end_users` | Your end users (one QuickBooks company file each) and their connection status. |
| `list_api_endpoints` | Search the operations by resource, name or words. |
| `get_api_endpoint_schema` | One operation's description and input schema. |
| `invoke_api_endpoint` | Call an operation. Writes carry an `Idempotency-Key`; an unknown outcome is reported with recovery steps, never resent. |
| `search_docs` | Search the documentation. |

## Use as a library

```ts
import { McpServer, handleMcpRequest } from "@desktopaccountingapi/quickbooks-desktop-mcp";
```

`handleMcpRequest(request, options)` serves Streamable HTTP from any runtime with web-standard `Request` and `Response`.

## Versioning

Generated from the Desktop Accounting API contract (sha256 `1cc3058cecb5`) by the same pipeline as the SDKs, and released in lockstep with them. See [CHANGELOG.md](CHANGELOG.md).

## Development

```sh
mise install        # pinned Node.js
mise run check      # install, typecheck, build, tests with the official MCP client, smoke test, package contents
```

## License

MIT
