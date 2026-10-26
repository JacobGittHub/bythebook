import { describe, expect, it } from "vitest";
import { usernameSchema } from "./schemas";

describe("usernameSchema", () => {
  it("takes letters, digits, underscores and hyphens", () => {
    expect(usernameSchema.safeParse("Magnus_Fan-99").success).toBe(true);
  });

  it("refuses the word \"verified\", which would pass for the verified mark", () => {
    for (const name of ["verified", "ByTheBook_Verified", "unverifiedfan", "VERIFIED-1"]) {
      expect(usernameSchema.safeParse(name).success, name).toBe(false);
    }
  });
});
