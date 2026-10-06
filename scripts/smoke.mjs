// Smoke test of the built package: starts the installed `quickbooks-desktop-mcp` bin over stdio
// (resolved through the package name, so it runs in this repository and in a clean consumer that
// installed the package from the registry), speaks raw newline-delimited JSON-RPC to it and checks
// initialize, tools/list, a tool call against a local mock API (Authorization, Idempotency-Key and
// end-user headers) and read-only mode. Uses only Node.js built-ins; works on Windows, macOS and Linux.
//
//   node scripts/smoke.mjs [--expect-version 0.1.0]

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";

const NAME = "@desktopaccountingapi/quickbooks-desktop-mcp";
const i = process.argv.indexOf("--expect-version");
const expectVersion = i >= 0 ? process.argv[i + 1] : undefined;
// A valid-format test key (the SDK conformance fixture key). It authorizes nothing.
const KEY = "sk_test_Conformance0Key0For0SDK0Tests000010nQFLR";
const EU = "eu_01j9x4m6v4c8k2t7q0r5s3w1zb";

const require = createRequire(join(process.cwd(), "noop.js"));
const pkgPath = require.resolve(`${NAME}/package.json`);
const pkg = require(pkgPath);
const cli = join(dirname(pkgPath), pkg.bin["quickbooks-desktop-mcp"]);
if (expectVersion) assert.equal(pkg.version, expectVersion, "package version");

const seen = [];
const api = createServer((req, res) => {
  seen.push({ method: req.method, url: req.url, auth: req.headers.authorization, endUser: req.headers["daapi-end-user-id"], idem: req.headers["idempotency-key"] });
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Daapi-Request-Id", "req_01j9x4m6v4c8k2t7q0r5s3w1zd");
  if (req.url.startsWith("/v1/end-users")) {
    res.end(JSON.stringify({ objectType: "list", url: "/v1/end-users", data: [{ id: EU, objectType: "end_user", companyName: "Smoke Co", sourceId: "s1", email: "s@example.com", createdAt: "2026-10-05T00:00:00.000Z", integrationConnections: [] }], nextCursor: null, hasMore: false }));
  } else if (req.method === "POST" && req.url === "/v1/quickbooks-desktop/customers") {
    res.statusCode = 201;
    res.end(JSON.stringify({ id: "80000001-1700000000", objectType: "qbd_customer", name: "Smoke" }));
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({ error: { type: "INVALID_REQUEST_ERROR", code: "RESOURCE_MISSING", message: "no", requestId: "req_x", retryable: false, outcome: "not_applied" } }));
  }
});
await new Promise((r) => api.listen(0, "127.0.0.1", r));
const base = `http://127.0.0.1:${api.address().port}`;

const children = [];
async function session(args) {
  const child = spawn(process.execPath, [cli, ...args], { env: { ...process.env, DAAPI_SECRET_KEY: KEY, DAAPI_BASE_URL: base, DAAPI_END_USER_ID: EU }, stdio: ["pipe", "pipe", "inherit"] });
  children.push(child);
  const waiting = new Map();
  createInterface({ input: child.stdout }).on("line", (line) => {
    const msg = JSON.parse(line);
    waiting.get(msg.id)?.(msg);
  });
  let id = 0;
  const rpc = (method, params) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${method}`)), 20_000);
      waiting.set(n, (m) => {
        clearTimeout(timer);
        resolve(m);
      });
      child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id: n, method, params })}\n`);
    });
  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "smoke", version: "1" } });
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
  return { child, rpc, init, close: () => child.stdin.end() };
}

try {
  const s = await session([]);
  assert.equal(s.init.result.protocolVersion, "2025-06-18");
  assert.equal(s.init.result.serverInfo.name, "desktopaccountingapi-quickbooks-desktop");
  if (expectVersion) assert.equal(s.init.result.serverInfo.version, expectVersion);
  const tools = (await s.rpc("tools/list", {})).result.tools.map((t) => t.name).sort();
  assert.deepEqual(tools, ["get_api_endpoint_schema", "invoke_api_endpoint", "list_api_endpoints", "list_end_users", "search_docs"]);
  const users = await s.rpc("tools/call", { name: "list_end_users", arguments: {} });
  assert.match(users.result.content[0].text, /Smoke Co/);
  assert.equal(seen.at(-1).auth, `Bearer ${KEY}`);
  const created = await s.rpc("tools/call", { name: "invoke_api_endpoint", arguments: { endpoint: "qbd.customers.create", args: { body: { name: "Smoke" } } } });
  assert.notEqual(created.result.isError, true, created.result.content[0].text);
  assert.equal(seen.at(-1).endUser, EU);
  assert.match(seen.at(-1).idem ?? "", /^[0-9a-f-]{36}$/);
  s.close();

  const ro = await session(["--read-only"]);
  const refused = await ro.rpc("tools/call", { name: "invoke_api_endpoint", arguments: { endpoint: "qbd.customers.create", args: { body: { name: "x" } } } });
  assert.equal(refused.result.isError, true);
  assert.match(refused.result.content[0].text, /read-only/);
  ro.close();
  console.log(`${NAME}@${pkg.version}: stdio smoke test passed on Node.js ${process.version} (${process.platform})`);
} finally {
  for (const c of children) if (c.exitCode === null) c.kill();
  api.closeAllConnections();
  api.close();
}
