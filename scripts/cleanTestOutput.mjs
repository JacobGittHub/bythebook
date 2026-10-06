// Prints the size of what Playwright runs leave behind (reports, traces, videos, failure
// diffs), then deletes it. Baselines are kept: `npm run screens:flush` handles those
// (plans/testing.md, D3 and D8). Usage: npm run test:e2e:clean
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUTPUT_DIRS = ["test-results", "playwright-report", "blob-report"];

function size(dir) {
  return readdirSync(dir, { withFileTypes: true }).reduce((sum, entry) => {
    const file = path.join(dir, entry.name);
    return sum + (entry.isDirectory() ? size(file) : statSync(file).size);
  }, 0);
}

const mb = (bytes) => `${(bytes / 1e6).toFixed(1)} MB`;

let total = 0;
for (const name of OUTPUT_DIRS) {
  const dir = path.join(ROOT, name);
  if (!existsSync(dir)) continue;
  const bytes = size(dir);
  total += bytes;
  rmSync(dir, { recursive: true, force: true });
  console.log(`${mb(bytes).padStart(9)}  ${name}/ deleted`);
}
console.log(total > 0 ? `${mb(total).padStart(9)}  total` : "Nothing to delete.");
