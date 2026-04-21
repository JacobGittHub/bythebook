"use client";

import { useCallback, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { BoardBase } from "./BoardBase";
import { BOARD_THEME } from "./boardTheme";
import { useChessGame } from "@/hooks/useChessGame";
import type { MoveResult } from "@/hooks/useChessGame";
import type { ChessboardOptions } from "react-chessboard";

type BoardInteractiveProps = {
  /** Starting FEN position. */
  initialFen?: string;
  /** Which color faces the player. */
  orientation?: "white" | "black";
  /** Which color the user is allowed to move. "both" = free play. */
  playerColor?: "white" | "black" | "both";
  /** Called after a legal move is made. */
  onMove?: (move: MoveResult) => void;
  /** Called when an illegal move is attempted. */
  onIllegalMove?: (from: string, to: string) => void;
  /** Show dot indicators on legal target squares. */
  showLegalMoves?: boolean;
  /** Highlight the last move's source and target squares. */
  showLastMove?: boolean;
  /** Whether undo is available. */
  allowUndo?: boolean;
};

/**
 * Fully interactive chessboard with chess.js move validation.
 * Supports drag-and-drop and click-click input.
 * Manages its own game state via useChessGame.
 */
export function BoardInteractive({
  initialFen,
  orientation = "white",
  playerColor = "both",
  onMove,
  onIllegalMove,
  showLegalMoves = true,
  showLastMove = true,
}: BoardInteractiveProps) {
  const {
    fen,
    turn,
    lastMove,
    isCheck,
    makeMove,
    getLegalMoves,
  } = useChessGame(initialFen);

  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [legalTargets, setLegalTargets] = useState<string[]>([]);

  /** Can the user move pieces for the current turn? */
  const canMoveForTurn =
    playerColor === "both" ||
    (playerColor === "white" && turn === "w") ||
    (playerColor === "black" && turn === "b");

  /** Attempt to make a move. Returns true if accepted. */
  const attemptMove = useCallback(
    (from: string, to: string): boolean => {
      if (!canMoveForTurn) return false;

      const result = makeMove(from, to);
      if (result) {
        setSelectedSquare(null);
        setLegalTargets([]);
        onMove?.(result);
        return true;
      }

      onIllegalMove?.(from, to);
      return false;
    },
    [canMoveForTurn, makeMove, onMove, onIllegalMove]
  );

  /** react-chessboard drop handler. */
  const handlePieceDrop = useCallback<
    NonNullable<ChessboardOptions["onPieceDrop"]>
  >(
    ({ sourceSquare, targetSquare }) => {
      if (!sourceSquare || !targetSquare) return false;
      return attemptMove(sourceSquare, targetSquare);
    },
    [attemptMove]
  );

  /** Click-click move input. */
  const handleSquareClick = useCallback<
    NonNullable<ChessboardOptions["onSquareClick"]>
  >(
    ({ square }) => {
      if (!canMoveForTurn) return;

      // If a piece is already selected and we click a target, attempt the move
      if (selectedSquare) {
        if (selectedSquare === square) {
          // Deselect
          setSelectedSquare(null);
          setLegalTargets([]);
          return;
        }

        const moved = attemptMove(selectedSquare, square);
        if (moved) return;

        // If the move failed, check if the clicked square has a piece we own
        // and select it instead.
      }

      // Select the clicked square if it has legal moves
      const targets = getLegalMoves(square);
      if (targets.length > 0) {
        setSelectedSquare(square);
        setLegalTargets(targets);
      } else {
        setSelectedSquare(null);
        setLegalTargets([]);
      }
    },
    [canMoveForTurn, selectedSquare, attemptMove, getLegalMoves]
  );

  /** Build per-square highlight styles. */
  const squareStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};

    // Last move highlighting
    if (showLastMove && lastMove) {
      styles[lastMove.from] = { ...BOARD_THEME.lastMoveLight };
      styles[lastMove.to] = { ...BOARD_THEME.lastMoveDark };
    }

    // Selected square
    if (selectedSquare) {
      styles[selectedSquare] = {
        ...styles[selectedSquare],
        ...BOARD_THEME.selectedSquare,
      };
    }

    // Legal move indicators
    if (showLegalMoves && legalTargets.length > 0) {
      for (const sq of legalTargets) {
        // If the square already has a style (e.g. last move), it likely has
        // a piece on it → use capture indicator
        const isOccupied = sq in styles;
        styles[sq] = {
          ...styles[sq],
          ...(isOccupied
            ? BOARD_THEME.validTargetCapture
            : BOARD_THEME.validTarget),
        };
      }
    }

    // Check highlighting on the king's square
    if (isCheck) {
      // chess.js doesn't directly tell us the king square, but we can
      // derive it from the FEN. For now, use the board position.
      // The react-chessboard library renders from FEN, so we parse it.
      const kingChar = turn === "w" ? "K" : "k";
      const fenParts = fen.split(" ")[0];
      const rows = fenParts.split("/");

      for (let rank = 0; rank < 8; rank++) {
        let file = 0;
        for (const ch of rows[rank]) {
          if (ch >= "1" && ch <= "8") {
            file += parseInt(ch);
          } else {
            if (ch === kingChar) {
              const sq =
                String.fromCharCode(97 + file) + String(8 - rank);
              styles[sq] = {
                ...styles[sq],
                ...BOARD_THEME.checkSquare,
              };
            }
            file++;
          }
        }
      }
    }

    return styles;
  }, [
    showLastMove,
    lastMove,
    selectedSquare,
    showLegalMoves,
    legalTargets,
    isCheck,
    turn,
    fen,
  ]);

  return (
    <BoardBase
      position={fen}
      orientation={orientation}
      interactive={canMoveForTurn}
      size="full"
      showNotation
      onPieceDrop={handlePieceDrop}
      onSquareClick={handleSquareClick}
      squareStyles={squareStyles}
    />
  );
}
