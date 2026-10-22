"use client";

import { Ellipsis, Trash2, Upload, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/shadcn/alert-dialog";
import { Button } from "@/components/shadcn/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import { useGameImport, type ImportPhase } from "@/context/GameImport";
import { useGameHistory } from "@/hooks/useGameHistory";
import { nameMismatch } from "@/lib/history/importFile";
import { HistoryError, type GameHistoryStore, type Tally } from "@/lib/history/types";
import { GAME_HISTORY_HREF } from "@/lib/library/links";
import { cn } from "@/lib/utils";
import { ProgressBar } from "./GameImportDialog";

const n = (count: number) => count.toLocaleString("en-US");
const games = (count: number) => `${n(count)} ${count === 1 ? "game" : "games"}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * Game history on the Library's first level (plans/game-history.md D29), fixed at the bottom of
 * the left page under the scrolling book list (Q18): what the history holds and Import games,
 * then the import's progress while it runs, then its report until it is dismissed. The history's
 * menu deletes every game.
 */
export function GameHistorySection() {
  const { phase, openDialog } = useGameImport();
  const { history, summary, reload } = useGameHistory();

  let body;
  if (phase.kind === "importing") {
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
          {last ? `Last import ${day(last.at)}, ${last.name}` : "Imported"} ·{" "}
          {history.store === "browser" ? "kept in this browser" : "kept in your account"}
        </p>
        <div className="flex items-center gap-2">
          <Button asChild size="sm">
            <Link href={GAME_HISTORY_HREF}>Open game history</Link>
          </Button>
          <Button size="sm" variant="outline" onClick={openDialog}>
            <Upload /> Import games
          </Button>
          <HistoryMenu history={history} games={summary.games} onCleared={reload} />
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

/** More for the history: deleting every game, after asking (AGENTS.md § UI). */
/** The history's ⋯ menu: Delete all games, asked first. */
export function HistoryMenu({ history, games: count, onCleared }: { history: GameHistoryStore; games: number; onCleared: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

  const clear = async () => {
    setBusy(true);
    try {
      await history.clear();
      toast.success(`Deleted ${games(count)}.`);
      setDeleting(false);
      onCleared();
    } catch (caught) {
      toast.error(caught instanceof HistoryError ? caught.message : "The games couldn't be deleted.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" aria-label="More for game history" disabled={busy}>
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
            <Trash2 /> Delete all games
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all {games(count)}?</AlertDialogTitle>
            <AlertDialogDescription>
              {history.store === "browser"
                ? "They go from this browser for good. Keep your PGN files to import them again."
                : "They go from your account for good. Keep your PGN files to import them again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={(event) => {
                // Stay open until the delete is done, so a failure can be read.
                event.preventDefault();
                void clear();
              }}
            >
              Delete all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
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

/** Wins, draws and losses as one bar. */
export function ResultsBar({ results, className }: { results: Tally; className?: string }) {
  const total = results.win + results.draw + results.loss;
  if (!total) return null;
  return (
    <div className={cn("flex h-2 overflow-hidden rounded-sm", className)} role="img" aria-label={`${results.win} wins, ${results.draw} draws, ${results.loss} losses`}>
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
