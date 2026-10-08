"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/shadcn/alert-dialog";
import { Button } from "@/components/shadcn/button";
import { moveLabel, type ViewNode } from "@/lib/books/viewTree";
import { removeMove } from "@/lib/library/edit";
import { STALE_BOOK_MESSAGE, startTree } from "@/lib/library/trees";
import { libraryErrorMessage, type BookPatch, type LibraryBook } from "@/lib/library/types";

type Props = {
  book: LibraryBook;
  /** The selected position, in the tree from the starting position (`BookReader` shows that one). */
  node: ViewNode;
  /** `useLibraryBook`'s save: false when the book changed elsewhere and nothing was saved. */
  save: (patch: BookPatch) => Promise<boolean>;
};

/**
 * Removes the selected move and every position after it (plans/deployment.md D25), once the
 * user has seen how much goes with it.
 */
export function RemoveMoveButton({ book, node, save }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // The node itself is one of `size`; a tree's first position is no move and can't go.
  const after = node.size - 1;

  const remove = async () => {
    setBusy(true);
    try {
      const tree = startTree(book.trees);
      const index = book.trees.indexOf(tree);
      const saved = await save({ trees: removeMove(book.trees, index, node.id) });
      if (saved) toast.success(`Removed ${moveLabel(node)}.`);
      else toast.error(STALE_BOOK_MESSAGE);
      setOpen(false);
    } catch (caught) {
      toast.error(libraryErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={node.depth === 0} className="justify-start text-destructive hover:text-destructive">
          <Trash2 /> Remove move
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {moveLabel(node)}?</AlertDialogTitle>
          <AlertDialogDescription>
            {after === 0
              ? "Nothing in the book comes after it."
              : `The ${after} ${after === 1 ? "position" : "positions"} after it go too.`}{" "}
            {book.name} keeps every other line.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={(event) => {
              event.preventDefault();
              void remove();
            }}
          >
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
