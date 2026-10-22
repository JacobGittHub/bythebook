"use client";

import { Upload, X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { useGameImport, type ImportPhase, type Tally } from "@/context/GameImport";
import { useGameHistory } from "@/hooks/useGameHistory";
import { nameMismatch } from "@/lib/history/importFile";
import { ProgressBar } from "./GameImportDialog";

const n = (count: number) => count.toLocaleString("en-US");
const games = (count: number) => `${n(count)} ${count === 1 ? "game" : "games"}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * Game history on the Library's first level (plans/game-history.md D29), fixed at the bottom of
 * the left page under the scrolling book list (Q18): what the history holds and Import games,
 * then the import's progress while it runs, then its report until it is dismissed.
 */
export function GameHistorySection() {
  const { available, phase, openDialog } = useGameImport();
  const { summary } = useGameHistory();

  let body;
  if (!available) {
    body = (
      <>
        <Head title="Game history" />
        <p className="text-xs text-muted-foreground">
          Coming soon to accounts: import your own games to see where you leave your books.
        </p>
      </>
    );
  } else if (phase.kind === "importing") {
    body = <Importing phase={phase} />;
  } else if (phase.kind === "done") {
    body = <Report phase={phase} />;
  } else if (phase.kind === "failed" && phase.during === "importing") {
    body = <Failed message={phase.message} />;
  } else if (summary && summary.games > 0) {
    const last = summary.imports.at(-1);
    body = (
      <>
        <Head title="Game history" aside={<span className="book-sc">{games(summary.games)}</span>} />
        <p className="text-xs text-muted-foreground">
          {last ? `Last import ${day(last.at)}, ${last.name}` : "Imported"} · kept in this browser
        </p>
        <div>
          <Button size="sm" variant="outline" onClick={openDialog}>
            <Upload /> Import games
          </Button>
        </div>
      </>
    );
  } else {
    body = (
      <>
        <Head title="Game history" />
        <p className="text-xs text-foreground">
          Import your games from Chess.com, Lichess or a tournament file to see how you&apos;ve done in your openings
          and where your games leave your books.
        </p>
        <div>
          <Button size="sm" variant="outline" onClick={openDialog}>
            <Upload /> Import games
          </Button>
        </div>
      </>
    );
  }

  return (
    <section aria-label="Game history" className="flex shrink-0 flex-col gap-2 border-t border-rule pt-2.5">
      {body}
    </section>
  );
}

function Head({ title, aside }: { title: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      <span className="grow" />
      {aside}
    </div>
  );
}

function Importing({ phase }: { phase: Extract<ImportPhase, { kind: "importing" }> }) {
  const { cancel } = useGameImport();
  const percent = phase.total ? Math.round((phase.done / phase.total) * 100) : 0;
  return (
    <>
      <Head
        title="Importing games"
        aside={
          <Button size="xs" variant="outline" onClick={cancel} disabled={phase.saving}>
            Cancel
          </Button>
        }
      />
      <p className="truncate text-xs text-muted-foreground">
        {phase.source.name} · {phase.username} · {games(phase.games)}
      </p>
      <div className="flex items-baseline justify-between text-xs">
        <span>{phase.saving ? "Saving" : "Replaying moves"}</span>
        <span className="text-muted-foreground tabular-nums">
          {n(phase.done)} of {n(phase.total)} read
        </span>
      </div>
      <ProgressBar value={phase.saving ? 100 : percent} label="Import progress" />
      <p className="text-xs text-muted-foreground">
        You can keep using ByTheBook meanwhile; it may be a little slower until this finishes.
      </p>
    </>
  );
}

function ResultsBar({ results }: { results: Tally }) {
  const total = results.win + results.draw + results.loss;
  if (!total) return null;
  return (
    <div className="flex h-2 overflow-hidden rounded-sm" role="img" aria-label={`${results.win} wins, ${results.draw} draws, ${results.loss} losses`}>
      <span className="bg-success" style={{ flex: results.win }} />
      <span className="bg-bar-draw" style={{ flex: results.draw }} />
      <span className="bg-destructive" style={{ flex: results.loss }} />
    </div>
  );
}

function Report({ phase }: { phase: Extract<ImportPhase, { kind: "done" }> }) {
  const { dismiss, openDialog, importAgainAs } = useGameImport();
  const { report, result, results, scan, username } = phase;
  const mismatch = nameMismatch(scan, result, username);
  const other = mismatch.other?.name ?? null;
  const leftOut = result.leftOut + report.leftOut;
  const rows: [string, number][] = [
    ["Already imported", result.duplicates + report.duplicates],
    ["Chess960 or a set-up position", result.skipped.variant],
    [`Not played by ${username}`, result.skipped.player],
    ["Not finished", result.skipped.unfinished],
    ["No moves", result.skipped.noMoves],
    ["Couldn't be read", result.skipped.unreadable],
    ["Left out for room", leftOut],
    ["Removed to make room", report.removed],
  ];
  // The name's own count always shows (D22); the others only when something was skipped for them.
  const shown = rows.filter(([label, count]) => count > 0 || label === `Not played by ${username}`);

  return (
    <>
      <Head
        title={report.added ? `Imported ${games(report.added)}` : "No new games imported"}
        aside={
          <Button size="icon-xs" variant="ghost" aria-label="Dismiss the report" onClick={dismiss}>
            <X />
          </Button>
        }
      />
      <ResultsBar results={results} />
      <p className="text-xs text-muted-foreground tabular-nums">
        {report.added > 0 && (
          <>
            {n(results.win)} · {n(results.draw)} · {n(results.loss)} wins, draws and losses ·{" "}
          </>
        )}
        {n(report.total)} of {n(phase.limit)} kept
      </p>
      {mismatch.large && (
        <div className="grid gap-1 border-l-[3px] border-warning py-1 pl-2.5 text-xs">
          <p className="font-semibold">
            {games(mismatch.games)} weren&apos;t played by {username}, so they weren&apos;t imported.
          </p>
          {other && (
            <>
              <p className="text-muted-foreground">
                If you also played as {other}, import the file again with that name; games already imported are skipped.
              </p>
              <div>
                <Button size="xs" variant="outline" onClick={() => importAgainAs(other)}>
                  Import again as {other}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground select-none hover:text-foreground">What was skipped</summary>
        <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 tabular-nums">
          {shown.map(([label, count]) => (
            <div key={label} className="contents">
              <dt>{label}</dt>
              <dd className="text-right">{n(count)}</dd>
            </div>
          ))}
        </dl>
      </details>
      <div>
        <Button size="sm" variant="ghost" onClick={openDialog}>
          <Upload /> Import more
        </Button>
      </div>
    </>
  );
}

function Failed({ message }: { message: string }) {
  const { dismiss, openDialog } = useGameImport();
  return (
    <>
      <Head
        title="The import stopped"
        aside={
          <Button size="icon-xs" variant="ghost" aria-label="Dismiss" onClick={dismiss}>
            <X />
          </Button>
        }
      />
      <p role="alert" className="text-xs text-destructive">
        {message} Nothing was saved.
      </p>
      <div>
        <Button size="sm" variant="outline" onClick={openDialog}>
          Try again
        </Button>
      </div>
    </>
  );
}
