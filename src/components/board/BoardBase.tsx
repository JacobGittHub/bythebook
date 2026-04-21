"use client";

import { Chessboard } from "react-chessboard";
import type { ChessboardOptions } from "react-chessboard";
import type { CSSProperties } from "react";
import { BOARD_THEME } from "./boardTheme";

const SIZE_MAP = {
  sm: 120,
  md: 240,
  lg: 400,
} as const;

type BoardSize = keyof typeof SIZE_MAP | "full";

export type BoardBaseProps = {
  /** FEN string for the position to display. */
  position?: string;
  /** Which color faces the player. */
  orientation?: "white" | "black";
  /** Whether pieces can be dragged / clicked. */
  interactive?: boolean;
  /** Preset board width, or "full" to fill available viewport height. */
  size?: BoardSize;
  /** Show rank/file notation on the board edges. */
  showNotation?: boolean;
  /** Move animation duration in milliseconds. */
  animationDuration?: number;
  /** Called when a piece is dropped. Return true to accept, false to reject. */
  onPieceDrop?: ChessboardOptions["onPieceDrop"];
  /** Called when a square is clicked. */
  onSquareClick?: ChessboardOptions["onSquareClick"];
  /** Arrows to render on the board. */
  arrows?: ChessboardOptions["arrows"];
  /** Per-square style overrides (highlights, selections). */
  squareStyles?: Record<string, CSSProperties>;
};

/**
 * Thin wrapper around react-chessboard. Every board in the app renders
 * through this component so theming and behavior are consistent.
 *
 * Contains NO game logic — that lives in hooks and parent components.
 */
export function BoardBase({
  position,
  orientation = "white",
  interactive = true,
  size = "full",
  showNotation = true,
  animationDuration = 200,
  onPieceDrop,
  onSquareClick,
  arrows = [],
  squareStyles = {},
}: BoardBaseProps) {
  const isFullSize = size === "full";

  const options: ChessboardOptions = {
    position,
    boardOrientation: orientation,
    allowDragging: interactive,
    showNotation,
    animationDurationInMs: animationDuration,
    showAnimations: animationDuration > 0,
    darkSquareStyle: BOARD_THEME.darkSquare,
    lightSquareStyle: BOARD_THEME.lightSquare,
    squareStyles,
    arrows,
    onPieceDrop: interactive ? onPieceDrop : undefined,
    onSquareClick: interactive ? onSquareClick : undefined,
  };

  const fixedPx = isFullSize ? undefined : SIZE_MAP[size];

  return (
    <div
      className="board-base-wrapper"
      style={{
        /* Fixed sizes get explicit width; full-size boards are constrained
           by the viewport-height-driven container their parent provides. */
        width: fixedPx ? `${fixedPx}px` : "100%",
        maxWidth: "100%",
        aspectRatio: "1 / 1",
        border: `3px solid ${BOARD_THEME.boardBorder}`,
        borderRadius: "4px",
        overflow: "hidden",
      }}
    >
      <Chessboard options={options} />
    </div>
  );
}
