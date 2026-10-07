"use client";

// The viewer's library (plans/deployment.md D12, D23): the browser library for a guest, the
// account's for a signed-in viewer, chosen from `useViewer()`. Pages read and save books only
// through `useLibrary()`, so they work the same for both, and `useLibraryBooks()` gives them
// the shared book list (`src/lib/library/cache.ts`).

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useViewer } from "@/context/Viewer";
import { accountLibrary } from "@/lib/library/accountStore";
import { browserLibrary, onBrowserLibraryChange } from "@/lib/library/browserStore";
import { cachedLibrary, type CachedLibrary, type LibraryListState } from "@/lib/library/cache";
import type { Library } from "@/lib/library/types";

/** How the Library names the store it shows, so a guest's and an account's books are never confused. */
export const STORE_LABELS: Record<Library["store"], string> = {
  browser: "Kept in this browser",
  account: "Saved to your account",
};

const LibraryContext = createContext<CachedLibrary | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { signedIn } = useViewer();
  const library = useMemo(() => cachedLibrary(signedIn ? accountLibrary : browserLibrary), [signedIn]);

  // Another tab's change to this browser's library shows here too. An account's books change
  // only through this tab or another device, which a stale save reports (`LibraryError`).
  useEffect(() => {
    if (library.store !== "browser") return;
    return onBrowserLibraryChange(() => void library.reload());
  }, [library]);

  return <LibraryContext.Provider value={library}>{children}</LibraryContext.Provider>;
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
