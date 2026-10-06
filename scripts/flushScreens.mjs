// Screenshot tests are temporary (plans/testing.md, D8). This lists them with their
// baselines, and deletes the ones that are finished with.
//
//   npm run screens:flush                 list every screenshot spec, and delete baseline
//                                         folders whose spec is gone
//   npm run screens:flush -- labyrinth    delete e2e/screens/labyrinth.spec.ts and its baselines
//   npm run screens:flush -- bugs         delete every spec made from a bug report
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SCREENS = path.join(ROOT, "e2e", "screens");
const SPEC = ".spec.ts";
const SNAPSHOTS = `${SPEC}-snapshots`;

/** Every file under `dir`, as paths relative to e2e/screens with forward slashes. */
function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return entry.name.endsWith(SNAPSHOTS) ? [toName(file)] : walk(file);
    }
    return [toName(file)];
  });
}

const toName = (file) => path.relative(SCREENS, file).split(path.sep).join("/");
const toPath = (name) => path.join(SCREENS, ...name.split("/"));

/** The baseline PNGs in a snapshot folder: their count, bytes and newest change. */
function baselines(folder) {
  const dir = toPath(folder);
  if (!existsSync(dir)) return { count: 0, bytes: 0, newest: null };
  const files = readdirSync(dir).map((name) => statSync(path.join(dir, name)));
  return {
    count: files.length,
    bytes: files.reduce((sum, file) => sum + file.size, 0),
    newest: files.reduce((latest, file) => Math.max(latest, file.mtimeMs), 0) || null,
  };
}

const kb = (bytes) => `${Math.round(bytes / 1000)} kB`;
const age = (ms) => (ms === null ? "no baselines" : `${Math.floor((Date.now() - ms) / 86_400_000)} days old`);

function remove(name) {
  rmSync(toPath(`${name}${SPEC}`), { force: true });
  rmSync(toPath(`${name}${SNAPSHOTS}`), { recursive: true, force: true });
  console.log(`Deleted ${name}${SPEC} and its baselines.`);
}

const entries = walk(SCREENS);
const specs = entries.filter((name) => name.endsWith(SPEC)).map((name) => name.slice(0, -SPEC.length));
const target = process.argv[2];

if (!target) {
  // Baselines left behind by a spec that was deleted by hand.
  for (const folder of entries.filter((name) => name.endsWith(SNAPSHOTS))) {
    const spec = folder.slice(0, -SNAPSHOTS.length);
    if (!specs.includes(spec)) {
      rmSync(toPath(folder), { recursive: true, force: true });
      console.log(`Deleted ${folder}: its spec no longer exists.`);
    }
  }

  let total = 0;
  for (const spec of specs) {
    const { count, bytes, newest } = baselines(`${spec}${SNAPSHOTS}`);
    total += bytes;
    console.log(`${spec.padEnd(40)} ${String(count).padStart(3)} baselines  ${kb(bytes).padStart(7)}  ${age(newest)}`);
  }
  console.log(specs.length > 0 ? `${kb(total)} of baselines in all.` : "No screenshot specs.");
  console.log("Delete one with: npm run screens:flush -- <name>, or every bug spec with -- bugs");
} else if (target === "bugs") {
  const bugs = specs.filter((spec) => spec.startsWith("bugs/"));
  if (bugs.length === 0) console.log("No bug report specs.");
  bugs.forEach(remove);
} else if (specs.includes(target)) {
  remove(target);
} else {
  console.error(`No screenshot spec named "${target}". Run npm run screens:flush to list them.`);
  process.exit(1);
}
