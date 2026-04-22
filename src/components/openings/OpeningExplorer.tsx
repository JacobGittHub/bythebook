"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BoardInteractive } from "@/components/board/BoardInteractive";
import { OpeningCatalogResults } from "@/components/openings/OpeningCatalogResults";
import { OpeningCatalogSearch } from "@/components/openings/OpeningCatalogSearch";
import { OpeningCatalogTreePreview } from "@/components/openings/OpeningCatalogTreePreview";
import { START_FEN } from "@/lib/chess/fen";
import {
  buildCatalogPreview,
  getCatalogMatchesForFen,
  getCatalogMatchesForUciLine,
  searchCatalogMatches,
} from "@/lib/chess/openingCatalog";
import {
  createRootMoveNode,
  getNodeIdsForPath,
  getNodePathByUciLine,
  mergeMoveLineIntoTree,
} from "@/lib/chess/moveTree";
import {
  createMoveCommand,
  createResetCommand,
  createUndoCommand,
  getCurrentLineIndex,
  getRemainingMovesFromLine,
  type ScriptedBoardCommand,
} from "@/lib/chess/linePlayback";
import type { MoveResult } from "@/hooks/useChessGame";
import type {
  CatalogLinePreview,
  CatalogMatch,
  ExplorerMatchMode,
  Move,
} from "@/types/chess";

const AUTO_PLAY_DELAY_MS = 700;

function moveResultsToMoves(moveHistory: MoveResult[]): Move[] {
  return moveHistory.map((move) => ({
    san: move.san,
    uci: move.uci,
    fen: move.fen,
  }));
}

export function OpeningExplorer() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMatch, setSelectedMatch] = useState<CatalogMatch | null>(null);
  const [moveHistory, setMoveHistory] = useState<MoveResult[]>([]);
  const [scriptedCommand, setScriptedCommand] = useState<ScriptedBoardCommand | null>(null);
  const [pendingForwardMoves, setPendingForwardMoves] = useState<Move[]>([]);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const commandNonceRef = useRef(0);

  const currentMoves = useMemo(() => moveResultsToMoves(moveHistory), [moveHistory]);
  const currentUciLine = useMemo(
    () => currentMoves.map((move) => move.uci),
    [currentMoves],
  );
  const currentSanLine = useMemo(
    () => currentMoves.map((move) => move.san),
    [currentMoves],
  );
  const currentFen = currentMoves[currentMoves.length - 1]?.fen ?? START_FEN;

  const searchResults = useMemo(
    () => searchCatalogMatches(searchQuery, 12),
    [searchQuery],
  );
  const prefixMatches = useMemo(
    () =>
      currentUciLine.length > 0
        ? getCatalogMatchesForUciLine(currentUciLine, 8)
        : [],
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
    prefixMatches.length > 0
      ? "prefix"
      : fenMatches.length > 0
        ? "position"
        : "none";
  const effectiveMatches = matchMode === "prefix" ? prefixMatches : fenMatches;
  const highlightedLineMoves = useMemo(
    () => selectedMatch?.moves ?? [],
    [selectedMatch],
  );
  const currentBoardIndexWithinHighlightedLine = selectedMatch
    ? getCurrentLineIndex(currentMoves, highlightedLineMoves)
    : -1;
  const isBoardOnHighlightedLine = selectedMatch
    ? currentBoardIndexWithinHighlightedLine !== -1
    : false;
  const remainingHighlightedMoves = useMemo(
    () =>
      selectedMatch
        ? getRemainingMovesFromLine(currentMoves, highlightedLineMoves)
        : [],
    [currentMoves, highlightedLineMoves, selectedMatch],
  );

  const canGoToStart = currentMoves.length > 0;
  const canUndo = currentMoves.length > 0;
  const canGoForward = Boolean(
    selectedMatch && isBoardOnHighlightedLine && remainingHighlightedMoves.length > 0,
  );
  const canGoToEnd = canGoForward;
  const canAutoPlay = canGoForward;

  const preview: CatalogLinePreview = useMemo(() => {
    const baseMatches = [
      ...(selectedMatch ? [selectedMatch] : []),
      ...effectiveMatches.filter(
        (match) =>
          !selectedMatch ||
          match.eco !== selectedMatch.eco ||
          match.name !== selectedMatch.name ||
          match.pgn !== selectedMatch.pgn,
      ),
    ];

    const baseRoot =
      baseMatches.length > 0
        ? buildCatalogPreview(baseMatches, START_FEN)
        : createRootMoveNode(START_FEN);
    const root = mergeMoveLineIntoTree(baseRoot, currentMoves);
    const highlightedNodeIds = selectedMatch
      ? getNodeIdsForPath(
          getNodePathByUciLine(
            root,
            selectedMatch.moves.map((move) => move.uci),
          ),
        )
      : [];
    const activeNodeIds = getNodeIdsForPath(
      getNodePathByUciLine(root, currentUciLine),
    );

    return {
      root,
      highlightedNodeIds,
      activeNodeIds,
    };
  }, [currentMoves, currentUciLine, effectiveMatches, selectedMatch]);

  const nextCommandId = () => {
    commandNonceRef.current += 1;
    return String(commandNonceRef.current);
  };

  useEffect(() => {
    if (!isAutoPlaying || !canAutoPlay) {
      return;
    }

    const nextMove = remainingHighlightedMoves[0];
    if (!nextMove) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setScriptedCommand(createMoveCommand(nextMove, nextCommandId()));
    }, AUTO_PLAY_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [canAutoPlay, isAutoPlaying, remainingHighlightedMoves]);

  const handleBoardMove = (move: MoveResult) => {
    const nextMoves = [...currentMoves, { san: move.san, uci: move.uci, fen: move.fen }];
    setMoveHistory((previousMoves) => [...previousMoves, move]);
    setPlaybackError(null);

    if (isAutoPlaying && selectedMatch) {
      const nextIndex = getCurrentLineIndex(nextMoves, highlightedLineMoves);

      if (
        nextIndex === -1 ||
        getRemainingMovesFromLine(nextMoves, highlightedLineMoves).length === 0
      ) {
        setIsAutoPlaying(false);
      }
    }

    if (pendingForwardMoves.length > 0) {
      const [nextMove, ...rest] = pendingForwardMoves;
      setPendingForwardMoves(rest);
      setScriptedCommand(createMoveCommand(nextMove, nextCommandId()));
    }
  };

  const handleBoardUndo = () => {
    setMoveHistory((previousMoves) => previousMoves.slice(0, -1));
    setPendingForwardMoves([]);
    setIsAutoPlaying(false);
    setPlaybackError(null);
  };

  const handleBoardReset = () => {
    setMoveHistory([]);
    setPendingForwardMoves([]);
    setIsAutoPlaying(false);
    setPlaybackError(null);
  };

  const handleHighlightMatch = (match: CatalogMatch) => {
    setSelectedMatch(match);
    setPendingForwardMoves([]);
    setIsAutoPlaying(false);
    setPlaybackError(null);
  };

  const handleGoToStart = () => {
    if (!canGoToStart) {
      return;
    }

    setPendingForwardMoves([]);
    setIsAutoPlaying(false);
    setScriptedCommand(createResetCommand(nextCommandId()));
  };

  const handleUndoMove = () => {
    if (!canUndo) {
      return;
    }

    setPendingForwardMoves([]);
    setIsAutoPlaying(false);
    setScriptedCommand(createUndoCommand(nextCommandId()));
  };

  const handleStepForward = () => {
    if (!canGoForward) {
      return;
    }

    const nextMove = remainingHighlightedMoves[0];
    if (!nextMove) {
      return;
    }

    setPendingForwardMoves([]);
    setIsAutoPlaying(false);
    setScriptedCommand(createMoveCommand(nextMove, nextCommandId()));
  };

  const handleGoToEnd = () => {
    if (!canGoToEnd) {
      return;
    }

    const [firstMove, ...rest] = remainingHighlightedMoves;
    if (!firstMove) {
      return;
    }

    setPendingForwardMoves(rest);
    setIsAutoPlaying(false);
    setScriptedCommand(createMoveCommand(firstMove, nextCommandId()));
  };

  const handleToggleAutoPlay = () => {
    if (isAutoPlaying) {
      setIsAutoPlaying(false);
      return;
    }

    if (!canAutoPlay) {
      return;
    }

    setPendingForwardMoves([]);
    setPlaybackError(null);
    setIsAutoPlaying(true);
  };

  const handleIllegalMove = () => {
    setPendingForwardMoves([]);
    setIsAutoPlaying(false);
    setPlaybackError("That move could not be applied on the current board state.");
  };

  const boardMatchesSummary =
    effectiveMatches.length > 0
      ? effectiveMatches
          .slice(0, 2)
          .map((match) => match.name)
          .join(" / ")
      : "No catalog match yet.";

  const matchModeLabel =
    matchMode === "prefix"
      ? "Exact line match"
      : matchMode === "position"
        ? "Position match"
        : "No match";

  return (
    <div className="grid h-[calc(100vh-10rem)] gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="grid h-full gap-4 rounded-[2rem] bg-slate-50 p-4">
        <div className="rounded-3xl border border-slate-200 bg-white px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-slate-950">Opening Explorer</h1>
              <p className="mt-1 text-sm text-slate-500">
                Play on the board, highlight a line, and navigate it like a chess explorer.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleGoToStart}
                disabled={!canGoToStart}
                className="rounded-full bg-slate-200 px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                |&lt;
              </button>
              <button
                type="button"
                onClick={handleUndoMove}
                disabled={!canUndo}
                className="rounded-full bg-slate-200 px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                &lt;
              </button>
              <button
                type="button"
                onClick={handleToggleAutoPlay}
                disabled={!canAutoPlay && !isAutoPlaying}
                className="rounded-full bg-slate-950 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isAutoPlaying ? "Pause" : "Play"}
              </button>
              <button
                type="button"
                onClick={handleStepForward}
                disabled={!canGoForward}
                className="rounded-full bg-slate-200 px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                &gt;
              </button>
              <button
                type="button"
                onClick={handleGoToEnd}
                disabled={!canGoToEnd}
                className="rounded-full bg-slate-200 px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-300 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
              >
                &gt;|
              </button>
            </div>
          </div>
          {selectedMatch && !isBoardOnHighlightedLine && (
            <p className="mt-3 text-sm text-amber-700">
              Board is off the highlighted line.
            </p>
          )}
        </div>

        <div className="flex min-h-0 items-center justify-center rounded-[2rem] border border-slate-200 bg-white p-4">
          <div className="h-full max-h-full w-auto" style={{ aspectRatio: "1 / 1" }}>
            <BoardInteractive
              initialFen={START_FEN}
              scriptedCommand={scriptedCommand}
              playerColor="both"
              onMove={handleBoardMove}
              onUndo={handleBoardUndo}
              onReset={handleBoardReset}
              onIllegalMove={handleIllegalMove}
            />
          </div>
        </div>

        <div className="grid gap-4 rounded-[2rem] border border-slate-200 bg-white p-4 md:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Current line
            </p>
            <p className="mt-2 text-sm text-slate-700">
              {currentSanLine.length > 0 ? currentSanLine.join(" ") : "No moves played yet."}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Match mode
            </p>
            <p className="mt-2 text-sm font-medium text-slate-900">{matchModeLabel}</p>
            <p className="mt-1 text-sm text-slate-700">{boardMatchesSummary}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Navigator
            </p>
            <p className="mt-2 text-sm text-slate-700">
              {selectedMatch
                ? isBoardOnHighlightedLine
                  ? `${currentBoardIndexWithinHighlightedLine}/${highlightedLineMoves.length} moves on highlighted line`
                  : "Select a highlighted line position or step back to realign."
                : "Highlight a line to enable forward navigation."}
            </p>
            {playbackError && (
              <p className="mt-2 text-xs text-rose-600">{playbackError}</p>
            )}
          </div>
        </div>
      </section>

      <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto">
        <OpeningCatalogSearch
          query={searchQuery}
          onQueryChange={setSearchQuery}
        />
        <OpeningCatalogResults
          results={searchResults}
          selectedMatch={selectedMatch}
          onHighlight={handleHighlightMatch}
        />
        <OpeningCatalogTreePreview
          root={preview.root}
          highlightedNodeIds={preview.highlightedNodeIds}
          activeNodeIds={preview.activeNodeIds}
          selectedMatch={selectedMatch}
        />
      </aside>
    </div>
  );
}
