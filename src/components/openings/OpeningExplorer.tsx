"use client";

import { useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from "react";
import { ExplorerTreeWindow } from "@/components/openings/ExplorerTreeWindow";
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
import { useEngine, type EngineMode } from "@/hooks/useEngine";
import { useBackgroundMode } from "@/context/BackgroundMode";
import { useViewer } from "@/context/Viewer";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { formatScore, evalToBarPct } from "@/lib/chess/stockfishUci";
import { mergeMoveLineIntoTree } from "@/lib/chess/moveTree";
import type { MoveResult } from "@/hooks/useChessGame";
import { STALE_BOOK_MESSAGE, accountLibrary, saveStartTree } from "@/lib/library/accountStore";
import { startTree } from "@/lib/library/trees";
import type { LibraryBook, LibraryEntry } from "@/lib/library/types";
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

/** The navigator for a page opened at `initialFen`: it replays the catalog line that reaches it. */
function initNavigator(initialFen: string | undefined) {
  return createNavigator<MoveResult>(initialFen ? getCatalogLineToFen(initialFen) : []);
}

function formatGames(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export function OpeningExplorer({ initialFen }: { initialFen?: string } = {}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  // The move navigator: the highlighted line, queued moves and autoplay (lib/chess/explorerNavigator).
  const [nav, dispatch] = useReducer(navigatorReducer<MoveResult>, initialFen, initNavigator);
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

  // Opening book integration
  const [explorerBooks, setExplorerBooks] = useState<LibraryEntry[]>([]);
  const [activeExplorerBookId, setActiveExplorerBookId] = useState<string | null>(null);
  // The chosen book with its trees, loaded when it is chosen; the list has only summaries.
  const [loadedBook, setLoadedBook] = useState<LibraryBook | null>(null);
  const [isSavingToBook, setIsSavingToBook] = useState(false);

  const { signedIn } = useViewer();

  // Load user's books for the book selector. A guest has none, so nothing is asked.
  useEffect(() => {
    if (!signedIn) return;

    accountLibrary
      .list()
      .then(setExplorerBooks)
      .catch(() => {});
  }, [signedIn]);

  useEffect(() => {
    if (!activeExplorerBookId) return;
    let current = true;
    accountLibrary
      .get(activeExplorerBookId)
      .then((book) => {
        if (current) setLoadedBook(book);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [activeExplorerBookId]);

  const { mode } = useBackgroundMode();
  // The hovered move is kept with the position it was hovered in, so it lapses when the
  // board moves on.
  const [hover, setHover] = useState<{ uci: string; fen: string } | null>(null);

  const arrowColor = useMemo(() => {
    switch (mode) {
      case "dark":  return "rgba(140, 130, 220, 0.55)";
      case "blue":  return "rgba(40,  80,  200, 0.55)";
      case "green": return "rgba(40,  130, 60,  0.55)";
      case "red":   return "rgba(170, 50,  40,  0.55)";
      default:      return "rgba(80,  60,  20,  0.50)";
    }
  }, [mode]);

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
      color: "rgba(230, 140, 40, 0.70)",
    }];
  }, [showEngineArrow, engine.lines]);

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

  const activeExplorerBook = loadedBook?.id === activeExplorerBookId ? loadedBook : null;
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
      const { book, saved } = await saveStartTree(activeExplorerBook, updatedTree);
      setLoadedBook(book);
      setExplorerBooks((prev) => prev.map((b) => (b.id === book.id ? book : b)));
      if (!saved) alert(STALE_BOOK_MESSAGE);
    } catch {
      // silent fail — user can retry
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

  const navBtnClass =
    "btn-secondary rounded-full p-1.5 transition-colors";
  const playBtnClass =
    "btn-primary rounded-full px-3 py-1.5 text-xs font-semibold transition-opacity";
  const cardClass = "rounded-2xl border border-[var(--border-card)] bg-[var(--bg-card)]";
  // A move row given a height wraps its moves; left alone it is one line that scrolls sideways.
  const wrapMoves = heights.moves !== null;
  const moveTokensWrap = wrapMoves ? "xl:flex-wrap xl:whitespace-normal" : "";

  return (
    // The page fits the viewport at every width. Wide: the board beside a panel column.
    // Narrow (a phone or a small window): the board on top, sized from the viewport height,
    // and the panels below it in one column that scrolls on its own.
    <div className="flex h-[calc(100dvh-var(--dash-offset))] flex-col gap-2 xl:grid xl:grid-cols-[1.1fr_0.9fr] xl:gap-3">
      {/* ── Left: board + search ── */}
      <section className="grid min-w-0 shrink-0 gap-2 xl:h-full" style={{ gridTemplateRows: "auto 1fr" }}>
        {/* Header card: title row + book row */}
        <div className={`flex flex-col gap-1.5 px-3 py-2 ${cardClass}`}>
          {/* Row 1: title+subtitle (inline) | flip | search */}
          <div className="flex items-center gap-2">
            {/* The title gives way to the search box when there is no room for both. */}
            <div className="hidden min-w-0 flex-1 items-baseline gap-2 sm:flex">
              <h1 className="shrink-0 text-lg font-semibold text-slate-950">Opening Explorer</h1>
              <p className="truncate text-sm text-slate-400">
                {selectedMatch
                  ? `${selectedMatch.eco} · ${selectedMatch.name}`
                  : "Play moves or search."}
              </p>
            </div>

            {/* Flip board button */}
            <button
              type="button"
              onClick={() => setBoardOrientation((o) => (o === "white" ? "black" : "white"))}
              title="Flip board"
              className="btn-secondary shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
            >
              ⇅ {boardOrientation === "white" ? "White" : "Black"}
            </button>

            {/* Search input */}
            <div className="relative order-first min-w-0 flex-1 sm:order-none sm:w-52 sm:flex-none">
              <input
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
                className="w-full rounded-xl border border-[var(--border-card)] bg-[var(--bg-muted)] px-3 py-1.5 text-sm text-[var(--text-primary)] outline-none transition-colors placeholder:text-[var(--text-muted)] focus:border-[var(--text-muted)] focus:bg-[var(--bg-card)]"
              />

              {showDropdown && (
                <div className="absolute left-0 right-0 top-full z-20 mt-1.5 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                  {searchResults.map((result) => (
                    <button
                      key={`${result.eco}-${result.name}-${result.pgn}`}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleHighlightFromSearch(result);
                      }}
                      className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-[var(--bg-muted)]"
                    >
                      <span className="w-10 shrink-0 text-xs font-semibold uppercase tracking-widest text-slate-400">
                        {result.eco}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">{result.name}</p>
                        <p className="truncate text-xs text-slate-400">{result.pgn}</p>
                      </div>
                      <span className="shrink-0 text-xs text-slate-400">
                        {result.moves.length}m
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Row 2: book selector (narrow) + View Lines + Add line (always visible).
              Books are saved to an account, so a guest gets a notice in the same row. */}
          {!signedIn ? (
            <SignInPrompt action="save lines to a book" className="text-xs xl:py-1.5 xl:text-sm" />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={activeExplorerBookId ?? ""}
                onChange={(e) => setActiveExplorerBookId(e.target.value || null)}
                className="min-w-0 basis-full rounded-xl sm:w-44 sm:shrink-0 sm:basis-auto border border-slate-200 bg-slate-50 py-1.5 pl-2 pr-6 text-sm text-slate-700 focus:outline-none"
              >
                <option value="">— No book selected —</option>
                {explorerBooks.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} ({b.color})</option>
                ))}
              </select>

              {/* View Lines dropdown */}
              <select
                value=""
                onChange={(e) => handleViewBookLine(e.target.value)}
                disabled={!activeExplorerBook || bookLines.length === 0}
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 py-1.5 pl-2 pr-6 text-sm text-slate-700 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
              >
                <option value="">View Lines</option>
                {bookLines.map((line, idx) => (
                  <option key={idx} value={JSON.stringify(line)}>
                    {line.slice(0, 8).map((m) => m.san).join(" ")}
                    {line.length > 8 ? "…" : ""}
                  </option>
                ))}
              </select>

              {/* Add line — always visible, disabled when no book or no moves */}
              <button
                type="button"
                onClick={handleAddToBook}
                disabled={!activeExplorerBook || currentMoves.length === 0 || isSavingToBook}
                className="btn-primary shrink-0 rounded-xl px-3 py-1.5 text-xs font-medium"
              >
                {isSavingToBook
                  ? "Saving…"
                  : currentMoves.length > 0
                    ? `Add line (${Math.min(currentMoves.length, 20)} moves)`
                    : "Add line"}
              </button>
            </div>
          )}
        </div>

        {/* Board + right-side eval bar */}
        <div className={`flex min-h-0 justify-center gap-2 p-1.5 xl:p-2 ${cardClass}`}>
          {/* Narrow: a square as wide as the card, but capped at about half the viewport's
              height (max-w below), so the panels under it always keep some room. Wide: it
              fills the card and the inner square takes the smaller side. */}
          <div
            className="aspect-square min-h-0 w-full max-w-[52dvh] flex-1 xl:aspect-auto xl:max-w-none"
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
          <div
            className="relative w-3 self-stretch overflow-hidden rounded-full border border-[var(--border-card)]"
            style={{ backgroundColor: "var(--bar-black)" }}
          >
            {/* Decorative tick marks */}
            {[25, 50, 75].map((pct) => (
              <div
                key={pct}
                className="absolute left-0 right-0 z-10 h-px"
                style={{ top: `${pct}%`, backgroundColor: "rgba(128,128,128,0.25)" }}
              />
            ))}
            {/* Eval fill */}
            <div
              className="absolute w-full transition-all duration-500"
              style={{
                ...(boardOrientation === "black" ? { top: 0 } : { bottom: 0 }),
                height:
                  engineMode !== "none" && engine.lines[0]
                    ? `${evalToBarPct(engine.lines[0].score, engine.lines[0].mate)}%`
                    : engineMode !== "none"
                      ? "50%"
                      : "0%",
                backgroundColor: "var(--bar-white)",
              }}
            />
          </div>
        </div>
      </section>

      {/* ── Right: four-section sidebar. Wide: each panel but the statistics can be dragged
          taller or shorter by the handle under it, and the statistics take what is left.
          Narrow: it sits under the board and scrolls as one column, with the move row first
          (and pinned) and the statistics next. A handle or a gap follows every panel. ── */}
      <aside className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        {/* ① Engine panel */}
        <div
          ref={enginePanelRef}
          className={`order-3 flex shrink-0 flex-col px-3 py-2 xl:order-none ${cardClass}`}
          style={engineMode !== "none" && heights.engine ? { height: heights.engine } : undefined}
        >
          {/* Controls row */}
          <div className="flex items-center gap-2">
            <p className="mr-auto text-xs font-semibold uppercase tracking-widest text-slate-400">
              Engine
            </p>
            {/* Arrow toggle — invisible when engine is off so the pills never shift */}
            <button
              type="button"
              onClick={() => setShowEngineArrow((v) => !v)}
              title={showEngineArrow ? "Hide engine arrow" : "Show engine arrow"}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                engineMode === "none"
                  ? "invisible"
                  : showEngineArrow
                    ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                    : "border-[var(--border-card)] bg-[var(--bg-muted)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              }`}
            >
              ↗ Arrow
            </button>
            {/* Mode pills */}
            <div className="flex rounded-full border border-slate-200 bg-slate-50 p-0.5">
              {(["none", "light", "heavy"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setEngineMode(m)}
                  className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                    engineMode === m
                      ? "bg-[var(--text-primary)] text-[var(--bg-card)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Engine output */}
          {engineMode !== "none" && (
            <div className="mt-2 min-h-0 space-y-2 overflow-y-auto">
              {!engine.isReady ? (
                <p className="text-xs text-slate-400">Loading engine…</p>
              ) : (
                <>
                  {/* Score + depth */}
                  <div className="flex items-baseline gap-3">
                    <span className="text-2xl font-semibold tabular-nums text-slate-900">
                      {engine.lines[0]
                        ? formatScore(engine.lines[0].score, engine.lines[0].mate)
                        : "—"}
                    </span>
                    <span className="text-xs text-slate-400">
                      {engine.isAnalyzing
                        ? `depth ${engine.lines[0]?.depth ?? "…"}`
                        : `depth ${engine.lines[0]?.depth ?? "—"}`}
                    </span>
                    {engine.isAnalyzing && (
                      <span className="ml-auto animate-pulse text-xs text-slate-300">●</span>
                    )}
                  </div>

                  {/* PV lines */}
                  {engine.lines.length > 0 && (
                    <div className="space-y-1.5">
                      {engine.lines.map((line) => (
                        <div key={line.multipv} className="flex items-baseline gap-2">
                          <span className="w-9 shrink-0 text-xs font-semibold tabular-nums text-slate-900">
                            {formatScore(line.score, line.mate)}
                          </span>
                          <span className="truncate text-xs text-slate-500">
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
        </div>

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
        <div
          ref={treePanelRef}
          className={`order-4 shrink-0 overflow-hidden p-1.5 xl:order-none ${cardClass}`}
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
        </div>
        <ResizeHandle
          className="order-4 xl:order-none"
          target={treePanelRef}
          {...PANEL_LIMITS.tree}
          onResize={(height) => setHeight("tree", height)}
          onReset={() => setHeight("tree", null)}
          label="Resize the tree window"
        />

        {/* ③ Move sequence + navigation */}
        <div
          ref={movesPanelRef}
          className={`sticky top-0 z-10 order-1 flex shrink-0 flex-col px-3 py-2 xl:static xl:order-none ${cardClass} ${
            wrapMoves ? "xl:h-[var(--moves-h)]" : ""
          }`}
          style={wrapMoves ? ({ "--moves-h": `${heights.moves}px` } as CSSProperties) : undefined}
        >
          <div className="flex min-h-0 flex-1 items-start gap-2">
            {/* Move tokens: one line that scrolls sideways, or wrapped when the row is taller */}
            <div className={`min-w-0 flex-1 overflow-x-auto ${wrapMoves ? "xl:h-full xl:overflow-x-hidden xl:overflow-y-auto" : ""}`}>
              {selectedMatch ? (
                <div className={`flex items-baseline gap-1 whitespace-nowrap pb-0.5 ${moveTokensWrap}`}>
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
                          <span className="text-xs text-slate-300">
                            {Math.floor(index / 2) + 1}.
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleClickMoveToken(index)}
                          className={`cursor-pointer rounded px-0.5 text-sm transition-colors hover:bg-[var(--bg-muted)] ${
                            isPlayed
                              ? "font-semibold text-slate-700"
                              : isNext
                                ? "font-semibold text-slate-950 underline decoration-slate-400 underline-offset-2"
                                : "text-slate-400"
                          }`}
                        >
                          {move.san}
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : currentMoves.length > 0 ? (
                <div className={`flex items-baseline gap-1 whitespace-nowrap pb-0.5 ${moveTokensWrap}`}>
                  {currentMoves.map((move, index) => (
                    <span key={index} className="inline-flex items-baseline gap-0.5">
                      {index % 2 === 0 && (
                        <span className="text-xs text-slate-300">
                          {Math.floor(index / 2) + 1}.
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleClickMoveToken(index)}
                        className="cursor-pointer rounded px-0.5 text-sm font-semibold text-slate-700 hover:bg-[var(--bg-muted)]"
                      >
                        {move.san}
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">No moves yet.</p>
              )}
            </div>

            {/* Nav buttons */}
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={handleGoToStart}
                disabled={!canGoToStart}
                className={navBtnClass}
                title="Go to start"
              >
                <span className="text-xs font-semibold">|&lt;</span>
              </button>
              <button
                type="button"
                onClick={handleUndoMove}
                disabled={!canUndo}
                className={navBtnClass}
                title="Undo move"
              >
                <span className="text-xs font-semibold">&lt;</span>
              </button>
              <button
                type="button"
                onClick={handleToggleAutoPlay}
                disabled={!canAutoPlay && !isAutoPlaying}
                className={playBtnClass}
                title={isAutoPlaying ? "Pause" : "Play"}
              >
                {isAutoPlaying ? "⏸" : "▶"}
              </button>
              <button
                type="button"
                onClick={handleStepForward}
                disabled={!canGoForward}
                className={navBtnClass}
                title="Step forward"
              >
                <span className="text-xs font-semibold">&gt;</span>
              </button>
              <button
                type="button"
                onClick={handleGoToEnd}
                disabled={!canGoToEnd}
                className={navBtnClass}
                title="Go to end"
              >
                <span className="text-xs font-semibold">&gt;|</span>
              </button>
            </div>
          </div>

          {selectedMatch && !isBoardOnHighlightedLine && currentMoves.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <p className="text-xs text-amber-600">Board diverged from highlighted line.</p>
              <button
                type="button"
                onClick={() => dispatch({ type: "clearLine" })}
                className="text-xs font-medium text-amber-600 underline hover:text-amber-700"
              >
                Clear line
              </button>
            </div>
          )}
          {playbackError && (
            <p className="mt-2 text-xs text-rose-500">{playbackError}</p>
          )}
        </div>
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
        <div className={`order-2 flex shrink-0 flex-col px-3 py-2 xl:order-none xl:min-h-32 xl:flex-1 xl:shrink xl:overflow-y-auto ${cardClass}`}>
          {/* Match label + opening name */}
          <div className="shrink-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              {matchModeLabel}
            </p>
            {positionName ? (
              <p className="mt-1 text-sm font-semibold text-slate-900">{positionName}</p>
            ) : (
              <p className="mt-1 text-sm text-slate-400">
                {selectedMatch ? selectedMatch.name : "Play moves to identify the opening."}
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="my-2 shrink-0 border-t border-[var(--border-card)]" />

          {/* Master game move stats */}
          {explorerData.loading && (
            <p className="text-xs text-slate-400">Loading master games…</p>
          )}
          {!explorerData.loading && explorerData.error && (
            <p className="text-xs text-slate-400">
              {/* A 404 is the route's answer to a guest for a position it hasn't saved. */}
              {explorerData.error === "404"
                ? "Master statistics for this position aren't saved yet. Live lookups need a beta account."
                : "Could not load master game data."}
            </p>
          )}
          {explorerData.data && explorerData.data.moves.length > 0 && (
            <div className="min-h-0 flex-1">
              <div className="mb-2 grid grid-cols-[2rem_1fr_3.5rem] gap-2 text-xs font-semibold uppercase tracking-widest text-slate-300">
                <span>Mv</span>
                <span>W / D / B</span>
                <span className="text-right">Games</span>
              </div>
              <div className="space-y-0.5" onMouseLeave={() => setHoveredMoveUci(null)}>
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
                      className={`grid cursor-pointer grid-cols-[2rem_1fr_3.5rem] items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${
                        isHovered || isHighlightedFirst
                          ? "bg-[var(--bg-muted)]"
                          : "hover:bg-[var(--bg-muted)]"
                      }`}
                    >
                      <span
                        className={`text-sm font-semibold ${
                          isHighlightedFirst
                            ? "text-[var(--text-primary)] underline decoration-[var(--text-muted)] underline-offset-2"
                            : "text-[var(--text-primary)]"
                        }`}
                      >
                        {move.san}
                      </span>
                      <div className="flex h-2 overflow-hidden rounded-full">
                        <div
                          style={{ width: `${wPct}%`, backgroundColor: "var(--bar-white)" }}
                          title={`White ${Math.round(wPct)}%`}
                        />
                        <div
                          style={{ width: `${dPct}%`, backgroundColor: "var(--bar-draw)" }}
                          title={`Draw ${Math.round(dPct)}%`}
                        />
                        <div
                          style={{ width: `${bPct}%`, backgroundColor: "var(--bar-black)" }}
                          title={`Black ${Math.round(bPct)}%`}
                        />
                      </div>
                      <span className="text-right text-xs text-[var(--text-muted)]">
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
              <p className="text-xs text-slate-400">
                No master games found for this position.
              </p>
            )}
          {!explorerData.data && !explorerData.loading && !explorerData.error && (
            <p className="text-xs text-slate-400">Master game data will appear here.</p>
          )}
        </div>
        <div className="order-2 h-2 shrink-0 xl:hidden" />
      </aside>
    </div>
  );
}
