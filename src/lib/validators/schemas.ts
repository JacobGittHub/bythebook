import { z } from "zod";
import { isValidFen, normalizeFen } from "@/lib/chess/fen";
import { cleanBookName, MAX_BOOK_NAME } from "@/lib/library/names";
import { bookOriginSchema } from "@/lib/library/types";

export const colorSchema = z.enum(["white", "black"]);

export const moveSchema = z.object({
  san: z.string().trim().min(1),
  uci: z.string().trim().min(1),
  fen: z.string().trim().optional(),
});

export const sessionInputSchema = z.object({
  bookId: z.string().uuid().nullable().optional(),
  result: z.enum(["pass", "fail", "abandoned"]),
  movesPlayed: z.array(z.string()).default([]),
  correctMoves: z.number().int().nonnegative().optional(),
  totalMoves: z.number().int().nonnegative().optional(),
  durationSeconds: z.number().int().nonnegative().optional(),
});

export const userPreferencesSchema = z.object({
  boardTheme: z.enum(["classic", "blue", "green"]).optional(),
  autoFlipForBlack: z.boolean().optional(),
  showEngine: z.boolean().optional(),
});

// A malformed FEN is refused here, so it never reaches the cache or Lichess.
export const explorerQuerySchema = z.object({
  fen: z
    .string()
    .optional()
    .transform((value) => normalizeFen(value ?? "startpos"))
    .refine(isValidFen, "Invalid FEN."),
});

export const explorerBodySchema = z.object({
  fen: z
    .string()
    .transform((value) => normalizeFen(value))
    .refine(isValidFen, "Invalid FEN."),
});

export const credentialsInputSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});

// An invite or reset code as typed. `hashAccessCode` normalizes it, so its format isn't
// checked here: a code that is wrong in any way simply matches no row.
const accessCodeSchema = z.string().trim().min(1).max(100);

/** What a new username may be: 3 to 24 letters, digits, "_" or "-". */
export const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,24}$/;

// Letters, digits, "_" and "-" only, so a name can't hold an email or imitate the verified
// mark (plans/bookstore.md, D8 and Q3). Unique without regard to case, in the database.
export const usernameSchema = z.string().trim().regex(USERNAME_PATTERN);

export const registerInputSchema = z.object({
  username: usernameSchema,
  email: z.string().trim().email(),
  password: z.string().min(8),
  code: accessCodeSchema,
});

export const resetPasswordInputSchema = z.object({
  code: accessCodeSchema,
  password: z.string().min(8),
});

// A book's name, trimmed, at most `MAX_BOOK_NAME` characters (plans/bookstore.md D8).
export const bookNameSchema = z
  .string()
  .transform(cleanBookName)
  .pipe(z.string().min(1).max(MAX_BOOK_NAME));

// A book's trees are checked by `validateTrees` (src/lib/library/validate.ts), which replays
// every move, so the schemas here only pass them along.
export const createBookSchema = z.object({
  name: bookNameSchema,
  color: colorSchema,
  origin: bookOriginSchema.default({ kind: "own" }),
  trees: z.unknown(),
});

export const patchBookSchema = z
  .object({
    name: bookNameSchema.optional(),
    color: colorSchema.optional(),
    trees: z.unknown().optional(),
    /** The `updatedAt` the client read; a book changed since then is refused with 409. */
    expectedUpdatedAt: z.string().min(1),
  })
  .refine(
    (patch) => patch.name !== undefined || patch.color !== undefined || patch.trees !== undefined,
    "Nothing to change.",
  );

export const schemas = {
  createBook: createBookSchema,
  patchBook: patchBookSchema,
  session: sessionInputSchema,
  userPreferences: userPreferencesSchema,
  explorerQuery: explorerQuerySchema,
  explorerBody: explorerBodySchema,
  credentials: credentialsInputSchema,
  register: registerInputSchema,
  resetPassword: resetPasswordInputSchema,
};
