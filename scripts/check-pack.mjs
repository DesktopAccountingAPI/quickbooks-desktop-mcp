// Checks what `npm pack` would publish: only dist/, README.md, LICENSE, CHANGELOG.md and
// package.json, with the CLI, the library entry, its declarations and the endpoint catalog.

import { execFileSync } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const out = execFileSync(npm, ["pack", "--dry-run", "--json", "--ignore-scripts"], { encoding: "utf8", shell: process.platform === "win32" });
const [info] = JSON.parse(out);
const files = info.files.map((f) => f.path).sort();

const allowed = /^(dist\/.+\.(js|d\.ts)|dist\/catalog\.json|README\.md|LICENSE|CHANGELOG\.md|package\.json)$/;
const unexpected = files.filter((f) => !allowed.test(f));
const required = ["package.json", "README.md", "LICENSE", "CHANGELOG.md", "dist/cli.js", "dist/index.js", "dist/index.d.ts", "dist/catalog.json"];
const missing = required.filter((f) => !files.includes(f));

console.log(`${info.name}@${info.version}: ${files.length} files, ${info.size} bytes packed, ${info.unpackedSize} bytes unpacked`);
if (unexpected.length > 0 || missing.length > 0) {
  if (unexpected.length > 0) console.error(`unexpected files in package:\n  ${unexpected.join("\n  ")}`);
  if (missing.length > 0) console.error(`missing files in package:\n  ${missing.join("\n  ")}`);
  process.exit(1);
}
