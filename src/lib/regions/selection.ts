import { EXPLORER_MOVES_LIMIT, gameCount } from "@/lib/chess/explorerData";
import type { ExplorerMove, ExplorerTotals } from "@/types/chess";

/** The first tier's cut-offs, set in the sidebar. Later tiers derive from them. */
export type TopSettings = { p: number; k: number };

export const DEFAULT_TOP_SETTINGS: TopSettings = { p: 0.9, k: 8 };

/** Levels a blob can show, counting its own. After the last, the remaining "Other" is sealed. */
export const TIER_COUNT = 3;

/** Tier 2's cap on moves shown in all. Tier 3's is everything the explorer returns. */
export const TIER_2_K = 15;

/**
 * Cumulative cut-offs for a tier (1-based). Each tier covers share p of what the one before
 * left over, so p = 0.9 gives 0.9, 0.99 and 0.999. k counts every move shown so far.
 */
export function tierLimits(tier: number, top: TopSettings) {
  const p = 1 - Math.pow(1 - top.p, tier);
  if (tier <= 1) return { p, k: top.k };
  return { p, k: Math.max(top.k, tier === 2 ? TIER_2_K : EXPLORER_MOVES_LIMIT) };
}

/** Most games first, ties by UCI. Plain comparison, not locale-aware, so every machine agrees. */
export function byGamesThenUci(a: ExplorerMove, b: ExplorerMove) {
  const diff = gameCount(b) - gameCount(a);
  if (diff !== 0) return diff;
  return a.uci < b.uci ? -1 : a.uci > b.uci ? 1 : 0;
}

export type SelectionLevel = {
  /** Moves first shown at this level, most games first. */
  moves: ExplorerMove[];
  /** Games left for this level's "Other": everything not shown at this level or above. */
  otherGames: number;
};

export type Selection = {
  /** Games in the position: the explorer totals, or the listed moves' sum for old cache rows. */
  total: number;
  /** Level 0 is laid out in the blob itself; level i + 1 inside level i's "Other". */
  levels: SelectionLevel[];
  /** Whether opening the last level's "Other" would show more moves. */
  canOpenOther: boolean;
};

/**
 * Chooses which moves get their own blob. Each level adds the fewest further moves that bring
 * the shown share of games up to its tier's p, without the shown count passing its k. Every
 * level shows at least one move while any are left, so opening "Other" always reveals
 * something. Forced moves (pins, and moves on the path to one) appear at their given level
 * whatever p and k say, and open every level down to it, even a level left with nothing but
 * its "Other".
 */
export function selectChildren(
  moves: readonly ExplorerMove[],
  totals: ExplorerTotals | undefined,
  openLevels: number,
  top: TopSettings,
  forced: ReadonlyMap<string, number> = new Map(),
): Selection {
  const sorted = moves.filter((m) => gameCount(m) > 0).sort(byGamesThenUci);
  const listed = sorted.reduce((sum, m) => sum + gameCount(m), 0);
  const total = Math.max(totals ? gameCount(totals) : 0, listed);

  const forcedLevel = new Map<string, number>();
  for (const m of sorted) {
    const level = forced.get(m.uci);
    if (level !== undefined) forcedLevel.set(m.uci, Math.min(Math.max(0, level), TIER_COUNT - 1));
  }

  let levelCount = Math.min(Math.max(1, openLevels), TIER_COUNT);
  for (const level of forcedLevel.values()) levelCount = Math.max(levelCount, level + 1);

  const shown = new Set<string>();
  let shownGames = 0;
  const levels: SelectionLevel[] = [];

  for (let level = 0; level < levelCount; level++) {
    // Nothing left to show: no empty level nested inside "Other".
    if (level > 0 && sorted.every((m) => shown.has(m.uci))) break;

    const { p, k } = tierLimits(level + 1, top);
    const picked: ExplorerMove[] = [];
    const take = (m: ExplorerMove) => {
      picked.push(m);
      shown.add(m.uci);
      shownGames += gameCount(m);
    };

    for (const m of sorted) {
      if (forcedLevel.get(m.uci) === level) take(m);
    }
    for (const m of sorted) {
      // A move forced to a later level waits for it.
      if (shown.has(m.uci) || forcedLevel.has(m.uci)) continue;
      if (picked.length > 0 && (shown.size >= k || shownGames >= p * total)) break;
      take(m);
    }

    levels.push({ moves: picked.sort(byGamesThenUci), otherGames: total - shownGames });
  }

  return {
    total,
    levels,
    canOpenOther: levelCount < TIER_COUNT && sorted.some((m) => !shown.has(m.uci)),
  };
}
