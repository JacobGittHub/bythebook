// The book views: five ways of drawing one book, or the Explorer's explored line, as a tree
// laid out left to right so depth gets the room. The Explorer's side window switches between
// them, and each has a small visualization page (`VISUALIZATIONS` in `src/lib/auth/access.ts`).
// Listed in the order the user ranked the concept mockups (2026-10-06).

export const BOOK_VIEWS = [
  {
    id: "ply-columns",
    label: "Ply columns",
    summary: "Every position as a dot, one column per move, so depth lines up across the whole book.",
  },
  {
    id: "metro",
    label: "Metro map",
    summary: "Each line as a route of stations, the main line running straight and each defense in its own color.",
  },
  {
    id: "spine",
    label: "Spine and ribs",
    summary: "One line straight across, with the book's other moves as ribs. Click a rib to walk down it.",
  },
  {
    id: "icicle",
    label: "Icicle",
    summary: "Each move as a block sized by its share of the book, like the Labyrinth laid flat.",
  },
  {
    id: "branch-points",
    label: "Branch points",
    summary: "Only the places where the book splits, for big books: runs of single moves become one stretch.",
  },
] as const;

export type BookViewId = (typeof BOOK_VIEWS)[number]["id"];

/** The view the Explorer's side window opens with. */
export const DEFAULT_EXPLORER_VIEW: BookViewId = "spine";

export function isBookViewId(value: unknown): value is BookViewId {
  return BOOK_VIEWS.some((view) => view.id === value);
}
