// Choosing games on the history page (plans/game-history.md D38): the side, the time controls,
// the sources with their imports, and a span of months. Every choice starts with everything in, so
// a filter keeps what is left out; "All games" puts everything back. Each panel counts its
// options under the other choices, so a count says what ticking it would add.

import { TIME_CLASSES, type GameSource, type HistoryImport, type StoredGame, type TimeClass } from "./types";

export type HistorySide = "both" | "white" | "black";

/** A game as the history page chooses it: its record and the import it came in. */
export type HistoryGame = Pick<StoredGame, "record" | "importId">;

export type HistoryFilter = {
  side: HistorySide;
  /** Time controls left out, by `timeKey`. */
  offTimes: ReadonlySet<string>;
  /** Each source's imports left out, by `sourceKey`. */
  offSources: ReadonlySet<string>;
  /** The first and last months chosen ("2025-03"); null for no bound. A game with no date needs neither. */
  from: string | null;
  to: string | null;
};

export const ALL_GAMES: HistoryFilter = { side: "both", offTimes: new Set(), offSources: new Set(), from: null, to: null };

type Choice = "time" | "source" | "date";

/** A game's time control within its class, such as "blitz 180+2", or "blitz -" with none written. */
export function timeKey(game: HistoryGame): string {
  return `${game.record.timeClass} ${game.record.timeControl ?? "-"}`;
}

/** A game's source within its import, such as "lichess 12". */
export function sourceKey(game: HistoryGame): string {
  return `${game.record.source} ${game.importId}`;
}

export function monthOf(game: HistoryGame): string | null {
  return game.record.playedAt?.slice(0, 7) ?? null;
}

/** Whether a game passes the filter, leaving out the choice `skip`, as its panel counts. */
export function passes(game: HistoryGame, filter: HistoryFilter, skip?: Choice): boolean {
  if (filter.side !== "both" && game.record.color !== filter.side) return false;
  if (skip !== "time" && filter.offTimes.has(timeKey(game))) return false;
  if (skip !== "source" && filter.offSources.has(sourceKey(game))) return false;
  if (skip !== "date" && (filter.from || filter.to)) {
    const month = monthOf(game);
    if (!month || (filter.from && month < filter.from) || (filter.to && month > filter.to)) return false;
  }
  return true;
}

export function chooseGames<T extends HistoryGame>(games: readonly T[], filter: HistoryFilter): T[] {
  return games.filter((game) => passes(game, filter));
}

export function isAllGames(filter: HistoryFilter): boolean {
  return filter.side === "both" && !filter.offTimes.size && !filter.offSources.size && !filter.from && !filter.to;
}

/** Puts `keys` in (`on`) or leaves them out of a set of left-out keys. */
export function withKeys(off: ReadonlySet<string>, keys: readonly string[], on: boolean): ReadonlySet<string> {
  const next = new Set(off);
  for (const key of keys) {
    if (on) next.delete(key);
    else next.add(key);
  }
  return next;
}

/** "3+2", "1 day a move", or "No clock". */
export function controlName(control: string | null): string {
  if (!control) return "No clock";
  const daily = /^1\/(\d+)$/.exec(control);
  if (daily) {
    const days = Number(daily[1]) / 86_400;
    return Number.isInteger(days) ? `${days} day${days === 1 ? "" : "s"} a move` : control;
  }
  const clock = /^(\d+)\+(\d+)$/.exec(control);
  if (!clock) return control;
  const base = Number(clock[1]);
  return `${base >= 60 && base % 60 === 0 ? base / 60 : `${base}s`}+${clock[2]}`;
}

const CLASS_NAMES: Record<TimeClass, string> = {
  bullet: "Bullet",
  blitz: "Blitz",
  rapid: "Rapid",
  classical: "Classical",
  daily: "Daily",
  unknown: "No time control",
};

export const SOURCE_NAMES: Record<GameSource, string> = { chesscom: "Chess.com", lichess: "Lichess", other: "Other" };

/** A check box with its games under the other choices. */
export type Option = { key: string; label: string; games: number };
/** A group of check boxes: a time class with its controls, or a source with its imports. */
export type OptionGroup = { label: string; games: number; options: (Option & { note?: string })[] };

/** The seconds a control's game is expected to take, to order controls within a class. */
function controlLength(control: string | null): number {
  const clock = control && /^(\d+)\+(\d+)$/.exec(control);
  if (clock) return Number(clock[1]) + 40 * Number(clock[2]);
  const daily = control && /^1\/(\d+)$/.exec(control);
  return daily ? Number(daily[1]) : Number.MAX_SAFE_INTEGER;
}

/** The time panel: each class the games have, with its controls, shortest first. */
export function timeGroups(games: readonly HistoryGame[], filter: HistoryFilter): OptionGroup[] {
  const counts = new Map<string, { game: HistoryGame; games: number }>();
  for (const game of games) {
    const key = timeKey(game);
    const entry = counts.get(key) ?? { game, games: 0 };
    if (passes(game, filter, "time")) entry.games += 1;
    counts.set(key, entry);
  }
  return TIME_CLASSES.flatMap((timeClass) => {
    const options = [...counts]
      .filter(([, { game }]) => game.record.timeClass === timeClass)
      .sort(([, a], [, b]) => controlLength(a.game.record.timeControl) - controlLength(b.game.record.timeControl))
      .map(([key, { game, games: count }]) => ({ key, label: controlName(game.record.timeControl), games: count }));
    return options.length
      ? [{ label: CLASS_NAMES[timeClass], games: options.reduce((sum, option) => sum + option.games, 0), options }]
      : [];
  });
}

/** The sources panel: each source the games have, with the imports its games came in, newest first. */
export function sourceGroups(games: readonly HistoryGame[], imports: readonly HistoryImport[], filter: HistoryFilter): OptionGroup[] {
  const counts = new Map<string, { source: GameSource; importId: number; games: number }>();
  for (const game of games) {
    const key = sourceKey(game);
    const entry = counts.get(key) ?? { source: game.record.source, importId: game.importId, games: 0 };
    if (passes(game, filter, "source")) entry.games += 1;
    counts.set(key, entry);
  }
  const byId = new Map(imports.map((entry) => [entry.id, entry]));
  return (Object.keys(SOURCE_NAMES) as GameSource[]).flatMap((source) => {
    const options = [...counts]
      .filter(([, entry]) => entry.source === source)
      .sort(([, a], [, b]) => b.importId - a.importId)
      .map(([key, entry]) => {
        const made = byId.get(entry.importId);
        return { key, label: made ? `Imported ${shortDate(made.at)}` : "An earlier import", note: made?.name, games: entry.games };
      });
    return options.length
      ? [{ label: SOURCE_NAMES[source], games: options.reduce((sum, option) => sum + option.games, 0), options }]
      : [];
  });
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "21 Oct 2026". */
function shortDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getUTCDate()} ${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** "Mar 2025". */
export function monthName(month: string): string {
  return `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

/** Every month from the first game's to the last's, with the games in each under the other choices. */
export function monthStrip(games: readonly HistoryGame[], filter: HistoryFilter): { months: string[]; games: number[] } {
  const dated = games.flatMap((game) => monthOf(game) ?? []);
  if (!dated.length) return { months: [], games: [] };
  const first = dated.reduce((a, b) => (a < b ? a : b));
  const last = dated.reduce((a, b) => (a > b ? a : b));
  const months: string[] = [];
  for (let [year, month] = [Number(first.slice(0, 4)), Number(first.slice(5, 7))]; ; ) {
    const name = `${year}-${String(month).padStart(2, "0")}`;
    months.push(name);
    if (name >= last) break;
    [year, month] = month === 12 ? [year + 1, 1] : [year, month + 1];
  }
  const index = new Map(months.map((month, i) => [month, i]));
  const counts = new Array<number>(months.length).fill(0);
  for (const game of games) {
    const month = monthOf(game);
    if (month && passes(game, filter, "date")) counts[index.get(month)!] += 1;
  }
  return { months, games: counts };
}

/** What a group of check boxes has chosen: every option, some, or none. */
export function groupState(group: OptionGroup, off: ReadonlySet<string>): "all" | "some" | "none" {
  const left = group.options.filter((option) => off.has(option.key)).length;
  return left === 0 ? "all" : left === group.options.length ? "none" : "some";
}

/** What the time button says: "All time controls", "Blitz, Rapid 10+0", or "No time controls". */
export function timeSummary(groups: readonly OptionGroup[], off: ReadonlySet<string>): string {
  if (groups.every((group) => groupState(group, off) === "all")) return "All time controls";
  const parts = groups.flatMap((group) => {
    const state = groupState(group, off);
    if (state === "all") return [group.label];
    if (state === "none") return [];
    return group.options.filter((option) => !off.has(option.key)).map((option) => `${group.label} ${option.label}`);
  });
  return parts.length ? parts.join(", ") : "No time controls";
}

/** What the sources button says: "All sources", "Chess.com, Lichess", "2 of 5 imports", or "No sources". */
export function sourceSummary(groups: readonly OptionGroup[], off: ReadonlySet<string>): string {
  const states = groups.map((group) => groupState(group, off));
  if (states.every((state) => state === "all")) return "All sources";
  if (states.every((state) => state === "none")) return "No sources";
  if (states.every((state) => state !== "some")) return groups.filter((_, i) => states[i] === "all").map((group) => group.label).join(", ");
  const options = groups.flatMap((group) => group.options);
  return `${options.filter((option) => !off.has(option.key)).length} of ${options.length} imports`;
}

/** What the strip says: "All dates", "Since Mar 2025", or "Mar 2025 – Jun 2025". */
export function dateSummary(filter: HistoryFilter): string {
  if (!filter.from && !filter.to) return "All dates";
  if (!filter.to) return `Since ${monthName(filter.from!)}`;
  if (!filter.from) return `Until ${monthName(filter.to)}`;
  return filter.from === filter.to ? monthName(filter.from) : `${monthName(filter.from)} – ${monthName(filter.to)}`;
}
