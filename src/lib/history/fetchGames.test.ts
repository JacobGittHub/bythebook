import { describe, expect, it } from "vitest";
import { archiveMonth, chessComArchivesUrl, chessComMonthPgnUrl, lichessExportUrl } from "./fetchGames";

describe("fetch addresses", () => {
  it("builds Chess.com's archive list and month addresses", () => {
    expect(chessComArchivesUrl(" Hikaru ")).toBe("https://api.chess.com/pub/player/hikaru/games/archives");
    expect(chessComMonthPgnUrl("https://api.chess.com/pub/player/hikaru/games/2025/09")).toBe(
      "https://api.chess.com/pub/player/hikaru/games/2025/09/pgn",
    );
    expect(archiveMonth("https://api.chess.com/pub/player/hikaru/games/2025/09")).toBe("2025-09");
    expect(archiveMonth("https://api.chess.com/pub/player/hikaru")).toBeNull();
  });

  it("builds Lichess's export address with its filters", () => {
    const url = new URL(lichessExportUrl("EricRosen", { since: new Date(Date.UTC(2024, 0, 1)), max: 500, perfTypes: ["blitz", "rapid"] }));
    expect(url.origin + url.pathname).toBe("https://lichess.org/api/games/user/ericrosen");
    expect(url.searchParams.get("since")).toBe(String(Date.UTC(2024, 0, 1)));
    expect(url.searchParams.get("max")).toBe("500");
    expect(url.searchParams.get("perfType")).toBe("blitz,rapid");
    expect(url.searchParams.get("clocks")).toBe("false");
  });
});
