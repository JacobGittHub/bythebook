// One-time invite and reset codes (plans/deployment.md, D6 and D14). This file only makes
// and hashes codes; `src/lib/db/accessCodes.ts` stores and claims them.
import { createHash, randomInt } from "node:crypto";

/** What a code is for: creating an account, or setting a new password on one. */
export type AccessCodePurpose = "invite" | "reset";

// Letters and digits that are hard to confuse when read aloud or retyped (no 0/O, 1/I/L, U).
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const GROUPS = 4;
const GROUP_LENGTH = 5;

/** A new random code, such as `7KQ2M-XW9PD-4HRTB-N6VCE`. About 98 bits of randomness. */
export function generateAccessCode(): string {
  const groups: string[] = [];
  for (let group = 0; group < GROUPS; group++) {
    let text = "";
    for (let index = 0; index < GROUP_LENGTH; index++) {
      text += ALPHABET[randomInt(ALPHABET.length)];
    }
    groups.push(text);
  }
  return groups.join("-");
}

/** The code as stored and compared: upper case, with dashes, spaces and the like removed. */
export function normalizeAccessCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * The value kept in `access_codes.code_hash`. A plain SHA-256 is enough here because a code
 * is long and random, unlike a password.
 */
export function hashAccessCode(code: string): string {
  return createHash("sha256").update(normalizeAccessCode(code)).digest("hex");
}
