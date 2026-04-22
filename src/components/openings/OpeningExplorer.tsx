"use client";

import { useEffect, useMemo, useState } from "react";
import { BoardInteractive } from "@/components/board/BoardInteractive";
import { OpeningCatalogResults } from "@/components/openings/OpeningCatalogResults";
import { OpeningCatalogSearch } from "@/components/openings/OpeningCatalogSearch";
import { OpeningCatalogTreePreview } from "@/components/openings/OpeningCatalogTreePreview";
import { START_FEN } from "@/lib/chess/fen";
import {
  buildCatalogPreview,
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
  getPlaybackSteps,
  getRemainingMoves,
  toScriptedBoardMove,
  type ScriptedBoardMove,
} from "@/lib/chess/linePlayback";
import type { MoveResult } from "@/hooks/useChessGame";
import type {
  CatalogLinePreview,
  CatalogMatch,
  LinePlaybackMode,
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
  const [boardInitialFen] = useState(START_FEN);
  const [boardResetToken, setBoardResetToken] = useState(0);
  const [scriptedMove, setScriptedMove] = useState<ScriptedBoardMove | null>(null);
  const [playbackMoves, setPlaybackMoves] = useState<Move[]>([]);
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [playbackMode, setPlaybackMode] = useState<LinePlaybackMode>("manual");
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  const currentMoves = useMemo(() => moveResultsToMoves(moveHistory), [moveHistory]);
  const currentUciLine = useMemo(
    () => currentMoves.map((move) => move.uci),
    [currentMoves],
  );
  const currentSanLine = useMemo(
    () => currentMoves.map((move) => move.san),
    [currentMoves],
  );

  const searchResults = useMemo(
    () => searchCatalogMatches(searchQuery, 12),
    [searchQuery],
  );
  const boardMatches = useMemo(
    () =>
      currentUciLine.length > 0
        ? getCatalogMatchesForUciLine(currentUciLine, 8)
        : [],
    [currentUciLine],
  );

  const preview: CatalogLinePreview = useMemo(() => {
    const baseMatches = [
      ...(selectedMatch ? [selectedMatch] : []),
      ...boardMatches.filter(
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
  }, [boardMatches, currentMoves, currentUciLine, selectedMatch]);

  useEffect(() => {
    if (!isAutoPlaying || playbackIndex >= playbackMoves.length) {
      return;
    }

    const nextMove = playbackMoves[playbackIndex];
    const timeoutId = window.setTimeout(() => {
      setScriptedMove(toScriptedBoardMove(nextMove, playbackIndex));
      setPlaybackIndex((currentIndex) => {
        const nextIndex = currentIndex + 1;

        if (nextIndex >= playbackMoves.length) {
          setIsAutoPlaying(false);
        }

        return nextIndex;
      });
    }, AUTO_PLAY_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [isAutoPlaying, playbackIndex, playbackMoves]);

  const handleBoardMove = (move: MoveResult) => {
    setMoveHistory((previousMoves) => [...previousMoves, move]);
    setPlaybackError(null);
  };

  const handleHighlightMatch = (match: CatalogMatch) => {
    setSelectedMatch(match);
    setPlaybackError(null);
  };

  const handleLoadLine = (match: CatalogMatch, mode: LinePlaybackMode) => {
    const nextPlaybackMoves = getPlaybackSteps(match);

    setSelectedMatch(match);
    setPlaybackMode(mode);
    setPlaybackMoves(nextPlaybackMoves);
    setPlaybackIndex(0);
    setIsAutoPlaying(mode === "auto");
    setPlaybackError(null);
    setScriptedMove(null);
    setMoveHistory([]);
    setBoardResetToken((value) => value + 1);
  };

  const handleAdvanceManualPlayback = () => {
    if (
      isAutoPlaying ||
      playbackMode !== "manual" ||
      playbackIndex >= playbackMoves.length
    ) {
      return;
    }

    const nextMove = playbackMoves[playbackIndex];
    const nextIndex = playbackIndex + 1;

    setScriptedMove(toScriptedBoardMove(nextMove, playbackIndex));
    setPlaybackIndex(nextIndex);
  };

  const handleResetBoard = () => {
    setMoveHistory([]);
    setPlaybackMoves([]);
    setPlaybackIndex(0);
    setIsAutoPlaying(false);
    setPlaybackError(null);
    setScriptedMove(null);
    setBoardResetToken((value) => value + 1);
  };

  const handleIllegalMove = () => {
    setIsAutoPlaying(false);
    setPlaybackError("That move could not be applied on the current board state.");
  };

  const remainingMoves = getRemainingMoves(playbackMoves, playbackIndex);

  return (
    <div className="grid h-[calc(100vh-10rem)] gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="grid h-full gap-4 rounded-[2rem] bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white px-4 py-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">Opening Explorer</h1>
            <p className="mt-1 text-sm text-slate-500">
              Play on the board, then use search to highlight and load catalog lines.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleResetBoard}
              className="rounded-full bg-slate-200 px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-300"
            >
              Reset Board
            </button>
            <button
              type="button"
              onClick={handleAdvanceManualPlayback}
              disabled={
                playbackMode !== "manual" ||
                remainingMoves.length === 0 ||
                isAutoPlaying
              }
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Next Move
            </button>
          </div>
        </div>

        <div className="flex min-h-0 items-center justify-center rounded-[2rem] border border-slate-200 bg-white p-4">
          <div className="h-full max-h-full w-auto" style={{ aspectRatio: "1 / 1" }}>
            <BoardInteractive
              key={boardResetToken}
              initialFen={boardInitialFen}
              scriptedMove={scriptedMove}
              playerColor="both"
              onMove={handleBoardMove}
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
              Board matches
            </p>
            <p className="mt-2 text-sm text-slate-700">
              {boardMatches.length > 0
                ? boardMatches.slice(0, 2).map((match) => match.name).join(" / ")
                : "No catalog match yet."}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
              Playback
            </p>
            <p className="mt-2 text-sm text-slate-700">
              {playbackMoves.length > 0
                ? `${playbackMode} - ${playbackIndex}/${playbackMoves.length} moves`
                : "No line loaded."}
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
          selectedEco={selectedMatch?.eco}
          onHighlight={handleHighlightMatch}
          onLoadLine={handleLoadLine}
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
