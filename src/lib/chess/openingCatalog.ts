import openingCatalogData from "./generated/openingCatalogIndex.json";
import { START_FEN, normalizeFen, toPositionKey } from "@/lib/chess/fen";
import {
  createMoveNodeId,
  createRootMoveNode,
  mergeMoveLineIntoTree,
} from "@/lib/chess/moveTree";
import type {
  CatalogMatch,
  GeneratedCatalogOpening,
  GeneratedOpeningCatalog,
  Move,
  MoveNode,
} from "@/types/chess";

export type EcoOpening = {
  eco: string;
  name: string;
  pgn: string;
};

const catalog = openingCatalogData as GeneratedOpeningCatalog;
const openings = catalog.openings;
const openingById = new Map(openings.map((opening) => [opening.id, opening]));
const catalogMatchCache = new Map<string, CatalogMatch>();
const moveTreeCache = new Map<string, MoveNode>();
const startPositionKey = toPositionKey(START_FEN);

function scoreOpeningMatch(opening: GeneratedCatalogOpening, query: string): number {
  if (opening.normalizedEco === query) return 500;
  if (opening.normalizedName === query) return 400;
  if (opening.normalizedName.startsWith(query)) return 300;
  if (opening.normalizedEco.startsWith(query)) return 250;
  if (opening.normalizedName.includes(query)) return 200;
  if (opening.normalizedPgn.includes(query)) return 100;
  return 0;
}

function buildMoveTreeFromMoves(moves: Move[], rootFen: string = START_FEN): MoveNode {
  const root = createRootMoveNode(rootFen);
  let currentNode = root;

  for (const move of moves) {
    const childNode: MoveNode = {
      id: createMoveNodeId(currentNode.id, move.uci),
      san: move.san,
      uci: move.uci,
      fen: move.fen ?? currentNode.fen,
      children: [],
    };

    currentNode.children.push(childNode);
    currentNode = childNode;
  }

  return root;
}

function openingToEcoOpening(opening: GeneratedCatalogOpening): EcoOpening {
  return {
    eco: opening.eco,
    name: opening.name,
    pgn: opening.pgn,
  };
}

function getOpeningById(id: string): GeneratedCatalogOpening | undefined {
  return openingById.get(id);
}

function getOpeningIdsForPrefix(uciMoves: string[]): string[] {
  const key = uciMoves.join("|");
  return catalog.indexes.byUciPrefix[key] ?? [];
}

function getOpeningIdsForEco(eco: string): string[] {
  return catalog.indexes.byEco[eco.trim().toLowerCase()] ?? [];
}

function getOpeningIdsForPositionKey(positionKey: string): string[] {
  return catalog.indexes.byPositionKey[positionKey] ?? [];
}

function buildCatalogMatch(opening: GeneratedCatalogOpening): CatalogMatch {
  const cachedMatch = catalogMatchCache.get(opening.id);
  if (cachedMatch) {
    return cachedMatch;
  }

  const cachedMoveTree = moveTreeCache.get(opening.id);
  const moves: Move[] = opening.moves.map((move) => ({
    san: move.san,
    uci: move.uci,
    fen: move.fen,
  }));
  const match: CatalogMatch = {
    eco: opening.eco,
    name: opening.name,
    pgn: opening.pgn,
    moves,
    moveNode: cachedMoveTree ?? buildMoveTreeFromMoves(moves),
  };

  moveTreeCache.set(opening.id, match.moveNode);
  catalogMatchCache.set(opening.id, match);

  return match;
}

function hydrateMatches(ids: string[], maxResults = ids.length): CatalogMatch[] {
  return ids
    .slice(0, maxResults)
    .map((id) => getOpeningById(id))
    .filter((opening): opening is GeneratedCatalogOpening => Boolean(opening))
    .map(buildCatalogMatch);
}

export function getOpeningCatalog(): EcoOpening[] {
  return openings.map(openingToEcoOpening);
}

export function searchOpenings(query: string, maxResults = 50): EcoOpening[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  return openings
    .map((opening) => ({
      opening,
      score: scoreOpeningMatch(opening, normalizedQuery),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.opening.name.localeCompare(right.opening.name);
    })
    .slice(0, maxResults)
    .map((entry) => openingToEcoOpening(entry.opening));
}

export function getOpeningByEco(eco: string): EcoOpening | undefined {
  return getOpeningsByEco(eco)[0];
}

export function getOpeningsByEco(eco: string): EcoOpening[] {
  return getOpeningIdsForEco(eco)
    .map((id) => getOpeningById(id))
    .filter((opening): opening is GeneratedCatalogOpening => Boolean(opening))
    .map(openingToEcoOpening);
}

export function getOpeningByName(name: string): EcoOpening | undefined {
  const normalizedName = name.trim().toLowerCase();
  const opening = openings.find((entry) => entry.normalizedName === normalizedName);
  return opening ? openingToEcoOpening(opening) : undefined;
}

export function searchCatalogMatches(query: string, maxResults = 50): CatalogMatch[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const matchingIds = openings
    .map((opening) => ({
      id: opening.id,
      score: scoreOpeningMatch(opening, normalizedQuery),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.id.localeCompare(right.id);
    })
    .map((entry) => entry.id);

  return hydrateMatches(matchingIds, maxResults);
}

export function getCatalogMatchesForUciLine(
  uciMoves: string[],
  maxResults = 50,
): CatalogMatch[] {
  if (uciMoves.length === 0) {
    return [];
  }

  return hydrateMatches(getOpeningIdsForPrefix(uciMoves), maxResults);
}

export function getCatalogMatchesForFen(
  fen: string,
  maxResults = 50,
): CatalogMatch[] {
  return hydrateMatches(getOpeningIdsForPositionKey(toPositionKey(fen)), maxResults);
}

export function getCatalogMatchesForStartPosition(maxResults = 50): CatalogMatch[] {
  return hydrateMatches(getOpeningIdsForPositionKey(startPositionKey), maxResults);
}

export function buildCatalogPreview(
  matches: CatalogMatch[],
  rootFen: string = START_FEN,
): MoveNode {
  const root = createRootMoveNode(rootFen);

  for (const match of matches) {
    const merged = mergeMoveLineIntoTree(root, match.moves);
    root.children = merged.children;
  }

  return root;
}

// ── Default catalog tree ─────────────────────────────────────────────────────
//
// A pre-built 5-level radial tree sourced entirely from the local ECO catalog
// (no API calls). Used as the always-visible base on the dashboard.

const CATALOG_TREE_MAX_DEPTH = 5;
const CATALOG_TREE_MAX_CHILDREN = [8, 5, 4, 3, 2]; // max per depth 0..4
const CATALOG_TREE_MIN_COVERAGE = 3; // min ECO openings through a branch

let _catalogTreeCache: MoveNode | null = null; // invalidated on server restart

export function buildDefaultCatalogTree(): MoveNode {
  if (_catalogTreeCache) return _catalogTreeCache;
  const root = createRootMoveNode(START_FEN);
  _fillCatalogTreeNode(root, [], 0);
  _catalogTreeCache = root;
  return root;
}

function _fillCatalogTreeNode(node: MoveNode, uciLine: string[], depth: number): void {
  if (depth >= CATALOG_TREE_MAX_DEPTH) return;

  const candidateIds: string[] =
    depth === 0
      ? openings.map((o) => o.id)
      : (catalog.indexes.byUciPrefix[uciLine.join("|")] ?? []);

  if (candidateIds.length < CATALOG_TREE_MIN_COVERAGE) return;

  const moveCounts = new Map<string, { count: number; san: string; fen: string }>();
  for (const id of candidateIds) {
    const opening = openingById.get(id);
    if (!opening || opening.moves.length <= depth) continue;
    const move = opening.moves[depth];
    const entry = moveCounts.get(move.uci);
    if (entry) {
      entry.count++;
    } else {
      moveCounts.set(move.uci, { count: 1, san: move.san, fen: move.fen });
    }
  }

  const maxChildren = CATALOG_TREE_MAX_CHILDREN[depth] ?? 2;
  const topMoves = [...moveCounts.entries()]
    .filter(([, v]) => v.count >= CATALOG_TREE_MIN_COVERAGE)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, maxChildren);

  for (const [uci, { san, fen }] of topMoves) {
    const child: MoveNode = {
      id: createMoveNodeId(node.id, uci),
      san,
      uci,
      fen: normalizeFen(fen),
      children: [],
    };
    node.children.push(child);
    _fillCatalogTreeNode(child, [...uciLine, uci], depth + 1);
  }
}
