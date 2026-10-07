// Book names (plans/bookstore.md D8: at most 30 characters). Names needn't be unique in a
// library; a duplicate, or a copy kept beside a book of the same name, gets "(copy)".

/** The longest a book's name may be. */
export const MAX_BOOK_NAME = 30;

/** A name as typed, trimmed, with runs of spaces made one. */
export function cleanBookName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/** The cleaned name, or null when it is empty or too long. */
export function checkBookName(raw: string): string | null {
  const name = cleanBookName(raw);
  return name.length >= 1 && name.length <= MAX_BOOK_NAME ? name : null;
}

/** A name from elsewhere, such as an example book's, cut to fit with an ellipsis if it is too long. */
export function fitBookName(raw: string): string {
  const name = cleanBookName(raw);
  return name.length <= MAX_BOOK_NAME ? name : `${name.slice(0, MAX_BOOK_NAME - 1).trimEnd()}…`;
}

const sameName = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

/** True when a library already has this name, ignoring case. */
export function nameTaken(name: string, taken: Iterable<string>): boolean {
  for (const other of taken) if (sameName(other, name)) return true;
  return false;
}

/**
 * The name for a copy of a book: "X (copy)", then "X (copy 2)" and on, the first that no
 * book in `taken` has. The original part is shortened so the whole stays within the limit.
 */
export function copyName(name: string, taken: Iterable<string>): string {
  const names = [...taken];
  const base = cleanBookName(name.replace(/ \(copy(?: \d+)?\)$/, ""));
  for (let n = 1; ; n++) {
    const suffix = n === 1 ? " (copy)" : ` (copy ${n})`;
    const candidate = base.slice(0, MAX_BOOK_NAME - suffix.length).trimEnd() + suffix;
    if (!nameTaken(candidate, names)) return candidate;
  }
}
