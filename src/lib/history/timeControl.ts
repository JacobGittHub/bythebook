// A game's time control, read from its PGN `TimeControl` header, and the class it falls in
// (plans/game-history.md D8). Each site's own rule picks the class, so a game is filed where
// the user saw it filed there.

import { TIME_CONTROL_PATTERN, type GameSource, type TimeClass } from "./types";

export type TimeControl =
  /** A clock: `base` seconds, plus `increment` seconds a move (both of a multi-period control's first period). */
  | { kind: "clock"; base: number; increment: number; text: string }
  /** Correspondence ("1/86400"): a number of seconds for each move. */
  | { kind: "daily"; secondsPerMove: number; text: string };

const CLOCK = /^(\d{1,6})(?:\+(\d{1,4}))?$/;
const DAILY = /^1\/(\d{1,7})$/;
// "40/5400+30:1800+30": moves in a period, its seconds and increment, then the next periods.
const PERIODS = /^(?:\d{1,3}\/)?(\d{1,6})(?:\+(\d{1,4}))?(?::(?:\d{1,3}\/)?\d{1,6}(?:\+\d{1,4})?)*$/;

/**
 * The time control a header gives, or null for none ("-", "?", a sandglass "*60", or text that
 * isn't one). A plain clock is written as base and increment ("300" reads as "300+0"), so the
 * same control from two sites matches.
 */
export function parseTimeControl(header: string | undefined): TimeControl | null {
  const text = header?.trim() ?? "";
  if (!TIME_CONTROL_PATTERN.test(text)) return null;
  const clock = CLOCK.exec(text);
  if (clock) {
    const [base, increment] = [Number(clock[1]), Number(clock[2] ?? 0)];
    return base || increment ? { kind: "clock", base, increment, text: `${base}+${increment}` } : null;
  }
  const daily = DAILY.exec(text);
  if (daily) return Number(daily[1]) ? { kind: "daily", secondsPerMove: Number(daily[1]), text } : null;
  const periods = PERIODS.exec(text);
  if (periods) return { kind: "clock", base: Number(periods[1]), increment: Number(periods[2] ?? 0), text };
  return null;
}

/**
 * The class a game falls in, by its site's rule on its expected length (the base plus 40
 * increments). Chess.com: under 3 minutes bullet, under 10 blitz, then rapid. Lichess, also
 * used for other sources: under 3 minutes bullet (with ultrabullet), under 8 blitz, under 25
 * rapid, then classical. A game with no time control is daily when its event says so.
 */
export function timeClassOf(control: TimeControl | null, source: GameSource, event = ""): TimeClass {
  if (!control) return /correspondence|daily/i.test(event) ? "daily" : "unknown";
  if (control.kind === "daily") return "daily";
  const seconds = control.base + 40 * control.increment;
  if (seconds < 180) return "bullet";
  if (source === "chesscom") return seconds < 600 ? "blitz" : "rapid";
  if (seconds < 480) return "blitz";
  return seconds < 1500 ? "rapid" : "classical";
}
