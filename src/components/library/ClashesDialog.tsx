"use client";

import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import { BoardDisplay } from "@/components/board/BoardDisplay";
import { Button } from "@/components/shadcn/button";
import { Checkbox } from "@/components/shadcn/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/shadcn/toggle-group";
import { useThemeColor } from "@/hooks/useThemeColor";
import { clashesOf, mostPlayed, openClashes, type Clash, type Picks } from "@/lib/books/drills";
import type { BookSide } from "@/lib/books/measures";
import { lineText, moveLabel, pathTo, type ViewNode, type ViewTree } from "@/lib/books/viewTree";
import { getOpeningEndingAt, getOpeningForLine } from "@/lib/chess/openingCatalog";
import type { PositionGames } from "@/lib/history/compareWithBook";
import { scoreOf } from "@/lib/history/historyTree";
import { cn } from "@/lib/utils";
import { ResultsBar } from "./GameHistorySection";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookName: string;
  tree: ViewTree;
  side: BookSide;
  /** The picks the book holds. */
  picks: Picks;
  /** The clash to open on; the first to resolve when null. */
  startId: string | null;
  /** The user's games at each position, for the games, results and score columns; null without games. */
  totals: ReadonlyMap<string, PositionGames> | null;
  /** Which games the totals count, as the page's filter says it. */
  gamesNote: string | null;
  /** Saves the picks; resolves true when they were saved. */
  onSave: (picks: Picks) => Promise<boolean>;
};

/**
 * Choosing the moves to drill at a book's clashes (plans/game-history.md D40): the clashes, to
 * resolve or all of them, and for the chosen one its board with an arrow for each ticked move and
 * a box for each move, with its lines and the user's games. Changes are a draft until saved.
 */
export function ClashesDialog({ open, onOpenChange, ...rest }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[54rem]">
        {open && <ClashesBody {...rest} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

const count = (n: number) => n.toLocaleString("en-US");
const percent = (score: number | null) => (score === null ? "–" : `${Math.round(score * 100)}%`);
const NONE: PositionGames = { games: 0, win: 0, draw: 0, loss: 0 };
const STATE_DOT = { open: "bg-[var(--view-clash)]", done: "bg-success", off: "border-[1.5px] border-dashed border-muted-foreground" } as const;

function ClashesBody({
  bookName,
  tree,
  side,
  picks,
  startId,
  totals,
  gamesNote,
  onSave,
  onClose,
}: Omit<Props, "open" | "onOpenChange"> & { onClose: () => void }) {
  const [draft, setDraft] = useState<Map<string, Set<string>>>(() => new Map([...picks].map(([id, set]) => [id, new Set(set)])));
  const clashes = useMemo(() => clashesOf(tree.root, side, draft), [tree, side, draft]);
  const toResolve = openClashes(clashes);
  const [filter, setFilter] = useState<"open" | "all">(toResolve.length ? "open" : "all");
  const [chosenId, setChosenId] = useState(() => startId ?? toResolve[0]?.node.id ?? clashes[0]?.node.id ?? null);
  const [busy, setBusy] = useState(false);
  const arrowColor = useThemeColor("--board-arrow", "rgb(44 74 116 / 0.55)");

  const listed = filter === "open" ? toResolve : clashes;
  const chosen = clashes.find((clash) => clash.node.id === chosenId) ?? listed[0] ?? clashes[0];
  const gamesOf = (node: ViewNode) => totals?.get(node.id)?.games ?? 0;
  const pick = (clash: ViewNode, ids: Iterable<string>) => setDraft((old) => new Map(old).set(clash.id, new Set(ids)));

  const save = async () => {
    setBusy(true);
    try {
      if (await onSave(draft)) onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DialogHeader className="gap-1 border-b border-rule px-5 pt-4 pb-2.5">
        <DialogTitle className="font-heading text-[21px]">Clashes in {bookName}</DialogTitle>
        <DialogDescription className="max-w-[74ch] text-[13px]">
          At a clash the book plays more than one move for your side. Tick the moves you want to drill. A clash is resolved when one move is
          ticked. Unticked moves stay in the book and its drawing, but drills skip them and the lines after them.
        </DialogDescription>
      </DialogHeader>
      <div className="grid min-h-0 flex-1 md:h-[29rem] md:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col border-rule max-md:border-b md:border-r">
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={filter}
            onValueChange={(next) => next && setFilter(next as "open" | "all")}
            aria-label="Which clashes"
            className="mx-3 my-2.5 shrink-0"
          >
            <ToggleGroupItem value="open" className="px-2.5">
              To resolve <span className="text-xs text-muted-foreground tabular-nums">{toResolve.length}</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="all" className="px-2.5">
              All <span className="text-xs text-muted-foreground tabular-nums">{clashes.length}</span>
            </ToggleGroupItem>
          </ToggleGroup>
          <div role="listbox" aria-label="Clashes" className="min-h-0 flex-1 overflow-y-auto border-t border-rule [scrollbar-width:thin] max-md:max-h-48">
            {listed.length ? (
              listed.map((clash) => <ClashRow key={clash.node.id} clash={clash} current={clash === chosen} onPick={() => setChosenId(clash.node.id)} />)
            ) : (
              <p className="px-3 py-2.5 text-xs text-muted-foreground">Every clash is resolved.</p>
            )}
          </div>
        </div>
        {chosen && (
          <ClashPane
            clash={chosen}
            index={clashes.indexOf(chosen)}
            of={clashes.length}
            totals={totals}
            gamesNote={gamesNote}
            arrowColor={arrowColor}
            onTick={(id, on) => {
              const ticked = new Set(chosen.ticked);
              if (on) ticked.add(id);
              else if (ticked.size > 1) ticked.delete(id);
              pick(chosen.node, ticked);
            }}
            onKeepTop={() => pick(chosen.node, [mostPlayed(chosen.node, gamesOf).id])}
            onTickAll={() => pick(chosen.node, chosen.node.children.map((child) => child.id))}
          />
        )}
      </div>
      <DialogFooter className="flex-row flex-wrap items-center gap-2 border-t border-rule bg-page-alt px-5 py-2.5 sm:justify-start">
        <Button
          variant="link"
          size="sm"
          className="h-auto px-0"
          onClick={() => setDraft(new Map(clashes.map((clash) => [clash.node.id, new Set([mostPlayed(clash.node, gamesOf).id])])))}
        >
          Keep the most played move at every clash
        </Button>
        <span className="grow" />
        <span className="text-xs text-muted-foreground">{toResolve.length ? `${count(toResolve.length)} to resolve` : "All resolved"}</span>
        <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button size="sm" onClick={() => void save()} disabled={busy}>
          Save choices
        </Button>
      </DialogFooter>
    </>
  );
}

function ClashRow({ clash, current, onPick }: { clash: Clash<ViewNode>; current: boolean; onPick: () => void }) {
  const { node, state, ticked } = clash;
  const name = getOpeningForLine(pathTo(node).slice(1).map((step) => step.fen))?.name;
  return (
    <button
      type="button"
      role="option"
      aria-selected={current}
      onClick={onPick}
      className={cn(
        "grid w-full grid-cols-[0.875rem_minmax(0,1fr)_auto] items-baseline gap-x-2 border-b border-rule px-3 py-1.5 text-left text-[12.5px] hover:bg-accent",
        current && "bg-accent shadow-[inset_3px_0_0_var(--primary)]",
      )}
    >
      <span aria-hidden="true" className={cn("size-2 self-center rounded-full", STATE_DOT[state])} />
      <b className={cn("font-mono font-medium", state === "off" && "text-muted-foreground")}>after {node.san ? moveLabel(node) : "the start"}</b>
      <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
        {ticked.size}/{node.children.length}
      </span>
      <span className="col-start-2 col-end-4 truncate font-heading text-xs text-muted-foreground italic">{name}</span>
    </button>
  );
}

function ClashPane({
  clash,
  index,
  of,
  totals,
  gamesNote,
  arrowColor,
  onTick,
  onKeepTop,
  onTickAll,
}: {
  clash: Clash<ViewNode>;
  index: number;
  of: number;
  totals: ReadonlyMap<string, PositionGames> | null;
  gamesNote: string | null;
  arrowColor: string;
  onTick: (id: string, on: boolean) => void;
  onKeepTop: () => void;
  onTickAll: () => void;
}) {
  const { node, state, ticked } = clash;
  const path = pathTo(node);
  const name = getOpeningForLine(path.slice(1).map((step) => step.fen))?.name;
  const stateText =
    state === "open"
      ? `${ticked.size} of ${node.children.length} moves ticked: tick one to resolve it`
      : state === "done"
        ? "Resolved: one move is drilled"
        : "Not drilled: a move above it is unticked";
  const arrows = node.children
    .filter((child) => ticked.has(child.id) && child.uci)
    .map((child) => ({ startSquare: child.uci!.slice(0, 2), endSquare: child.uci!.slice(2, 4), color: arrowColor }));
  const columns = totals ? "grid-cols-[1.125rem_3.5rem_minmax(0,1fr)_3.25rem_2.75rem_3.75rem_2.25rem]" : "grid-cols-[1.125rem_3.5rem_minmax(0,1fr)_3.25rem]";

  return (
    <div className="grid min-h-0 content-start gap-3 overflow-y-auto px-4.5 py-3.5 [scrollbar-width:thin]">
      <div className="grid gap-4 sm:grid-cols-[12.5rem_minmax(0,1fr)]">
        <div className="w-full max-w-60">
          <BoardDisplay fen={node.fen} size="md" orientation={node.ply % 2 === 0 ? "white" : "black"} arrows={arrows} />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <p className="book-sc">
            Clash {index + 1} of {of}
          </p>
          <p className="font-heading text-[19px] leading-tight font-semibold">After {node.san ? moveLabel(node) : "the start"}</p>
          <p className="font-heading text-[13.5px] text-muted-foreground italic">{name}</p>
          <p className="truncate font-mono text-[11.5px] text-muted-foreground" title={lineText(path)}>
            {node.san ? lineText(path) : "Before the first move"}
          </p>
          <p
            className={cn(
              "flex items-center gap-1.5 text-[12.5px] font-semibold",
              state === "open" ? "text-warning" : state === "done" ? "text-success" : "font-normal text-muted-foreground",
            )}
          >
            {state === "done" && <Check className="size-3.5" />}
            {stateText}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Button variant="outline" size="sm" onClick={onKeepTop}>
              Keep only the most played
            </Button>
            <Button variant="ghost" size="sm" onClick={onTickAll}>
              Tick all
            </Button>
          </div>
        </div>
      </div>
      <div role="group" aria-label="Moves to drill" className="grid border-t border-rule">
        <div className={cn("grid items-center gap-2 border-b border-rule px-1 py-1 book-sc", columns)}>
          <span />
          <span>Move</span>
          <span>Opening</span>
          <span>Lines</span>
          {totals && (
            <>
              <span>Games</span>
              <span>Results</span>
              <span>Score</span>
            </>
          )}
        </div>
        {node.children.map((child) => {
          const on = ticked.has(child.id);
          const last = on && ticked.size === 1;
          const games = totals?.get(child.id) ?? NONE;
          return (
            <label
              key={child.id}
              title={last ? "One move stays ticked" : undefined}
              className={cn("grid cursor-pointer items-center gap-2 border-b border-rule px-1 py-1 text-[12.5px] hover:bg-accent", columns, !on && "text-muted-foreground")}
            >
              <Checkbox checked={on} disabled={last} onCheckedChange={(next) => onTick(child.id, next === true)} aria-label={`Drill ${moveLabel(child)}`} />
              <b className="font-mono font-medium">{moveLabel(child)}</b>
              <span className="truncate font-heading text-xs text-muted-foreground italic">{getOpeningEndingAt(child.fen)?.name}</span>
              <span className="tabular-nums">{count(child.leaves)}</span>
              {totals && (
                <>
                  <span className="tabular-nums">{count(games.games)}</span>
                  <ResultsBar results={games} className="h-1.5" />
                  <span className="tabular-nums">{percent(scoreOf(games))}</span>
                </>
              )}
            </label>
          );
        })}
      </div>
      {gamesNote && <p className="text-xs text-muted-foreground">{gamesNote}</p>}
    </div>
  );
}
