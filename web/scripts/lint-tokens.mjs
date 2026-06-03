#!/usr/bin/env node
/**
 * Wrapper around matcha-oat's check-no-raw-values.mjs that handles glob
 * expansion. Exits 0 if no files match (safe before component dirs exist).
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import path from "node:path";

const require = createRequire(import.meta.url);
const fg = (await import("fast-glob")).default;

const patterns = process.argv.slice(2);
if (patterns.length === 0) {
  console.error("usage: lint-tokens.mjs <glob...>");
  process.exit(2);
}

const files = await fg(patterns);
if (files.length === 0) {
  console.log("OK — no files matched the lint:tokens globs (dirs not yet created).");
  process.exit(0);
}

const checkerPath = path.resolve(
  fileURLToPath(import.meta.url),
  "../../node_modules/matcha-oat-design-system/scripts/check-no-raw-values.mjs"
);
const result = spawnSync(process.execPath, [checkerPath, ...files], { stdio: "inherit" });
process.exit(result.status ?? 1);
