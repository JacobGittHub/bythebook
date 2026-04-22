import fs from "fs/promises";
import path from "path";
import { Chess } from "chess.js";

function normalizeCatalogText(value) {
  return value.trim().toLowerCase();
}

function normalizeFen(fen) {
  const normalized = fen.trim();

  if (!normalized || normalized === "startpos") {
    return "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  }

  return normalized;
}

function toPositionKey(fen) {
  const normalizedFen = normalizeFen(fen);
  const [board, turn = "w", castling = "-", enPassant = "-"] =
    normalizedFen.split(" ");

  return [board, turn, castling, enPassant].join(" ");
}

function buildOpeningId(opening, index) {
  return `${opening.eco}:${index}`;
}

function addToIndex(index, key, openingId) {
  if (!index.has(key)) {
    index.set(key, new Set());
  }

  index.get(key).add(openingId);
}

function buildUciPrefixKey(uciMoves) {
  return uciMoves.join("|");
}

function sortOpeningIds(ids, openingsById) {
  return [...ids].sort((leftId, rightId) => {
    const left = openingsById.get(leftId);
    const right = openingsById.get(rightId);

    if (!left || !right) {
      return leftId.localeCompare(rightId);
    }

    if (right.moves.length !== left.moves.length) {
      return right.moves.length - left.moves.length;
    }

    if (left.eco !== right.eco) {
      return left.eco.localeCompare(right.eco);
    }

    if (left.name !== right.name) {
      return left.name.localeCompare(right.name);
    }

    return left.id.localeCompare(right.id);
  });
}

function finalizeIndex(index, openingsById) {
  return Object.fromEntries(
    [...index.entries()].map(([key, ids]) => [key, sortOpeningIds(ids, openingsById)]),
  );
}

function parseOpeningMoves(pgn) {
  const rootFen = normalizeFen("startpos");
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
      positionKey: toPositionKey(replayGame.fen()),
    };
  });
}

async function buildOpeningCatalogIndex() {
  const sourcePath = path.join(process.cwd(), "src", "lib", "chess", "ecoData.json");
  const outputDir = path.join(process.cwd(), "src", "lib", "chess", "generated");
  const outputPath = path.join(outputDir, "openingCatalogIndex.json");

  const sourceText = await fs.readFile(sourcePath, "utf8");
  const openings = JSON.parse(sourceText);

  const parsedOpenings = openings.map((opening, index) => {
    const moves = parseOpeningMoves(opening.pgn);
    const finalFen =
      moves[moves.length - 1]?.fen ?? normalizeFen("startpos");

    return {
      id: buildOpeningId(opening, index),
      eco: opening.eco,
      name: opening.name,
      pgn: opening.pgn,
      normalizedEco: normalizeCatalogText(opening.eco),
      normalizedName: normalizeCatalogText(opening.name),
      normalizedPgn: normalizeCatalogText(opening.pgn),
      moves,
      finalFen,
      finalPositionKey: toPositionKey(finalFen),
    };
  });

  const openingsById = new Map(parsedOpenings.map((opening) => [opening.id, opening]));
  const byEco = new Map();
  const byUciPrefix = new Map();
  const byPositionKey = new Map();

  for (const opening of parsedOpenings) {
    addToIndex(byEco, opening.normalizedEco, opening.id);
    addToIndex(byUciPrefix, "", opening.id);
    addToIndex(byPositionKey, toPositionKey(normalizeFen("startpos")), opening.id);

    const uciMoves = [];

    for (const move of opening.moves) {
      uciMoves.push(move.uci);
      addToIndex(byUciPrefix, buildUciPrefixKey(uciMoves), opening.id);
      addToIndex(byPositionKey, move.positionKey, opening.id);
    }
  }

  const payload = {
    version: 2,
    generatedAt: new Date().toISOString(),
    sourceCount: openings.length,
    openings: parsedOpenings,
    indexes: {
      byEco: finalizeIndex(byEco, openingsById),
      byUciPrefix: finalizeIndex(byUciPrefix, openingsById),
      byPositionKey: finalizeIndex(byPositionKey, openingsById),
    },
  };

  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(
    `Wrote parsed opening catalog and lookup indexes for ${parsedOpenings.length} openings to ${outputPath}`,
  );
}

buildOpeningCatalogIndex().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
