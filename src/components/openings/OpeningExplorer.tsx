"use client";

import { useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from "react";
import {
  ArrowUpDown,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  MoveUpRight,
  Pause,
  Play,
} from "lucide-react";
import { toast } from "sonner";
import { ExplorerTreeWindow } from "@/components/openings/ExplorerTreeWindow";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { Separator } from "@/components/shadcn/separator";
import { Toggle } from "@/components/shadcn/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/shadcn/toggle-group";
import { Panel, PanelLabel } from "@/components/ui/Panel";
import { ResizeHandle } from "@/components/ui/ResizeHandle";
import { useStoredString } from "@/hooks/useStoredString";
import { BoardInteractive } from "@/components/board/BoardInteractive";
import { START_FEN } from "@/lib/chess/fen";
import {
  getCatalogLineToFen,
  getCatalogMatchesForFen,
  getCatalogMatchesForUciLine,
  searchCatalogMatches,
} from "@/lib/chess/openingCatalog";
import {
  createNavigator,
  lineIndex,
  navigatorReducer,
  remainingLineMoves,
} from "@/lib/chess/explorerNavigator";
import { useOpeningExplorer } from "@/hooks/useOpeningExplorer";
import { useOpeningExplorerMulti } from "@/hooks/useOpeningExplorerMulti";
import { useThemeColor } from "@/hooks/useThemeColor";
import { useEngine, type EngineMode } from "@/hooks/useEngine";
import { useLibraryBook, useLibraryBooks } from "@/context/Library";
import { formatScore, evalToBarPct } from "@/lib/chess/stockfishUci";
import { mergeMoveLineIntoTree } from "@/lib/chess/moveTree";
import type { MoveResult } from "@/hooks/useChessGame";
import { replayUciLine } from "@/lib/library/links";
import { STALE_BOOK_MESSAGE, startTree } from "@/lib/library/trees";
import { libraryErrorMessage } from "@/lib/library/types";
import type { CatalogMatch, ExplorerMatchMode, ExplorerMove, Move, MoveNode } from "@/types/chess";

function collectBookLines(
  node: MoveNode,
  path: { san: string; uci: string }[] = [],
): { san: string; uci: string }[][] {
  if (node.children.length === 0) return path.length > 0 ? [path] : [];
  return node.children.flatMap((child) => {
    if (!child.san || !child.uci) return [];
    return collectBookLines(child, [...path, { san: child.san, uci: child.uci }]);
  });
}

const AUTO_PLAY_DELAY_MS = 700;

const NO_MOVES: ExplorerMove[] = [];

/** Where the side panels' heights are kept in the browser. */
const PANELS_KEY = "bythebook.explorer.panels";

/**
 * How far each side panel can be dragged, in pixels. A height of null is the panel's own:
 * the engine and the move row fit their content, the tree window starts at `TREE_HEIGHT`.
 */
const PANEL_LIMITS = {
  engine: { min: 56, max: 360 },
  tree: { min: 120, max: 560 },
  moves: { min: 40, max: 220 },
} as const;
const TREE_HEIGHT = 240;

type PanelHeights = { engine: number | null; tree: number | null; moves: number | null };
const NO_HEIGHTS: PanelHeights = { engine: null, tree: null, moves: null };

function parseHeights(stored: string | null): PanelHeights {
  if (!stored) return NO_HEIGHTS;
  try {
    const value = JSON.parse(stored) as Partial<Record<keyof PanelHeights, unknown>>;
    const pick = (key: keyof PanelHeights) => {
      const height = value[key];
      const { min, max } = PANEL_LIMITS[key];
      return typeof height === "number" && height >= min && height <= max ? height : null;
    };
    return { engine: pick("engine"), tree: pick("tree"), moves: pick("moves") };
  } catch {
    return NO_HEIGHTS;
  }
}

function moveResultsToMoves(moveHistory: MoveResult[]): Move[] {
  return moveHistory.map((move) => ({
    san: move.san,
    uci: move.uci,
    fen: move.fen,
  }));
}

/**
 * The navigator for a page opened with a line (`initialLine`, UCI moves from the starting
 * position, as a book's "Open in Explorer" sends) or at `initialFen`, for which it replays the
 * catalog line that reaches it.
 */
function initNavigator({ initialFen, initialLine }: { initialFen?: string; initialLine?: readonly string[] }) {
  if (initialLine?.length) return createNavigator<MoveResult>(replayUciLine(initialLine));
  return createNavigator<MoveResult>(initialFen ? getCatalogLineToFen(initialFen) : []);
}

function formatGames(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

type Props = {
  initialFen?: string;
  /** A line to play on opening, as UCI moves from the starting position. */
  initialLine?: readonly string[];
  /** The book chosen on opening, such as the one New book just made. */
  initialBookId?: string;
};

export function OpeningExplorer({ initialFen, initialLine, initialBookId }: Props = {}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  // The move navigator: the highlighted line, queued moves and autoplay (lib/chess/explorerNavigator).
  const [nav, dispatch] = useReducer(navigatorReducer<MoveResult>, { initialFen, initialLine }, initNavigator);
  const {
    line: selectedMatch,
    history: moveHistory,
    command: scriptedCommand,
    autoPlaying: isAutoPlaying,
    error: playbackError,
  } = nav;
  const [engineMode, setEngineMode] = useState<EngineMode>("none");
  const [showEngineArrow, setShowEngineArrow] = useState(true);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const blurTimeoutRef = useRef<number | null>(null);

  // Opening book integration: the viewer's books, a guest's included (src/context/Library.tsx).
  // The list has only summaries; the chosen book's trees are loaded when it is chosen.
  const { books: explorerBooks } = useLibraryBooks();
  const [activeExplorerBookId, setActiveExplorerBookId] = useState<string | null>(initialBookId ?? null);
  const { book: activeExplorerBook, saveStartTree } = useLibraryBook(activeExplorerBookId);
  const [isSavingToBook, setIsSavingToBook] = useState(false);

  // The hovered move is kept with the position it was hovered in, so it lapses when the
  // board moves on.
  const [hover, setHover] = useState<{ uci: string; fen: string } | null>(null);

  const arrowColor = useThemeColor("--board-arrow", "rgb(80 60 20 / 0.5)");
  const engineArrowColor = useThemeColor("--engine-arrow", "rgb(230 140 40 / 0.7)");

  const currentMoves = useMemo(() => moveResultsToMoves(moveHistory), [moveHistory]);
  const currentUciLine = useMemo(() => currentMoves.map((m) => m.uci), [currentMoves]);
  const currentFen = currentMoves[currentMoves.length - 1]?.fen ?? START_FEN;

  const hoveredMoveUci = hover?.fen === currentFen ? hover.uci : null;
  const setHoveredMoveUci = (uci: string | null) =>
    setHover(uci ? { uci, fen: currentFen } : null);

  const hoverArrows = useMemo(
    () =>
      hoveredMoveUci
        ? [{ startSquare: hoveredMoveUci.slice(0, 2), endSquare: hoveredMoveUci.slice(2, 4), color: arrowColor }]
        : [],
    [hoveredMoveUci, arrowColor],
  );

  const engine = useEngine(currentFen, engineMode);

  const engineArrows = useMemo(() => {
    if (!showEngineArrow || engine.lines.length === 0) return [];
    const top = engine.lines[0];
    if (!top || top.pv.length === 0) return [];
    return [{
      startSquare: top.pv[0].slice(0, 2),
      endSquare: top.pv[0].slice(2, 4),
      color: engineArrowColor,
    }];
  }, [showEngineArrow, engine.lines, engineArrowColor]);

  // Deduplicate arrows by square pair — hover takes priority, engine fills gaps.
  const combinedArrows = useMemo(() => {
    const seen = new Set<string>();
    const result: { startSquare: string; endSquare: string; color: string }[] = [];
    for (const a of [...hoverArrows, ...engineArrows]) {
      const key = `${a.startSquare}-${a.endSquare}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(a);
      }
    }
    return result;
  }, [hoverArrows, engineArrows]);

  const searchResults = useMemo(
    () => (searchQuery.length > 0 ? searchCatalogMatches(searchQuery, 8) : []),
    [searchQuery],
  );
  const showDropdown = isSearchFocused && searchResults.length > 0;

  const prefixMatches = useMemo(
    () => (currentUciLine.length > 0 ? getCatalogMatchesForUciLine(currentUciLine, 8) : []),
    [currentUciLine],
  );
  const fenMatches = useMemo(
    () =>
      prefixMatches.length === 0 && currentMoves.length > 0
        ? getCatalogMatchesForFen(currentFen, 8)
        : [],
    [currentFen, currentMoves.length, prefixMatches.length],
  );

  const matchMode: ExplorerMatchMode =
    prefixMatches.length > 0 ? "prefix" : fenMatches.length > 0 ? "position" : "none";
  const effectiveMatches = matchMode === "prefix" ? prefixMatches : fenMatches;

  const currentBoardIndexWithinHighlightedLine = lineIndex(nav);
  const isBoardOnHighlightedLine = currentBoardIndexWithinHighlightedLine !== -1;

  const canGoToStart = currentMoves.length > 0;
  const canUndo = currentMoves.length > 0;
  const canGoForward = remainingLineMoves(nav).length > 0;
  const canGoToEnd = canGoForward;
  const canAutoPlay = canGoForward;

  const explorerData = useOpeningExplorer(currentFen);

  const historyBeforeFens = useMemo(
    () => moveHistory.map((_, i) => (i === 0 ? START_FEN : moveHistory[i - 1].fen)),
    [moveHistory],
  );
  const historyExplorerData = useOpeningExplorerMulti(historyBeforeFens);
  // The master moves at the position before each played move, for the tree window.
  const historyBefore = useMemo(
    () => historyBeforeFens.map((fen) => historyExplorerData[fen]?.moves ?? null),
    [historyBeforeFens, historyExplorerData],
  );

  const [storedHeights, setStoredHeights] = useStoredString(PANELS_KEY);
  const heights = parseHeights(storedHeights);
  const setHeight = (key: keyof PanelHeights, height: number | null) =>
    setStoredHeights(JSON.stringify({ ...heights, [key]: height }));
  const enginePanelRef = useRef<HTMLDivElement>(null);
  const treePanelRef = useRef<HTMLDivElement>(null);
  const movesPanelRef = useRef<HTMLDivElement>(null);

  // Autoplay sends the next move a moment after each one lands.
  useEffect(() => {
    if (!isAutoPlaying || !canAutoPlay) return;
    const timeoutId = window.setTimeout(
      () => dispatch({ type: "autoPlayTick" }),
      AUTO_PLAY_DELAY_MS,
    );
    return () => window.clearTimeout(timeoutId);
  }, [canAutoPlay, isAutoPlaying, moveHistory]);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current !== null) window.clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  const handleHighlightFromSearch = (match: CatalogMatch) => {
    dispatch({ type: "highlight", line: match });
    setSearchQuery("");
    setIsSearchFocused(false);
  };

  const handleBoardMove = (move: MoveResult) => dispatch({ type: "boardMoved", move });
  const handleBoardUndo = () => dispatch({ type: "boardUndone" });
  const handleBoardReset = () => dispatch({ type: "boardReset" });
  const handleIllegalMove = () => dispatch({ type: "illegalMove" });

  /** Goes to the position after `moves`, through a reset and a replay. */
  const goToLine = (moves: Move[]) => dispatch({ type: "goToLine", moves });

  const handleHistoryNodeClick = (fullMoveIndex: number) => {
    if (fullMoveIndex === moveHistory.length - 1) return;
    goToLine(moveHistory.slice(0, fullMoveIndex + 1).map((m) => ({ san: m.san, uci: m.uci })));
  };

  const handleGoToStart = () => dispatch({ type: "goToStart" });
  const handleUndoMove = () => dispatch({ type: "undo" });
  const handleStepForward = () => dispatch({ type: "stepForward" });
  const handleGoToEnd = () => dispatch({ type: "goToEnd" });
  const handleToggleAutoPlay = () => dispatch({ type: "toggleAutoPlay" });

  const handleExplorerMoveClick = (move: Move) => {
    dispatch({ type: "playMove", move: { san: move.san, uci: move.uci } });
  };

  const matchModeLabel =
    matchMode === "prefix"
      ? "Exact line match"
      : matchMode === "position"
        ? "Position match"
        : currentMoves.length === 0
          ? "Starting position"
          : "No catalog match";

  const positionName =
    explorerData.data?.opening?.name ??
    (effectiveMatches.length > 0
      ? effectiveMatches.slice(0, 2).map((m) => m.name).join(" / ")
      : null);

  // ── Book save ──────────────────────────────────────────────────────────────

  const activeExplorerTree = useMemo(
    () => (activeExplorerBook ? startTree(activeExplorerBook.trees) : null),
    [activeExplorerBook],
  );

  const handleAddToBook = async () => {
    if (!activeExplorerBook || !activeExplorerTree || currentMoves.length === 0) return;
    const movesToAdd = currentMoves.slice(0, 20); // 20-move limit
    const updatedTree = mergeMoveLineIntoTree(activeExplorerTree, movesToAdd);
    setIsSavingToBook(true);
    try {
      if (!(await saveStartTree(updatedTree))) toast.error(STALE_BOOK_MESSAGE);
    } catch (error) {
      toast.error(libraryErrorMessage(error));
    } finally {
      setIsSavingToBook(false);
    }
  };

  const bookLines = useMemo(
    () => (activeExplorerTree ? collectBookLines(activeExplorerTree) : []),
    [activeExplorerTree],
  );

  const handleViewBookLine = (lineJson: string) => {
    if (!lineJson) return;
    const moves: { san: string; uci: string }[] = JSON.parse(lineJson);
    if (!moves.length) return;
    goToLine(moves);
  };

  const handleClickMoveToken = (index: number) => {
    if (selectedMatch) {
      goToLine(selectedMatch.moves.slice(0, index + 1).map((m) => ({ san: m.san, uci: m.uci })));
    } else {
      // Navigate to position after this move in the current board history
      handleHistoryNodeClick(index);
    }
  };

  // A move row given a height wraps its moves; left alone it is one line that scrolls sideways.
  const wrapMoves = heights.moves !== null;
  const moveTokensWrap = wrapMoves ? "xl:flex-wrap xl:whitespace-normal" : "";

  return (
    // The page fits its page of the book at every width. Wide: the board beside a panel column.
    // Narrow (a phone or a small window): the board on top, sized from the page's height (a
    // size container, for the board's cap below), and the panels below it in one column that
    // scrolls on its own.
    <div className="flex h-full flex-col gap-2 [container-type:size] xl:grid xl:grid-cols-[1.1fr_0.9fr]">
      {/* ── Left: board + search ── */}
      <section className="grid min-w-0 shrink-0 gap-2 xl:h-full" style={{ gridTemplateRows: "auto 1fr" }}>
        {/* Header: title row + book row */}
        <Panel className="flex flex-col gap-1.5 px-2.5 py-2">
          {/* Row 1: title+subtitle (inline) | flip | search */}
          <div className="flex items-center gap-2">
            {/* The title gives way to the search box when there is no room for both. */}
            <div className="hidden min-w-0 flex-1 items-baseline gap-2 sm:flex">
              <h1 className="shrink-0 font-heading text-base font-semibold">Opening Explorer</h1>
              <p className="truncate text-xs text-muted-foreground">
                {selectedMatch
                  ? `${selectedMatch.eco} · ${selectedMatch.name}`
                  : "Play moves or search."}
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="h-7 shrink-0 px-2 text-xs"
              onClick={() => setBoardOrientation((o) => (o === "white" ? "black" : "white"))}
              title="Flip board"
            >
              <ArrowUpDown aria-hidden="true" />
              {boardOrientation === "white" ? "White" : "Black"}
            </Button>

            {/* Search input */}
            <div className="relative order-first min-w-0 flex-1 sm:order-none sm:w-52 sm:flex-none">
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (blurTimeoutRef.current !== null) window.clearTimeout(blurTimeoutRef.current);
                  setIsSearchFocused(true);
                }}
                onBlur={() => {
                  blurTimeoutRef.current = window.setTimeout(
                    () => setIsSearchFocused(false),
                    150,
                  );
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setSearchQuery("");
                    setIsSearchFocused(false);
                  }
                }}
                placeholder="Search — Sicilian, B12…"
                aria-label="Search openings"
                className="h-7 px-2"
              />

              {showDropdown && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md">
                  {searchResults.map((result) => (
                    <button
                      key={`${result.eco}-${result.name}-${result.pgn}`}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleHighlightFromSearch(result);
                      }}
                      className="flex w-full items-center gap-2.5 border-b px-2.5 py-1.5 text-left last:border-0 hover:bg-accent"
                    >
                      <span className="w-9 shrink-0 font-mono text-xs font-semibold text-muted-foreground">
                        {result.eco}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{result.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{result.pgn}</p>
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {result.moves.length}m
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 2: book selector + View Lines + Add line. On a phone View Lines is left out,
              so the row stays one line and the sticky header never covers the panels below. */}
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect
              aria-label="Book"
              size="sm"
              value={activeExplorerBookId ?? ""}
              onChange={(e) => setActiveExplorerBookId(e.target.value || null)}
              wrapperClassName="min-w-0 flex-1 sm:w-44 sm:flex-none sm:shrink-0"
              className="h-7 pl-2 pr-7"
            >
              <NativeSelectOption value="">
                {explorerBooks?.length === 0 ? "— No books yet —" : "— No book selected —"}
              </NativeSelectOption>
              {(explorerBooks ?? []).map((b) => (
                <NativeSelectOption key={b.id} value={b.id}>
                  {b.name} ({b.color})
                </NativeSelectOption>
              ))}
            </NativeSelect>

            {/* View Lines dropdown */}
            <NativeSelect
              aria-label="View a line of the book"
              size="sm"
              value=""
              onChange={(e) => handleViewBookLine(e.target.value)}
              disabled={!activeExplorerBook || bookLines.length === 0}
              wrapperClassName="hidden min-w-0 flex-1 sm:block"
              className="h-7 pl-2 pr-7"
            >
              <NativeSelectOption value="">View Lines</NativeSelectOption>
              {bookLines.map((line, idx) => (
                <NativeSelectOption key={idx} value={JSON.stringify(line)}>
                  {line.slice(0, 8).map((m) => m.san).join(" ")}
                  {line.length > 8 ? "…" : ""}
                </NativeSelectOption>
              ))}
            </NativeSelect>

            {/* Add line — always visible, disabled when no book or no moves */}
            <Button
              size="sm"
              className="h-7 shrink-0 px-2.5 text-xs"
              onClick={handleAddToBook}
              disabled={!activeExplorerBook || currentMoves.length === 0 || isSavingToBook}
            >
              {isSavingToBook ? (
                "Saving…"
              ) : (
                <>
                  Add line
                  {currentMoves.length > 0 && (
                    <span className="hidden sm:inline"> ({Math.min(currentMoves.length, 20)} moves)</span>
                  )}
                </>
              )}
            </Button>
          </div>
        </Panel>

        {/* Board + right-side eval bar */}
        <Panel className="flex min-h-0 justify-center gap-1.5 p-1.5">
          {/* Narrow: a square as wide as the panel, but capped at about half the page's
              height (max-w below), so the panels under it always keep some room. Wide: it
              fills the panel and the inner square takes the smaller side. */}
          <div
            className="aspect-square min-h-0 w-full max-w-[52cqh] flex-1 xl:aspect-auto xl:max-w-none"
            style={{ containerType: "size" }}
          >
            <div style={{ width: "min(100cqw, 100cqh)", height: "min(100cqw, 100cqh)" }}>
              <BoardInteractive
                initialFen={START_FEN}
                scriptedCommand={scriptedCommand}
                playerColor="both"
                orientation={boardOrientation}
                onMove={handleBoardMove}
                onUndo={handleBoardUndo}
                onReset={handleBoardReset}
                onIllegalMove={handleIllegalMove}
                arrows={combinedArrows}
              />
            </div>
          </div>
          {/* Vertical eval bar — always present; fill only when engine is active */}
          <div className="relative w-2.5 self-stretch overflow-hidden rounded-sm border bg-bar-black">
            {/* Decorative tick marks */}
            {[25, 50, 75].map((pct) => (
              <div
                key={pct}
                className="absolute left-0 right-0 z-10 h-px bg-muted-foreground/25"
                style={{ top: `${pct}%` }}
              />
            ))}
            {/* Eval fill */}
            <div
              className="absolute w-full bg-bar-white transition-all duration-500"
              style={{
                ...(boardOrientation === "black" ? { top: 0 } : { bottom: 0 }),
                height:
                  engineMode !== "none" && engine.lines[0]
                    ? `${evalToBarPct(engine.lines[0].score, engine.lines[0].mate)}%`
                    : engineMode !== "none"
                      ? "50%"
                      : "0%",
              }}
            />
          </div>
        </Panel>
      </section>

      {/* ── Right: four-section sidebar. Wide: each panel but the statistics can be dragged
          taller or shorter by the handle under it, and the statistics take what is left.
          Narrow: it sits under the board and scrolls as one column, with the move row first
          (and pinned) and the statistics next. A handle or a gap follows every panel. ── */}
      <aside className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        {/* ① Engine panel */}
        <Panel
          ref={enginePanelRef}
          className="order-3 flex shrink-0 flex-col px-2.5 py-1.5 xl:order-none"
          style={engineMode !== "none" && heights.engine ? { height: heights.engine } : undefined}
        >
          {/* Controls row */}
          <div className="flex items-center gap-1.5">
            <PanelLabel className="mr-auto">Engine</PanelLabel>
            {/* Arrow toggle — invisible when engine is off so the pills never shift */}
            <Toggle
              variant="outline"
              size="sm"
              pressed={showEngineArrow}
              onPressedChange={setShowEngineArrow}
              title={showEngineArrow ? "Hide engine arrow" : "Show engine arrow"}
              className={`h-6 min-w-0 px-2 text-xs data-[state=on]:border-warning/50 data-[state=on]:bg-transparent data-[state=on]:text-warning ${
                engineMode === "none" ? "invisible" : ""
              }`}
            >
              <MoveUpRight aria-hidden="true" className="size-3" />
              Arrow
            </Toggle>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              aria-label="Engine"
              value={engineMode}
              onValueChange={(value) => {
                if (value) setEngineMode(value as EngineMode);
              }}
            >
              {(["none", "light", "heavy"] as const).map((m) => (
                <ToggleGroupItem
                  key={m}
                  value={m}
                  className="h-6 min-w-0 px-2 text-xs capitalize data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  {m}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {/* Engine output */}
          {engineMode !== "none" && (
            <div className="mt-1.5 min-h-0 space-y-1.5 overflow-y-auto">
              {!engine.isReady ? (
                <p className="text-xs text-muted-foreground">Loading engine…</p>
              ) : (
                <>
                  {/* Score + depth */}
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-xl font-semibold tabular-nums">
                      {engine.lines[0]
                        ? formatScore(engine.lines[0].score, engine.lines[0].mate)
                        : "—"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {engine.isAnalyzing
                        ? `depth ${engine.lines[0]?.depth ?? "…"}`
                        : `depth ${engine.lines[0]?.depth ?? "—"}`}
                    </span>
                    {engine.isAnalyzing && (
                      <span className="ml-auto animate-pulse text-xs text-muted-foreground/60">●</span>
                    )}
                  </div>

                  {/* PV lines */}
                  {engine.lines.length > 0 && (
                    <div className="space-y-1">
                      {engine.lines.map((line) => (
                        <div key={line.multipv} className="flex items-baseline gap-2">
                          <span className="w-9 shrink-0 font-mono text-xs font-semibold tabular-nums">
                            {formatScore(line.score, line.mate)}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {line.pvSan.slice(0, 6).join(" ")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </Panel>

        {engineMode !== "none" ? (
          <ResizeHandle
            className="order-3 xl:order-none"
            target={enginePanelRef}
            {...PANEL_LIMITS.engine}
            onResize={(height) => setHeight("engine", height)}
            onReset={() => setHeight("engine", null)}
            label="Resize the engine panel"
          />
        ) : (
          <div className="order-3 h-2 shrink-0 xl:order-none" />
        )}

        {/* ② The explored line, in the book view the viewer picks */}
        <Panel
          ref={treePanelRef}
          className="order-4 shrink-0 overflow-hidden p-1 xl:order-none"
          style={{ height: heights.tree ?? TREE_HEIGHT }}
        >
          <ExplorerTreeWindow
            history={moveHistory}
            before={historyBefore}
            next={explorerData.data?.moves ?? NO_MOVES}
            orientation={boardOrientation}
            onGoToLine={goToLine}
            onPlayMove={handleExplorerMoveClick}
            onHoverUci={setHoveredMoveUci}
          />
        </Panel>
        <ResizeHandle
          className="order-4 xl:order-none"
          target={treePanelRef}
          {...PANEL_LIMITS.tree}
          onResize={(height) => setHeight("tree", height)}
          onReset={() => setHeight("tree", null)}
          label="Resize the tree window"
        />

        {/* ③ Move sequence + navigation */}
        <Panel
          ref={movesPanelRef}
          className={`sticky top-0 z-10 order-1 flex shrink-0 flex-col px-2.5 py-1.5 xl:static xl:order-none ${
            wrapMoves ? "xl:h-[var(--moves-h)]" : ""
          }`}
          style={wrapMoves ? ({ "--moves-h": `${heights.moves}px` } as CSSProperties) : undefined}
        >
          <div className="flex min-h-0 flex-1 items-start gap-2">
            {/* Move tokens: one line that scrolls sideways, or wrapped when the row is taller */}
            <div className={`min-w-0 flex-1 self-center overflow-x-auto ${wrapMoves ? "xl:h-full xl:self-auto xl:overflow-x-hidden xl:overflow-y-auto" : ""}`}>
              {selectedMatch ? (
                <div className={`flex items-baseline gap-1 whitespace-nowrap ${moveTokensWrap}`}>
                  {selectedMatch.moves.map((move, index) => {
                    const isPlayed =
                      isBoardOnHighlightedLine &&
                      index < currentBoardIndexWithinHighlightedLine;
                    const isNext =
                      isBoardOnHighlightedLine &&
                      index === currentBoardIndexWithinHighlightedLine;
                    return (
                      <span key={index} className="inline-flex items-baseline gap-0.5">
                        {index % 2 === 0 && (
                          <span className="text-xs text-muted-foreground/60">
                            {Math.floor(index / 2) + 1}.
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleClickMoveToken(index)}
                          className={`cursor-pointer rounded-xs px-0.5 text-sm transition-colors hover:bg-muted ${
                            isPlayed
                              ? "font-semibold"
                              : isNext
                                ? "font-semibold underline decoration-muted-foreground underline-offset-2"
                                : "text-muted-foreground"
                          }`}
                        >
                          {move.san}
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : currentMoves.length > 0 ? (
                <div className={`flex items-baseline gap-1 whitespace-nowrap ${moveTokensWrap}`}>
                  {currentMoves.map((move, index) => (
                    <span key={index} className="inline-flex items-baseline gap-0.5">
                      {index % 2 === 0 && (
                        <span className="text-xs text-muted-foreground/60">
                          {Math.floor(index / 2) + 1}.
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleClickMoveToken(index)}
                        className="cursor-pointer rounded-xs px-0.5 text-sm font-semibold hover:bg-muted"
                      >
                        {move.san}
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No moves yet.</p>
              )}
            </div>

            {/* Nav buttons */}
            <div className="flex shrink-0 items-center gap-0.5">
              <Button variant="ghost" size="icon-sm" className="size-7" onClick={handleGoToStart} disabled={!canGoToStart} title="Go to start">
                <ChevronFirst aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="icon-sm" className="size-7" onClick={handleUndoMove} disabled={!canUndo} title="Undo move">
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button
                size="icon-sm"
                className="size-7"
                onClick={handleToggleAutoPlay}
                disabled={!canAutoPlay && !isAutoPlaying}
                title={isAutoPlaying ? "Pause" : "Play"}
              >
                {isAutoPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
              </Button>
              <Button variant="ghost" size="icon-sm" className="size-7" onClick={handleStepForward} disabled={!canGoForward} title="Step forward">
                <ChevronRight aria-hidden="true" />
              </Button>
              <Button variant="ghost" size="icon-sm" className="size-7" onClick={handleGoToEnd} disabled={!canGoToEnd} title="Go to end">
                <ChevronLast aria-hidden="true" />
              </Button>
            </div>
          </div>

          {selectedMatch && !isBoardOnHighlightedLine && currentMoves.length > 0 && (
            <div className="mt-1.5 flex items-center gap-2 text-xs text-warning">
              <p>Board diverged from highlighted line.</p>
              <button
                type="button"
                onClick={() => dispatch({ type: "clearLine" })}
                className="font-medium underline hover:no-underline"
              >
                Clear line
              </button>
            </div>
          )}
          {playbackError && (
            <p className="mt-1.5 text-xs text-destructive">{playbackError}</p>
          )}
        </Panel>
        {/* The move row's handle is for wide screens, where the row isn't pinned. */}
        <div className="order-1 shrink-0 xl:order-none">
          <div className="hidden xl:block">
            <ResizeHandle
              target={movesPanelRef}
              {...PANEL_LIMITS.moves}
              onResize={(height) => setHeight("moves", height)}
              onReset={() => setHeight("moves", null)}
              label="Resize the move row"
            />
          </div>
          <div className="h-2 xl:hidden" />
        </div>

        {/* ④ Opening name + master game stats */}
        <Panel className="order-2 flex shrink-0 flex-col px-2.5 py-2 xl:order-none xl:min-h-32 xl:flex-1 xl:shrink xl:overflow-y-auto">
          {/* Match label + opening name */}
          <div className="shrink-0">
            <PanelLabel>{matchModeLabel}</PanelLabel>
            {positionName ? (
              <p className="mt-0.5 text-sm font-semibold">{positionName}</p>
            ) : (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {selectedMatch ? selectedMatch.name : "Play moves to identify the opening."}
              </p>
            )}
          </div>

          <Separator className="my-2 shrink-0" />

          {/* Master game move stats */}
          {explorerData.loading && (
            <p className="text-xs text-muted-foreground">Loading master games…</p>
          )}
          {!explorerData.loading && explorerData.error && (
            <p className="text-xs text-muted-foreground">
              {/* A 404 is the route's answer to a guest for a position it hasn't saved. */}
              {explorerData.error === "404"
                ? "Master statistics for this position aren't saved yet. Live lookups need a beta account."
                : "Could not load master game data."}
            </p>
          )}
          {explorerData.data && explorerData.data.moves.length > 0 && (
            <div className="min-h-0 flex-1">
              <div className="mb-1 grid grid-cols-[2rem_1fr_3.5rem] gap-2 px-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                <span>Mv</span>
                <span>W / D / B</span>
                <span className="text-right">Games</span>
              </div>
              <div onMouseLeave={() => setHoveredMoveUci(null)}>
                {explorerData.data.moves.map((move) => {
                  const total = move.white + move.draws + move.black;
                  if (total === 0) return null;
                  const wPct = (move.white / total) * 100;
                  const dPct = (move.draws / total) * 100;
                  const bPct = (move.black / total) * 100;
                  const isHighlightedFirst =
                    selectedMatch &&
                    currentBoardIndexWithinHighlightedLine === 0 &&
                    selectedMatch.moves[0]?.san === move.san;
                  const isHovered = hoveredMoveUci === move.uci;
                  return (
                    <div
                      key={move.uci}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleExplorerMoveClick(move)}
                      onMouseEnter={() => setHoveredMoveUci(move.uci)}
                      onMouseLeave={() => setHoveredMoveUci(null)}
                      onKeyDown={(e) => e.key === "Enter" && handleExplorerMoveClick(move)}
                      className={`grid cursor-pointer grid-cols-[2rem_1fr_3.5rem] items-center gap-2 rounded-sm px-1.5 py-1 transition-colors ${
                        isHovered || isHighlightedFirst ? "bg-muted" : "hover:bg-muted"
                      }`}
                    >
                      <span
                        className={`text-sm font-semibold ${
                          isHighlightedFirst ? "underline decoration-muted-foreground underline-offset-2" : ""
                        }`}
                      >
                        {move.san}
                      </span>
                      <div data-slot="move-bar" className="flex h-2 overflow-hidden rounded-xs">
                        <div
                          className="bg-bar-white"
                          style={{ width: `${wPct}%` }}
                          title={`White ${Math.round(wPct)}%`}
                        />
                        <div
                          className="bg-bar-draw"
                          style={{ width: `${dPct}%` }}
                          title={`Draw ${Math.round(dPct)}%`}
                        />
                        <div
                          className="bg-bar-black"
                          style={{ width: `${bPct}%` }}
                          title={`Black ${Math.round(bPct)}%`}
                        />
                      </div>
                      <span className="text-right text-xs tabular-nums text-muted-foreground">
                        {formatGames(total)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {explorerData.data &&
            explorerData.data.moves.length === 0 &&
            !explorerData.loading && (
              <p className="text-xs text-muted-foreground">
                No master games found for this position.
              </p>
            )}
          {!explorerData.data && !explorerData.loading && !explorerData.error && (
            <p className="text-xs text-muted-foreground">Master game data will appear here.</p>
          )}
        </Panel>
        <div className="order-2 h-2 shrink-0 xl:hidden" />
      </aside>
    </div>
  );
}
