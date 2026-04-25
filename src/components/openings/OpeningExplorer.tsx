"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BoardInteractive } from "@/components/board/BoardInteractive";
import { START_FEN } from "@/lib/chess/fen";
import {
  getCatalogMatchesForFen,
  getCatalogMatchesForUciLine,
  searchCatalogMatches,
} from "@/lib/chess/openingCatalog";
import {
  createMoveCommand,
  createResetCommand,
  createUndoCommand,
  getCurrentLineIndex,
  getRemainingMovesFromLine,
  type ScriptedBoardCommand,
} from "@/lib/chess/linePlayback";
import { useOpeningExplorer } from "@/hooks/useOpeningExplorer";
import { useOpeningExplorerMulti } from "@/hooks/useOpeningExplorerMulti";
import { useEngine, type EngineMode } from "@/hooks/useEngine";
import { useBackgroundMode } from "@/context/BackgroundMode";
import { formatScore, evalToBarPct } from "@/lib/chess/stockfishUci";
import { OpeningMiniTree, type HistoryAltEntry } from "@/components/openings/OpeningMiniTree";
import type { MoveResult } from "@/hooks/useChessGame";
import type { CatalogMatch, ExplorerMatchMode, ExplorerMove, Move } from "@/types/chess";

const AUTO_PLAY_DELAY_MS = 700;

function moveResultsToMoves(moveHistory: MoveResult[]): Move[] {
  return moveHistory.map((move) => ({
    san: move.san,
    uci: move.uci,
    fen: move.fen,
  }));
}

function formatGames(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export function OpeningExplorer() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<CatalogMatch | null>(null);
  const [moveHistory, setMoveHistory] = useState<MoveResult[]>([]);
  const [scriptedCommand, setScriptedCommand] = useState<ScriptedBoardCommand | null>(null);
  const [pendingForwardMoves, setPendingForwardMoves] = useState<Move[]>([]);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [engineMode, setEngineMode] = useState<EngineMode>("none");
  const [showEngineArrow, setShowEngineArrow] = useState(true);
  const [boardOrientation, setBoardOrientation] = useState<"white" | "black">("white");
  const commandNonceRef = useRef(0);
  const blurTimeoutRef = useRef<number | null>(null);
  const pendingPostResetMovesRef = useRef<Move[]>([]);

  const { mode } = useBackgroundMode();
  const [hoveredMoveUci, setHoveredMoveUci] = useState<string | null>(null);

  const arrowColor = useMemo(() => {
    switch (mode) {
      case "dark":  return "rgba(140, 130, 220, 0.55)";
      case "blue":  return "rgba(40,  80,  200, 0.55)";
      case "green": return "rgba(40,  130, 60,  0.55)";
      case "red":   return "rgba(170, 50,  40,  0.55)";
      default:      return "rgba(80,  60,  20,  0.50)";
    }
  }, [mode]);

  const hoverArrows = useMemo(
    () =>
      hoveredMoveUci
        ? [{ startSquare: hoveredMoveUci.slice(0, 2), endSquare: hoveredMoveUci.slice(2, 4), color: arrowColor }]
        : [],
    [hoveredMoveUci, arrowColor],
  );

  const currentMoves = useMemo(() => moveResultsToMoves(moveHistory), [moveHistory]);
  const currentUciLine = useMemo(() => currentMoves.map((m) => m.uci), [currentMoves]);
  const currentFen = currentMoves[currentMoves.length - 1]?.fen ?? START_FEN;

  // Clear hover arrow whenever the board position changes.
  useEffect(() => {
    setHoveredMoveUci(null);
  }, [currentFen]);

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

  const highlightedLineMoves = useMemo(() => selectedMatch?.moves ?? [], [selectedMatch]);
  const currentBoardIndexWithinHighlightedLine = selectedMatch
    ? getCurrentLineIndex(currentMoves, highlightedLineMoves)
    : -1;
  const isBoardOnHighlightedLine =
    selectedMatch ? currentBoardIndexWithinHighlightedLine !== -1 : false;
  const remainingHighlightedMoves = useMemo(
    () =>
      selectedMatch ? getRemainingMovesFromLine(currentMoves, highlightedLineMoves) : [],
    [currentMoves, highlightedLineMoves, selectedMatch],
  );

  const canGoToStart = currentMoves.length > 0;
  const canUndo = currentMoves.length > 0;
  const canGoForward = Boolean(
    selectedMatch && isBoardOnHighlightedLine && remainingHighlightedMoves.length > 0,
  );
  const canGoToEnd = canGoForward;
  const canAutoPlay = canGoForward;

  const explorerData = useOpeningExplorer(currentFen);

  const historyBeforeFens = useMemo(
    () => moveHistory.map((_, i) => (i === 0 ? START_FEN : moveHistory[i - 1].fen)),
    [moveHistory],
  );
  const historyExplorerData = useOpeningExplorerMulti(historyBeforeFens);
  const historyPlayedFractions = useMemo((): (number | null)[] => {
    return moveHistory.map((move, i) => {
      const beforeFen = i === 0 ? START_FEN : moveHistory[i - 1].fen;
      const data = historyExplorerData[beforeFen];
      if (!data?.moves?.length) return null;
      const total = data.moves.reduce((s, m) => s + m.white + m.draws + m.black, 0);
      if (total === 0) return null;
      const played = data.moves.find((m) => m.uci === move.uci);
      if (!played) return null;
      return (played.white + played.draws + played.black) / total;
    });
  }, [moveHistory, historyExplorerData]);

  const historyPlayedGames = useMemo((): (number | null)[] => {
    return moveHistory.map((move, i) => {
      const beforeFen = i === 0 ? START_FEN : moveHistory[i - 1].fen;
      const data = historyExplorerData[beforeFen];
      if (!data?.moves?.length) return null;
      const played = data.moves.find((m) => m.uci === move.uci);
      if (!played) return null;
      return played.white + played.draws + played.black;
    });
  }, [moveHistory, historyExplorerData]);

  const historyAlternates = useMemo((): (HistoryAltEntry | null)[] => {
    return moveHistory.map((move, i) => {
      const beforeFen = i === 0 ? START_FEN : moveHistory[i - 1].fen;
      const data = historyExplorerData[beforeFen];
      if (!data?.moves?.length) return null;
      const total = data.moves.reduce((s, m) => s + m.white + m.draws + m.black, 0);
      if (total === 0) return null;
      const alts = data.moves.filter((m) => m.uci !== move.uci).slice(0, 2);
      return alts.length > 0 ? { alts, total } : null;
    });
  }, [moveHistory, historyExplorerData]);

  const nextCommandId = () => {
    commandNonceRef.current += 1;
    return String(commandNonceRef.current);
  };

  useEffect(() => {
    if (!isAutoPlaying || !canAutoPlay) return;
    const nextMove = remainingHighlightedMoves[0];
    if (!nextMove) return;
    const timeoutId = window.setTimeout(() => {
      setScriptedCommand(createMoveCommand(nextMove, nextCommandId()));
    }, AUTO_PLAY_DELAY_MS);
    return () => window.clearTimeout(timeoutId);
  }, [canAutoPlay, isAutoPlaying, remainingHighlightedMoves]);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current !== null) window.clearTimeout(blurTimeoutRef.current);
    };
  }, []);

  const handleHighlightMatch = (match: CatalogMatch) => {
    setSelectedMatch(match);
    setPendingForwardMoves([]);
    setIsAutoPlaying(false);
    setPlaybackError(null);
  };

  const handleHighlightFromSearch = (match: CatalogMatch) => {
    handleHighlightMatch(match);
    setSearchQuery("");
    setIsSearchFocused(false);
  };

  const handleBoardMove = (move: MoveResult) => {
    const nextMoves = [...currentMoves, { san: move.san, uci: move.uci, fen: move.fen }];
    setMoveHistory((prev) => [...prev, move]);
    setPlaybackError(null);

    if (isAutoPlaying && selectedMatch) {
      const nextIndex = getCurrentLineIndex(nextMoves, highlightedLineMoves);
      if (nextIndex === -1 || getRemainingMovesFromLine(nextMoves, highlightedLineMoves).length === 0) {
        setIsAutoPlaying(false);
      }
    }

    if (pendingForwardMoves.length > 0) {
      const [nextPending, ...rest] = pendingForwardMoves;
      setPendingForwardMoves(rest);
      setScriptedCommand(createMoveCommand(nextPending, nextCommandId()));
    }
  };

  const handleBoardUndo = () => {
    setMoveHistory((prev) => prev.slice(0, -1));
    setPendingForwardMoves([]);
    setIsAutoPlaying(false);
    setPlaybackError(null);
  };

  const handleBoardReset = () => {
    setMoveHistory([]);
    setIsAutoPlaying(false);
    setPlaybackError(null);
    const postResetMoves = pendingPostResetMovesRef.current;
    pendingPostResetMovesRef.current = [];
    if (postResetMoves.length > 0) {
      const [first, ...rest] = postResetMoves;
      setPendingForwardMoves(rest);
      setScriptedCommand(createMoveCommand(first, nextCommandId()));
    } else {
      setPendingForwardMoves([]);
    }
  };

  const handleHistoryAlternateClick = (fullMoveIndex: number, move: ExplorerMove) => {
    const movesToPlay: Move[] = [
      ...moveHistory.slice(0, fullMoveIndex).map((m) => ({ san: m.san, uci: m.uci })),
      { san: move.san, uci: move.uci },
    ];
    setPendingForwardMoves([]);
    setIsAutoPlaying(false);
    pendingPostResetMovesRef.current = movesToPlay;
    setScriptedCommand(createResetCommand(nextCommandId()));
  };

  const handleHistoryNodeClick = (fullMoveIndex: number) => {
    if (fullMoveIndex === moveHistory.length - 1) return;
    const movesToPlay: Move[] = moveHistory
      .slice(0, fullMoveIndex + 1)
      .map((m) => ({ san: m.san, uci: m.uci }));
    setPendingForwardMoves([]);
    setIsAutoPlaying(false);
    pendingPostResetMovesRef.current = movesToPlay;
    setScriptedCommand(createResetCommand(nextCommandId()));
  };

  const handleGoToStart = () => {
    if (!canGoToStart) return;
    setPendingForwardMoves([]);
    setIsAutoPlaying(false);
    setScriptedCommand(createResetCommand(nextCommandId()));
  };

  const handleUndoMove = () => {
    if (!canUndo) return;
    setPendingForwardMoves([]);
    setIsAutoPlaying(false);
    setScriptedCommand(createUndoCommand(nextCommandId()));
  };

  const handleStepForward = () => {
    if (!canGoForward) return;
    const nextMove = remainingHighlightedMoves[0];
    if (!nextMove) return;
    setPendingForwardMoves([]);
    setIsAutoPlaying(false);
    setScriptedCommand(createMoveCommand(nextMove, nextCommandId()));
  };

  const handleGoToEnd = () => {
    if (!canGoToEnd) return;
    const [firstMove, ...rest] = remainingHighlightedMoves;
    if (!firstMove) return;
    setPendingForwardMoves(rest);
    setIsAutoPlaying(false);
    setScriptedCommand(createMoveCommand(firstMove, nextCommandId()));
  };

  const handleToggleAutoPlay = () => {
    if (isAutoPlaying) { setIsAutoPlaying(false); return; }
    if (!canAutoPlay) return;
    setPendingForwardMoves([]);
    setPlaybackError(null);
    setIsAutoPlaying(true);
  };

  const handleIllegalMove = () => {
    setPendingForwardMoves([]);
    setIsAutoPlaying(false);
    setPlaybackError("Move could not be applied to the current board state.");
  };

  const handleExplorerMoveClick = (move: ExplorerMove) => {
    setPendingForwardMoves([]);
    setIsAutoPlaying(false);
    setScriptedCommand(createMoveCommand({ san: move.san, uci: move.uci }, nextCommandId()));
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

  const navBtnClass =
    "rounded-full p-1.5 text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300";
  const playBtnClass =
    "rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400";

  return (
    <div className="grid h-[calc(100vh-8rem)] gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      {/* ── Left: board + search ── */}
      <section
        className="grid h-full min-w-0 gap-3 rounded-[2rem] bg-slate-50 p-3"
        style={{ gridTemplateRows: "auto 1fr" }}
      >
        {/* Header card: title left, search right — single compact row */}
        <div className="flex items-center gap-4 rounded-3xl border border-slate-200 bg-white px-5 py-4">
          <div className="shrink-0">
            <h1 className="text-xl font-semibold text-slate-950">Opening Explorer</h1>
            {selectedMatch ? (
              <p className="mt-0.5 text-sm text-slate-500">
                <span className="font-medium text-slate-700">{selectedMatch.eco}</span>
                {" · "}
                {selectedMatch.name}
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-slate-400">Play moves or search.</p>
            )}
          </div>

          {/* Flip board button */}
          <button
            type="button"
            onClick={() => setBoardOrientation((o) => (o === "white" ? "black" : "white"))}
            title="Flip board"
            className="shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            ⇅ {boardOrientation === "white" ? "White" : "Black"}
          </button>

          {/* Search input */}
          <div className="relative flex-1">
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
              placeholder="Search — Sicilian, B12, Ruy Lopez…"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
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
                    className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-0 hover:bg-slate-50"
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

        {/* Board + right-side eval bar */}
        <div className="flex min-h-0 gap-2 rounded-[2rem] border border-slate-200 bg-white p-4">
          <div className="min-h-0 flex-1" style={{ containerType: "size" }}>
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

      {/* ── Right: four-section sidebar ── */}
      <aside className="flex min-h-0 min-w-0 flex-col gap-3">
        {/* ① Engine panel */}
        <div className="shrink-0 rounded-3xl border border-slate-200 bg-white px-5 py-4">
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
                    : "border-slate-200 bg-slate-50 text-slate-400 hover:text-slate-600"
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
                      ? "bg-slate-950 text-white"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Engine output */}
          {engineMode !== "none" && (
            <div className="mt-4 space-y-3">
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

        {/* ② Mini look-ahead tree */}
        <div className="h-52 shrink-0 overflow-hidden rounded-3xl border border-[var(--border-card)] bg-[var(--bg-card)] px-3 py-3">
          <OpeningMiniTree
            moveHistory={moveHistory}
            explorerMoves={explorerData.data?.moves ?? []}
            currentFen={currentFen}
            historyPlayedFractions={historyPlayedFractions}
            historyPlayedGames={historyPlayedGames}
            historyAlternates={historyAlternates}
            boardOrientation={boardOrientation}
            onMoveClick={handleExplorerMoveClick}
            onHistoryNodeClick={handleHistoryNodeClick}
            onHistoryAlternateClick={handleHistoryAlternateClick}
            onHoverUci={setHoveredMoveUci}
            hoveredUci={hoveredMoveUci}
          />
        </div>

        {/* ③ Move sequence + navigation */}
        <div className="shrink-0 rounded-3xl border border-slate-200 bg-white px-5 py-4">
          <div className="flex items-center gap-2">
            {/* Scrollable move tokens */}
            <div className="min-w-0 flex-1 overflow-x-auto">
              {selectedMatch ? (
                <div className="flex items-baseline gap-1 whitespace-nowrap pb-0.5">
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
                        <span
                          className={`text-sm transition-colors ${
                            isPlayed
                              ? "font-semibold text-slate-700"
                              : isNext
                                ? "font-semibold text-slate-950 underline decoration-slate-400 underline-offset-2"
                                : "text-slate-400"
                          }`}
                        >
                          {move.san}
                        </span>
                      </span>
                    );
                  })}
                </div>
              ) : currentMoves.length > 0 ? (
                <div className="flex items-baseline gap-1 whitespace-nowrap pb-0.5">
                  {currentMoves.map((move, index) => (
                    <span key={index} className="inline-flex items-baseline gap-0.5">
                      {index % 2 === 0 && (
                        <span className="text-xs text-slate-300">
                          {Math.floor(index / 2) + 1}.
                        </span>
                      )}
                      <span className="text-sm font-semibold text-slate-700">{move.san}</span>
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
            <p className="mt-2 text-xs text-amber-600">Board diverged from highlighted line.</p>
          )}
          {playbackError && (
            <p className="mt-2 text-xs text-rose-500">{playbackError}</p>
          )}
        </div>

        {/* ④ Opening name + master game stats */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto rounded-3xl border border-slate-200 bg-white px-5 py-4">
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
          <div className="my-3 shrink-0 border-t border-slate-100" />

          {/* Master game move stats */}
          {explorerData.loading && (
            <p className="text-xs text-slate-400">Loading master games…</p>
          )}
          {!explorerData.loading && explorerData.error && (
            <p className="text-xs text-slate-400">
              {explorerData.error === "401"
                ? "Sign in to see master game statistics."
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
                      className={`grid cursor-pointer grid-cols-[2rem_1fr_3.5rem] items-center gap-2 rounded-xl px-2 py-2 transition-colors ${
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
      </aside>
    </div>
  );
}
