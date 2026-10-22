// What a guest and a signed-in user may each reach (plans/deployment.md, D17 and D18). The
// book's tabs, the proxy, the Overview page and the Visualizations page all read this file, so
// they can't disagree. It has no Supabase or browser imports: the proxy imports it, and the
// tests run in Node.

import { BOOK_VIEWS } from "@/lib/books/views";

export type PageAccess = "everyone" | "account";
export type PageStatus = "live" | "coming_soon" | "prototype";

/** A page a button can route to. */
export type PageLink = {
  href: string;
  label: string;
  /** A guest asking for an `account` page is redirected to sign in. */
  access: PageAccess;
  status: PageStatus;
  /** One line for the page's button. */
  summary: string;
};

/** A chapter's icon in the book's narrow chapter column (plans/book-ui.md D15), by name. */
export type ChapterIcon = "house" | "compass" | "eye" | "book" | "store" | "target" | "puzzle" | "sliders";

/**
 * A page of the book, with its tab in the strip. `details` is the longer text beside its demo
 * on the Overview page, and `demo` is that demo, a looping GIF recorded by
 * `npm run demos:record` into `public/demos/`.
 */
export type NavItem = PageLink & { icon: ChapterIcon; details?: string; demo?: string };

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    icon: "house",
    label: "Overview",
    access: "everyone",
    status: "live",
    summary: "What ByTheBook does and what an account adds.",
  },
  {
    href: "/dashboard/explorer",
    icon: "compass",
    demo: "/demos/explorer.gif",
    label: "Explorer",
    access: "everyone",
    status: "live",
    summary: "Board analysis with master-game statistics and an engine.",
    details:
      "Play moves on the board and the Explorer names the opening you are in, lists what masters played from that position and how those games ended, and draws a small tree of where the game has been and where it usually goes next, in whichever of five views you like. Turn on Stockfish, which runs in your own browser, to see the evaluation and the best move.",
  },
  {
    href: "/dashboard/visualizations",
    icon: "eye",
    demo: "/demos/visualizations.gif",
    label: "Visualizations",
    access: "everyone",
    status: "live",
    summary: "Experimental ways to see opening theory as a place.",
    details:
      "The Labyrinth, the view in active development, draws every move as a region inside the move before it, sized by how often masters played it, so zooming in walks you deeper into a line. It needs an account for now. The Treemap, an earlier view, draws every named opening as one radial tree that you can pan, search and click through, with your own books highlighted on it. Five small visualizations each draw one book at a time, an example book or one of your own, beside a board. Prototypes of a 3D globe and a flat map are kept here as possible future visualizations.",
  },
  {
    href: "/dashboard/library",
    icon: "book",
    demo: "/demos/library.gif",
    label: "Library",
    access: "everyone",
    status: "live",
    summary: "Your own data: the books you build.",
    details:
      "Everything that is yours. Create a book for an opening you play, add lines to it from the Explorer or the Treemap or paste them in, and open each book on a page of its own. Repertoires that combine books, and imports of your own games, will live here too. As a guest your books are kept in this browser, and you can back them up to a file; an account keeps them on the server.",
  },
  {
    href: "/dashboard/bookstore",
    icon: "store",
    demo: "/demos/bookstore.gif",
    label: "Bookstore",
    access: "everyone",
    status: "live",
    summary: "Ready-made books to add to your library.",
    details:
      "A shelf of ready-made books, such as the Queen's Gambit or the Caro-Kann, each drawn by its shape beside a board. Save one and it is copied into your library, to edit as your own. For now every book is ByTheBook's, made from Wikibooks, the opening catalog and master statistics; ratings and books from other players come later.",
  },
  {
    href: "/dashboard/train",
    icon: "target",
    label: "Train",
    access: "everyone",
    status: "coming_soon",
    summary: "Drill the lines in your books.",
    details:
      "Drills made from your books: the computer will play into your lines and you answer from memory, with the positions you miss coming back more often. An early scaffold is in place, and the trainer itself is not built yet.",
  },
  {
    href: "/dashboard/puzzles",
    icon: "puzzle",
    label: "Puzzles",
    access: "everyone",
    status: "coming_soon",
    summary: "Tactical puzzles.",
    details:
      "Tactical puzzles from the Lichess puzzle database, with your attempts tracked. An early scaffold is in place, and no puzzles are loaded yet.",
  },
  {
    href: "/dashboard/settings",
    icon: "sliders",
    demo: "/demos/settings.gif",
    label: "Settings",
    access: "everyone",
    status: "live",
    summary: "Light or dark, page turns, and vibes.",
    details:
      "Choose a light or dark theme, or follow your device, how pages turn, and whether vibes dress the book. The choices are saved in this browser, so they work the same for guests and accounts.",
  },
];

/** A chapter in the book's contents (plans/book-ui.md D10): a page of the book, or one with no page yet (`href` null). */
export type ContentsEntry = Pick<NavItem, "label" | "status" | "summary" | "details" | "demo"> & { href: string | null };

/**
 * The Vibes chapter (plans/vibes.md): listed in the book's contents, coming soon, with no page
 * or tab yet. It comes just before Settings.
 */
export const VIBES_CHAPTER: ContentsEntry = {
  href: null,
  label: "Vibes",
  status: "coming_soon",
  summary: "The book dressed for the opening on the board.",
  details:
    "With vibes on, the book takes on the character of the opening you are playing: its paper, its borders and its type, with music to match. The first vibes are still being made; the Vibes switch beside the account links is where they will turn on.",
};

/**
 * The book's chapters as its contents list them, for this viewer: the pages after the
 * Overview, which is the contents itself, with the Vibes chapter in its place. A chapter's
 * number is its place in this list, from 1.
 */
export function bookContents(signedIn: boolean): ContentsEntry[] {
  return visibleNavItems(signedIn)
    .filter((item) => item.href !== "/dashboard")
    .flatMap(({ href, label, status, summary, details, demo }): ContentsEntry[] => {
      const entry = { href, label, status, summary, details, demo };
      return href === "/dashboard/settings" ? [VIBES_CHAPTER, entry] : [entry];
    });
}

/** The groups of the Visualizations chapter's contents (plans/book-ui.md D18), in order. */
export const VISUALIZATION_GROUPS = ["In development", "Book views", "Opening tree", "Prototypes"] as const;
export type VisualizationGroup = (typeof VISUALIZATION_GROUPS)[number];

/**
 * A visualization, on a page of its own below the Visualizations chapter. Its `id` is the
 * address's last part, and names its screenshot (`visualizationShot`).
 */
export type Visualization = PageLink & { id: string; group: VisualizationGroup };

/**
 * The visualizations, as the Visualizations chapter lists them. A `prototype` is a possible
 * future visualization, kept from the former Lab, except the Labyrinth, which is in active
 * development. The book views (`src/lib/books/views/`) are the small ones, one book at a time.
 */
export const VISUALIZATIONS: Visualization[] = [
  {
    id: "labyrinth",
    group: "In development",
    href: "/dashboard/visualizations/labyrinth",
    label: "Labyrinth",
    access: "account",
    status: "prototype",
    summary:
      "Every move as a region inside the move before it, sized by how often masters played it. Zoom in to walk deeper into a line, with the opening's name above the map and its position on a board beside it.",
  },
  ...BOOK_VIEWS.map(
    (view): Visualization => ({
      id: view.id,
      group: "Book views",
      href: `/dashboard/visualizations/books/${view.id}`,
      label: view.label,
      access: "everyone",
      status: "live",
      summary: view.summary,
    }),
  ),
  {
    id: "treemap",
    group: "Opening tree",
    href: "/dashboard/visualizations/treemap",
    label: "Treemap",
    access: "everyone",
    status: "live",
    summary:
      "Every named opening as one radial tree. Pan, search, and click a position to see its board and master statistics.",
  },
  {
    id: "globe",
    group: "Prototypes",
    href: "/dashboard/visualizations/globe",
    label: "Globe",
    access: "account",
    status: "prototype",
    summary: "Openings placed on a rotating 3D globe: every named opening, or one book from its start.",
  },
];

/** Where a visualization's screenshot is, in the theme given: `npm run demos:shots` takes them. */
export function visualizationShot(id: string, theme: "light" | "dark"): string {
  return `/visualizations/${id}-${theme}.webp`;
}

/** The book's pages (its tabs) for this viewer, in book order. */
export function visibleNavItems(signedIn: boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => signedIn || item.access === "everyone");
}

/** True when a guest asking for this path must sign in first. */
export function requiresAccount(pathname: string): boolean {
  return [...NAV_ITEMS, ...VISUALIZATIONS].some(
    (page) =>
      page.access === "account" &&
      (pathname === page.href || pathname.startsWith(`${page.href}/`)),
  );
}

export type AccessRow = { feature: string; guest: string; account: string };

/** What an account adds, as the Overview's contents page shows it. */
export const ACCESS_ROWS: AccessRow[] = [
  { feature: "Your books", guest: "Kept in this browser", account: "Saved to your account" },
  { feature: "Master statistics", guest: "Every named opening", account: "Any position, live" },
  { feature: "Prototype views", guest: "Listed only", account: "Yes" },
  { feature: "Game history", guest: "Kept in this browser", account: "Coming soon" },
];
