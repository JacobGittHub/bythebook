"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLibrary, useLibraryBooks } from "@/context/Library";
import { backupAdvice, writeBackup, type BackupAdvice } from "@/lib/library/backup";
import { browserKeepsData, browserLibrary } from "@/lib/library/browserStore";
import { libraryErrorMessage, type Library, type LibraryBook } from "@/lib/library/types";

/** Hands the browser a file to save. */
function download(text: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/** The backup notice's text (bookstore.md D12): when the library was last backed up, and why it matters. */
export function adviceText(advice: BackupAdvice): string {
  const when = advice.lastBackupAt
    ? new Date(advice.lastBackupAt).toLocaleDateString(undefined, { dateStyle: "medium" })
    : null;
  const sentences = [
    when
      ? advice.changed
        ? `Last backed up ${when}, and books have changed since.`
        : `Last backed up ${when}.`
      : "These books haven't been backed up yet.",
  ];
  if (advice.mayBeDeleted) {
    sentences.push(
      "This browser hasn't promised to keep them: some browsers, Safari among them, delete a site's data after 7 days without a visit.",
    );
  }
  sentences.push(advice.changed ? "Back up to keep a copy in a file." : "Your backup file holds them all.");
  return sentences.join(" ");
}

/**
 * Backing up the library to a file, as the Library and Settings pages offer it. `advice` is the
 * backup notice for a library kept in this browser (null for an account's), read again after
 * every change and backup; `refresh` reads it again after a change made elsewhere.
 */
export function useBackup() {
  const { store } = useLibrary();
  const { books } = useLibraryBooks();
  const [advice, setAdvice] = useState<BackupAdvice | null>(null);
  const [backingUp, setBackingUp] = useState(false);
  const [backups, setBackups] = useState(0);

  useEffect(() => {
    if (store !== "browser" || books === null) return;
    let current = true;
    Promise.all([browserLibrary.backupState(), browserKeepsData()]).then(
      ([state, kept]) => {
        if (current) setAdvice(backupAdvice(books.length, state, kept));
      },
      () => {},
    );
    return () => {
      current = false;
    };
  }, [store, books, backups]);

  /** Downloads every book in `source`: the viewer's library, or in debug mode this browser's. */
  const backUp = async (source: Library) => {
    setBackingUp(true);
    try {
      const full: LibraryBook[] = [];
      for (const entry of await source.list()) {
        const book = await source.get(entry.id);
        if (book) full.push(book);
      }
      const now = new Date();
      download(await writeBackup(full, now), `bythebook-library-${now.toISOString().slice(0, 10)}.json`);
      if (source.store === "browser") {
        await browserLibrary.recordBackup(now);
        setBackups((count) => count + 1);
      }
      toast.success(`Backed up ${full.length} ${full.length === 1 ? "book" : "books"}.`);
    } catch (caught) {
      toast.error(libraryErrorMessage(caught));
    } finally {
      setBackingUp(false);
    }
  };

  const refresh = () => setBackups((count) => count + 1);

  return { advice: store === "browser" ? advice : null, backingUp, backUp, refresh };
}
