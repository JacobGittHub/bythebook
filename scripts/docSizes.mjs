// Prints what the agent docs and the largest source files cost in an agent's context, as
// estimated tokens: docs are bytes ÷ 4, source is bytes ÷ 3.5 (the Read tool adds line
// numbers). See docs/agent-context-map.md. Usage: npm run docs:sizes
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SKIP = new Set(["node_modules", ".next", ".git", "generated"]);
const LARGEST_SOURCE_FILES = 10;

function walk(dir, keep) {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    if (SKIP.has(entry.name)) return [];
    const file = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) return walk(file, keep);
    return keep(file) ? [file] : [];
  });
}

const tokens = (file, bytesPerToken) => statSync(path.join(ROOT, file)).size / bytesPerToken;
const k = (n) => `${(n / 1000).toFixed(1)}k`.padStart(7);

function print(title, rows) {
  console.log(`\n${title}`);
  for (const [file, n] of rows) console.log(`${k(n)}  ${file}`);
  console.log(`${k(rows.reduce((sum, [, n]) => sum + n, 0))}  total`);
}

const isMarkdown = (file) => file.endsWith(".md");

print(
  "Loaded in every session",
  ["CLAUDE.md", "AGENTS.md"].map((file) => [file, tokens(file, 4)]),
);
print("Docs", walk("docs", isMarkdown).map((file) => [file, tokens(file, 4)]));
print("Plans", walk("plans", isMarkdown).map((file) => [file, tokens(file, 4)]));
print(
  `Largest source files (top ${LARGEST_SOURCE_FILES})`,
  walk("src", (file) => /\.(ts|tsx)$/.test(file))
    .map((file) => [file, tokens(file, 3.5)])
    .sort((a, b) => b[1] - a[1])
    .slice(0, LARGEST_SOURCE_FILES),
);
console.log("\nNever read src/lib/chess/generated/openingCatalogIndex.json (about 3.5M tokens).");
