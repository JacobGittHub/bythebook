"use client";

import { useState } from "react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/shadcn/toggle-group";
import { useLibrary } from "@/context/Library";
import { START_FEN } from "@/lib/chess/fen";
import { createRootMoveNode } from "@/lib/chess/moveTree";
import { MAX_BOOK_NAME } from "@/lib/library/names";
import { libraryErrorMessage, type LibraryEntry } from "@/lib/library/types";

type Props = {
  onCreated: (book: LibraryEntry) => void;
  onCancel?: () => void;
};

export function BookEditor({ onCreated, onCancel }: Props) {
  const { library } = useLibrary();
  const [name, setName] = useState("");
  const [color, setColor] = useState<"white" | "black">("white");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      // A new book is one empty tree from the starting position.
      const entry = await library.create({
        name,
        color,
        origin: { kind: "own" },
        trees: [createRootMoveNode(START_FEN)],
      });
      onCreated(entry);
    } catch (caught) {
      setError(libraryErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor="book-editor-name" className="text-xs text-muted-foreground">
          Book name
        </Label>
        <Input
          id="book-editor-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Ruy Lopez repertoire"
          maxLength={MAX_BOOK_NAME}
          required
          className="h-8"
        />
      </div>

      <div className="grid gap-1.5">
        <p id="book-editor-color" className="text-xs font-medium text-muted-foreground">
          Playing as
        </p>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          aria-labelledby="book-editor-color"
          value={color}
          onValueChange={(value) => {
            if (value) setColor(value as "white" | "black");
          }}
          className="w-full"
        >
          {(["white", "black"] as const).map((c) => (
            <ToggleGroupItem
              key={c}
              value={c}
              className="flex-1 capitalize data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              {c}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" size="sm" className="flex-1" disabled={submitting || !name.trim()}>
          {submitting ? "Creating…" : "Create book"}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
