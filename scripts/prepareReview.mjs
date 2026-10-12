// Readies a review worktree (AGENTS.md § "Reviews"): copies .env.local into it, gives its
// browser tests their own port, and installs its dependencies. A worktree holds only
// committed files, and .env.local is the one ignored file the app needs.
// Usage, from the main folder, after `git worktree add --detach ../bythebook-review <commit>`:
//   npm run review:prepare            (the folder defaults to ../bythebook-review)
//   npm run review:prepare -- <folder>
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const target = path.resolve(process.argv[2] ?? path.join(ROOT, "..", "bythebook-review"));
/** The main folder's tests use 3000 (playwright.config.ts), so a review's never reuse its server. */
const REVIEW_PORT = 3100;

const same = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

// Only a worktree of this repository, never the main folder or any other folder, gets the secrets.
const worktrees = execFileSync("git", ["worktree", "list", "--porcelain"], { cwd: ROOT, encoding: "utf8" })
  .split("\n")
  .filter((line) => line.startsWith("worktree "))
  .map((line) => line.slice("worktree ".length).trim());
if (same(target, ROOT)) {
  console.error("That is the main folder. Name the review worktree instead.");
  process.exit(1);
}
if (!worktrees.some((dir) => same(dir, target))) {
  console.error(`${target} is not a review worktree of this repository. Create it first:`);
  console.error(`  git worktree add --detach ${path.relative(ROOT, target)} <commit>`);
  process.exit(1);
}

const env = path.join(ROOT, ".env.local");
if (existsSync(env)) {
  copyFileSync(env, path.join(target, ".env.local"));
  appendFileSync(
    path.join(target, ".env.local"),
    `\n# Added by npm run review:prepare: this worktree's browser tests use their own port.\nE2E_PORT=${REVIEW_PORT}\n`,
  );
  console.log(`Copied .env.local, with E2E_PORT=${REVIEW_PORT}.`);
} else {
  console.log("No .env.local to copy: specs that need the test account will skip.");
}

console.log("Installing dependencies (npm ci)...");
const install = spawnSync("npm", ["ci", "--no-audit", "--no-fund"], { cwd: target, stdio: "inherit", shell: true });
if (install.status !== 0) process.exit(install.status ?? 1);
console.log(`Ready: ${target}`);
