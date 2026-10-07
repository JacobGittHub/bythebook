// Writes the example books the book views show (`src/lib/books/examples.ts`) into
// public/books/examples/. Run it locally with `npm run books:examples`; it reads .env.local.
//
// Three ways of making a book are compared (plans/bookstore.md, Q1):
// - Wikibooks: the page titles under a section of Chess Opening Theory, credited under CC BY-SA.
// - Catalog: every named line through a position in the opening catalog (public domain).
// - Masters: grown from master statistics in `position_cache` (`src/lib/books/grow.ts`). It
//   reads the cache only and never calls Lichess, so it stops where the cache stops.
//
//   npm run books:examples                  every book
//   npm run books:examples -- --skip-masters keep the master-statistics books as they are
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  EXAMPLE_ID_PREFIX,
  exampleBookFromFile,
  parseExampleFile,
  replaySanLines,
  sanLinesOf,
  type ExampleBookFile,
  type ExampleBookIndex,
} from "@/lib/books/examples";
import { growBook, type GrowLookup, type GrowRules } from "@/lib/books/grow";
import { averageLeafDepth, countPositions, findClashes, MAX_BOOK_POSITIONS } from "@/lib/books/measures";
import { linesFromTitles, WIKIBOOKS_ROOT, wikibooksUrl } from "@/lib/books/wikibooks";
import { gameCount, normalizeCastling } from "@/lib/chess/explorerData";
import { buildMoveTreeFromLines } from "@/lib/chess/moveTree";
import { getCatalogMatchesForUciLine } from "@/lib/chess/openingCatalog";

const OUT_DIR = path.join(process.cwd(), "public", "books", "examples");
/** Wikimedia asks API clients to say who they are. */
const USER_AGENT = "ByTheBook example-book builder (https://github.com/JacobGittHub/bythebook)";
const WIKIBOOKS_API = "https://en.wikibooks.org/w/api.php";

type Common = { slug: string; name: string; color: "white" | "black"; description: string };
type Config =
  | (Common & { method: "wikibooks"; section: string })
  | (Common & { method: "catalog"; root: string[] })
  | (Common & { method: "masters" | "catalog+masters"; rules: GrowRules });

/** The master-statistics rules for the Queen's Gambit comparison books. */
const QG_MASTERS: GrowRules = {
  root: ["d4", "d5", "c4"],
  side: "white",
  minShare: 0.08,
  minGames: 100,
  maxPly: 20,
  maxPositions: MAX_BOOK_POSITIONS,
};

const BOOKS: Config[] = [
  {
    method: "wikibooks",
    slug: "queens-gambit",
    name: "Queen's Gambit",
    color: "white",
    section: "1. d4/1...d5/2. c4",
    description:
      "1.d4 d5 2.c4 and the replies Wikibooks covers: the Slav, the Queen's Gambit Declined and Accepted, the Chigorin, the Albin Countergambit and more. Both sides' alternatives are kept.",
  },
  {
    method: "wikibooks",
    slug: "italian-game",
    name: "Italian Game",
    color: "white",
    section: "1. e4/1...e5/2. Nf3/2...Nc6/3. Bc4",
    description: "1.e4 e5 2.Nf3 Nc6 3.Bc4: the Giuoco Piano, the Two Knights Defense, the Evans Gambit and their sidelines.",
  },
  {
    method: "wikibooks",
    slug: "ruy-lopez",
    name: "Ruy Lopez",
    color: "white",
    section: "1. e4/1...e5/2. Nf3/2...Nc6/3. Bb5",
    description: "1.e4 e5 2.Nf3 Nc6 3.Bb5: the Morphy Defense, the Berlin, the Schliemann and the other third moves for Black.",
  },
  {
    method: "wikibooks",
    slug: "kings-gambit",
    name: "King's Gambit",
    color: "white",
    section: "1. e4/1...e5/2. f4",
    description: "1.e4 e5 2.f4, accepted and declined.",
  },
  {
    method: "wikibooks",
    slug: "english-opening",
    name: "English Opening",
    color: "white",
    section: "1. c4",
    description: "1.c4 and Black's main replies, from the Symmetrical English to the Reversed Sicilian.",
  },
  {
    method: "wikibooks",
    slug: "french-defense",
    name: "French Defense",
    color: "black",
    section: "1. e4/1...e6",
    description: "1.e4 e6: the Advance, Exchange, Tarrasch and Winawer lines, among others.",
  },
  {
    method: "wikibooks",
    slug: "caro-kann-defense",
    name: "Caro-Kann Defense",
    color: "black",
    section: "1. e4/1...c6",
    description: "1.e4 c6: the Classical, Advance, Exchange and Panov lines, among others.",
  },
  {
    method: "wikibooks",
    slug: "sicilian-defense",
    name: "Sicilian Defense",
    color: "black",
    section: "1. e4/1...c5",
    description: "1.e4 c5 as far as Wikibooks takes it: the Open Sicilian's main systems and White's anti-Sicilians.",
  },
  {
    method: "catalog",
    slug: "queens-gambit-catalog",
    name: "Queen's Gambit (catalog lines)",
    color: "white",
    root: ["d4", "d5", "c4"],
    description:
      "Every named line through 1.d4 d5 2.c4 in the opening catalog, for comparing ways of making books. The catalog is public domain, so nothing needs crediting.",
  },
  {
    method: "masters",
    slug: "queens-gambit-masters",
    name: "Queen's Gambit (master statistics)",
    color: "white",
    rules: QG_MASTERS,
    description:
      "Grown from master games alone, for comparing ways of making books: White plays the most played move, and Black gets every common reply.",
  },
  {
    method: "catalog+masters",
    slug: "queens-gambit-catalog-masters",
    name: "Queen's Gambit (catalog + masters)",
    color: "white",
    rules: { ...QG_MASTERS, maxPly: 16 },
    description:
      "The catalog's named lines through 1.d4 d5 2.c4, with Black's common replies they lack and each line carried on from master games, for comparing ways of making books.",
  },
];

async function wikibooksTitles(section: string): Promise<string[]> {
  const titles: string[] = [];
  let next: string | undefined;
  do {
    const url = new URL(WIKIBOOKS_API);
    url.search = new URLSearchParams({
      action: "query",
      list: "allpages",
      apprefix: `${WIKIBOOKS_ROOT}/${section}`,
      aplimit: "max",
      format: "json",
      ...(next ? { apcontinue: next } : {}),
    }).toString();
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) throw new Error(`Wikibooks answered ${response.status} for ${section}.`);
    const body = (await response.json()) as {
      query: { allpages: { title: string }[] };
      continue?: { apcontinue: string };
    };
    titles.push(...body.query.allpages.map((page) => page.title));
    next = body.continue?.apcontinue;
  } while (next);
  // The prefix also matches siblings that start with the same text ("1. c4" and "1. c45").
  const own = `${WIKIBOOKS_ROOT}/${section}`;
  return titles.filter((title) => title === own || title.startsWith(`${own}/`));
}

/** The UCI moves of a SAN line from the starting position. */
function uciOf(sans: readonly string[]): string[] {
  return replaySanLines([sans.join(" ")]).lines[0].map((move) => move.uci);
}

function catalogLines(root: readonly string[]): string[] {
  const lines = getCatalogMatchesForUciLine(uciOf(root), Infinity).map((match) => match.moves.map((move) => move.san).join(" "));
  // One line per leaf: a named line that another one extends is inside it.
  return sanLinesOf(buildMoveTreeFromLines(replaySanLines(lines).lines));
}

const cacheLookup: GrowLookup = async (fen) => {
  // Imported here, so a run with --skip-masters needs no database settings.
  const { getCachedPosition } = await import("@/lib/db/positionCache");
  const cached = await getCachedPosition(fen);
  if (!cached) return null;
  const data = normalizeCastling(cached);
  const moves = data.moves.map((move) => ({ uci: move.uci, games: gameCount(move) }));
  const listed = moves.reduce((sum, move) => sum + move.games, 0);
  return { moves, total: data.totals ? Math.max(gameCount(data.totals), listed) : listed };
};

function rulesText(rules: GrowRules, seeded: boolean): string {
  return [
    `From ${rules.root.join(" ")}`,
    seeded ? "and every catalog line through it" : null,
    `${rules.side === "white" ? "White" : "Black"} plays the most played move`,
    `the other side every reply played in at least ${Math.round(rules.minShare * 100)}% and ${rules.minGames} of the position's master games`,
    `to ply ${rules.maxPly}, at most ${rules.maxPositions} positions, from position_cache only`,
  ]
    .filter(Boolean)
    .join("; ");
}

async function build(config: Config, today: string): Promise<ExampleBookFile> {
  const base = {
    version: 1 as const,
    id: `${EXAMPLE_ID_PREFIX}${config.slug}`,
    name: config.name,
    color: config.color,
    description: config.description,
  };
  if (config.method === "wikibooks") {
    const titles = await wikibooksTitles(config.section);
    const { lines, skipped } = linesFromTitles(titles);
    const title = `${WIKIBOOKS_ROOT}/${config.section}`;
    return {
      ...base,
      method: "wikibooks",
      attribution: {
        title,
        url: wikibooksUrl(title),
        author: "Wikibooks contributors",
        license: "CC BY-SA 4.0",
        licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
        retrieved: today,
        changes:
          `Made from the titles of the ${titles.length} pages in this section, turned into a move tree; the pages' text isn't used.` +
          (skipped.length ? ` ${skipped.length} title${skipped.length > 1 ? "s" : ""} that don't name legal moves were left out.` : ""),
      },
      rules: `Every page title under ${title} on ${today}`,
      lines,
    };
  }
  if (config.method === "catalog") {
    return {
      ...base,
      method: "catalog",
      attribution: null,
      rules: `Every line in the opening catalog (lichess-org/chess-openings) that starts ${config.root.join(" ")}`,
      lines: catalogLines(config.root),
    };
  }
  const seeded = config.method === "catalog+masters";
  const result = await growBook(
    { ...config.rules, seedLines: seeded ? catalogLines(config.rules.root) : undefined },
    cacheLookup,
  );
  console.log(
    `  ${config.slug}: ${result.unknown} positions had no cached numbers${result.full ? "; stopped at the position limit" : ""}`,
  );
  return {
    ...base,
    method: config.method,
    attribution: null,
    rules: rulesText(config.rules, seeded),
    lines: result.lines,
  };
}

function readExisting(file: string): ExampleBookFile | null {
  try {
    return parseExampleFile(JSON.parse(readFileSync(path.join(OUT_DIR, file), "utf8")));
  } catch {
    return null;
  }
}

async function main() {
  const { values } = parseArgs({ options: { "skip-masters": { type: "boolean", default: false } } });
  // The local date, which is the day the user ran it.
  const today = new Date().toLocaleDateString("en-CA");
  mkdirSync(OUT_DIR, { recursive: true });
  const index: ExampleBookIndex = { version: 1, books: [] };

  for (const config of BOOKS) {
    const fileName = `${config.slug}.json`;
    const skip = values["skip-masters"] && (config.method === "masters" || config.method === "catalog+masters");
    const file = skip ? readExisting(fileName) : await build(config, today);
    if (!file) {
      console.log(`  ${config.slug}: skipped, and there is no earlier file to keep`);
      continue;
    }
    const book = exampleBookFromFile(file);
    const positions = countPositions([book.moveNode]);
    if (positions > MAX_BOOK_POSITIONS) throw new Error(`${config.slug} has ${positions} positions.`);
    if (!skip) writeFileSync(path.join(OUT_DIR, fileName), `${JSON.stringify(file, null, 1)}\n`);
    index.books.push({ id: file.id, name: file.name, color: file.color, method: file.method, positions, file: fileName });
    const depth = averageLeafDepth([book.moveNode]);
    console.log(
      [
        config.slug.padEnd(30),
        `${positions} positions`.padEnd(15),
        `${file.lines.length} lines`.padEnd(10),
        `avg leaf ${depth?.toFixed(1) ?? "-"} plies`.padEnd(19),
        `${findClashes([book.moveNode], file.color).length} clashes`,
      ].join(" "),
    );
  }

  writeFileSync(path.join(OUT_DIR, "index.json"), `${JSON.stringify(index, null, 1)}\n`);
  console.log(`Wrote ${index.books.length} books to ${path.relative(process.cwd(), OUT_DIR)}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
