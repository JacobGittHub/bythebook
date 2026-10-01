// Fills position_cache with master stats for every catalog position, so guests, who never
// reach Lichess, still get them. Run it locally with `npm run cache:prefill`; it reads
// .env.local. It asks Lichess for one position at a time, and it can be stopped and run
// again: positions already cached are skipped.
//
//   npm run cache:prefill                        every catalog position
//   npm run cache:prefill -- --dry-run           count what is missing, without Lichess
//   npm run cache:prefill -- --limit 200         stop after 200 Lichess calls
//   npm run cache:prefill -- --min-games 1000    also follow moves played in 1000+ games
//   npm run cache:prefill -- --delay-ms 1500     pause between Lichess calls (default 1000)
import { parseArgs } from "node:util";
import { prefillPositions } from "@/lib/chess/cachePrefill";
import { getExplorerData } from "@/lib/chess/explorerService";
import { LichessRateLimitError } from "@/lib/chess/lichessExplorer";
import { listCatalogFens } from "@/lib/chess/openingCatalog";

const PROGRESS_EVERY = 50;

function numberOption(value: string | undefined, name: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`--${name} must be a whole number, got "${value}".`);
  }
  return parsed;
}

async function main() {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      limit: { type: "string" },
      "min-games": { type: "string" },
      "delay-ms": { type: "string" },
    },
  });

  const dryRun = values["dry-run"];
  const fens = listCatalogFens();
  console.log(
    `${fens.length} catalog positions.${dryRun ? " Dry run: Lichess will not be called." : ""}`,
  );

  let visited = 0;
  const result = await prefillPositions({
    fens,
    load: (fen) => getExplorerData(fen, async () => !dryRun),
    retryAfterSeconds: (error) =>
      error instanceof LichessRateLimitError ? error.retryAfterSeconds : null,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    delayMs: numberOption(values["delay-ms"], "delay-ms") ?? 1000,
    minGames: numberOption(values["min-games"], "min-games"),
    limit: numberOption(values.limit, "limit"),
    onProgress: (counts) => {
      visited++;
      if (visited % PROGRESS_EVERY === 0) {
        console.log(
          `${visited} visited: ${counts.cached} cached, ${counts.fetched} fetched, ` +
            `${counts.missing} missing, ${counts.failed} failed, ${counts.queued} to go`,
        );
      }
    },
  });

  console.log(result);
  if (result.stopped === "failures") {
    console.error("Stopped after repeated failures. Check LICHESS_API_TOKEN and the database.");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
