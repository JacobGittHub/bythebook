"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { RadioGroup, RadioGroupItem } from "@/components/shadcn/radio-group";
import { Textarea } from "@/components/shadcn/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/shadcn/toggle-group";
import { useLibrary } from "@/context/Library";
import { MAX_BOOK_POSITIONS, countPositions, type BookSide } from "@/lib/books/measures";
import { START_FEN } from "@/lib/chess/fen";
import { createRootMoveNode } from "@/lib/chess/moveTree";
import { explorerHref } from "@/lib/library/links";
import { MAX_BOOK_NAME, checkBookName } from "@/lib/library/names";
import { pgnTrees, readPgn } from "@/lib/library/pgn";
import { libraryErrorMessage, type LibraryEntry } from "@/lib/library/types";
import type { MoveNode } from "@/types/chess";

type Start = "explorer" | "paste";

/** What a paste will make, or why it can't. */
type Pasted = { ok: true; trees: MoveNode[]; lines: number; positions: number } | { ok: false; error: string };

const STORE_NOTES = {
  browser: "Kept in this browser. Back it up or create an account to keep it safe.",
  account: "Saved to your account.",
} as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A book made from pasted moves, which stays on the Library page. */
  onCreated: (book: LibraryEntry) => void;
};

/**
 * New book (plans/deployment.md D21): a name, a side, and where the first lines come from. The
 * Explorer is the recommended start, since few people have their lines written down; pasted
 * moves or a PGN come second.
 */
export function NewBookDialog({ open, onOpenChange, onCreated }: Props) {
  const router = useRouter();
  const { library, store } = useLibrary();
  const [name, setName] = useState("");
  const [side, setSide] = useState<BookSide>("white");
  const [start, setStart] = useState<Start>("explorer");
  const [paste, setPaste] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The paste, read as it is typed, so the dialog can say what it will make.
  const pasted = useMemo((): Pasted | null => {
    if (start !== "paste" || !paste.trim()) return null;
    const read = readPgn(paste);
    if (!read.ok) return { ok: false, error: read.error };
    const trees = pgnTrees(read);
    return { ok: true, trees, lines: read.lines.length, positions: countPositions(trees) };
  }, [start, paste]);

  const reset = () => {
    setName("");
    setSide("white");
    setStart("explorer");
    setPaste("");
    setError(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanName = checkBookName(name);
    if (!cleanName) return setError(`A name needs 1 to ${MAX_BOOK_NAME} characters.`);
    if (start === "paste" && !pasted?.ok) {
      return setError(pasted ? pasted.error : "Paste some moves first, or start in the Explorer.");
    }
    setSaving(true);
    setError(null);
    try {
      const trees = start === "paste" && pasted?.ok ? pasted.trees : [createRootMoveNode(START_FEN)];
      const entry = await library.create({ name: cleanName, color: side, origin: { kind: "own" }, trees });
      onOpenChange(false);
      reset();
      if (start === "explorer") {
        router.push(explorerHref({ bookId: entry.id }));
      } else {
        toast.success(`Made ${entry.name}.`);
        onCreated(entry);
      }
    } catch (caught) {
      setError(libraryErrorMessage(caught));
    } finally {
      setSaving(false);
    }
  };

  const overLimit = pasted?.ok === true && pasted.positions > MAX_BOOK_POSITIONS;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>New book</DialogTitle>
            <DialogDescription>{STORE_NOTES[store]}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="new-book-name">Name</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {name.length} / {MAX_BOOK_NAME}
              </span>
            </div>
            <Input
              id="new-book-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={MAX_BOOK_NAME}
              placeholder="e.g. Najdorf Sicilian"
              autoComplete="off"
              autoFocus
            />
          </div>

          <div className="grid gap-1.5">
            <Label id="new-book-side">Played as</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={side}
              onValueChange={(next) => next && setSide(next as BookSide)}
              aria-labelledby="new-book-side"
            >
              <ToggleGroupItem value="white" className="px-4">
                White
              </ToggleGroupItem>
              <ToggleGroupItem value="black" className="px-4">
                Black
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="grid gap-1.5">
            <Label id="new-book-start">First lines</Label>
            <RadioGroup
              value={start}
              onValueChange={(next) => setStart(next as Start)}
              aria-labelledby="new-book-start"
              className="gap-2"
            >
              <label className="flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 has-[[data-state=checked]]:border-foreground">
                <RadioGroupItem value="explorer" className="mt-0.5" />
                <span className="text-sm">
                  <span className="font-medium">Add lines in the Explorer</span>{" "}
                  <Badge variant="secondary" className="align-middle">
                    Recommended
                  </Badge>
                  <span className="block text-muted-foreground">
                    The Explorer opens with this book chosen. Play a line on the board, then add it.
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 has-[[data-state=checked]]:border-foreground">
                <RadioGroupItem value="paste" className="mt-0.5" />
                <span className="text-sm">
                  <span className="font-medium">Paste moves or PGN</span>
                  <span className="block text-muted-foreground">For lines you already have written down.</span>
                </span>
              </label>
            </RadioGroup>
          </div>

          {start === "paste" && (
            <div className="grid gap-1.5">
              <Textarea
                aria-label="Moves or PGN"
                value={paste}
                onChange={(event) => setPaste(event.target.value)}
                placeholder="1. e4 c5 2. Nf3 d6 (2... Nc6) 3. d4"
                className="h-28 font-mono text-xs"
              />
              <p
                className={
                  pasted && (!pasted.ok || overLimit) ? "text-xs text-destructive" : "text-xs text-muted-foreground"
                }
              >
                {!pasted
                  ? "A variation in brackets becomes its own line."
                  : !pasted.ok
                    ? pasted.error
                    : `${pasted.lines} ${pasted.lines === 1 ? "line" : "lines"}, ${pasted.positions} ${
                        pasted.positions === 1 ? "position" : "positions"
                      }${overLimit ? `, over the ${MAX_BOOK_POSITIONS.toLocaleString("en-US")} a book can hold` : ""}.`}
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !name.trim() || overLimit}>
              {saving ? "Saving…" : start === "explorer" ? "Create and open the Explorer" : "Create book"}
              {start === "explorer" && !saving && (
                <span className="rounded-sm bg-primary-foreground/20 px-1 text-[10px] uppercase tracking-wide">
                  Jump to page
                </span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
