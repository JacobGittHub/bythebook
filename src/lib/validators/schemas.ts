import { z } from "zod";
import { normalizeFen } from "@/lib/chess/fen";

export const colorSchema = z.enum(["white", "black"]);

export const moveSchema = z.object({
  san: z.string().trim().min(1),
  uci: z.string().trim().min(1),
  fen: z.string().trim().optional(),
});

export const openingBookInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  color: colorSchema,
  moveNode: z.unknown().optional(),
  isPublic: z.boolean().optional(),
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

export const explorerQuerySchema = z.object({
  fen: z
    .string()
    .optional()
    .transform((value) => normalizeFen(value ?? "startpos")),
});

export const explorerBodySchema = z.object({
  fen: z.string().transform((value) => normalizeFen(value)),
});

export const credentialsInputSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});

export const registerInputSchema = z.object({
  username: z.string().trim().min(1).max(50),
  email: z.string().trim().email(),
  password: z.string().min(8),
});

export const updateBookTreeSchema = z.object({
  moveNode: z.unknown(),
});

export const schemas = {
  openingBook: openingBookInputSchema,
  session: sessionInputSchema,
  userPreferences: userPreferencesSchema,
  explorerQuery: explorerQuerySchema,
  explorerBody: explorerBodySchema,
  credentials: credentialsInputSchema,
  register: registerInputSchema,
};
