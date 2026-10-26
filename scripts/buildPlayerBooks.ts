// Grows draft books from players' public games (plans/bookstore.md Q1): it downloads each
// player's games from Chess.com or Lichess, counts what they play from each position
// (`src/lib/books/playerGames.ts`) and grows each book with `growBook`, the player's own side
// keeping its most played moves up to a share (top p) and the other side every common reply.
// Each book has a position budget, and the fewest games a move needs (`GrowRules.minGames`)
// is the lowest that keeps the book within it, so lines end where the player's games thin out
// rather than where the budget runs out. It prints each book's measures and how much of the player's games and of master games it
// catches. With --save it writes the books as private drafts in the publishing account's
// library (D13), replacing drafts of the same name, for the user to review and rename.
//
//   npm run books:players                     build and report, saving nothing
//   npm run books:players -- --only hikaru    only the books whose slug contains "hikaru"
//   npm run books:players -- --save           also save them to the publishing account
//   npm run books:players -- --refresh        download the games again
//   npm run books:players -- --store hikaru-vs-e4-tight --store rosen-gambits-black
//                                             publish those books' drafts to the Bookstore
//
// --store grows nothing: it reads each named book's draft from the publishing account, so the
// user's edits to it are kept, and writes it as a store file in public/books/players/ (the
// example books' format, `src/lib/books/examples.ts`), then rewrites that folder's index from
// the files there. The Bookstore shows them once they are committed and deployed.
//
// Downloads are kept in --cache (the system's temp folder by default), so a rerun reads them
// from disk. A player's name in a book says whose games it was grown from; its description
// says they had no part in making it.
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import os from "node:os";
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
import { MAX_BOOK_POSITIONS, coverage, type MasterMovesLookup } from "@/lib/books/measures";
import { countPlayerMoves, gambitOf, openingOf, playerGrowLookup, playerMovesLookup } from "@/lib/books/playerGames";
import { gameCount, normalizeCastling } from "@/lib/chess/explorerData";
import { buildMoveTreeFromLines } from "@/lib/chess/moveTree";
import { archiveMonth, chessComArchivesUrl, chessComMonthPgnUrl, lichessExportUrl } from "@/lib/history/fetchGames";
import { readGames } from "@/lib/history/pgnGames";
import { readRecord } from "@/lib/history/record";
import { GAME_HISTORY_PLIES, type GameRecord } from "@/lib/history/types";
import { summarize } from "@/lib/library/summary";
import type { MoveNode } from "@/types/chess";

const USER_AGENT = "ByTheBook book builder (https://github.com/JacobGittHub/bythebook)";

type Source =
  | { site: "chesscom"; username: string; fromMonth: string }
  | { site: "lichess"; username: string; since: string; max: number };

type PlayerBook = {
  slug: string;
  name: string;
  /** The player's name as the description gives it. */
  player: string;
  source: Source;
  /** Which of the player's games the book is grown from, and how the description says so. */
  games: { keep: (record: GameRecord) => boolean; text: string };
  rules: Omit<GrowRules, "maxPositions" | "seedLines" | "minGames">;
  /** The most positions the book may have, at most `MAX_BOOK_POSITIONS`. */
  budget: number;
};

const SPEEDS = new Set(["bullet", "blitz", "rapid", "classical"]);
const live = (record: GameRecord) => SPEEDS.has(record.timeClass);
const startsWith = (prefix: string) => (record: GameRecord) => `${record.moves} `.startsWith(`${prefix} `);

const HIKARU: Source = { site: "chesscom", username: "Hikaru", fromMonth: "2023-01" };
const ROZMAN: Source = { site: "chesscom", username: "GothamChess", fromMonth: "2017-01" };
const NARODITSKY: Source = { site: "chesscom", username: "DanielNaroditsky", fromMonth: "2018-01" };
const ROSEN: Source = { site: "lichess", username: "EricRosen", since: "2021-01-01", max: 15_000 };

const hikaruVsE4 = (record: GameRecord) => live(record) && record.color === "black" && startsWith("e2e4")(record);
const hikaruElite = (record: GameRecord) =>
  live(record) && record.color === "white" && (record.opponentRating ?? 0) >= 3000;
const kid = (record: GameRecord) =>
  live(record) && record.color === "black" && (openingOf(record)?.startsWith("King's Indian Defense") ?? false);
const gambits = (side: "white" | "black") => (record: GameRecord) =>
  live(record) && record.color === side && gambitOf(record)?.by === side;

const BOOKS: PlayerBook[] = [
  ...(
    [
      ["tight", 0.5, 0.1, 300],
      ["mid", 0.8, 0.06, 600],
      ["wide", 0.95, 0.03, MAX_BOOK_POSITIONS],
    ] as const
  ).map(([scale, topP, minShare, budget]) => ({
    slug: `hikaru-vs-e4-${scale}`,
    name: `Hikaru games · vs 1.e4 · ${scale}`,
    player: "Hikaru Nakamura",
    source: HIKARU,
    games: { keep: hikaruVsE4, text: "games as Black against 1.e4" },
    rules: { root: ["e4"], side: "black" as const, minShare, maxPly: 24, topP },
    budget,
  })),
  ...(
    [
      ["tight", 0.5, 0.1, 300],
      ["wide", 0.9, 0.04, MAX_BOOK_POSITIONS],
    ] as const
  ).map(([scale, topP, minShare, budget]) => ({
    slug: `hikaru-white-${scale}`,
    name: `Hikaru games · White · ${scale}`,
    player: "Hikaru Nakamura",
    source: HIKARU,
    games: { keep: hikaruElite, text: "games as White against players rated 3000 or more" },
    rules: { root: [], side: "white" as const, minShare, maxPly: 24, topP },
    budget,
  })),
  {
    slug: "rozman-caro-kann",
    name: "Rozman games · Caro-Kann",
    player: "Levy Rozman",
    source: ROZMAN,
    games: { keep: (record) => live(record) && record.color === "black" && startsWith("e2e4 c7c6")(record), text: "Caro-Kann games" },
    rules: { root: ["e4", "c6"], side: "black", minShare: 0.06, maxPly: 24, topP: 0.7 },
    budget: 500,
  },
  ...(
    [
      ["tight", 0.5, 0.1, 300],
      ["wide", 0.9, 0.04, MAX_BOOK_POSITIONS],
    ] as const
  ).map(([scale, topP, minShare, budget]) => ({
    slug: `naroditsky-kid-${scale}`,
    name: `Naroditsky games · KID · ${scale}`,
    player: "Daniel Naroditsky",
    source: NARODITSKY,
    games: { keep: kid, text: "King's Indian games" },
    rules: { root: [], side: "black" as const, minShare, maxPly: 24, topP },
    budget,
  })),
  ...(["white", "black"] as const).map((side) => ({
    slug: `rosen-gambits-${side}`,
    name: `Rosen games · gambits · ${side === "white" ? "White" : "Black"}`,
    player: "Eric Rosen",
    source: ROSEN,
    games: { keep: gambits(side), text: `games offering a gambit as ${side === "white" ? "White" : "Black"}` },
    rules: { root: [], side, minShare: 0.05, maxPly: 24, topP: 0.85 },
    budget: 600,
  })),
];

const SITE_NAMES = { chesscom: "Chess.com", lichess: "Lichess" } as const;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A successful response, waiting a minute and trying again after a 429, as both sites ask. */
async function request(url: string, headers: Record<string, string> = {}): Promise<Response> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, ...headers } });
    if (response.status === 429) {
      console.log("    rate limited; waiting a minute");
      await wait(60_000);
      continue;
    }
    if (!response.ok) throw new Error(`${url} answered ${response.status}.`);
    return response;
  }
  throw new Error(`${url} stayed rate limited.`);
}

/**
 * Writes a PGN response to `file` as it arrives, counting its games aloud, since Lichess sends
 * a player's games at a few dozen a second. It is written beside the file and renamed when
 * whole, so a download cut short is never read as cached.
 */
async function downloadPgn(file: string, url: string, headers?: Record<string, string>): Promise<void> {
  const response = await request(url, headers);
  const part = `${file}.part`;
  writeFileSync(part, "");
  const decoder = new TextDecoder();
  let games = 0;
  let told = 0;
  for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
    const text = decoder.decode(chunk, { stream: true });
    appendFileSync(part, text);
    games += text.match(/^\[Event /gm)?.length ?? 0;
    if (games - told >= 1_000) {
      told = games;
      console.log(`    ${games} games so far`);
    }
  }
  appendFileSync(part, decoder.decode());
  renameSync(part, file);
}

/** The source's games as PGN files, downloaded once into the cache. */
async function pgnFiles(source: Source, cache: string, refresh: boolean): Promise<string[]> {
  const dir = path.join(cache, `${source.site}-${source.username.toLowerCase()}`);
  mkdirSync(dir, { recursive: true });
  const fetchOnce = async (file: string, url: string, headers?: Record<string, string>) => {
    const full = path.join(dir, file);
    if (refresh || !existsSync(full)) await downloadPgn(full, url, headers);
    return full;
  };

  if (source.site === "lichess") {
    const token = process.env.LICHESS_API_TOKEN;
    console.log(`  ${source.username} on Lichess: up to ${source.max} games since ${source.since} (a few minutes)`);
    const url = lichessExportUrl(source.username, {
      since: new Date(`${source.since}T00:00:00Z`),
      max: source.max,
      perfTypes: [...SPEEDS],
    });
    return [
      await fetchOnce(`since-${source.since}-max-${source.max}.pgn`, url, {
        Accept: "application/x-chess-pgn",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }),
    ];
  }

  const { archives } = (await (await request(chessComArchivesUrl(source.username))).json()) as { archives: string[] };
  const months = archives.filter((url) => (archiveMonth(url) ?? "") >= source.fromMonth);
  console.log(`  ${source.username} on Chess.com: ${months.length} months from ${source.fromMonth}`);
  const files: string[] = [];
  for (const url of months) files.push(await fetchOnce(`${archiveMonth(url)}.pgn`, chessComMonthPgnUrl(url)));
  return files;
}

/** The source's games as records, read from its PGN once and kept beside it. */
async function recordsOf(source: Source, cache: string, refresh: boolean): Promise<GameRecord[]> {
  const kept = path.join(
    cache,
    `${source.site}-${source.username.toLowerCase()}`,
    source.site === "lichess" ? `records-${source.since}-${source.max}.json` : `records-${source.fromMonth}.json`,
  );
  if (!refresh && existsSync(kept)) return JSON.parse(readFileSync(kept, "utf8")) as GameRecord[];
  const records: GameRecord[] = [];
  for (const file of await pgnFiles(source, cache, refresh)) {
    const { games } = readGames(readFileSync(file, "utf8"), { plies: GAME_HISTORY_PLIES });
    for (const game of games) {
      const read = await readRecord(game, source.username);
      if (read.ok) records.push(read.record);
    }
  }
  writeFileSync(kept, JSON.stringify(records));
  return records;
}

/**
 * Grows the book with the fewest games per move that keeps it within its budget, found by
 * halving: fewer games per move only ever adds positions.
 */
async function fitBook(book: PlayerBook, lookup: GrowLookup, games: number) {
  const grow = (minGames: number) => growBook({ ...book.rules, minGames, maxPositions: book.budget }, lookup);
  let [low, high] = [2, Math.max(2, games)];
  let best = await grow(high);
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const result = await grow(middle);
    if (result.full) low = middle + 1;
    else [high, best] = [middle, result];
  }
  return { result: best.full ? await grow(high) : best, minGames: high };
}

/** Master moves from `position_cache`, read once per position. */
function masterLookup(): { lookup: (trees: MoveNode[]) => Promise<MasterMovesLookup> } {
  const known = new Map<string, { uci: string; games: number }[] | null>();
  return {
    // `coverage` asks synchronously, so every position of the book is read first.
    async lookup(trees) {
      const { getCachedPosition } = await import("@/lib/db/positionCache");
      const { toPositionKey } = await import("@/lib/chess/fen");
      const visit = async (node: MoveNode) => {
        const key = toPositionKey(node.fen);
        if (!known.has(key)) {
          const cached = await getCachedPosition(node.fen);
          known.set(
            key,
            cached ? normalizeCastling(cached).moves.map((move) => ({ uci: move.uci, games: gameCount(move) })) : null,
          );
        }
        for (const child of node.children) await visit(child);
      };
      for (const tree of trees) await visit(tree);
      return (positionKey) => known.get(positionKey) ?? null;
    },
  };
}

/** How far the player's games follow the book, by their moves: to a leaf, and in plies on average. */
function followed(tree: MoveNode, records: readonly GameRecord[]) {
  let leaves = 0;
  let plies = 0;
  for (const record of records) {
    let node = tree;
    for (const uci of record.moves.split(" ")) {
      const next = node.children.find((child) => child.uci === uci);
      if (!next) break;
      node = next;
      plies++;
    }
    if (node.children.length === 0) leaves++;
  }
  return { toLeaf: records.length ? leaves / records.length : 0, plies: records.length ? plies / records.length : 0 };
}

const percent = (share: number) => `${Math.round(share * 100)}%`;

function describe(book: PlayerBook, records: readonly GameRecord[]): string {
  const years = records.map((record) => record.playedAt?.slice(0, 4)).filter(Boolean).sort();
  const span = years.length ? (years[0] === years.at(-1) ? years[0] : `${years[0]}–${years.at(-1)}`) : "";
  const site = SITE_NAMES[book.source.site];
  const full = `Grown by ByTheBook from ${records.length.toLocaleString("en-US")} of ${book.player}'s public ${site} ${book.games.text}, ${span}. ${book.player} had no part in making it.`;
  return full.length <= 200
    ? full
    : `Grown by ByTheBook from ${records.length.toLocaleString("en-US")} of ${book.player}'s public ${site} games, ${span}. ${book.player} had no part in making it.`;
}

/** The publishing account's id, found by `PUBLISHER_EMAIL`, which is never printed. */
async function publisherId(): Promise<string> {
  const { findUserIdByEmail } = await import("@/lib/db/users");
  const email = process.env.PUBLISHER_EMAIL;
  if (!email) throw new Error("PUBLISHER_EMAIL isn't set in .env.local.");
  const id = await findUserIdByEmail(email);
  if (!id) throw new Error("No account has PUBLISHER_EMAIL's address.");
  return id;
}

/** Where published player books are written, served at `PLAYER_BOOKS_PATH`. */
const STORE_DIR = path.join(process.cwd(), "public", "books", "players");

/** How a book was grown, in words, for its store page's "How it was made". */
function rulesText(book: PlayerBook, draftDate: string): string {
  const { root, side, topP, minShare, maxPly } = book.rules;
  return [
    `${book.player}'s ${book.games.text} on ${SITE_NAMES[book.source.site]}`,
    root.length ? `from ${root.join(" ")}` : "",
    `${side === "white" ? "White" : "Black"}'s moves kept until they made up ${percent(topP ?? 0)} of the games`,
    `the other side's replies kept when ${percent(minShare)} or more of the games played them`,
    `at most ${book.budget} positions and ${maxPly} plies`,
    `published from the draft of ${draftDate}`,
  ]
    .filter(Boolean)
    .join("; ");
}

/** Publishes the named books' drafts as store files, then rewrites the folder's index. */
async function publish(slugs: readonly string[]) {
  const { draftByName } = await import("@/lib/db/publishing");
  const id = await publisherId();
  mkdirSync(STORE_DIR, { recursive: true });
  for (const slug of slugs) {
    const book = BOOKS.find((candidate) => candidate.slug === slug);
    if (!book) throw new Error(`No book has the slug "${slug}".`);
    const draft = await draftByName(id, book.name);
    if (!draft) throw new Error(`The publishing account has no draft named "${book.name}". Was it renamed?`);
    const file: ExampleBookFile = {
      version: 1,
      id: `${EXAMPLE_ID_PREFIX}${slug}`,
      name: draft.name,
      color: draft.color,
      description: draft.description,
      method: "player-games",
      attribution: null,
      rules: rulesText(book, draft.updatedAt.slice(0, 10)),
      lines: draft.trees.flatMap(sanLinesOf),
    };
    writeFileSync(path.join(STORE_DIR, `${slug}.json`), `${JSON.stringify(file, null, 1)}\n`);
    console.log(`  published ${draft.name} (${file.lines.length} lines)`);
  }

  const index: ExampleBookIndex = { version: 1, books: [] };
  for (const name of readdirSync(STORE_DIR).filter((name) => name.endsWith(".json") && name !== "index.json").sort()) {
    const file = parseExampleFile(JSON.parse(readFileSync(path.join(STORE_DIR, name), "utf8")));
    if (!file) throw new Error(`${name} isn't a store book file.`);
    const positions = exampleBookFromFile(file).summary.positions;
    index.books.push({ id: file.id, name: file.name, color: file.color, method: file.method, positions, file: name });
  }
  writeFileSync(path.join(STORE_DIR, "index.json"), `${JSON.stringify(index, null, 1)}\n`);
  console.log(`The Bookstore's player books: ${index.books.length}, in ${path.relative(process.cwd(), STORE_DIR)}.`);
}

async function main() {
  const { values } = parseArgs({
    options: {
      only: { type: "string" },
      save: { type: "boolean", default: false },
      store: { type: "string", multiple: true },
      refresh: { type: "boolean", default: false },
      cache: { type: "string", default: path.join(os.tmpdir(), "bythebook-player-games") },
    },
  });
  if (values.store?.length) return publish(values.store);
  const books = BOOKS.filter((book) => !values.only || book.slug.includes(values.only));
  if (!books.length) throw new Error(`No book's slug contains "${values.only}".`);

  let publisher: { id: string; names: Map<string, string> } | null = null;
  if (values.save) {
    const { bookIdsByName, usernameOf } = await import("@/lib/db/publishing");
    const id = await publisherId();
    publisher = { id, names: await bookIdsByName(id) };
    console.log(`Saving to ${(await usernameOf(id)) ?? "the publishing account"}'s library.`);
  }

  const masters = masterLookup();
  const recordsBySource = new Map<Source, GameRecord[]>();
  for (const book of books) {
    let all = recordsBySource.get(book.source);
    if (!all) {
      all = await recordsOf(book.source, values.cache, values.refresh);
      recordsBySource.set(book.source, all);
      console.log(`  read ${all.length} of ${book.source.username}'s games`);
    }
    const records = all.filter(book.games.keep);
    const counts = countPlayerMoves(records);
    const { result, minGames } = await fitBook(book, playerGrowLookup(counts), records.length);
    const tree = buildMoveTreeFromLines(replaySanLines(result.lines).lines);
    const summary = summarize([tree], book.rules.side);
    const mine = coverage([tree], book.rules.side, playerMovesLookup(counts));
    const theirs = coverage([tree], book.rules.side, await masters.lookup([tree]));
    const follow = followed(tree, records);

    console.log(`\n${book.name}  (${book.slug})`);
    console.log(
      `  ${records.length} games · ${summary.positions} positions · ${summary.lines} lines · average line ${summary.averageDepth?.toFixed(1) ?? "-"} plies, longest ${summary.maxDepth} · ${summary.clashes} clashes · moves played in ${minGames}+ games${result.full ? " · stopped at the budget" : ""}`,
    );
    console.log(
      `  the player's games: ${percent(follow.toLeaf)} reach a line's end, ${follow.plies.toFixed(1)} plies in the book on average; coverage ${mine ? percent(mine.covered) : "-"}`,
    );
    console.log(
      `  master games: ${theirs ? `${percent(theirs.covered)} covered, ${percent(theirs.escaped)} leave the book, ${percent(theirs.unknown)} past the cache` : "-"}`,
    );

    if (publisher) {
      const { saveDraft } = await import("@/lib/db/publishing");
      const draft = { name: book.name, color: book.rules.side, description: describe(book, records), trees: [tree] };
      const replaceId = publisher.names.get(book.name.toLocaleLowerCase());
      await saveDraft(publisher.id, draft, replaceId);
      console.log(`  ${replaceId ? "replaced the draft" : "saved as a new draft"}: ${draft.description}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
