"use client";

// The viewer's game import (plans/game-history.md D29): choosing a file, checking it and the
// limit choice happen in a dialog (`GameImportDialog`); once the import starts, the dialog
// closes and the import runs here, in the dashboard's layout, so it keeps going while the
// viewer moves between pages. Its progress and report sit at the bottom of the Library's left
// page (`GameHistorySection`); a viewer on any other page when it ends gets a toast. Closing or
// reloading the tab stops it, and the browser asks first.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useBugReportSection } from "@/context/BugReport";
import { useGameHistory } from "@/hooks/useGameHistory";
import { freshFor, type FileScan, type ImportResult } from "@/lib/history/importFile";
import { startImportSession, ImportStopped, type ImportSession } from "@/lib/history/importSession";
import { makeRoom, type MergeReport } from "@/lib/history/merge";
import { HistoryError, type GameHistoryStore, type LimitChoice } from "@/lib/history/types";
import { saveImport } from "@/lib/history/writes";
import { libraryHref } from "@/lib/library/links";

/** What is being imported: a file, or pasted text made into one (D34). */
export type ImportSource = { file: File; name: string; pasted: boolean };

/** The history as the first pass found it, which the second pass's choices and write are planned from. */
export type ImportBase = { version: number; games: number; limit: number };

export type Tally = { win: number; draw: number; loss: number };

export type ImportPhase =
  | { kind: "idle" }
  | { kind: "reading"; source: ImportSource; progress: number }
  | { kind: "checked"; source: ImportSource; scan: FileScan; base: ImportBase; preferredName: string | null }
  | { kind: "importing"; source: ImportSource; username: string; games: number; done: number; total: number; saving: boolean }
  | {
      kind: "done";
      source: ImportSource;
      username: string;
      scan: FileScan;
      result: ImportResult;
      report: MergeReport;
      results: Tally;
      limit: number;
    }
  | { kind: "failed"; message: string; during: "reading" | "importing" };

type GameImportValue = {
  /** Whether this viewer has somewhere to keep games; a signed-in viewer has none until Phase 3. */
  available: boolean;
  phase: ImportPhase;
  dialogOpen: boolean;
  openDialog: () => void;
  /** Closes the dialog, stopping a file that is being read or checked. */
  closeDialog: () => void;
  /** Goes back to choosing a file, with the dialog still open. */
  back: () => void;
  /** The first pass over `source`; `preferredName` is offered as the user's when the file has it. */
  read: (source: ImportSource, preferredName?: string | null) => void;
  /** The second pass and the write, for the games `username` played, past the limit as `choice` says. */
  start: (username: string, choice: LimitChoice) => void;
  /** Stops the import's second pass; nothing has been saved yet. */
  cancel: () => void;
  /** Clears the report or the failure. */
  dismiss: () => void;
  /** Reads the last import's file again, offering `name` as the user's. */
  importAgainAs: (name: string) => void;
};

const GameImportContext = createContext<GameImportValue | null>(null);

/** Where the import's progress and report show, so it doesn't also toast there. */
const LIBRARY_PATH = libraryHref(null);

const message = (error: unknown) =>
  error instanceof HistoryError || error instanceof ImportStopped ? error.message : "The import stopped unexpectedly. Please try again.";

export function GameImportProvider({ children }: { children: ReactNode }) {
  const { history } = useGameHistory();
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<ImportPhase>({ kind: "idle" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const session = useRef<ImportSession | null>(null);
  // Each read or import gets a number, so a pass that was stopped can't change what came after it.
  const run = useRef(0);
  const where = useRef(pathname);
  useEffect(() => {
    where.current = pathname;
  }, [pathname]);
  const phaseRef = useRef(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const stopSession = useCallback(() => {
    run.current += 1;
    session.current?.stop();
    session.current = null;
  }, []);

  // Leaving the dashboard ends the import with it.
  useEffect(() => stopSession, [stopSession]);

  // Closing or reloading the tab would stop the import, so the browser asks first.
  const working = phase.kind === "reading" || phase.kind === "importing";
  useEffect(() => {
    if (!working) return;
    const ask = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", ask);
    return () => window.removeEventListener("beforeunload", ask);
  }, [working]);

  /** A toast for an import that ended while the Library's first level wasn't open (D29). */
  const tellElsewhere = useCallback(
    (ended: { ok: true; added: number } | { ok: false; message: string }) => {
      if (where.current === LIBRARY_PATH) return;
      const options = {
        closeButton: true,
        duration: Infinity,
        action: { label: "Open the Library", onClick: () => router.push(LIBRARY_PATH) },
      };
      if (ended.ok) {
        const games = `${ended.added.toLocaleString("en-US")} ${ended.added === 1 ? "game" : "games"}`;
        toast.success(`Imported ${games}`, { ...options, description: "The report is in the Library." });
      } else {
        toast.error("The import stopped", { ...options, description: ended.message });
      }
    },
    [router],
  );

  const read = useCallback(
    (source: ImportSource, preferredName: string | null = null) => {
      if (!history) return;
      stopSession();
      const mine = run.current;
      const current = startImportSession();
      session.current = current;
      setPhase({ kind: "reading", source, progress: 0 });
      void (async (store: GameHistoryStore) => {
        try {
          const [summary, chunks] = await Promise.all([store.summary(), store.chunks()]);
          const keys = chunks.flatMap((chunk) => chunk.games.map((game) => game.record.key));
          const scan = await current.scan(source.file, keys, ({ done, total }) => {
            if (run.current === mine) setPhase({ kind: "reading", source, progress: total ? done / total : 0 });
          });
          if (run.current !== mine) return;
          const base = { version: summary.version, games: summary.games, limit: summary.limit };
          setPhase({ kind: "checked", source, scan, base, preferredName });
        } catch (error) {
          if (run.current !== mine || (error instanceof ImportStopped && error.reason === "cancelled")) return;
          stopSession();
          setPhase({ kind: "failed", message: message(error), during: "reading" });
        }
      })(history);
    },
    [history, stopSession],
  );

  const start = useCallback(
    (username: string, choice: LimitChoice) => {
      const checked = phaseRef.current;
      const current = session.current;
      if (!history || !current || checked.kind !== "checked") return;
      const { source, scan, base } = checked;
      const { keep } = makeRoom(base.games, freshFor(scan, username), base.limit, choice);
      const mine = run.current;
      setDialogOpen(false);
      setPhase({ kind: "importing", source, username, games: keep, done: 0, total: scan.games, saving: false });
      void (async (store: GameHistoryStore) => {
        try {
          const result = await current.read(username, keep, ({ done, total }) => {
            if (run.current === mine) setPhase((now) => (now.kind === "importing" ? { ...now, done, total } : now));
          });
          if (run.current !== mine) return;
          setPhase((now) => (now.kind === "importing" ? { ...now, done: now.total, saving: true } : now));
          const report = await saveImport(store, result.games, { choice, username, version: base.version, name: source.name });
          stopSession();
          const results: Tally = { win: 0, draw: 0, loss: 0 };
          for (const game of result.games) results[game.record.result] += 1;
          setPhase({ kind: "done", source, username, scan, result, report, results, limit: base.limit });
          tellElsewhere({ ok: true, added: report.added });
        } catch (error) {
          if (run.current !== mine || (error instanceof ImportStopped && error.reason === "cancelled")) return;
          stopSession();
          setPhase({ kind: "failed", message: message(error), during: "importing" });
          tellElsewhere({ ok: false, message: message(error) });
        }
      })(history);
    },
    [history, stopSession, tellElsewhere],
  );

  const value = useMemo((): GameImportValue => {
    const idle = () => setPhase({ kind: "idle" });
    return {
      available: history !== null,
      phase,
      dialogOpen,
      openDialog: () => {
        if (phaseRef.current.kind === "importing") return;
        if (phaseRef.current.kind !== "idle") idle();
        setDialogOpen(true);
      },
      closeDialog: () => {
        setDialogOpen(false);
        const now = phaseRef.current.kind;
        if (now === "reading" || now === "checked" || now === "failed") {
          stopSession();
          idle();
        }
      },
      back: () => {
        const now = phaseRef.current.kind;
        if (now !== "reading" && now !== "checked" && now !== "failed") return;
        stopSession();
        idle();
      },
      read,
      start,
      cancel: () => {
        const now = phaseRef.current;
        if (now.kind !== "importing" || now.saving) return;
        stopSession();
        idle();
      },
      dismiss: () => {
        const now = phaseRef.current.kind;
        if (now === "done" || now === "failed") idle();
      },
      importAgainAs: (name) => {
        const now = phaseRef.current;
        if (now.kind !== "done") return;
        setDialogOpen(true);
        read(now.source, name);
      },
    };
  }, [history, phase, dialogOpen, read, start, stopSession]);

  useBugReportSection(() => {
    const now = phaseRef.current;
    const lines: [string, string][] = [["Import", now.kind]];
    if (now.kind === "importing") lines.push(["Progress", `${now.done} of ${now.total} games read`]);
    if (now.kind === "failed") lines.push(["Failure", now.message]);
    return { title: "Game import", lines };
  });

  return <GameImportContext.Provider value={value}>{children}</GameImportContext.Provider>;
}

export function useGameImport(): GameImportValue {
  const value = useContext(GameImportContext);
  if (!value) throw new Error("useGameImport needs a GameImportProvider.");
  return value;
}
