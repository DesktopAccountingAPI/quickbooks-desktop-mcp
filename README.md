# Desktop Accounting API MCP server

`@desktopaccountingapi/quickbooks-desktop-mcp` connects Claude, Cursor, VS Code, Codex and other AI tools to QuickBooks Desktop through [Desktop Accounting API](https://www.desktopaccountingapi.com/) and the [Model Context Protocol](https://modelcontextprotocol.io). Ask in plain English for overdue invoices, a vendor's payment history or last month's profit and loss, and the agent finds the operation, calls the API and answers from the company file.

- Covers all 275 operations of API 1.0.0 through five compact tools, so it does not fill the agent's context.
- Writes carry an idempotency key and are never retried blindly. Read-only keys are enforced by the API itself.
- Runs over stdio with Node.js 20 or later on Windows, macOS and Linux, with no runtime dependencies.

The current version is **0.5.1**. [MCP guide](https://www.desktopaccountingapi.com/docs/guides/mcp/) · [Documentation](https://www.desktopaccountingapi.com/docs/) · [Changelog](CHANGELOG.md) · [Status](https://status.desktopaccountingapi.com)

## Hosted server or local package

Both expose the same tools and call the same API with your secret key:

| | Hosted server | This package |
| --- | --- | --- |
| Address | `https://mcp.desktopaccountingapi.com/` (Streamable HTTP) | `npx -y @desktopaccountingapi/quickbooks-desktop-mcp` (stdio) |
| Install | Nothing | Node.js 20 or later |
| Secret key | `Authorization: Bearer sk_...` header | `DAAPI_SECRET_KEY` environment variable |
| Use it when | Your client supports remote servers with a header | Your client runs only local servers, or you prefer a local process |

## Before you start

- Create a secret key in the [dashboard](https://www.desktopaccountingapi.com/dashboard) under **API keys**. Use a separate key per person or tool, so you can revoke one without affecting the rest. For tools that should only look things up, choose **Read-only** (see [Read-only access](#read-only-access)). Test projects issue `sk_test_...` keys, production projects `sk_live_...` keys.
- Connect at least one end user's QuickBooks Desktop company file. QuickBooks must be open on that computer for data requests to succeed.

Replace `sk_live_...` below with your key. Keep it in your client's configuration only, never in shared documents, chat or a repository.

## Setup

### Claude Desktop

Open **Settings > Developer > Edit Config** (`claude_desktop_config.json`) and add:

```json
{
  "mcpServers": {
    "quickbooks-desktop": {
      "command": "npx",
      "args": ["-y", "@desktopaccountingapi/quickbooks-desktop-mcp@0.5.1"],
      "env": { "DAAPI_SECRET_KEY": "sk_live_..." }
    }
  }
}
```

If the file already has an `mcpServers` section, add the `quickbooks-desktop` entry inside it, then restart Claude Desktop. Drop `@0.5.1` from the package name to always run the latest version.

### Claude Code

```sh
claude mcp add quickbooks-desktop --env DAAPI_SECRET_KEY=sk_live_... -- npx -y @desktopaccountingapi/quickbooks-desktop-mcp
```

Or the hosted server:

```sh
claude mcp add --transport http quickbooks-desktop https://mcp.desktopaccountingapi.com/ --header "Authorization: Bearer sk_live_..."
```

Add `--scope user` to make it available in all your projects.

### Cursor

In `~/.cursor/mcp.json`, or `.cursor/mcp.json` inside a project:

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

For the hosted server, replace `command`, `args` and `env` with `"url": "https://mcp.desktopaccountingapi.com/"` and `"headers": { "Authorization": "Bearer sk_live_..." }`.

### VS Code

Run **MCP: Open User Configuration** from the Command Palette, or use `.vscode/mcp.json` in a workspace. The top-level key is `servers`:

```json
{
  "inputs": [{ "type": "promptString", "id": "daapi-key", "description": "Desktop Accounting API secret key", "password": true }],
  "servers": {
    "quickbooks-desktop": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@desktopaccountingapi/quickbooks-desktop-mcp"],
      "env": { "DAAPI_SECRET_KEY": "${input:daapi-key}" }
    }
  }
}
```

VS Code asks for the key once and stores it securely, so it never sits in the file.

### Other clients

Any stdio client: run `npx -y @desktopaccountingapi/quickbooks-desktop-mcp` with `DAAPI_SECRET_KEY` set. Any client that supports remote servers with custom headers can use `https://mcp.desktopaccountingapi.com/` with `Authorization: Bearer sk_live_...`. Setup for Codex CLI and more clients is in the [MCP guide](https://www.desktopaccountingapi.com/docs/guides/mcp/).

### Verify it works

Ask the agent: "List my QuickBooks Desktop end users and show the 5 most recent invoices for the first one." If it returns real data from the company file, you are set up. The key is checked when the agent first requests data, so a "connected" indicator alone does not prove the key works.

## Options

| Flag | Environment | Meaning |
| --- | --- | --- |
| | `DAAPI_SECRET_KEY` | Secret key (`sk_live_...` or `sk_test_...`). Required. |
| `--read-only` | `DAAPI_MCP_READ_ONLY=true` | Hide and refuse operations that change data. |
| `--resources invoices,customers` | `DAAPI_MCP_RESOURCES` | Also expose one tool per operation for these resources (`all` for every operation). |
| `--end-user-id eu_...` | `DAAPI_END_USER_ID` | Default end user (company file) for QuickBooks operations. A tool call's `end_user_id` overrides it. |
| `--base-url <url>` | `DAAPI_BASE_URL` | API origin. Default `https://api.desktopaccountingapi.com`. |
| `--version` | | Print the version. |
| `--help` | | Print the options. |

We recommend a **read-only** secret key for AI tools. The API rejects every write made with it (`403 API_KEY_READ_ONLY`), whatever the client does, and the server detects such a key and hides write operations without `--read-only`. QuickBooks data in tool results is wrapped in `<untrusted-data>` with a note telling the model not to follow instructions found inside it.

## Tools

| Tool | What it does |
| --- | --- |
| `list_end_users` | Your end users (one QuickBooks company file each), with connection status and QuickBooks company name. |
| `list_api_endpoints` | Searches the operations by resource, name, words or report type, for example "open invoices" or "profit and loss", and names the matching report types. |
| `get_api_endpoint_schema` | One operation's description and the JSON Schema of its arguments. |
| `invoke_api_endpoint` | Calls an operation and returns its JSON result. `fields` (dot paths such as `["id", "refNumber"]`) trims each record. |
| `search_docs` | Searches the documentation, including the error codes. |

With `--resources`, each operation of those resources also becomes its own tool, such as `qbd_invoices_list` and `qbd_invoices_create`.

## Writes and safety

- By default the agent can read and write. The server instructs agents to describe each write and get your confirmation first.
- Every write carries an `Idempotency-Key`, and the result shows it. Repeating a call with the same key returns the original result instead of writing twice.
- Nothing is retried automatically. When a write's outcome is unknown, the result tells the agent not to resend it and how to check the request instead.
- Errors include the `userFacingMessage` and `fixes` from the [error catalog](https://www.desktopaccountingapi.com/docs/errors/), so the agent can tell you what to do.
- Every call appears in the dashboard's request log, like any other API call.

## Read-only access

Create a **read-only** secret key in the dashboard and use it in the setup above. The API enforces it for every client: a read-only key can call every `GET` operation and passthrough requests that contain only queries, and any other call returns `403 API_KEY_READ_ONLY` before anything reaches QuickBooks. The server recognizes a read-only key and hides write tools from the agent on its own. Add `--read-only` (or `DAAPI_MCP_READ_ONLY=true`) to hide them for a full-access key too; the read-only key is what guarantees writes cannot happen.

## Use as a library

`handleMcpRequest(request, options)` serves Streamable HTTP from any runtime with web-standard `Request` and `Response`, such as Cloudflare Workers, Deno or Bun:

```ts
import { buildCatalog, handleMcpRequest } from "@desktopaccountingapi/quickbooks-desktop-mcp";

// The tool catalog comes from the API's OpenAPI document, published with the documentation.
const spec = await (await fetch("https://www.desktopaccountingapi.com/docs/openapi.json")).json();
const catalog = buildCatalog(spec);

export default {
  fetch: (request: Request): Promise<Response> =>
    handleMcpRequest(request, { catalog, version: "1.0.0", apiBaseUrl: "https://api.desktopaccountingapi.com" }),
};
```

Clients send their own secret key as `Authorization: Bearer sk_...`; the server passes it to the API unchanged. `McpServer` and `Tools` are exported for other transports.

## Troubleshooting

- **"No secret key reached the MCP server".** `DAAPI_SECRET_KEY` (or the `Authorization` header for the hosted server) is missing or not passed through.
- **"The secret key ... is malformed".** The key was cut off or mistyped. Copy it again from the dashboard.
- **`API_KEY_INVALID`.** The key is unknown or was revoked. The message shows only the key's last four characters.
- **Requests fail with a QuickBooks error.** QuickBooks must be open on the end user's computer and the Web Connector must be running. See [troubleshooting](https://www.desktopaccountingapi.com/docs/troubleshooting/).

## Versioning and changelog

- The package follows [semantic versioning](https://semver.org/) and is released together with the [Node.js](https://github.com/DesktopAccountingAPI/quickbooks-desktop-node), [Python](https://github.com/DesktopAccountingAPI/quickbooks-desktop-python), [.NET](https://github.com/DesktopAccountingAPI/quickbooks-desktop-dotnet) and [Java](https://github.com/DesktopAccountingAPI/quickbooks-desktop-java) SDKs, with the same version number.
- It is generated from the Desktop Accounting API contract (sha256 `3d102b7bcecb...` for this release) by the same pipeline as the SDKs.
- Every release is listed in [CHANGELOG.md](CHANGELOG.md) and tagged `v<version>` on GitHub.

## Support

- [MCP guide](https://www.desktopaccountingapi.com/docs/guides/mcp/), [documentation](https://www.desktopaccountingapi.com/docs/) and [status page](https://status.desktopaccountingapi.com).
- Bugs and feature requests for this package: [GitHub issues](https://github.com/DesktopAccountingAPI/quickbooks-desktop-mcp/issues).
- Questions about your account, keys, billing or a connection: [contact us](https://www.desktopaccountingapi.com/contact). Never send your secret key.
- Security reports: use **Report a vulnerability** on this repository's Security tab.

## Development

```sh
mise install        # pinned Node.js
mise run check      # install, typecheck, build, tests with the official MCP client, README samples, smoke test, package contents
```

This README is generated; `mise run check` parses its JSON configuration blocks and type-checks its TypeScript sample against the build.

## License

MIT. See [LICENSE](LICENSE).

QuickBooks is a registered trademark of Intuit Inc. Desktop Accounting API is an independent product and is not affiliated with, endorsed by, or approved by Intuit Inc.
