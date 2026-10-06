import { describe, expect, it } from "vitest";
import { canDebug } from "./debug";
import type { Viewer } from "./viewer";

const guest: Viewer = { signedIn: false };
const tester: Viewer = {
  signedIn: true,
  userId: "user-1",
  displayName: "tester",
  email: "Tester@Example.com",
};
const other: Viewer = { ...tester, userId: "user-2", email: "other@example.com" };

describe("canDebug", () => {
  it("is off for everyone unless the flag says true", () => {
    for (const DEBUG_MODE of [undefined, "", "false", "1", "yes"]) {
      for (const NODE_ENV of ["development", "production"]) {
        expect(canDebug(tester, { DEBUG_MODE, DEBUG_EMAILS: "tester@example.com", NODE_ENV })).toBe(false);
      }
    }
  });

  it("is on for everyone under next dev, guests included", () => {
    const env = { DEBUG_MODE: "true", NODE_ENV: "development" };
    expect(canDebug(guest, env)).toBe(true);
    expect(canDebug(other, env)).toBe(true);
  });

  it("deployed, is on only for signed-in accounts on the list", () => {
    const env = { DEBUG_MODE: "TRUE", DEBUG_EMAILS: " someone@x.org , tester@example.com", NODE_ENV: "production" };
    expect(canDebug(tester, env)).toBe(true);
    expect(canDebug(other, env)).toBe(false);
    expect(canDebug(guest, env)).toBe(false);
  });

  it("deployed, is off when the list is empty or the account has no email", () => {
    expect(canDebug(tester, { DEBUG_MODE: "true", NODE_ENV: "production" })).toBe(false);
    expect(canDebug(tester, { DEBUG_MODE: "true", DEBUG_EMAILS: ",,", NODE_ENV: "production" })).toBe(false);
    const noEmail: Viewer = { ...tester, email: null };
    expect(canDebug(noEmail, { DEBUG_MODE: "true", DEBUG_EMAILS: "tester@example.com", NODE_ENV: "production" })).toBe(false);
  });
});
