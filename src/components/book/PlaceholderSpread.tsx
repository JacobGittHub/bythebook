"use client";

import { useBookFrame } from "@/components/book/BookFrame";
import { Spread, chapterFolio } from "@/components/book/Spread";
import { Badge } from "@/components/shadcn/badge";

/**
 * A chapter that isn't built yet, as a spread (plans/book-ui.md D11): its title page on the
 * left, with its place in the book and one line on what it is for, and on the right what it
 * will be, over ruled lines left blank for it.
 */
export function PlaceholderSpread({ line, text }: { line: string; text: string[] }) {
  const { form, chapters, chapterCount, at } = useBookFrame();
  const chapter = chapters[at];
  if (!chapter) return null;
  const place = chapterFolio(chapter.number, chapterCount);

  return (
    <Spread
      left={{
        head: <span>{chapter.label}</span>,
        body: (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3.5 py-6 text-center">
            {place && <span className="book-sc">{place}</span>}
            <h1 className="font-heading text-[46px] leading-[1.1] font-semibold tracking-[-0.01em]">{chapter.label}</h1>
            <p className="max-w-[34ch] text-sm text-muted-foreground">{line}</p>
          </div>
        ),
      }}
      right={{
        head: (
          <>
            <span className="grow" />
            <span>{chapter.label}</span>
          </>
        ),
        body: (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="flex items-center gap-2.5">
              {/* On one page the title page is just above. */}
              {form === "spread" && <h2 className="font-heading text-[30px] leading-[1.15] font-semibold tracking-[-0.01em]">{chapter.label}</h2>}
              <Badge variant="outline" className="font-normal text-muted-foreground">
                Coming soon
              </Badge>
            </div>
            {text.map((paragraph) => (
              <p key={paragraph} className="max-w-[60ch] text-sm leading-6">
                {paragraph}
              </p>
            ))}
            <div
              aria-hidden
              className="min-h-24 flex-1 rounded-xs bg-[repeating-linear-gradient(to_bottom,transparent_0_21px,var(--rule)_21px_22px)] opacity-55"
            />
          </div>
        ),
        folio: <span className="ml-auto">{place}</span>,
      }}
    />
  );
}
