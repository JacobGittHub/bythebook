"use client";

import { useState } from "react";
import { Copy, Ellipsis, Pencil, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/shadcn/alert-dialog";
import { Button } from "@/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { useLibrary, useLibraryBooks } from "@/context/Library";
import { duplicateBook } from "@/lib/library/edit";
import { MAX_BOOK_NAME, checkBookName } from "@/lib/library/names";
import { STALE_BOOK_MESSAGE } from "@/lib/library/trees";
import { LibraryError, libraryErrorMessage, type BookPatch, type LibraryEntry } from "@/lib/library/types";

type Props = {
  book: LibraryEntry;
  /** After the book is deleted, such as going back to the list. */
  onDeleted?: () => void;
  /** After a copy is made, such as selecting it. */
  onDuplicated?: (copy: LibraryEntry) => void;
};

/**
 * A book's "⋯" menu (plans/deployment.md D25): Rename, Change side, Duplicate and Delete.
 * Combine and single-book export join it with plans/bookstore.md Phase 5.
 */
export function BookMenu({ book, onDeleted, onDuplicated }: Props) {
  const { library, store } = useLibrary();
  const { books } = useLibraryBooks();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState(book.name);
  const [busy, setBusy] = useState(false);

  /** Saves a patch against the time the list read the book, so another tab's change isn't lost. */
  const save = async (patch: BookPatch, done: string) => {
    setBusy(true);
    try {
      await library.update(book.id, patch, book.updatedAt);
      toast.success(done);
      return true;
    } catch (caught) {
      toast.error(caught instanceof LibraryError && caught.code === "stale" ? STALE_BOOK_MESSAGE : libraryErrorMessage(caught));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const rename = async (event: React.FormEvent) => {
    event.preventDefault();
    const clean = checkBookName(name);
    if (!clean) return toast.error(`A name needs 1 to ${MAX_BOOK_NAME} characters.`);
    if (clean === book.name || (await save({ name: clean }, `Renamed to ${clean}.`))) setRenaming(false);
  };

  const changeSide = () => {
    const color = book.color === "white" ? "black" : "white";
    void save({ color }, `${book.name} is now played as ${color === "white" ? "White" : "Black"}.`);
  };

  const duplicate = async () => {
    setBusy(true);
    try {
      const full = await library.get(book.id);
      if (!full) throw new LibraryError("not_found");
      const copy = await library.create(duplicateBook(full, (books ?? []).map((entry) => entry.name)));
      toast.success(`Made ${copy.name}.`);
      onDuplicated?.(copy);
    } catch (caught) {
      toast.error(libraryErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await library.remove(book.id);
      toast.success(`Deleted ${book.name}.`);
      setDeleting(false);
      onDeleted?.();
    } catch (caught) {
      // Already gone is as good as deleted.
      if (caught instanceof LibraryError && caught.code === "not_found") {
        setDeleting(false);
        onDeleted?.();
      } else {
        toast.error(libraryErrorMessage(caught));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" aria-label={`More for ${book.name}`} disabled={busy}>
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onSelect={() => {
              setName(book.name);
              setRenaming(true);
            }}
          >
            <Pencil /> Rename
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={changeSide}>
            <Repeat /> Play as {book.color === "white" ? "Black" : "White"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void duplicate()}>
            <Copy /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={rename} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Rename book</DialogTitle>
              <DialogDescription>At most {MAX_BOOK_NAME} characters.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="rename-book">Name</Label>
              <Input
                id="rename-book"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={MAX_BOOK_NAME}
                autoComplete="off"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setRenaming(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !name.trim()}>
                Rename
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {book.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              {store === "browser"
                ? "It goes from this browser for good. Back up first if you may want it again."
                : "It goes from your account for good, with its training history."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={(event) => {
                // Stay open until the delete is done, so a failure can be read.
                event.preventDefault();
                void remove();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
