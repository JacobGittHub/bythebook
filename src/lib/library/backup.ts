// The library backup file, format version 1 (plans/bookstore.md D12; deployment.md D23).
// It holds every book with where it came from (D24), and a SHA-256 checksum that catches a
// damaged file. The checksum is not a signature: Restore checks every field and replays
// every move whatever the file says (`copyPlan.ts`).

import type { MoveNode } from "@/types/chess";
import { toCandidate, type Candidate } from "./copyPlan";
import type { BookOrigin, LibraryBook } from "./types";

export const BACKUP_KIND = "bythebook-library";
export const BACKUP_VERSION = 1;

/** The largest file Restore reads. A full library of full books is a few megabytes. */
export const MAX_BACKUP_BYTES = 16 * 1024 * 1024;

/** A move as the file keeps it: the UCI alone, since Restore replays every move anyway. */
type FileMove = { uci: string; children?: FileMove[] };
type FileTree = { fen: string; children?: FileMove[] };

type FileBook = {
  id: string;
  name: string;
  color: LibraryBook["color"];
  origin: BookOrigin;
  updatedAt: string;
  trees: FileTree[];
};

type FileBody = { kind: string; version: number; exportedAt: string; books: FileBook[] };

function compactMoves(node: MoveNode): FileMove[] | undefined {
  return node.children.length
    ? node.children.map((child) => ({ uci: child.uci ?? "", children: compactMoves(child) }))
    : undefined;
}

/** JSON with every object's keys sorted, so a file's checksum doesn't depend on key order. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** The backup file's text for `books`. */
export async function writeBackup(books: readonly LibraryBook[], exportedAt: Date): Promise<string> {
  const body: FileBody = {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: exportedAt.toISOString(),
    books: books.map((book) => ({
      id: book.id,
      name: book.name,
      color: book.color,
      origin: book.origin,
      updatedAt: book.updatedAt,
      trees: book.trees.map((tree) => ({ fen: tree.fen, children: compactMoves(tree) })),
    })),
  };
  return JSON.stringify({ ...body, sha256: await sha256(canonicalJson(body)) });
}

/** Why a file can't be restored at all. */
export type BackupProblem = "too_large" | "not_backup" | "newer_version" | "damaged";

export type BackupRead =
  | { ok: true; exportedAt: string; books: Candidate[] }
  | { ok: false; problem: BackupProblem };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Reads a backup file into candidates for the copy checklist. A file whose checksum doesn't
 * match is refused as damaged; otherwise each book is checked on its own, and a bad one is
 * listed with its reason while the rest restore.
 */
export async function readBackup(text: string): Promise<BackupRead> {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, problem: "too_large" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, problem: "not_backup" };
  }
  if (!isRecord(parsed) || parsed.kind !== BACKUP_KIND || typeof parsed.version !== "number") {
    return { ok: false, problem: "not_backup" };
  }
  if (parsed.version > BACKUP_VERSION) return { ok: false, problem: "newer_version" };

  const { sha256: stated, ...body } = parsed;
  if (typeof stated !== "string" || stated !== (await sha256(canonicalJson(body)))) {
    return { ok: false, problem: "damaged" };
  }
  if (!Array.isArray(body.books) || typeof body.exportedAt !== "string") {
    return { ok: false, problem: "not_backup" };
  }
  return { ok: true, exportedAt: body.exportedAt, books: body.books.map(toCandidate) };
}
