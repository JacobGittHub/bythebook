// Checks the agent docs against the repository, so they can't drift silently:
// - every file, folder, route, package and code name that AGENTS.md or docs/ puts in
//   backticks exists;
// - plans name future code, so only their links to docs and other plans are checked;
// - every doc is listed in AGENTS.md's "Read before working on…" table;
// - plans/README.md's index lists every plan with the status the plan itself gives;
// - docs carry no review dates (they were bumped on every edit, so they claimed a review that
//   never happened).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "..");

/**
 * Named in the docs as planned or absent. The test fails once one of them exists, so the
 * doc that calls it planned gets updated.
 */
const NOT_BUILT = new Set([
  "src/lib/chess/openingTree.ts",
  "src/lib/chess/weights.ts",
  "src/components/territory/",
  "src/components/hyperbolic/",
  "OpeningGlobe.tsx",
  "BookBranchView",
  "BRANCH_STEP",
  "@react-spring/three",
  "interpolateZoom",
  "PUBLISHER_EMAIL",
  "PUBLISHER_PASSWORD",
]);

/**
 * Names that aren't in this repository's code: library APIs, removed code the docs record as
 * history, gitignored local files and folders, and folders that stay empty until used.
 */
const NOT_IN_REPO = new Set([
  "InstancedMesh",
  "instanceMatrix",
  "instanceColor",
  "OpeningTreeGraph",
  "useMoveTreeLayout",
  ".claude/settings.local.json",
  "test-results/",
  "playwright-report/",
  "e2e/screens/bugs/",
]);

/** What CI sees: tracked files plus new ones that aren't ignored. */
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
  cwd: ROOT,
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean)
  .filter((file) => {
    try {
      readFileSync(path.join(ROOT, file));
      return true;
    } catch {
      return false; // deleted but not yet committed
    }
  });
const fileSet = new Set(files);
const dirSet = new Set(files.flatMap((file) => file.split("/").slice(0, -1).map((_, i, parts) => parts.slice(0, i + 1).join("/"))));
const names = new Set(files.flatMap((file) => file.split("/")));

/** A file's text, with Windows line endings made plain so the patterns below hold on any checkout. */
const read = (file: string) => readFileSync(path.join(ROOT, file), "utf8").replace(/\r\n/g, "\n");

const pkg = JSON.parse(read("package.json"));
const packages = new Set(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }));

/** All code the docs may name, in one string. Generated files and data are left out. */
const sourceText = files
  .filter(
    (f) =>
      (/^(src|scripts|supabase|e2e)\//.test(f) && /\.(ts|tsx|mts|mjs|css|sql)$/.test(f)) ||
      /^\.github\/workflows\/.+\.yml$/.test(f),
  )
  .concat(["next.config.ts", "playwright.config.ts", "package.json"])
  .map(read)
  .join("\n");

const docFiles = files.filter((f) => f.startsWith("docs/") && f.endsWith(".md"));
const planFiles = files.filter((f) => f.startsWith("plans/") && f.endsWith(".md"));

/** The backticked spans of a markdown file, outside fenced code blocks. */
function backticked(file: string): string[] {
  const text = read(file).replace(/```[\s\S]*?```/g, "");
  return [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1].trim());
}

function globToRegExp(glob: string) {
  const body = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*\/?|\*/g, (m) => (m === "*" ? "[^/]*" : ".*"));
  return new RegExp(`(^|/)${body}$`);
}

/** A path, as written from the root, the doc's folder, docs/ or src/ (docs shorten all four). */
function pathExists(token: string, from: string): boolean {
  if (packages.has(token)) return true;
  const clean = token.replace(/\/+$/, "");
  if (clean.startsWith("node_modules/")) return existsSync(path.join(ROOT, clean)); // after npm ci
  if (clean.includes("*")) return files.some((file) => globToRegExp(clean).test(file));
  if (!clean.includes("/")) return names.has(clean);
  return ["", path.posix.dirname(from), "docs", "src"].some((base) => {
    const full = path.posix.join(base, clean);
    return fileSet.has(full) || dirSet.has(full);
  });
}

function routeExists(token: string): boolean {
  const route = token.replace(/[?#*].*$/, "").replace(/\/+$/, "");
  const dir = path.posix.join("src/app", route);
  return (
    fileSet.has(`${dir}/page.tsx`) ||
    fileSet.has(`${dir}/route.ts`) ||
    dirSet.has(dir) ||
    read("next.config.ts").includes(`source: "${route || "/"}"`)
  );
}

type Ref = { check: "path" | "route" | "name"; name: string };

/** What a backticked span refers to, or null when it isn't something the repo can confirm. */
function classify(token: string): Ref | null {
  if (/[…<> '"=,;{}]/.test(token) || token.startsWith("@/")) return null;
  if (token.startsWith("/")) return { check: "route", name: token };
  if (/^[\w-]+(\.[\w-]+)+\//.test(token)) return null; // a URL such as github.com/…
  if (token.includes("/") || /\.(ts|tsx|mts|mjs|js|json|md|sql|css|svg|png|wasm)$/.test(token)) {
    return { check: "path", name: token };
  }
  const name = token.replace(/\(\)$/, "");
  if (/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/.test(name)) return { check: "name", name };
  if (/^[A-Za-z_$][\w$]*$/.test(name) && /[a-z][A-Z]|^[A-Z][a-z]+[A-Z]/.test(name)) {
    return { check: "name", name };
  }
  return null;
}

function exists({ check, name }: Ref, from: string) {
  if (check === "route") return routeExists(name);
  if (check === "path") return pathExists(name, from);
  return new RegExp(`(^|[^\\w$])${name.replace(/\$/g, "\\$")}($|[^\\w$])`).test(sourceText);
}

describe("agent docs", () => {
  it("name only files, routes, packages and code that exist", () => {
    const missing = new Set<string>();
    for (const file of ["AGENTS.md", ...docFiles]) {
      for (const token of backticked(file)) {
        const ref = classify(token);
        if (!ref || NOT_IN_REPO.has(ref.name) || NOT_BUILT.has(ref.name)) continue;
        if (!exists(ref, file)) missing.add(`${file}: ${token}`);
      }
    }
    expect([...missing]).toEqual([]);
  });

  it("don't call anything planned once it exists", () => {
    const built = [...NOT_BUILT].filter((name) => {
      const ref = classify(name);
      return ref !== null && exists(ref, "AGENTS.md");
    });
    expect(built, "now built: update the docs that call it planned, then remove it here").toEqual([]);
  });

  it("are all listed in AGENTS.md", () => {
    const agents = read("AGENTS.md");
    const unlisted = docFiles.filter((doc) => doc !== "docs/README.md" && !agents.includes(doc));
    expect(unlisted).toEqual([]);
  });

  it("carry no review dates", () => {
    const dated = ["AGENTS.md", ...docFiles].filter((file) => /last reviewed/i.test(read(file)));
    expect(dated).toEqual([]);
  });
});

describe("plans", () => {
  const index = read("plans/README.md");
  const rows = new Map(
    [...index.matchAll(/^\| \[([\w-]+\.md)\]\(\1\) \| `?(\w+)`? \|/gm)].map((m) => [m[1], m[2]]),
  );
  const statuses = [...(index.match(/^Statuses:([\s\S]*?)\n\n/m)?.[1] ?? "").matchAll(/`(\w+)`/g)].map(
    (m) => m[1],
  );
  const plans = planFiles.filter((file) => file !== "plans/README.md");

  it("are each in the index with the status the plan gives", () => {
    const wrong: string[] = [];
    for (const file of plans) {
      const name = path.posix.basename(file);
      const header = read(file).match(/^Status: (\w+) · Updated: \d{4}-\d{2}-\d{2} · Depends on: (.+)$/m);
      if (!header) {
        wrong.push(`${name}: no "Status: … · Updated: YYYY-MM-DD · Depends on: …" line`);
        continue;
      }
      const [, status, dependsOn] = header;
      if (!statuses.includes(status)) wrong.push(`${name}: status "${status}" isn't in the README's list`);
      if (rows.get(name) !== status) wrong.push(`${name}: index says "${rows.get(name)}", plan says "${status}"`);
      for (const [dep] of dependsOn.matchAll(/[\w-]+\.md/g)) {
        if (!fileSet.has(`plans/${dep}`)) wrong.push(`${name}: depends on missing ${dep}`);
      }
    }
    for (const name of rows.keys()) {
      if (!fileSet.has(`plans/${name}`)) wrong.push(`README.md: index lists missing ${name}`);
    }
    expect(wrong).toEqual([]);
  });

  it("link only to docs and plans that exist", () => {
    const broken: string[] = [];
    for (const file of planFiles) {
      for (const token of backticked(file)) {
        if (/^[\w./-]+\.md$/.test(token) && !pathExists(token, file)) broken.push(`${file}: ${token}`);
      }
    }
    expect(broken).toEqual([]);
  });
});
