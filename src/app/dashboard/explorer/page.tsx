import { OpeningExplorer } from "@/components/openings/OpeningExplorer";
import { parseLineParam } from "@/lib/library/links";

type Props = {
  searchParams: Promise<{ fen?: string; book?: string; line?: string }>;
};

/**
 * The Explorer. `?fen=` opens at a catalog position; `?line=` plays UCI moves from the start and
 * `?book=` chooses a book, as the Library's "Open in Explorer" and New book send
 * (`explorerHref`, `src/lib/library/links.ts`).
 */
export default async function ExplorerPage({ searchParams }: Props) {
  const { fen, book, line } = await searchParams;
  return (
    <main className="space-y-6">
      <OpeningExplorer initialFen={fen} initialLine={parseLineParam(line)} initialBookId={book} />
    </main>
  );
}
