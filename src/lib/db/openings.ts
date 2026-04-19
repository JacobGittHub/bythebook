import type { OpeningBook } from "@/types/chess";

export async function listOpeningBooks(): Promise<OpeningBook[]> {
  return [
    {
      id: "vienna-main",
      name: "Vienna Game",
      color: "white",
      description: "Aggressive 1.e4 repertoire with practical traps and transpositions.",
      rootFen: "startpos",
      lines: [[{ san: "e4", uci: "e2e4" }]],
    },
  ];
}

export async function getOpeningBook(bookId: string): Promise<OpeningBook> {
  const [book] = await listOpeningBooks();
  return {
    ...book,
    id: bookId,
  };
}
