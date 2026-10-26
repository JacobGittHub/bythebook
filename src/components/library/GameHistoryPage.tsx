"use client";

import { ExternalLink, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { PageEar } from "@/components/book/PageEar";
import { Spread } from "@/components/book/Spread";
import { BookView } from "@/components/books/BookView";
import { useViewZoom } from "@/components/books/useViewZoom";
import { ZoomControls } from "@/components/books/ZoomControls";
import { Button } from "@/components/shadcn/button";
import { Skeleton } from "@/components/shadcn/skeleton";
import { Switch } from "@/components/shadcn/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/shadcn/toggle-group";
import { useGameImport } from "@/context/GameImport";
import { useHistoryGames } from "@/hooks/useHistoryGames";
import { highlightIndex, type Walk } from "@/lib/books/views/camera";
import { buildViewTree, deepestOf, moveLabel, pathTo, type ViewNode } from "@/lib/books/viewTree";
import { applyUci, uciToSan } from "@/lib/chess/applyUci";
import { ALL_GAMES, chooseGames, controlName, recentGames, type HistoryFilter, type HistorySide } from "@/lib/history/historyFilter";
import { buildHistoryTree, gamesThrough, scoreOf, type PositionNames } from "@/lib/history/historyTree";
import { comparePlayed } from "@/lib/history/merge";
import { gameLink } from "@/lib/history/record";
import type { StoredGame, Tally } from "@/lib/history/types";
import { libraryHref } from "@/lib/library/links";
import { HistoryMenu, ResultsBar } from "./GameHistorySection";
import { HistoryFilters } from "./HistoryFilters";
import { HistoryPosition } from "./HistoryPosition";

/** Games listed at first through the current position; more come a page at a time. */
const GAMES_SHOWN = 100;
/** Moves from the current position shown for each listed game. */
const MOVES_SHOWN = 6;

const count = (n: number) => n.toLocaleString("en-US");
const games = (n: number) => `${count(n)} game${n === 1 ? "" : "s"}`;
const percent = (score: number | null) => (score === null ? "–" : `${Math.round(score * 100)}%`);

/**
 * The game history page, a second level of the Library (plans/game-history.md D30, D38): on the
 * left the user's games, chosen by side, time, source and dates, with their totals and the games
 * through the current position; on the right the current position and the games' tree in ply
 * columns, painted by the user's score and walked with the arrow keys (D32).
 */
export function GameHistoryPage() {
  const { history, summary, games: all, error, reload } = useHistoryGames();
  const { openDialog } = useGameImport();
  const [pickedFilter, setFilter] = useState<HistoryFilter | null>(null);
  const [chosenId, setChosenId] = useState("root");
  const [walk, setWalk] = useState<Walk | null>(null);
  const [painted, setPainted] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [shown, setShown] = useState({ id: "root", count: GAMES_SHOWN });
  const zoom = useViewZoom();
  // Positions and move names, kept between trees so a change of filter only counts games again.
  const [names] = useState<PositionNames>(() => new Map());

  // The page opens on the last year of games, which also keeps the first tree small, until a filter is picked.
  const opening = useMemo(() => (all ? recentGames(all) : null), [all]);
  const filter = pickedFilter ?? opening ?? ALL_GAMES;
  const chosen = useMemo(() => (all ? chooseGames(all, filter) : []), [all, filter]);
  const built = useMemo(() => buildHistoryTree(chosen.map((game) => game.record), names), [chosen, names]);
  const tree = useMemo(() => buildViewTree(built.source), [built]);
  const success = useMemo(() => new Map([...built.results].map(([id, tally]) => [id, scoreOf(tally)])), [built]);
  const selected = deepestOf(tree, chosenId);
  const highlight = highlightIndex(selected, walk);
  const highlightId = highlight >= 0 ? selected.children[highlight].id : null;
  // The board draws the hovered move of this position, else the one the arrow keys would play.
  const hovered = hoveredId ? tree.byId.get(hoveredId) : undefined;
  const arrow = hovered?.parent === selected ? hovered : highlight >= 0 ? selected.children[highlight] : null;
  const through = useMemo(
    () => gamesThrough(chosen, built.lines.get(selected.id) ?? "").sort((a, b) => comparePlayed(b.record, a.record)),
    [chosen, built, selected],
  );
  const listed = shown.id === selected.id ? shown.count : GAMES_SHOWN;

  const select = (node: ViewNode) => setChosenId(node.id);
  const total: Tally = built.results.get("root") ?? { win: 0, draw: 0, loss: 0 };
  const orientation = filter.side === "black" ? "black" : "white";
  const kept = history.store === "browser" ? "Kept in this browser" : "Kept in your account";
  const empty = summary !== null && summary.games === 0;
  const ready = all !== null && !empty;

  let left;
  let right;
  if (error) {
    left = <p className="py-6 text-sm text-muted-foreground">{error}</p>;
    right = null;
  } else if (empty) {
    left = (
      <div className="flex flex-col items-start gap-3 py-6">
        <h1 className="font-heading text-[30px] leading-tight font-semibold">Your games</h1>
        <p className="text-sm">
          Import your games from Chess.com, Lichess or a tournament file to see how you&apos;ve done in your openings.
        </p>
        <Button size="sm" variant="outline" onClick={openDialog}>
          <Upload /> Import games
        </Button>
      </div>
    );
    right = <p className="py-6 text-sm text-muted-foreground">Your games&apos; tree appears here once they are imported.</p>;
  } else if (!ready) {
    left = <Skeleton className="h-64 w-full" />;
    right = <Skeleton className="min-h-64 w-full flex-1" />;
  } else {
    left = (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <header className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-heading text-[30px] leading-tight font-semibold">
              Your games <span className="font-sans text-base font-normal text-muted-foreground">as</span>
            </h1>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={filter.side}
              onValueChange={(side) => side && setFilter({ ...filter, side: side as HistorySide })}
              aria-label="Side"
            >
              <ToggleGroupItem value="both" className="px-2.5">Both</ToggleGroupItem>
              <ToggleGroupItem value="white" className="px-2.5">White</ToggleGroupItem>
              <ToggleGroupItem value="black" className="px-2.5">Black</ToggleGroupItem>
            </ToggleGroup>
            <span className="grow" />
            <Button size="sm" variant="ghost" onClick={openDialog}>
              <Upload /> Import games
            </Button>
            <HistoryMenu history={history} games={summary?.games ?? 0} onCleared={reload} />
          </div>
          {history.store === "browser" && (
            <p className="text-xs text-muted-foreground">
              Kept in this browser, which may delete them after weeks without a visit (Safari does after 7 days), so keep
              your PGN files to import them again.
            </p>
          )}
        </header>
        <HistoryFilters games={all} imports={summary?.imports ?? []} filter={filter} onChange={setFilter} />
        <div className="flex shrink-0 flex-col gap-1.5 border-y border-rule py-2.5">
          <div className="flex items-baseline gap-2.5">
            <span className="font-heading text-[26px] leading-none font-semibold tabular-nums">{count(chosen.length)}</span>
            <span className="text-muted-foreground">games</span>
            <span className="grow" />
            <span className="text-xs text-muted-foreground">
              Score <b className="text-foreground tabular-nums">{percent(scoreOf(total))}</b>
            </span>
          </div>
          <ResultsBar results={total} />
          <p className="flex flex-wrap gap-x-3.5 text-xs text-muted-foreground">
            <span>{count(total.win)} wins</span>
            <span>{count(total.draw)} draws</span>
            <span>{count(total.loss)} losses</span>
          </p>
        </div>
        <section aria-labelledby="history-through" className="flex min-h-0 flex-1 flex-col gap-1.5">
          <div className="flex items-baseline gap-2">
            <h2 id="history-through" className="font-heading text-[19px] leading-tight font-semibold">
              {selected.san ? `Games through ${moveLabel(selected)}` : "All games"}
            </h2>
            <span className="book-sc">{games(through.length)}</span>
          </div>
          <nav aria-label="Line" className="flex flex-wrap gap-x-1 font-mono text-xs">
            {pathTo(selected).map((node, i) => (
              <span key={node.id} className="flex gap-1">
                {i > 0 && <span className="text-muted-foreground">›</span>}
                <button
                  type="button"
                  aria-current={node === selected ? "true" : undefined}
                  onClick={() => select(node)}
                  className="rounded-sm px-0.5 text-primary aria-[current]:font-medium aria-[current]:text-foreground"
                >
                  {node.san ? moveLabel(node) : "Start"}
                </button>
              </span>
            ))}
          </nav>
          <GamesTable
            games={through.slice(0, listed)}
            from={selected}
            more={through.length - listed}
            onMore={() => setShown({ id: selected.id, count: listed + GAMES_SHOWN })}
          />
        </section>
      </div>
    );
    right = (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <HistoryPosition
          node={selected}
          results={built.results}
          highlightId={highlightId}
          arrow={arrow}
          orientation={orientation}
          onSelect={select}
          onHover={(node) => setHoveredId(node?.id ?? null)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[13px]">
            <Switch checked={painted} onCheckedChange={setPainted} />
            Your score
          </label>
          <span className="grow" />
          <ZoomControls zoom={zoom} />
        </div>
        <div
          data-slot="panel"
          className="relative flex h-[28rem] min-h-64 rounded-md border bg-muted p-1 [--bv-label-halo:var(--muted)] md:h-auto md:flex-1"
        >
          <BookView
            tree={tree}
            view="ply-columns"
            selectedId={selected.id}
            side={null}
            weight="games"
            onSelect={select}
            onHover={(node) => setHoveredId(node?.id ?? null)}
            label="Ply columns of your games"
            zoom={zoom}
            success={painted ? success : undefined}
            walk={walk}
            onWalkChange={setWalk}
            keysAnywhere
            className="flex-1"
          />
        </div>
        <p className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
          <span>
            <Key>↑</Key> <Key>↓</Key> choose a move
          </span>
          <span>
            <Key>→</Key> play it
          </span>
          <span>
            <Key>←</Key> back
          </span>
          <span>Drag to look around, Ctrl + wheel to zoom</span>
          <span className="grow" />
          {painted ? (
            <span className="flex items-center gap-1.5">
              Your score
              <span className="inline-block h-[7px] w-16 rounded-sm bg-[linear-gradient(90deg,var(--destructive),var(--bar-draw),var(--success))]" />
              30% → 70%+ · thickness: games
            </span>
          ) : (
            <span>Thickness: games</span>
          )}
        </p>
      </div>
    );
  }

  return (
    <Spread
      left={{
        // Back to the Library by the page's ear (plans/book-ui.md D21, D22).
        ear: <PageEar side="left" word="Library" label="Back to the Library" href={libraryHref()} />,
        head: (
          <>
            <span className="grow" />
            <span className="book-sc">{kept}</span>
          </>
        ),
        body: left,
        folio: summary && (
          <>
            <span className="grow" />
            <span>{games(summary.games)} of {count(summary.limit)}</span>
          </>
        ),
      }}
      right={{
        head: (
          <>
            <span className="book-sc">The current position</span>
            <span className="grow" />
            <span>Game history</span>
          </>
        ),
        body: right,
        folio: ready && (
          <>
            <span>{games(chosen.length)} chosen</span>
            <span className="grow" />
            <span>{count(tree.nodes.length)} positions drawn</span>
          </>
        ),
      }}
    />
  );
}

/** A key on the keyboard, in the hints under a drawing. */
export function Key({ children }: { children: string }) {
  return <kbd className="rounded-sm border border-b-2 bg-card px-1 text-[11px] text-foreground">{children}</kbd>;
}

/** "1.e4 e5 2.Nf3", from the position `from`, as far as a game's kept moves go. */
function movesFrom(game: StoredGame, from: ViewNode): string {
  const moves = game.record.moves.split(" ").slice(from.ply, from.ply + MOVES_SHOWN);
  let fen = from.fen;
  const sans: string[] = [];
  for (const [i, uci] of moves.entries()) {
    const ply = from.ply + i;
    const san = uciToSan(fen, uci);
    const next = applyUci(fen, uci);
    if (!san || !next) break;
    sans.push(ply % 2 === 0 ? `${ply / 2 + 1}.${san}` : i === 0 ? `${(ply + 1) / 2}...${san}` : san);
    fen = next;
  }
  return sans.join(" ");
}

const RESULTS = { win: ["Win", "text-success"], draw: ["Draw", "text-muted-foreground"], loss: ["Loss", "text-destructive"] } as const;

/** The games through the current position, newest first, each with the moves it played next and a link to it. */
function GamesTable({ games: list, from, more, onMore }: { games: StoredGame[]; from: ViewNode; more: number; onMore: () => void }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto border-t border-rule [scrollbar-width:thin] max-md:max-h-96">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="text-left">
            {["Date", "", "Result", "Time", "Moves from here", ""].map((head, i) => (
              <th key={i} className={`sticky top-0 border-b border-rule bg-card px-1.5 py-1.5 book-sc ${i === 3 ? "max-sm:hidden" : ""}`}>
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.map((game) => {
            const { record } = game;
            const link = gameLink(record);
            const moves = movesFrom(game, from);
            const [result, color] = RESULTS[record.result];
            return (
              <tr key={record.key} className="border-b border-rule align-top">
                <td className="px-1.5 py-1 tabular-nums whitespace-nowrap">{record.playedAt?.slice(0, 10) ?? "–"}</td>
                <td className="px-1 py-1">
                  <span
                    title={record.color === "white" ? "White" : "Black"}
                    className={`inline-block size-2.5 border ${record.color === "white" ? "border-muted-foreground bg-card" : "border-foreground bg-foreground"}`}
                  />
                </td>
                <td className={`px-1.5 py-1 font-bold ${color}`}>{result}</td>
                <td className="px-1.5 py-1 text-muted-foreground tabular-nums max-sm:hidden">{controlName(record.timeControl)}</td>
                <td className="px-1.5 py-1 font-mono text-xs text-foreground">{moves || "–"}</td>
                <td className="px-1.5 py-1">
                  {link && (
                    <a href={link} target="_blank" rel="noopener noreferrer" aria-label="Open the game on its site" className="text-muted-foreground hover:text-foreground">
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {more > 0 && (
        <div className="flex items-center gap-2 px-1.5 py-2 text-xs text-muted-foreground">
          The newest {count(list.length)} of {count(list.length + more)}.
          <Button variant="link" size="xs" className="h-auto p-0" onClick={onMore}>
            Show {count(Math.min(more, GAMES_SHOWN))} more
          </Button>
        </div>
      )}
    </div>
  );
}
