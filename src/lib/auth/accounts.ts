// Creating an account from an invite code, and setting a password from a reset code
// (plans/deployment.md, D6 and D14).
import type { AccessCodePurpose } from "@/lib/auth/accessCode";
import {
  claimAccessCode,
  releaseAccessCode,
  setAccessCodeUser,
} from "@/lib/db/accessCodes";
import { createConfirmedUser, isUsernameTaken, setUserPassword } from "@/lib/db/users";

/** `bad_code`: unknown, already used, or the wrong kind. `failed`: something else went wrong, and the code was not used up. */
export type CodeOutcome = "ok" | "bad_code" | "failed";

/** Registering can also find the username taken, before any code is used. */
export type RegisterOutcome = CodeOutcome | "username_taken";

/** Claims a code. `null` means it can't be used; `"error"` means the database couldn't be asked. */
async function claim(code: string, purpose: AccessCodePurpose) {
  try {
    return await claimAccessCode(code, purpose);
  } catch (error) {
    console.error("An access code could not be checked.", error);
    return "error" as const;
  }
}

/** Gives a claimed code back after the step it paid for failed. Never throws. */
async function release(code: string) {
  try {
    await releaseAccessCode(code);
  } catch (error) {
    console.error("A claimed access code could not be released.", error);
  }
}

/**
 * Creates an account with a one-time invite code. The username is checked first, so a taken
 * name costs no code. The code is then claimed, so two people can't both register with it.
 * If the account can't be created, the code is released and can be tried again.
 */
export async function registerWithInvite(input: {
  code: string;
  email: string;
  password: string;
  username: string;
}): Promise<RegisterOutcome> {
  try {
    if (await isUsernameTaken(input.username)) return "username_taken";
  } catch (error) {
    console.error("A username could not be checked.", error);
    return "failed";
  }

  const claimed = await claim(input.code, "invite");
  if (claimed === "error") return "failed";
  if (!claimed) return "bad_code";

  let userId: string;
  try {
    userId = await createConfirmedUser(input);
  } catch (error) {
    console.error("Account creation failed after an invite code was claimed.", error);
    await release(input.code);
    // The database refuses a taken name (there is no fallback name), so someone may have
    // taken it since the check above.
    return (await isUsernameTaken(input.username).catch(() => false))
      ? "username_taken"
      : "failed";
  }

  try {
    await setAccessCodeUser(input.code, userId);
  } catch (error) {
    // The account exists and the code is spent; only the record of who used it is missing.
    console.error("An invite code was not linked to the account it created.", error);
  }
  return "ok";
}

/** Sets a new password on the account a one-time reset code was made for. */
export async function resetPasswordWithCode(input: {
  code: string;
  password: string;
}): Promise<CodeOutcome> {
  const claimed = await claim(input.code, "reset");
  if (claimed === "error") return "failed";
  if (!claimed?.userId) return "bad_code";

  try {
    await setUserPassword(claimed.userId, input.password);
  } catch (error) {
    console.error("Setting a password failed after a reset code was claimed.", error);
    await release(input.code);
    return "failed";
  }
  return "ok";
}
