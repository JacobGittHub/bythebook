import fs from "node:fs";
import path from "node:path";
import { test as base, expect } from "@playwright/test";
import { toPositionKey } from "@/lib/chess/fen";
import type { ExplorerResponse } from "@/types/chess";

/** Recorded explorer answers, keyed by position key (`toPositionKey`). */
const EXPLORER_FIXTURES = path.join(__dirname, "explorer.json");

/**
 * With `E2E_RECORD_EXPLORER=1`, requests go through to the real route and its answers are
 * added to the fixtures. Run it with one worker, so runs don't overwrite each other's
 * answers. As a guest the route answers from `position_cache` only, so recording never
 * reaches Lichess.
 */
const RECORDING = process.env.E2E_RECORD_EXPLORER === "1";

type Fixtures = Record<string, ExplorerResponse>;

function readFixtures(): Fixtures {
  try {
    return JSON.parse(fs.readFileSync(EXPLORER_FIXTURES, "utf8")) as Fixtures;
  } catch {
    return {};
  }
}

function writeFixtures(added: Fixtures) {
  const all = { ...readFixtures(), ...added };
  const sorted = Object.fromEntries(Object.entries(all).sort(([a], [b]) => (a < b ? -1 : 1)));
  fs.writeFileSync(EXPLORER_FIXTURES, `${JSON.stringify(sorted, null, 1)}\n`);
}

/**
 * Every spec imports `test` from here. It answers `/api/openings/explorer` from the
 * recorded fixtures, so tests never depend on the cache or on Lichess, and a position that
 * isn't recorded gets the guest's cache-miss answer, a 404.
 */
export const test = base.extend<{ explorerFixtures: void }>({
  explorerFixtures: [
    async ({ page }, use) => {
      const fixtures = readFixtures();
      const recorded: Fixtures = {};

      await page.route("**/api/openings/explorer", async (route) => {
        const { fen } = route.request().postDataJSON() as { fen: string };
        const key = toPositionKey(fen);

        if (RECORDING) {
          const response = await route.fetch();
          if (response.ok()) {
            const body = (await response.json()) as ExplorerResponse;
            recorded[key] = {
              moves: body.moves,
              opening: body.opening,
              totals: body.totals,
              movesLimit: body.movesLimit,
            };
          }
          await route.fulfill({ response });
          return;
        }

        const answer = fixtures[key];
        if (answer) await route.fulfill({ json: { fen, cached: true, ...answer } });
        else await route.fulfill({ status: 404, json: { error: "Not in the test fixtures." } });
      });

      await use();
      // A test can end while the page is still asking for positions.
      await page.unrouteAll({ behavior: "ignoreErrors" });

      if (RECORDING && Object.keys(recorded).length > 0) writeFixtures(recorded);
    },
    { auto: true },
  ],
});

export { expect };
