"use client";

import { useId, useRef, useState, type DragEvent } from "react";
import Link from "next/link";
import { FileText, TriangleAlert, Upload } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { RadioGroup, RadioGroupItem } from "@/components/shadcn/radio-group";
import { Textarea } from "@/components/shadcn/textarea";
import { useGameImport, type ImportBase, type ImportSource } from "@/context/GameImport";
import { useViewer } from "@/context/Viewer";
import { useGameHistory } from "@/hooks/useGameHistory";
import { freshFor, likelyUser, type FileScan } from "@/lib/history/importFile";
import { makeRoom } from "@/lib/history/merge";
import {
  DEFAULT_GAME_HISTORY_LIMIT,
  GAME_HISTORY_PLIES,
  MAX_GAME_FILE_BYTES,
  MAX_GAME_HISTORY_REQUEST,
  MAX_GAMES_PER_FILE,
  MAX_ROOM_REQUEST_REASON_CHARS,
  MAX_USERNAME_CHARS,
  HistoryError,
  type GameSource,
  type LimitChoice,
  type RoomRequest,
  type RoomRequestInput,
} from "@/lib/history/types";

const n = (count: number) => count.toLocaleString("en-US");
const games = (count: number) => `${n(count)} ${count === 1 ? "game" : "games"}`;
const shortDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export const SOURCE_NAMES: Record<GameSource, string> = { chesscom: "Chess.com", lichess: "Lichess", other: "Other" };

/** The name a pasted import is listed by (D34). */
const PASTED_NAME = "Pasted games";

/** How many of the file's names are offered as buttons; the rest are suggested as the name is typed. */
const NAME_BUTTONS = 3;

/** What the dialog offers when the new games don't fit: the two choices of D28, and importing none (D33). */
type FitChoice = LimitChoice | "none";

/**
 * Import games (plans/game-history.md D29): choosing a file or pasting PGN, the file's check with
 * the user's name, and the choice when the games don't fit. The import itself then runs from
 * `GameImportProvider`, at the bottom of the Library's left page.
 */
export function GameImportDialog() {
  const { phase, dialogOpen, closeDialog } = useGameImport();
  return (
    <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent className="max-h-[calc(100%-2rem)] overflow-y-auto sm:max-w-lg">
        {phase.kind === "reading" ? (
          <Reading source={phase.source} progress={phase.progress} />
        ) : phase.kind === "checked" ? (
          <Check
            key={`${phase.source.name}:${phase.preferredName ?? ""}`}
            source={phase.source}
            scan={phase.scan}
            base={phase.base}
            preferredName={phase.preferredName}
          />
        ) : (
          <Choose problem={phase.kind === "failed" && phase.during === "reading" ? phase.message : null} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Choose({ problem }: { problem: string | null }) {
  const { read, closeDialog } = useGameImport();
  const { signedIn } = useViewer();
  const { summary } = useGameHistory();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [paste, setPaste] = useState("");
  const limit = summary?.limit ?? DEFAULT_GAME_HISTORY_LIMIT;

  const choose = (file: File | undefined) => {
    if (input.current) input.current.value = "";
    if (file) read({ file, name: file.name, pasted: false });
  };
  const drop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    choose(event.dataTransfer.files[0]);
  };
  const readPaste = () => {
    const file = new File([paste], `${PASTED_NAME}.pgn`, { type: "text/plain" });
    read({ file, name: PASTED_NAME, pasted: true });
  };

  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Import your games</DialogTitle>
        <DialogDescription>From a PGN file. The file is read in this browser and never uploaded.</DialogDescription>
      </DialogHeader>

      {problem && (
        <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {problem}
        </p>
      )}

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={drop}
        data-dragging={dragging || undefined}
        className="grid justify-items-center gap-1.5 rounded-lg border border-dashed border-border px-4 py-5 text-center data-[dragging]:border-primary data-[dragging]:bg-accent"
      >
        <Upload className="size-5 text-muted-foreground" aria-hidden />
        <p className="text-sm font-medium">Drop a PGN file here</p>
        <Button size="sm" onClick={() => input.current?.click()}>
          Choose file
        </Button>
        <p className="text-xs text-muted-foreground">
          Up to {MAX_GAME_FILE_BYTES / 1024 / 1024} MB. Unzip a .zip export first.
        </p>
        <input
          ref={input}
          type="file"
          accept=".pgn,application/x-chess-pgn,text/plain"
          aria-label="PGN file to import"
          className="hidden"
          onChange={(event) => choose(event.target.files?.[0])}
        />
      </div>

      <details className="group text-sm">
        <summary className="cursor-pointer text-muted-foreground select-none hover:text-foreground">Or paste PGN text</summary>
        <div className="mt-2 grid gap-2">
          <Textarea
            aria-label="PGN text"
            value={paste}
            onChange={(event) => setPaste(event.target.value)}
            placeholder={'[Event "Club championship"]\n[White "You"]\n1. e4 e5 2. Nf3 …'}
            className="h-24 font-mono text-xs"
          />
          <div>
            <Button size="sm" variant="outline" onClick={readPaste} disabled={!paste.trim()}>
              Read pasted games
            </Button>
          </div>
        </div>
      </details>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="font-semibold">Chess.com</dt>
        <dd className="text-muted-foreground">Your game archive: the Download button for each month</dd>
        <dt className="font-semibold">Lichess</dt>
        <dd className="text-muted-foreground">Your profile&apos;s menu: Export games</dd>
      </dl>

      <div className="grid gap-1.5">
        <p className="book-sc">What is kept</p>
        <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
          <li>
            The first {GAME_HISTORY_PLIES} plies ({GAME_HISTORY_PLIES / 2} moves) of each game, enough to compare with
            your books
          </li>
          <li>Date, time control, your color, result, both ratings and your time per move</li>
          <li>Not opponents&apos; names, comments or engine evaluations</li>
          <li>Up to {n(limit)} games; you choose what gives way past that</li>
        </ul>
      </div>

      {!signedIn && (
        <div className="flex flex-wrap items-center gap-2 border-y border-rule py-2">
          <p className="min-w-0 flex-1 basis-60 text-xs text-foreground">
            Kept in this browser. Safari deletes a site&apos;s data after 7 days without a visit, so keep the PGN file
            to import it again.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/auth/register">Create account</Link>
          </Button>
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" onClick={closeDialog}>
          Cancel
        </Button>
      </DialogFooter>
    </div>
  );
}

function FileRow({ source, detail, onChange }: { source: ImportSource; detail: string; onChange?: () => void }) {
  return (
    <div className="flex items-center gap-2.5 rounded-md bg-page-alt px-2.5 py-2">
      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{source.name}</p>
        <p className="text-xs text-muted-foreground tabular-nums">{detail}</p>
      </div>
      {onChange && (
        <Button size="sm" variant="ghost" onClick={onChange}>
          Change
        </Button>
      )}
    </div>
  );
}

const size = (file: File) => {
  const mb = file.size / 1024 / 1024;
  return mb >= 0.1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`;
};

function Reading({ source, progress }: { source: ImportSource; progress: number }) {
  const { closeDialog } = useGameImport();
  const percent = Math.round(progress * 100);
  return (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Reading the file</DialogTitle>
        <DialogDescription>Counting the games and the players in it. Nothing is saved yet.</DialogDescription>
      </DialogHeader>
      <FileRow source={source} detail={size(source.file)} />
      <ProgressBar value={percent} label="Reading the file" />
      <DialogFooter>
        <Button variant="outline" onClick={closeDialog}>
          Cancel
        </Button>
      </DialogFooter>
    </div>
  );
}

/** A bar from 0 to 100. */
export function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className="h-1.5 overflow-hidden rounded-sm bg-muted"
    >
      <div className="h-full bg-primary transition-[width]" style={{ width: `${value}%` }} />
    </div>
  );
}

function Check({ source, scan, base, preferredName }: { source: ImportSource; scan: FileScan; base: ImportBase; preferredName: string | null }) {
  const { start, closeDialog, back } = useGameImport();
  const { history, summary, reload } = useGameHistory();
  const nameId = useId();
  const listId = useId();
  const offered = preferredName && scan.names.some((count) => count.name.toLowerCase() === preferredName.toLowerCase());
  const [username, setUsername] = useState(() => (offered ? preferredName : (likelyUser(scan) ?? "")));
  const name = username.trim();
  const fresh = name ? freshFor(scan, name) : 0;
  const inFile = scan.names.find((count) => count.name.toLowerCase() === name.toLowerCase());

  const room = Math.max(0, base.limit - base.games);
  const fits = fresh <= room;
  const [picked, setPicked] = useState<FitChoice>(room > 0 ? "stop" : "none");
  // The "stop" choice imports nothing when there is no room, so it isn't offered then.
  const choice: FitChoice = fits ? "stop" : picked === "stop" && room === 0 ? "none" : picked;
  const stop = makeRoom(base.games, fresh, base.limit, "stop");
  const replace = makeRoom(base.games, fresh, base.limit, "replace");
  const keep = choice === "replace" ? replace.keep : choice === "stop" ? stop.keep : 0;

  const sources = (Object.keys(scan.sources) as GameSource[]).filter((key) => scan.sources[key] > 0);
  const detail = [
    size(source.file),
    games(scan.games),
    ...sources.map((key) => (sources.length > 1 ? `${SOURCE_NAMES[key]} ${n(scan.sources[key])}` : SOURCE_NAMES[key])),
  ].join(" · ");

  const skippedRows: [string, number][] = (
    [
      ["Chess960 or a set-up position", scan.skipped.variant],
      ["Not finished", scan.skipped.unfinished],
      ["No moves", scan.skipped.noMoves],
      ["Couldn't be read", scan.skipped.unreadable],
      ["Already imported", scan.duplicates],
    ] as [string, number][]
  ).filter(([, count]) => count > 0);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (choice === "none") return closeDialog();
    if (keep > 0) start(name, choice);
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Check the file</DialogTitle>
        <DialogDescription>
          Nothing is saved until you import. The import then runs at the bottom of the Library while you carry on.
        </DialogDescription>
      </DialogHeader>

      <FileRow source={source} detail={detail} onChange={back} />

      {scan.truncated && (
        <p className="flex items-start gap-2 text-xs text-warning">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          The file holds more than {n(MAX_GAMES_PER_FILE)} games; only the first {n(MAX_GAMES_PER_FILE)} are read.
        </p>
      )}

      <div className="grid gap-1.5">
        <Label htmlFor={nameId}>Which player are you?</Label>
        <Input
          id={nameId}
          list={listId}
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          maxLength={MAX_USERNAME_CHARS}
          autoComplete="off"
        />
        <datalist id={listId}>
          {scan.names.slice(0, 200).map((count) => (
            <option key={count.name} value={count.name} />
          ))}
        </datalist>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {!name ? (
            "Type the name you play under."
          ) : !inFile ? (
            "No games in the file have this name."
          ) : fresh > 0 ? (
            <>
              <span className="font-semibold text-foreground">{games(fresh)}</span> to import match this name
            </>
          ) : (
            "This name's games are all imported already, or can't be imported."
          )}
        </p>
        {scan.names.length > 1 && (
          <div className="flex flex-wrap gap-1" aria-label="Names in the file">
            {scan.names.slice(0, NAME_BUTTONS).map((count) => (
              <Button
                key={count.name}
                type="button"
                size="xs"
                variant="outline"
                aria-pressed={count.name.toLowerCase() === name.toLowerCase()}
                className="aria-pressed:border-foreground aria-pressed:bg-accent"
                onClick={() => setUsername(count.name)}
              >
                {count.name} · {n(count.games)}
              </Button>
            ))}
          </div>
        )}
      </div>

      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 text-xs tabular-nums">
        <dt>Games in the file</dt>
        <dd className="text-right">{n(scan.games)}</dd>
        {skippedRows.map(([label, count]) => (
          <Row key={label} label={label} count={count} />
        ))}
        <dt className="font-semibold">New games to import</dt>
        <dd className="text-right font-semibold">{n(fresh)}</dd>
      </dl>

      {!fits && (
        <div className="grid gap-2">
          <p className="flex items-start gap-2 text-sm">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
            <span>
              There is room for <b>{n(room)}</b> more {room === 1 ? "game" : "games"}: {n(base.games)} of {n(base.limit)}{" "}
              are kept.
            </span>
          </p>
          <RadioGroup value={choice} onValueChange={(next) => setPicked(next as FitChoice)} aria-label="When the games don't fit" className="gap-2">
            {room > 0 && (
              <Choice value="stop" title={`Import ${n(stop.keep)} and stop`}>
                Your current games stay. The {n(stop.keep)} newest played of the new games are imported, and{" "}
                {n(fresh - stop.keep)} are left out.
              </Choice>
            )}
            <Choice value="replace" title={`Import ${n(replace.keep)}, removing ${games(replace.drop)} imported earlier`}>
              The games you imported earliest are removed, whenever they were played.
              {replace.keep < fresh && ` Only the newest ${n(replace.keep)} of the new games fit.`}
            </Choice>
            <Choice value="none" title="Import none of them">
              Nothing changes. You could export fewer games, such as the last year&apos;s
              {history.requestRoom ? ", or ask for more room." : "."}
            </Choice>
          </RadioGroup>
          {choice === "none" && history.requestRoom && (
            <RoomRequestForm request={summary?.roomRequest ?? null} wanted={base.games + fresh} ask={history.requestRoom} onAsked={reload} />
          )}
        </div>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={closeDialog}>
          Cancel
        </Button>
        {choice === "none" ? (
          <Button type="submit">Close without importing</Button>
        ) : (
          <Button type="submit" disabled={keep === 0}>
            Import {games(keep)}
          </Button>
        )}
      </DialogFooter>
    </form>
  );
}

/**
 * Asking for more room (D37), for an account: how many games and why. One request may wait for an
 * answer at a time, so a pending one is shown in place of the form.
 */
function RoomRequestForm({
  request,
  wanted,
  ask,
  onAsked,
}: {
  request: RoomRequest | null;
  wanted: number;
  ask: (input: RoomRequestInput) => Promise<RoomRequest>;
  onAsked: () => void;
}) {
  const gamesId = useId();
  const reasonId = useId();
  const [count, setCount] = useState(() => String(Math.min(MAX_GAME_HISTORY_REQUEST, Math.ceil(wanted / 1_000) * 1_000)));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const asked = Number(count);
  const valid = Number.isInteger(asked) && asked >= 1 && asked <= MAX_GAME_HISTORY_REQUEST;

  if (request?.status === "pending") {
    return (
      <p className="rounded-md border border-dashed p-2.5 text-xs text-muted-foreground">
        Asked for room for {games(request.games)} on {shortDay(request.at)}. You&apos;ll see the new limit here once it&apos;s
        answered.
      </p>
    );
  }

  const send = async () => {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await ask({ games: asked, reason: reason.trim() });
      onAsked();
    } catch (caught) {
      setError(caught instanceof HistoryError ? caught.message : "The request couldn't be sent.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="group" aria-label="Ask for more room" className="grid gap-2 rounded-md border border-dashed p-2.5">
      <p className="text-xs text-muted-foreground">
        {request?.status === "declined"
          ? `Your request of ${shortDay(request.at)} was declined. You can ask again.`
          : "Beta accounts can ask for more room. The request is read by hand."}
      </p>
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2">
        <Label htmlFor={gamesId} className="text-xs">
          Games to keep
        </Label>
        <Input
          id={gamesId}
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_GAME_HISTORY_REQUEST}
          step={1_000}
          value={count}
          onChange={(event) => setCount(event.target.value)}
          className="h-8 w-28"
        />
        <Label htmlFor={reasonId} className="self-start pt-1.5 text-xs">
          Why <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id={reasonId}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={MAX_ROOM_REQUEST_REASON_CHARS}
          rows={2}
          className="min-h-0 text-sm"
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground tabular-nums">
          {reason.length} / {MAX_ROOM_REQUEST_REASON_CHARS}
        </span>
        <Button type="button" size="sm" variant="outline" disabled={busy || !valid} onClick={() => void send()}>
          Ask for room
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function Row({ label, count }: { label: string; count: number }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}, skipped</dt>
      <dd className="text-right text-muted-foreground">{n(count)}</dd>
    </>
  );
}

function Choice({ value, title, children }: { value: FitChoice; title: string; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 has-[[data-state=checked]]:border-foreground">
      <RadioGroupItem value={value} className="mt-0.5" />
      <span className="text-sm">
        <span className="font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{children}</span>
      </span>
    </label>
  );
}
