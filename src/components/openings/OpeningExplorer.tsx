"use client";

import { useEffect, useMemo, useReducer, useState, useSyncExternalStore } from "react";
import { ArrowLeftRight, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { createHtmlPortalNode, InPortal, OutPortal } from "react-reverse-portal";
import { toast } from "sonner";
import { Ink } from "@/components/book/Book";
import { Spread } from "@/components/book/Spread";
import { BoardInteractive } from "@/components/board/BoardInteractive";
import { ExplorerTreeWindow } from "@/components/openings/ExplorerTreeWindow";
import {
  BoardSlot,
  EngineControls,
  EngineLines,
  ExplorerSearch,
  MasterMoves,
  Slot,
  SlotNote,
  SlotTab,
  engineNote,
  evalShare,
  formatGames,
} from "@/components/openings/ExplorerParts";
import { Scoresheet } from "@/components/openings/Scoresheet";
import { Button } from "@/components/shadcn/button";
import { NativeSelect, NativeSelectOption } from "@/components/shadcn/native-select";
import { START_FEN } from "@/lib/chess/fen";
import { gameCount } from "@/lib/chess/explorerData";
import { getCatalogLineToFen, getCatalogMatchesForFen, getCatalogMatchesForUciLine } from "@/lib/chess/openingCatalog";
import { createNavigator, lineIndex, navigatorReducer, remainingLineMoves } from "@/lib/chess/explorerNavigator";
import { useOpeningExplorer } from "@/hooks/useOpeningExplorer";
import { useOpeningExplorerMulti } from "@/hooks/useOpeningExplorerMulti";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ENGINE_LINES, useEngine, type EngineMode } from "@/hooks/useEngine";
import { useLibraryBook, useLibraryBooks } from "@/context/Library";
import { mergeMoveLineIntoTree } from "@/lib/chess/moveTree";
import type { MoveResult } from "@/hooks/useChessGame";
import { replayUciLine } from "@/lib/library/links";
import { STALE_BOOK_MESSAGE, startTree } from "@/lib/library/trees";
import { libraryErrorMessage } from "@/lib/library/types";
import { bookLineTree } from "@/lib/books/explorerTree";
import type { ExplorerMatchMode, ExplorerMove, Move, MoveNode } from "@/types/chess";

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

/** The most moves "Add line" saves. */
const LINE_LIMIT = 20;

const NO_MOVES: ExplorerMove[] = [];

const subscribeNothing = () => () => {};

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

type Props = {
  initialFen?: string;
  /** A line to play on opening, as UCI moves from the starting position. */
  initialLine?: readonly string[];
  /** The book chosen on opening, such as the one New book just made. */
  initialBookId?: string;
};

/**
 * The Explorer as a spread (plans/book-ui.md D6, D7): the search, the book's controls and the
 * board on the left page; the book view, the engine and the master moves on the right, with the
 * line in its outer margin as a scoresheet. The view can swap pages with the board. In the
 * one-page form the board is on top and the rest scrolls under it (D15).
 */
export function OpeningExplorer({ initialFen, initialLine, initialBookId }: Props = {}) {
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
  // How often the view and the board swapped pages: odd when the view has the left page (D7).
  // Each swap re-inks the pages (D13), but not their first showing.
  const [swaps, setSwaps] = useState(0);
  const swapped = swaps % 2 === 1;

  // Opening book integration: the viewer's books, a guest's included (src/context/Library.tsx).
  // The list has only summaries; the chosen book's trees are loaded when it is chosen.
  const { books: explorerBooks } = useLibraryBooks();
  const [activeExplorerBookId, setActiveExplorerBookId] = useState<string | null>(initialBookId ?? null);
  const { book: activeExplorerBook, saveStartTree } = useLibraryBook(activeExplorerBookId);
  const [isSavingToBook, setIsSavingToBook] = useState(false);
  // With a book chosen, the view draws it, unless the viewer went back to the explored line (D17).
  const [showExplored, setShowExplored] = useState(false);

  // The board keeps its game itself, so it is rendered once, into a node of its own, which the
  // swap moves between the pages without mounting the board again. The node is the browser's.
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const boardNode = useMemo(
    () => (hydrated ? createHtmlPortalNode({ attributes: { style: "width: 100%; height: 100%" } }) : null),
    [hydrated],
  );

  // The hovered move is kept with the position it was hovered in, so it lapses when the
  // board moves on.
  const [hover, setHover] = useState<{ uci: string; fen: string } | null>(null);

  const arrowColor = useThemeColor("--board-arrow", "rgb(80 60 20 / 0.5)");
  const engineArrowColor = useThemeColor("--engine-arrow", "rgb(230 140 40 / 0.7)");

  const currentMoves = useMemo(() => moveResultsToMoves(moveHistory), [moveHistory]);
  const currentUciLine = useMemo(() => currentMoves.map((m) => m.uci), [currentMoves]);
  const currentFen = currentMoves[currentMoves.length - 1]?.fen ?? START_FEN;

  const hoveredMoveUci = hover?.fen === currentFen ? hover.uci : null;
  const setHoveredMoveUci = (uci: string | null) => setHover(uci ? { uci, fen: currentFen } : null);

  const engine = useEngine(currentFen, engineMode);

  // Hover's arrow first, then the engine's best move unless it is the same.
  const combinedArrows = useMemo(() => {
    const arrows: { startSquare: string; endSquare: string; color: string }[] = [];
    if (hoveredMoveUci) {
      arrows.push({ startSquare: hoveredMoveUci.slice(0, 2), endSquare: hoveredMoveUci.slice(2, 4), color: arrowColor });
    }
    const best = showEngineArrow ? engine.lines[0]?.pv[0] : undefined;
    if (best && best.slice(0, 4) !== hoveredMoveUci?.slice(0, 4)) {
      arrows.push({ startSquare: best.slice(0, 2), endSquare: best.slice(2, 4), color: engineArrowColor });
    }
    return arrows;
  }, [hoveredMoveUci, arrowColor, showEngineArrow, engine.lines, engineArrowColor]);

  const prefixMatches = useMemo(
    () => (currentUciLine.length > 0 ? getCatalogMatchesForUciLine(currentUciLine, 8) : []),
    [currentUciLine],
  );
  const fenMatches = useMemo(
    () => (prefixMatches.length === 0 && currentMoves.length > 0 ? getCatalogMatchesForFen(currentFen, 8) : []),
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

  // Autoplay sends the next move a moment after each one lands.
  useEffect(() => {
    if (!isAutoPlaying || !canGoForward) return;
    const timeoutId = window.setTimeout(() => dispatch({ type: "autoPlayTick" }), AUTO_PLAY_DELAY_MS);
    return () => window.clearTimeout(timeoutId);
  }, [canGoForward, isAutoPlaying, moveHistory]);

  /** Goes to the position after `moves`, through a reset and a replay. */
  const goToLine = (moves: Move[]) => dispatch({ type: "goToLine", moves });

  const handleHistoryNodeClick = (fullMoveIndex: number) => {
    if (fullMoveIndex === moveHistory.length - 1) return;
    goToLine(moveHistory.slice(0, fullMoveIndex + 1).map((m) => ({ san: m.san, uci: m.uci })));
  };

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
    (effectiveMatches.length > 0 ? effectiveMatches.slice(0, 2).map((m) => m.name).join(" / ") : null);
  const eco = explorerData.data?.opening?.eco ?? effectiveMatches[0]?.eco ?? null;
  // "Sicilian Defense: Najdorf Variation" heads the left page with its family and the right with the rest.
  const [family, ...variation] = (positionName ?? "").split(": ");

  // ── Book save ──────────────────────────────────────────────────────────────

  const activeExplorerTree = useMemo(
    () => (activeExplorerBook ? startTree(activeExplorerBook.trees) : null),
    [activeExplorerBook],
  );

  const handleAddToBook = async () => {
    if (!activeExplorerBook || !activeExplorerTree || currentMoves.length === 0) return;
    const updatedTree = mergeMoveLineIntoTree(activeExplorerTree, currentMoves.slice(0, LINE_LIMIT));
    setIsSavingToBook(true);
    try {
      if (!(await saveStartTree(updatedTree))) toast.error(STALE_BOOK_MESSAGE);
    } catch (error) {
      toast.error(libraryErrorMessage(error));
    } finally {
      setIsSavingToBook(false);
    }
  };

  // The book with the line played on it, for the view and the running head (D17).
  const bookLine = useMemo(
    () => (activeExplorerTree ? bookLineTree(activeExplorerTree, moveHistory) : null),
    [activeExplorerTree, moveHistory],
  );

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

  // ── The parts ──────────────────────────────────────────────────────────────

  // The scoresheet lists the picked line to its end while the board is on it, else the moves played.
  const sheetIsLine = selectedMatch !== null && isBoardOnHighlightedLine;
  const sheetMoves = sheetIsLine ? selectedMatch.moves : currentMoves;
  const sheetPlayed = sheetIsLine ? currentBoardIndexWithinHighlightedLine : currentMoves.length;
  const pickSheetMove = (index: number) => {
    if (sheetIsLine) goToLine(selectedMatch.moves.slice(0, index + 1).map((m) => ({ san: m.san, uci: m.uci })));
    else handleHistoryNodeClick(index);
  };

  const navButtons = (
    <>
      <Button variant="ghost" size="icon-sm" className="size-6" onClick={() => dispatch({ type: "goToStart" })} disabled={!canGoToStart} title="Go to start">
        <ChevronFirst aria-hidden="true" />
      </Button>
      <Button variant="ghost" size="icon-sm" className="size-6" onClick={() => dispatch({ type: "undo" })} disabled={!canUndo} title="Undo move">
        <ChevronLeft aria-hidden="true" />
      </Button>
      <Button
        size="icon-sm"
        className="size-6"
        onClick={() => dispatch({ type: "toggleAutoPlay" })}
        disabled={!canGoForward && !isAutoPlaying}
        title={isAutoPlaying ? "Pause" : "Play"}
      >
        {isAutoPlaying ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
      </Button>
      <Button variant="ghost" size="icon-sm" className="size-6" onClick={() => dispatch({ type: "stepForward" })} disabled={!canGoForward} title="Step forward">
        <ChevronRight aria-hidden="true" />
      </Button>
      <Button variant="ghost" size="icon-sm" className="size-6" onClick={() => dispatch({ type: "goToEnd" })} disabled={!canGoForward} title="Go to end">
        <ChevronLast aria-hidden="true" />
      </Button>
    </>
  );

  const navNotice = (
    <>
      {selectedMatch && !isBoardOnHighlightedLine && currentMoves.length > 0 && (
        <p className="text-xs text-warning">
          Board diverged from highlighted line.{" "}
          <button type="button" onClick={() => dispatch({ type: "clearLine" })} className="font-medium underline hover:no-underline">
            Clear line
          </button>
        </p>
      )}
      {playbackError && <p className="text-xs text-destructive">{playbackError}</p>}
    </>
  );

  const scoresheet = (sheetForm: "margin" | "row") => (
    <Scoresheet
      form={sheetForm}
      moves={sheetMoves}
      played={sheetPlayed}
      onPick={pickSheetMove}
      title={selectedMatch && `${selectedMatch.eco} · ${selectedMatch.name}`}
      nav={navButtons}
      notice={navNotice}
    />
  );

  const board = boardNode && <OutPortal node={boardNode} />;
  const evalPct = evalShare(engineMode, engine.lines);
  const boardSlot = (className?: string) => (
    <BoardSlot board={board} evalPct={evalPct} orientation={boardOrientation} className={className} />
  );

  const controls = (
    <div className="flex flex-col gap-2">
      <ExplorerSearch
        orientation={boardOrientation}
        onFlip={() => setBoardOrientation((o) => (o === "white" ? "black" : "white"))}
        onPick={(match) => dispatch({ type: "highlight", line: match })}
      />
      <div className="flex items-center gap-2">
        <NativeSelect
          aria-label="Book"
          size="sm"
          value={activeExplorerBookId ?? ""}
          onChange={(e) => {
            setActiveExplorerBookId(e.target.value || null);
            setShowExplored(false);
          }}
          wrapperClassName="min-w-0 flex-1 sm:w-44 sm:flex-none sm:shrink-0"
          className="h-7 pr-7 pl-2"
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
        {/* On a phone View lines is left out, so the row stays one line. */}
        <NativeSelect
          aria-label="View a line of the book"
          size="sm"
          value=""
          onChange={(e) => handleViewBookLine(e.target.value)}
          disabled={!activeExplorerBook || bookLines.length === 0}
          wrapperClassName="hidden min-w-0 flex-1 sm:block"
          className="h-7 pr-7 pl-2"
        >
          <NativeSelectOption value="">View lines</NativeSelectOption>
          {bookLines.map((line, idx) => (
            <NativeSelectOption key={idx} value={JSON.stringify(line)}>
              {line.slice(0, 8).map((m) => m.san).join(" ")}
              {line.length > 8 ? "…" : ""}
            </NativeSelectOption>
          ))}
        </NativeSelect>
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
                <span className="hidden sm:inline"> ({Math.min(currentMoves.length, LINE_LIMIT)} moves)</span>
              )}
            </>
          )}
        </Button>
      </div>
    </div>
  );

  const treeWindow = (
    <ExplorerTreeWindow
      history={moveHistory}
      before={historyBefore}
      next={explorerData.data?.moves ?? NO_MOVES}
      orientation={boardOrientation}
      onGoToLine={goToLine}
      onPlayMove={handleExplorerMoveClick}
      onHoverUci={setHoveredMoveUci}
      book={
        activeExplorerBook && bookLine && !showExplored
          ? { name: activeExplorerBook.name, side: activeExplorerBook.color, line: bookLine }
          : null
      }
    />
  );

  // The view draws the chosen book or the explored line (D17); the Labyrinth's tab says it is coming (D16).
  const drawsBook = activeExplorerBook !== null && !showExplored;
  const viewTabs = (
    <>
      <SlotTab
        on={drawsBook}
        onPick={() => setShowExplored(false)}
        disabled={!activeExplorerBook}
        title={activeExplorerBook ? undefined : "Choose a book to draw it here"}
      >
        Book
      </SlotTab>
      <SlotTab on={!drawsBook} onPick={() => setShowExplored(true)}>
        Explored
      </SlotTab>
      <SlotTab soon>Labyrinth</SlotTab>
    </>
  );

  // One button swaps both ways, and stays at the right end of the right page's top slot (D7).
  const swapButton = (
    <Button variant="outline" size="sm" className="ml-auto h-6 shrink-0 px-2 text-xs" onClick={() => setSwaps((n) => n + 1)}
      aria-label={swapped ? "Swap back" : "Swap with board"}
    >
      <ArrowLeftRight aria-hidden="true" />
      {swapped ? "Swap back" : (
        <>
          Swap<span className="@max-sm:hidden"> with board</span>
        </>
      )}
    </Button>
  );

  const turn = currentFen.split(" ")[1] === "b" ? "Black" : "White";

  const masters = explorerData.data?.moves ?? NO_MOVES;
  const totalGames = explorerData.data?.totals
    ? gameCount(explorerData.data.totals)
    : masters.reduce((total, move) => total + gameCount(move), 0);
  const markedSan =
    selectedMatch && currentBoardIndexWithinHighlightedLine === 0 ? (selectedMatch.moves[0]?.san ?? null) : null;
  // While the next position's moves load, the last position's stay up, faded and out of reach:
  // taking them down would shorten the one-page column for a moment, and a browser then pulls
  // a column scrolled down past them back up.
  const stale = explorerData.loading ? (explorerData.previous?.moves ?? NO_MOVES) : NO_MOVES;
  const masterMoves = (
    <div className="flex flex-col gap-2" aria-busy={explorerData.loading}>
      {explorerData.loading && stale.length === 0 && <p className="text-xs text-muted-foreground">Loading master games…</p>}
      {!explorerData.loading && explorerData.error && (
        <p className="text-xs text-muted-foreground">
          {/* A 404 is the route's answer to a guest for a position it hasn't saved. */}
          {explorerData.error === "404"
            ? "Master statistics for this position aren't saved yet. Live lookups need a beta account."
            : "Could not load master game data."}
        </p>
      )}
      {(masters.length > 0 || stale.length > 0) && (
        <div inert={stale.length > 0} className={stale.length > 0 ? "opacity-50" : undefined}>
          <MasterMoves
            moves={stale.length > 0 ? stale : masters}
            hoveredUci={hoveredMoveUci}
            markedSan={markedSan}
            onPlay={handleExplorerMoveClick}
            onHover={setHoveredMoveUci}
          />
        </div>
      )}
      {explorerData.data && masters.length === 0 && !explorerData.loading && (
        <p className="text-xs text-muted-foreground">No master games found for this position.</p>
      )}
    </div>
  );
  // The one-page form has no right folio, so its head says how the position matched the catalog.
  const mastersHead = (match: boolean) => (
    <>
      <SlotTab>Master moves</SlotTab>
      <span className="grow" />
      <SlotNote>
        {stale.length > 0 && "Loading… "}
        {match && matchModeLabel}
        {match && totalGames > 0 && " · "}
        {totalGames > 0 && `${formatGames(totalGames)} games`}
      </SlotNote>
    </>
  );

  const engineHead = (
    <>
      <SlotTab>Engine</SlotTab>
      {engineMode !== "none" && <SlotNote>{engineNote(engine.isReady, engine.isAnalyzing, engine.lines)}</SlotNote>}
      <span className="grow" />
      <EngineControls mode={engineMode} onMode={setEngineMode} arrow={showEngineArrow} onArrow={setShowEngineArrow} />
    </>
  );
  const engineLines = engineMode !== "none" && <EngineLines lines={engine.lines} rows={ENGINE_LINES[engineMode]} />;

  // With a book chosen, the running head says whether the line is still in it (D17).
  const leftHead = (
    <>
      <span className="truncate">{family || matchModeLabel}</span>
      <span className="grow" />
      <span className="book-sc">{bookLine ? (bookLine.out ? "Out of book" : "In book") : "Opening Explorer"}</span>
    </>
  );
  const leftFolio = (
    <>
      <span>{turn} to move</span>
      <span className="grow" />
      <span className="truncate">{activeExplorerBook ? activeExplorerBook.name : "No book chosen"}</span>
    </>
  );

  const left = (
    <>
      {controls}
      <Ink key={swapped ? "view" : "board"} inked={swaps > 0} className="flex min-h-0 flex-1 flex-col">
        {swapped ? (
          <Slot head={viewTabs} className="flex-1">
            {treeWindow}
          </Slot>
        ) : (
          boardSlot()
        )}
      </Ink>
    </>
  );

  const right = (
    <div className="flex min-h-0 flex-1 gap-[18px]">
      <div className="@container grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,46fr)_auto_minmax(0,54fr)] gap-3.5">
        <Ink key={swapped ? "board" : "view"} inked={swaps > 0} className="flex min-h-0 flex-col">
          {swapped ? (
            <Slot
              head={
                <>
                  <SlotTab>Board</SlotTab>
                  <SlotNote>{turn} to move</SlotNote>
                  {swapButton}
                </>
              }
              className="flex-1"
            >
              {boardSlot()}
            </Slot>
          ) : (
            <Slot
              head={
                <>
                  {viewTabs}
                  {swapButton}
                </>
              }
              className="flex-1"
            >
              {treeWindow}
            </Slot>
          )}
        </Ink>
        <Slot head={engineHead}>{engineLines}</Slot>
        <Slot head={mastersHead(false)} bodyClassName="overflow-y-auto pr-2">
          {masterMoves}
        </Slot>
      </div>
      {scoresheet("margin")}
    </div>
  );

  // The one-page form: the board on top, as big as about half the page lets it be, and under it
  // the line, then the rest in one column that scrolls on its own (D15). The page never scrolls.
  const single = (
    <div className="flex min-h-0 flex-1 flex-col gap-2 [container-type:size]">
      {controls}
      <div className="flex flex-none" style={{ height: "min(52cqh, 100cqw)" }}>
        {boardSlot()}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        <div className="sticky top-0 z-10 bg-page">{scoresheet("row")}</div>
        <Slot head={mastersHead(true)} className="flex-none">
          {masterMoves}
        </Slot>
        <Slot head={engineHead} className="flex-none">
          {engineLines}
        </Slot>
        <Slot head={viewTabs} className="h-60 flex-none">
          {treeWindow}
        </Slot>
      </div>
    </div>
  );

  return (
    <>
      {boardNode && (
        <InPortal node={boardNode}>
          <BoardInteractive
            initialFen={START_FEN}
            scriptedCommand={scriptedCommand}
            playerColor="both"
            orientation={boardOrientation}
            onMove={(move) => dispatch({ type: "boardMoved", move })}
            onUndo={() => dispatch({ type: "boardUndone" })}
            onReset={() => dispatch({ type: "boardReset" })}
            onIllegalMove={() => dispatch({ type: "illegalMove" })}
            arrows={combinedArrows}
          />
        </InPortal>
      )}
      <Spread
        left={{ head: leftHead, body: left, folio: leftFolio }}
        right={{
          head: (
            <>
              {eco && <span className="book-sc">{eco}</span>}
              <span className="grow" />
              <span className="truncate">{variation.join(": ") || family || matchModeLabel}</span>
            </>
          ),
          body: right,
          folio: (
            <>
              <span>{matchModeLabel}</span>
              <span className="grow" />
              {totalGames > 0 && <span>{formatGames(totalGames)} master games</span>}
            </>
          ),
        }}
        single={single}
      />
    </>
  );
}
