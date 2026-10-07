import { describe, expect, it } from "vitest";
import { LIBRARY_ERROR_STATUS, libraryErrorFrom, libraryErrorResponse } from "./http";
import { LibraryError } from "./types";

describe("library errors over HTTP", () => {
  it("carry their code and message both ways", async () => {
    const response = libraryErrorResponse(new LibraryError("stale", "Changed elsewhere."));
    expect(response.status).toBe(LIBRARY_ERROR_STATUS.stale);
    const error = await libraryErrorFrom(response);
    expect([error.code, error.message]).toEqual(["stale", "Changed elsewhere."]);
  });

  it("report anything else as failed", async () => {
    const original = console.error;
    console.error = () => {};
    try {
      expect(libraryErrorResponse(new Error("boom")).status).toBe(500);
    } finally {
      console.error = original;
    }
    expect((await libraryErrorFrom(new Response("<html>", { status: 502 }))).code).toBe("failed");
    expect((await libraryErrorFrom(Response.json({ code: "nonsense" }))).code).toBe("failed");
  });
});
