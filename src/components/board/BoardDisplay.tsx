"use client";

import { BoardBase } from "./BoardBase";

type BoardDisplayProps = {
  /** FEN string for the position to show. */
  fen?: string;
  /** Board size preset. */
  size?: "sm" | "md" | "lg";
  /** Which color faces the viewer. */
  orientation?: "white" | "black";
  /** Slide the pieces when the position changes, for a board that follows a selection. */
  animate?: boolean;
};

/** The same speed as a move on the playable board (`BoardBase`'s default). */
const ANIMATION_MS = 200;

/**
 * Non-interactive board thumbnail for cards, buttons, and previews.
 * No game logic, no hooks, no state — purely presentational.
 */
export function BoardDisplay({
  fen,
  size = "sm",
  orientation = "white",
  animate = false,
}: BoardDisplayProps) {
  return (
    <BoardBase
      position={fen}
      orientation={orientation}
      interactive={false}
      size={size}
      showNotation={false}
      animationDuration={animate ? ANIMATION_MS : 0}
    />
  );
}
