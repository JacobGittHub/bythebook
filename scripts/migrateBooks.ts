// Moves every book from `opening_books.move_node` into `trees` with its summary
// (plans/deployment.md Phase 5, D28). Run it locally with `npm run books:migrate`; it reads
// .env.local and uses the service role key, since it reads every user's books.
//
//   npm run books:migrate                              back up every row, then convert
//   npm run books:migrate -- --dry-run                 say what would change; writes nothing
//   npm run books:migrate -- --rebuild-diverged        also rebuild trees that disagree with move_node
//
// Before writing, it saves every row as it is to backups/opening_books-<time>.json (git-ignored).
// Each row is written only if no one changed it since it was read, and its `updated_at` stays,
// so it can run again at any time: rows already done are kept. Run it once the library code is
// live, so nothing writes `move_node` alone afterwards.
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { planMigration, type MigrationRow, type RowPlan } from "@/lib/library/migrate";
import { createAdminSupabaseClient } from "@/lib/supabase";
import type { Json, Tables } from "@/types/database";

const PAGE = 500;

type Row = Tables<"opening_books">;

async function readAllRows(): Promise<Row[]> {
  const supabase = createAdminSupabaseClient();
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("opening_books")
      .select("*")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE) return rows;
  }
}

function backUp(rows: Row[]): string {
  const exportedAt = new Date().toISOString();
  const file = path.join("backups", `opening_books-${exportedAt.replace(/[:.]/g, "-")}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ table: "opening_books", exportedAt, rows }, null, 2));
  return file;
}

/** Writes the trees and summary, only if the row hasn't changed since it was read. */
async function write(row: Row, plan: Extract<RowPlan, { action: "write" }>): Promise<boolean> {
  const supabase = createAdminSupabaseClient();
  const update = supabase
    .from("opening_books")
    .update({ trees: plan.trees as unknown as Json, summary: plan.summary as unknown as Json })
    .eq("id", row.id);
  const { data, error } = await (row.updated_at ? update.eq("updated_at", row.updated_at) : update.is("updated_at", null))
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

function describe(plan: RowPlan): string {
  switch (plan.action) {
    case "keep":
      return "already moved";
    case "write":
      return `${plan.reason}: ${plan.summary.positions} positions, ${plan.summary.lines} lines, ${plan.summary.trees} ${plan.summary.trees === 1 ? "tree" : "trees"}`;
    case "diverged":
      return "DIVERGED: its trees and move_node hold different moves (--rebuild-diverged rebuilds from move_node)";
    case "refuse":
      return `REFUSED: ${plan.detail}`;
  }
}

async function main() {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      "rebuild-diverged": { type: "boolean", default: false },
    },
  });
  const dryRun = values["dry-run"];

  const rows = await readAllRows();
  console.log(`${rows.length} book${rows.length === 1 ? "" : "s"}.${dryRun ? " Dry run: nothing is written." : ""}`);
  if (!dryRun && rows.length) console.log(`Backed up every row to ${backUp(rows)}`);

  const counts = { keep: 0, written: 0, changed: 0, diverged: 0, refuse: 0 };
  for (const row of rows) {
    const plan = planMigration(row as MigrationRow, { rebuildDiverged: values["rebuild-diverged"] });
    let note = describe(plan);
    if (plan.action === "write") {
      if (dryRun || (await write(row, plan))) counts.written++;
      else {
        counts.changed++;
        note = "CHANGED while running: run again";
      }
    } else counts[plan.action]++;
    console.log(`  ${row.id}  ${note}`);
  }

  const verb = dryRun ? "would be written" : "written";
  console.log(
    `${counts.written} ${verb}, ${counts.keep} already moved, ${counts.diverged} diverged, ${counts.refuse} refused` +
      (counts.changed ? `, ${counts.changed} changed while running` : "") +
      ".",
  );
  const left = counts.diverged + counts.refuse + counts.changed + (dryRun ? counts.written : 0);
  console.log(
    left
      ? `${left} book${left === 1 ? " still needs" : "s still need"} trees or a decision before Migration B.`
      : "Every book has its trees: check them in the app, then Migration B can follow.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
