import type { CSSProperties } from "react";

export type BoardTheme = {
  lightSquare: CSSProperties;
  darkSquare: CSSProperties;
  boardBorder: string;
  lastMoveLight: CSSProperties;
  lastMoveDark: CSSProperties;
  validTarget: CSSProperties;
  validTargetCapture: CSSProperties;
  checkSquare: CSSProperties;
  selectedSquare: CSSProperties;
};

/** Lichess classic — warm cream and brown, matching user reference. */
export const BOARD_THEME: BoardTheme = {
  lightSquare: { backgroundColor: "#F0D9B5" },
  darkSquare: { backgroundColor: "#B58863" },
  boardBorder: "#432818",

  lastMoveLight: { backgroundColor: "rgba(205, 210, 106, 0.5)" },
  lastMoveDark: { backgroundColor: "rgba(170, 162, 58, 0.5)" },

  validTarget: {
    backgroundImage:
      "radial-gradient(circle, rgba(0,0,0,0.15) 25%, transparent 25%)",
  },
  validTargetCapture: {
    backgroundImage:
      "radial-gradient(circle, transparent 55%, rgba(0,0,0,0.15) 55%)",
  },

  checkSquare: {
    backgroundImage:
      "radial-gradient(ellipse at center, rgba(255,0,0,0.6) 0%, rgba(200,0,0,0.3) 40%, transparent 70%)",
  },

  selectedSquare: { backgroundColor: "rgba(20, 85, 30, 0.4)" },
} as const;
