import { Chess } from "chess.js";
import ecoData from "./ecoData.json";
import { START_FEN } from "@/lib/chess/fen";
import { createMoveNodeId, createRootMoveNode } from "@/lib/chess/moveTree";
import type { Move, MoveNode } from "@/types/chess";

export type EcoOpening = {
  eco: string;
  name: string;
  pgn: string;
};

export type ParsedEcoOpening = EcoOpening & {
  normalizedName: string;
  normalizedEco: string;
  normalizedPgn: string;
};

const openings = (ecoData as EcoOpening[]).map((opening) => ({
  ...opening,
  normalizedName: normalizeCatalogText(opening.name),
  normalizedEco: normalizeCatalogText(opening.eco),
  normalizedPgn: normalizeCatalogText(opening.pgn),
}));

function normalizeCatalogText(value: string): string {
  return value.trim().toLowerCase();
}

function scoreOpeningMatch(opening: ParsedEcoOpening, query: string): number {
  if (opening.normalizedEco === query) return 500;
  if (opening.normalizedName === query) return 400;
  if (opening.normalizedName.startsWith(query)) return 300;
  if (opening.normalizedEco.startsWith(query)) return 250;
  if (opening.normalizedName.includes(query)) return 200;
  if (opening.normalizedPgn.includes(query)) return 100;
  return 0;
}

export function getOpeningCatalog(): EcoOpening[] {
  return openings;
}

export function searchOpenings(query: string, maxResults = 50): EcoOpening[] {
  const normalizedQuery = normalizeCatalogText(query);
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
    .map((entry) => entry.opening);
}

export function getOpeningByEco(eco: string): EcoOpening | undefined {
  const normalizedEco = normalizeCatalogText(eco);
  return openings.find((opening) => opening.normalizedEco === normalizedEco);
}

export function getOpeningsByEco(eco: string): EcoOpening[] {
  const normalizedEco = normalizeCatalogText(eco);
  return openings.filter((opening) => opening.normalizedEco === normalizedEco);
}

export function getOpeningByName(name: string): EcoOpening | undefined {
  const normalizedName = normalizeCatalogText(name);
  return openings.find((opening) => opening.normalizedName === normalizedName);
}

export function parseEcoOpeningMoves(pgn: string, rootFen: string = START_FEN): Move[] {
  const game = new Chess(rootFen);
  game.loadPgn(pgn);

  const verboseHistory = game.history({ verbose: true });
  const replayGame = new Chess(rootFen);

  return verboseHistory.map((move) => {
    replayGame.move(move.san);

    return {
      san: move.san,
      uci: `${move.from}${move.to}${move.promotion ?? ""}`,
      fen: replayGame.fen(),
    };
  });
}

export function buildMoveTreeFromEcoOpening(
  opening: EcoOpening,
  rootFen: string = START_FEN,
): MoveNode {
  const root = createRootMoveNode(rootFen);
  const moves = parseEcoOpeningMoves(opening.pgn, rootFen);

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

export function getOpeningsStartingWithMoves(
  sanMoves: string[],
  maxResults = 50,
): EcoOpening[] {
  if (sanMoves.length === 0) {
    return [];
  }

  return openings
    .filter((opening) => {
      const openingMoves = parseEcoOpeningMoves(opening.pgn).map((move) =>
        normalizeCatalogText(move.san),
      );

      if (openingMoves.length < sanMoves.length) {
        return false;
      }

      return sanMoves.every(
        (move, index) => openingMoves[index] === normalizeCatalogText(move),
      );
    })
    .slice(0, maxResults)
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function buildCatalogMoveTree(
  selectedOpenings: EcoOpening[],
  rootFen: string = START_FEN,
): MoveNode {
  const root = createRootMoveNode(rootFen);

  for (const opening of selectedOpenings) {
    const moves = parseEcoOpeningMoves(opening.pgn, rootFen);
    let currentNode = root;

    for (const move of moves) {
      const existingChild =
        currentNode.children.find((child) => child.uci === move.uci) ?? null;

      if (existingChild) {
        currentNode = existingChild;
        continue;
      }

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
  }

  return root;
}
