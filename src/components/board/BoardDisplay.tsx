"use client";

import { BoardBase } from "./BoardBase";

type BoardDisplayProps = {
  /** FEN string for the position to show. */
  fen?: string;
  /** Board size preset. */
  size?: "sm" | "md" | "lg";
  /** Which color faces the viewer. */
  orientation?: "white" | "black";
};

/**
 * Non-interactive board thumbnail for cards, buttons, and previews.
 * No game logic, no hooks, no state — purely presentational.
 */
export function BoardDisplay({
  fen,
  size = "sm",
  orientation = "white",
}: BoardDisplayProps) {
  return (
    <BoardBase
      position={fen}
      orientation={orientation}
      interactive={false}
      size={size}
      showNotation={false}
      animationDuration={0}
    />
  );
}
