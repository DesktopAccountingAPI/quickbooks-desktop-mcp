// The built server (dist/cli.js) through the official MCP TypeScript SDK client over stdio, against
// a local mock of the API: discovery, schemas, end-user selection, idempotent writes, error
// guidance, read-only mode and per-resource tools.
import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type IncomingMessage } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const KEY = "sk_test_Conformance0Key0For0SDK0Tests000010nQFLR";
const EU = "eu_01j9x4m6v4c8k2t7q0r5s3w1zb";
const CLI = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

interface Seen {
  method: string;
  url: string;
  headers: IncomingMessage["headers"];
  body: string;
}

const text = (r: unknown) => ((r as { content: { text: string }[] }).content ?? []).map((c) => c.text).join("\n");
const isError = (r: unknown) => (r as { isError?: boolean }).isError === true;

test("stdio server with the official MCP client", async (t) => {
  const seen: Seen[] = [];
  const api = createServer(async (req, res) => {
    let body = "";
    for await (const c of req) body += String(c);
    seen.push({ method: req.method ?? "", url: req.url ?? "", headers: req.headers, body });
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Daapi-Request-Id", "req_01j9x4m6v4c8k2t7q0r5s3w1zd");
    if (req.url === "/v1/end-users?limit=100") {
      res.end(JSON.stringify({ objectType: "list", url: "/v1/end-users", data: [{ id: EU, companyName: "Acme", sourceId: "a", email: "a@acme.example", integrationConnections: [{ status: "online", statusReason: null, lastHeartbeatAt: null, companyFile: { companyName: "Acme Inc" } }] }], nextCursor: null, hasMore: false }));
    } else if (req.url?.startsWith("/v1/quickbooks-desktop/invoices?")) {
      res.end(JSON.stringify({ objectType: "list", url: "/v1/quickbooks-desktop/invoices", data: [{ id: "1", refNumber: "100", total: "10.00", lines: [] }], nextCursor: null, hasMore: false }));
    } else if (req.method === "POST" && req.url === "/v1/quickbooks-desktop/customers") {
      res.statusCode = 502;
      res.setHeader("Daapi-Should-Retry", "false");
      res.end(JSON.stringify({ error: { type: "OUTCOME_UNKNOWN_ERROR", code: "QBD_WRITE_OUTCOME_UNKNOWN", message: "unknown", userFacingMessage: "x", requestId: "req_01j9x4m6v4c8k2t7q0r5s3w1zd", retryable: false, outcome: "unknown", details: {} } }));
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: { type: "INVALID_REQUEST_ERROR", code: "RESOURCE_MISSING", message: "missing", requestId: "req_x", retryable: false, outcome: "not_applied", details: {} } }));
    }
  });
  await new Promise<void>((r) => api.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;

  const open: Client[] = [];
  async function connect(args: string[] = [], env: Record<string, string> = {}) {
    const transport = new StdioClientTransport({ command: process.execPath, args: [CLI, ...args], env: { PATH: process.env.PATH ?? "", DAAPI_SECRET_KEY: KEY, DAAPI_BASE_URL: base, ...env }, stderr: "pipe" });
    const client = new Client({ name: "test", version: "1.0.0" });
    await client.connect(transport);
    open.push(client);
    return client;
  }

  try {
    await t.test("tools, instructions and discovery", async () => {
      const client = await connect();
      assert.equal(client.getServerVersion()?.name, "desktopaccountingapi-quickbooks-desktop");
      const { tools } = await client.listTools();
      assert.equal(tools.length, 5);
      assert.match(text(await client.callTool({ name: "list_api_endpoints", arguments: { search: "invoice", kind: "read" } })), /qbd\.invoices\.list/);
      // The searches the tool description and server instructions suggest find their operation.
      assert.match(text(await client.callTool({ name: "list_api_endpoints", arguments: { search: "profit and loss" } })), /^qbd\.reports\.generalSummary .*profit_and_loss_standard/m);
      assert.match(text(await client.callTool({ name: "list_api_endpoints", arguments: { search: "open invoices" } })), /^qbd\.reports\.generalDetail .*open_invoices/m);
      const schema = JSON.parse(text(await client.callTool({ name: "get_api_endpoint_schema", arguments: { endpoint: "qbd.invoices.create" } })));
      assert.equal(schema.changesData, true);
      assert.ok(schema.args.properties.body.$ref || schema.args.properties.body.type);
      await client.close();
    });

    await t.test("reads use the key and the end user; fields trim results", async () => {
      const client = await connect([], { DAAPI_END_USER_ID: EU });
      assert.match(text(await client.callTool({ name: "list_end_users", arguments: {} })), /Acme Inc/);
      const res = await client.callTool({ name: "invoke_api_endpoint", arguments: { endpoint: "qbd.invoices.list", args: { limit: 5, refNumbers: ["100", "101"] }, fields: ["id", "total"] } });
      assert.ok(!isError(res), text(res));
      const last = seen.at(-1)!;
      assert.equal(last.headers.authorization, `Bearer ${KEY}`);
      assert.equal(last.headers["daapi-end-user-id"], EU);
      const q = new URL(last.url, "http://x").searchParams;
      assert.equal(q.get("limit"), "5");
      assert.deepEqual(q.getAll("refNumbers"), ["100", "101"]);
      assert.match(text(res), /\{"objectType":"list".*"data":\[\{"id":"1","total":"10.00"\}\]/);
      await client.close();
    });

    await t.test("an unknown write outcome is never resent", async () => {
      const client = await connect([], { DAAPI_END_USER_ID: EU });
      const before = seen.length;
      const res = await client.callTool({ name: "invoke_api_endpoint", arguments: { endpoint: "qbd.customers.create", args: { body: { name: "X" } }, idempotency_key: "k-1" } });
      assert.ok(isError(res));
      assert.equal(seen.length, before + 1, "sent once");
      assert.equal(seen.at(-1)!.headers["idempotency-key"], "k-1");
      assert.match(text(res), /Do not send it again with a new idempotency key/);
      assert.match(text(res), /idempotency_key "k-1"/);
      await client.close();
    });

    await t.test("read-only mode and per-resource tools", async () => {
      const client = await connect(["--read-only", "--resources", "invoices"], { DAAPI_END_USER_ID: EU });
      const names = (await client.listTools()).tools.map((x) => x.name);
      assert.ok(names.includes("qbd_invoices_list"));
      assert.ok(!names.includes("qbd_invoices_create"));
      const before = seen.length;
      const res = await client.callTool({ name: "invoke_api_endpoint", arguments: { endpoint: "qbd.invoices.create", args: { body: {} } } });
      assert.ok(isError(res));
      assert.equal(seen.length, before, "nothing sent");
      await client.close();
    });
  } finally {
    for (const c of open) await c.close().catch(() => undefined);
    api.closeAllConnections();
    api.close();
  }
});
