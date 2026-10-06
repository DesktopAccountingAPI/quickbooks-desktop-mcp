// Builds dist/ (ES modules with declarations), copies the endpoint catalog next to the CLI and
// marks the CLI executable. Runs on `npm run build` and on `prepare`.

import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// typescript does not export ./bin/tsc, so resolve the installed file directly.
const tsc = join(root, "node_modules", "typescript", "bin", "tsc");

rmSync(join(root, "dist"), { recursive: true, force: true });
const r = spawnSync(process.execPath, [tsc, "-p", join(root, "tsconfig.build.json")], { stdio: "inherit", cwd: root });
if (r.status !== 0) process.exit(r.status ?? 1);
copyFileSync(join(root, "src", "catalog.json"), join(root, "dist", "catalog.json"));
chmodSync(join(root, "dist", "cli.js"), 0o755);
