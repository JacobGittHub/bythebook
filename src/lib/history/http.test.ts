import { describe, expect, it, vi } from "vitest";
import { HISTORY_ERROR_STATUS, historyErrorFrom, historyErrorResponse } from "./http";
import { HistoryError } from "./types";

describe("history errors over HTTP", () => {
  it("carry their code and message both ways", async () => {
    const response = historyErrorResponse(new HistoryError("stale", "Changed elsewhere."));
    expect(response.status).toBe(HISTORY_ERROR_STATUS.stale);
    const error = await historyErrorFrom(response);
    expect([error.code, error.message]).toEqual(["stale", "Changed elsewhere."]);
  });

  it("report anything else as failed", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(historyErrorResponse(new Error("boom")).status).toBe(500);
    } finally {
      quiet.mockRestore();
    }
    expect((await historyErrorFrom(new Response("<html>", { status: 502 }))).code).toBe("failed");
    expect((await historyErrorFrom(Response.json({ code: "nonsense" }))).code).toBe("failed");
  });
});
