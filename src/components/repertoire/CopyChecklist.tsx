"use client";

import { useMemo, useState } from "react";
import { BookMiniature } from "@/components/books/BookMiniature";
import { SideTag, countOf } from "@/components/library/BookParts";
import { Button } from "@/components/shadcn/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/shadcn/toggle-group";
import { countPositions } from "@/lib/books/measures";
import { resolvePlan, type ClashChoice, type ExistingBook, type IncomingBook, type PlanItem } from "@/lib/library/copyPlan";
import { miniature } from "@/lib/library/miniature";
import { MAX_LIBRARY_BOOKS, libraryErrorMessage, type BookDraft } from "@/lib/library/types";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  /** A sentence under the title saying what happens to the books. */
  description?: string;
  /** The checklist from `planCopy`. */
  plan: PlanItem[];
  /** What the receiving library holds. */
  existing: ExistingBook[];
  /** Completes "{count} books" on the confirm button, such as "Restore". */
  verb: string;
  /**
   * Saves one book, given as it will be written and as it came; a refusal is shown beside it
   * and the rest carry on.
   */
  save: (draft: BookDraft, source: IncomingBook) => Promise<unknown>;
  /** The button that closes the checklist without saving; "Cancel" when not given. */
  cancelLabel?: string;
  /** Called when the checklist is closed, with how many books were saved. */
  onDone: (saved: number) => void;
};

type Outcome = { saved: boolean; message?: string };

const itemName = (item: PlanItem) => (item.status === "rejected" ? item.name : item.book.name);

/** A checklist row's miniature and size, worked out from the incoming book's trees. */
function ItemShape({ book }: { book: IncomingBook }) {
  const shape = useMemo(() => ({ mini: miniature(book.trees), positions: countPositions(book.trees) }), [book.trees]);
  return (
    <>
      <BookMiniature miniature={shape.mini} width={46} height={28} />
      <span className="text-xs text-muted-foreground">
        <SideTag side={book.color} /> · {countOf(shape.positions, "position")}
      </span>
    </>
  );
}

/**
 * The checklist that Restore and the copy at sign-in share (plans/deployment.md D22, D23):
 * each incoming book with what will happen to it. A name already in the library is kept as a
 * second book unless the user skips it. Books are saved one at a time.
 */
export function CopyChecklist({ title, description, plan, existing, verb, save, cancelLabel = "Cancel", onDone }: Props) {
  const [choices, setChoices] = useState<ReadonlyMap<number, ClashChoice>>(new Map());
  const [outcomes, setOutcomes] = useState<ReadonlyMap<number, Outcome> | null>(null);
  const [busy, setBusy] = useState(false);
  const { write, noRoom } = resolvePlan(plan, choices, existing);
  const finished = outcomes !== null && !busy;
  const savedCount = outcomes ? [...outcomes.values()].filter((outcome) => outcome.saved).length : 0;

  const choose = (index: number, choice: ClashChoice) => setChoices((old) => new Map(old).set(index, choice));

  const run = async () => {
    setBusy(true);
    const results = new Map<number, Outcome>();
    for (const { index, draft, source } of write) {
      try {
        await save(draft, source);
        results.set(index, { saved: true });
      } catch (error) {
        results.set(index, { saved: false, message: libraryErrorMessage(error) });
      }
      setOutcomes(new Map(results));
    }
    setOutcomes(new Map(results));
    setBusy(false);
  };

  const describe = (item: PlanItem, index: number): { text: string; warn: boolean } => {
    const outcome = outcomes?.get(index);
    if (outcome) return outcome.saved ? { text: "Saved.", warn: false } : { text: `Not saved: ${outcome.message}`, warn: true };
    if (noRoom.includes(index)) return { text: `No room: a library holds at most ${MAX_LIBRARY_BOOKS} books.`, warn: true };
    switch (item.status) {
      case "new":
        return { text: "Will be added.", warn: false };
      case "present":
        return { text: "Already in this library.", warn: false };
      case "rejected":
        return { text: `Can't be added: ${item.detail}`, warn: true };
      case "name_clash": {
        const planned = write.find((entry) => entry.index === index);
        return planned
          ? { text: `A book has this name, so it will be added as “${planned.draft.name}”.`, warn: true }
          : { text: "Skipped.", warn: false };
      }
    }
  };

  return (
    <section className="rounded-md border bg-card p-4" aria-label={title}>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      <ul className="mt-2 divide-y">
        {plan.map((item, index) => {
          const state = describe(item, index);
          return (
            <li key={index} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
              {item.status !== "rejected" && <ItemShape book={item.book} />}
              <span className="min-w-0 flex-1 truncate font-medium text-foreground">{itemName(item)}</span>
              <span className={cn("text-xs", state.warn ? "text-foreground" : "text-muted-foreground")}>{state.text}</span>
              {item.status === "name_clash" && outcomes === null && (
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  value={choices.get(index) ?? "keep_both"}
                  onValueChange={(next) => next && choose(index, next as ClashChoice)}
                  aria-label={`What to do with ${item.book.name}`}
                >
                  <ToggleGroupItem value="keep_both" className="px-2.5 text-xs">
                    Keep both
                  </ToggleGroupItem>
                  <ToggleGroupItem value="skip" className="px-2.5 text-xs">
                    Skip
                  </ToggleGroupItem>
                </ToggleGroup>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {finished ? (
          <>
            <p className="flex-1 text-sm text-muted-foreground" role="status">
              {savedCount} {savedCount === 1 ? "book" : "books"} saved.
            </p>
            <Button size="sm" onClick={() => onDone(savedCount)}>
              Done
            </Button>
          </>
        ) : (
          <>
            <span className="flex-1" />
            <Button size="sm" variant="ghost" onClick={() => onDone(savedCount)} disabled={busy}>
              {cancelLabel}
            </Button>
            <Button size="sm" onClick={run} disabled={busy || write.length === 0}>
              {busy ? "Saving…" : `${verb} ${write.length} ${write.length === 1 ? "book" : "books"}`}
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
