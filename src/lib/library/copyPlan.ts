// The checklist that copying browser books into an account (plans/deployment.md D22) and
// Restore (D23) share. Each incoming book is new, a name clash (kept as a second book or
// skipped), already present (the same id), or rejected with its reason; the books to write
// are worked out from the user's choices, within `MAX_LIBRARY_BOOKS`.

import { z } from "zod";
import { colorSchema } from "@/lib/validators/schemas";
import { checkBookName, copyName, nameTaken } from "./names";
import { bookOriginSchema, MAX_LIBRARY_BOOKS, type BookDraft } from "./types";
import { validateTrees } from "./validate";

/** A book that passed validation, with the id it had where it came from. */
export type IncomingBook = BookDraft & { id: string };

export type Candidate =
  | { ok: true; book: IncomingBook }
  | { ok: false; name: string; problem: "invalid" | "over_limit"; detail: string };

const incomingSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string(),
  color: colorSchema,
  origin: bookOriginSchema.default({ kind: "own" }),
  trees: z.unknown(),
});

/** Checks one incoming book, from a backup file or the browser library, as the server would. */
export function toCandidate(raw: unknown): Candidate {
  const parsed = incomingSchema.safeParse(raw);
  const rawName =
    typeof raw === "object" && raw !== null && "name" in raw && typeof raw.name === "string"
      ? raw.name.slice(0, 60)
      : "A book without a name";
  if (!parsed.success) {
    return { ok: false, name: rawName, problem: "invalid", detail: "Its details are missing or wrong." };
  }
  const name = checkBookName(parsed.data.name);
  if (!name) {
    return { ok: false, name: rawName, problem: "invalid", detail: "Its name is empty or too long." };
  }
  const result = validateTrees(parsed.data.trees);
  if (!result.ok) {
    return result.reason === "over_limit"
      ? {
          ok: false,
          name,
          problem: "over_limit",
          detail: `${result.count.toLocaleString("en-US")} positions, over the limit of ${result.limit.toLocaleString("en-US")}.`,
        }
      : { ok: false, name, problem: "invalid", detail: result.detail };
  }
  const { id, color, origin } = parsed.data;
  return { ok: true, book: { id, name, color, origin, trees: result.trees } };
}

export type PlanItem =
  | { status: "new"; book: IncomingBook }
  | { status: "name_clash"; book: IncomingBook }
  | { status: "present"; book: IncomingBook }
  | { status: "rejected"; name: string; problem: "invalid" | "over_limit"; detail: string };

/** What the receiving library already holds. */
export type ExistingBook = { id: string; name: string };

/**
 * The checklist for `candidates` arriving in a library that holds `existing`. A name clashes
 * with a book already there, or with an earlier incoming book.
 */
export function planCopy(candidates: readonly Candidate[], existing: readonly ExistingBook[]): PlanItem[] {
  const ids = new Set(existing.map((book) => book.id));
  const names = existing.map((book) => book.name);
  return candidates.map((candidate): PlanItem => {
    if (!candidate.ok) return { status: "rejected", ...candidate };
    const { book } = candidate;
    if (ids.has(book.id)) return { status: "present", book };
    ids.add(book.id);
    const clash = nameTaken(book.name, names);
    names.push(book.name);
    return { status: clash ? "name_clash" : "new", book };
  });
}

export type ClashChoice = "keep_both" | "skip";

/** What a resolved plan writes, by plan index, and what found no room. */
export type CopyWrites = {
  /** Each book to write, with the book it came from (whose id is in the library it left). */
  write: { index: number; draft: BookDraft; source: IncomingBook }[];
  /** Plan indexes that would take the library past `MAX_LIBRARY_BOOKS`. */
  noRoom: number[];
};

/**
 * The books to write once the user has chosen, in plan order. A clash is kept by default,
 * under a "(copy)" name, since skipping is the choice that can lose a book.
 */
export function resolvePlan(
  plan: readonly PlanItem[],
  choices: ReadonlyMap<number, ClashChoice>,
  existing: readonly ExistingBook[],
): CopyWrites {
  const names = existing.map((book) => book.name);
  let room = MAX_LIBRARY_BOOKS - existing.length;
  const result: CopyWrites = { write: [], noRoom: [] };
  plan.forEach((item, index) => {
    if (item.status !== "new" && item.status !== "name_clash") return;
    if (item.status === "name_clash" && (choices.get(index) ?? "keep_both") === "skip") return;
    if (room <= 0) {
      result.noRoom.push(index);
      return;
    }
    room--;
    const { name, color, origin, trees } = item.book;
    const finalName = nameTaken(name, names) ? copyName(name, names) : name;
    names.push(finalName);
    result.write.push({ index, draft: { name: finalName, color, origin, trees }, source: item.book });
  });
  return result;
}
