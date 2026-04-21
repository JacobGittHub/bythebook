"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";
import type { Move as ChessJsMove, Square } from "chess.js";

export type MoveResult = {
  san: string;
  from: Square;
  to: Square;
  color: "w" | "b";
  /** FEN after the move. */
  fen: string;
  /** Captured piece symbol, if any. */
  captured?: string;
  /** True if this move gives check. */
  isCheck: boolean;
  /** True if this move is checkmate. */
  isCheckmate: boolean;
};

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function toMoveResult(move: ChessJsMove, game: Chess): MoveResult {
  return {
    san: move.san,
    from: move.from,
    to: move.to,
    color: move.color,
    fen: game.fen(),
    captured: move.captured,
    isCheck: game.inCheck(),
    isCheckmate: game.isCheckmate(),
  };
}

/**
 * Core game-state hook wrapping chess.js.
 * Single source of truth for board position, move validation, and game status.
 */
export function useChessGame(initialFen: string = START_FEN) {
  const gameRef = useRef<Chess>(new Chess(initialFen));
  const [fen, setFen] = useState(initialFen);
  const [moveHistory, setMoveHistory] = useState<MoveResult[]>([]);

  const game = gameRef.current;

  const turn = useMemo(() => game.turn(), [fen]);

  const lastMove = useMemo(() => {
    if (moveHistory.length === 0) return null;
    const last = moveHistory[moveHistory.length - 1];
    return { from: last.from, to: last.to };
  }, [moveHistory]);

  const isCheck = useMemo(() => game.inCheck(), [fen]);
  const isCheckmate = useMemo(() => game.isCheckmate(), [fen]);
  const isStalemate = useMemo(() => game.isStalemate(), [fen]);
  const isDraw = useMemo(() => game.isDraw(), [fen]);
  const isGameOver = useMemo(() => game.isGameOver(), [fen]);

  const makeMove = useCallback(
    (
      from: string,
      to: string,
      promotion?: string
    ): MoveResult | null => {
      try {
        const move = game.move({
          from: from as Square,
          to: to as Square,
          promotion: promotion as "q" | "r" | "b" | "n" | undefined,
        });

        if (!move) return null;

        const result = toMoveResult(move, game);
        setFen(game.fen());
        setMoveHistory((prev) => [...prev, result]);
        return result;
      } catch {
        return null;
      }
    },
    [game]
  );

  const undoMove = useCallback((): MoveResult | null => {
    const move = game.undo();
    if (!move) return null;

    const result: MoveResult = {
      san: move.san,
      from: move.from,
      to: move.to,
      color: move.color,
      fen: game.fen(),
      captured: move.captured,
      isCheck: game.inCheck(),
      isCheckmate: false,
    };

    setFen(game.fen());
    setMoveHistory((prev) => prev.slice(0, -1));
    return result;
  }, [game]);

  const resetGame = useCallback(() => {
    game.load(initialFen);
    setFen(initialFen);
    setMoveHistory([]);
  }, [game, initialFen]);

  const loadFen = useCallback(
    (newFen: string) => {
      game.load(newFen);
      setFen(newFen);
      setMoveHistory([]);
    },
    [game]
  );

  const getLegalMoves = useCallback(
    (square: string): string[] => {
      try {
        const moves = game.moves({
          square: square as Square,
          verbose: true,
        });
        return moves.map((m) => m.to);
      } catch {
        return [];
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [game, fen]
  );

  return {
    game,
    fen,
    turn,
    moveHistory,
    lastMove,
    isCheck,
    isCheckmate,
    isStalemate,
    isDraw,
    isGameOver,
    makeMove,
    undoMove,
    resetGame,
    loadFen,
    getLegalMoves,
  };
}
