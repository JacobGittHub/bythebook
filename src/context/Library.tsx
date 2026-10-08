"use client";

// The viewer's library (plans/deployment.md D12, D23): the browser library for a guest, the
// account's for a signed-in viewer, chosen from `useViewer()`. Pages read and save books only
// through `useLibrary()`, so they work the same for both: `useLibraryBooks()` gives them the
// shared book list (`src/lib/library/cache.ts`), and `useLibraryBook()` one book to show and
// edit.
//
// A signed-in viewer's browser may still hold books from browsing as a guest. The provider
// counts them, and `useBrowserBooksOffer()` gives the offer to copy them into the account
// (D22, `BrowserBooksOffer.tsx`); that offer is the only reason a signed-in page reads the
// browser library.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { useBugReportSection } from "@/context/BugReport";
import { useViewer } from "@/context/Viewer";
import { accountLibrary } from "@/lib/library/accountStore";
import { browserLibrary, onBrowserLibraryChange } from "@/lib/library/browserStore";
import { cachedLibrary, type CachedLibrary, type LibraryListState } from "@/lib/library/cache";
import { saveStartTree } from "@/lib/library/trees";
import type { Library, LibraryBook } from "@/lib/library/types";
import type { MoveNode } from "@/types/chess";

/** How the Library names the store it shows, so a guest's and an account's books are never confused. */
export const STORE_LABELS: Record<Library["store"], string> = {
  browser: "Kept in this browser",
  account: "Saved to your account",
};

const LibraryContext = createContext<CachedLibrary | null>(null);

/** The offer to copy this browser's books into the account (D22). */
export type BrowserBooksOffer = {
  /** How many books this browser holds; null until counted. */
  count: number | null;
  /** "Not now" was chosen in this tab's session. */
  dismissed: boolean;
  dismiss: () => void;
  /** Shows the offer again after "Not now". */
  reopen: () => void;
  /** Counts this browser's books again, after some left it, and returns the count. */
  recount: () => Promise<number>;
};

const BrowserBooksContext = createContext<BrowserBooksOffer | null>(null);

/** Where "Not now" is kept, so it lasts for the tab's session. */
const OFFER_DISMISSED_KEY = "bythebook-copy-offer-dismissed";

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(OFFER_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(dismissed: boolean) {
  try {
    if (dismissed) sessionStorage.setItem(OFFER_DISMISSED_KEY, "1");
    else sessionStorage.removeItem(OFFER_DISMISSED_KEY);
  } catch {
    // Without session storage, "Not now" lasts until the page reloads.
  }
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { signedIn } = useViewer();
  const library = useMemo(() => cachedLibrary(signedIn ? accountLibrary : browserLibrary), [signedIn]);
  const [browserBooks, setBrowserBooks] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(readDismissed);

  // A browser that can't keep books holds none to copy.
  const recount = useCallback(async () => {
    const count = await browserLibrary.list().then((books) => books.length, () => 0);
    setBrowserBooks(count);
    return count;
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    browserLibrary.list().then((books) => setBrowserBooks(books.length), () => setBrowserBooks(0));
    return onBrowserLibraryChange(() => void recount());
  }, [signedIn, recount]);

  const offer = useMemo<BrowserBooksOffer | null>(
    () =>
      signedIn
        ? {
            count: browserBooks,
            dismissed,
            dismiss: () => {
              writeDismissed(true);
              setDismissed(true);
            },
            reopen: () => {
              writeDismissed(false);
              setDismissed(false);
            },
            recount,
          }
        : null,
    [signedIn, browserBooks, dismissed, recount],
  );

  // What a bug report says about the library: which store, and how many books (D23).
  useBugReportSection(() => {
    const books = library.state().books;
    const lines: [string, string][] = [
      ["Store", STORE_LABELS[library.store]],
      ["Books", books ? String(books.length) : "not read yet"],
    ];
    if (signedIn) lines.push(["Books in this browser", browserBooks === null ? "not counted yet" : String(browserBooks)]);
    return { title: "Library", lines };
  });

  // Another tab's change to this browser's library shows here too. An account's books change
  // only through this tab or another device, which a stale save reports (`LibraryError`).
  useEffect(() => {
    if (library.store !== "browser") return;
    return onBrowserLibraryChange(() => void library.reload());
  }, [library]);

  return (
    <LibraryContext.Provider value={library}>
      <BrowserBooksContext.Provider value={offer}>{children}</BrowserBooksContext.Provider>
    </LibraryContext.Provider>
  );
}

/** The offer to copy this browser's books into the account; null for a guest. */
export function useBrowserBooksOffer(): BrowserBooksOffer | null {
  return useContext(BrowserBooksContext);
}

function useCachedLibrary(): CachedLibrary {
  const library = useContext(LibraryContext);
  if (!library) throw new Error("useLibrary needs a LibraryProvider (src/app/dashboard/layout.tsx).");
  return library;
}

/** The viewer's library, and the name of the store it keeps books in. */
export function useLibrary(): { library: Library; store: Library["store"]; label: string } {
  const library = useCachedLibrary();
  return { library, store: library.store, label: STORE_LABELS[library.store] };
}

const NOT_READ: LibraryListState = { books: null, error: null };

/** The viewer's books, newest change first, read when first asked for; `books` is null until then. */
export function useLibraryBooks(): LibraryListState & { reload: () => Promise<void> } {
  const library = useCachedLibrary();
  const state = useSyncExternalStore(library.subscribe, library.state, () => NOT_READ);
  useEffect(() => library.load(), [library]);
  return { ...state, reload: library.reload };
}

export type OpenedBookStatus = "none" | "loading" | "ready" | "missing" | "failed";

/**
 * One book with its trees, opened through the shared library: `book` is null while it loads,
 * when `bookId` is null, or when there is no such book. When the list shows the book changed
 * (another tab of this browser), it is opened again.
 */
export function useLibraryBook(bookId: string | null): {
  book: LibraryBook | null;
  status: OpenedBookStatus;
  /**
   * Saves `tree` as the book's tree from the starting position. False when the book had
   * changed elsewhere, so the current one is shown instead and nothing was saved
   * (`STALE_BOOK_MESSAGE`). Other failures throw a `LibraryError`.
   */
  saveStartTree: (tree: MoveNode) => Promise<boolean>;
} {
  const library = useCachedLibrary();
  const { books } = useSyncExternalStore(library.subscribe, library.state, () => NOT_READ);
  const listedAt = bookId ? books?.find((entry) => entry.id === bookId)?.updatedAt : undefined;
  const [opened, setOpened] = useState<{ library: CachedLibrary; id: string; book: LibraryBook | null; failed: boolean } | null>(null);

  useEffect(() => {
    if (!bookId) return;
    let current = true;
    library.get(bookId).then(
      (book) => {
        if (current) setOpened({ library, id: bookId, book, failed: false });
      },
      () => {
        if (current) setOpened({ library, id: bookId, book: null, failed: true });
      },
    );
    return () => {
      current = false;
    };
  }, [library, bookId, listedAt]);

  const mine = opened && opened.library === library && opened.id === bookId ? opened : null;
  const book = mine?.book ?? null;
  const status: OpenedBookStatus = !bookId
    ? "none"
    : !mine
      ? "loading"
      : mine.failed
        ? "failed"
        : book
          ? "ready"
          : "missing";

  const save = useCallback(
    async (tree: MoveNode) => {
      if (!book) return false;
      const result = await saveStartTree(library, book, tree);
      setOpened({ library, id: book.id, book: result.book, failed: false });
      return result.saved;
    },
    [library, book],
  );

  return { book, status, saveStartTree: save };
}
