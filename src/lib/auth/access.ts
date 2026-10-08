// What a guest and a signed-in user may each reach (plans/deployment.md, D17 and D18). The
// sidebar, the proxy, the Overview page and the Visualizations page all read this file, so
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
  /** Shown first, in a larger button, on the page that lists it. */
  featured?: boolean;
  /** A small visualization: one book in one of the book views, listed in its own group. */
  small?: boolean;
};

/** A sidebar page. `details` is the longer text beside its demo on the Overview page. */
export type NavItem = PageLink & { details?: string };

export const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Overview",
    access: "everyone",
    status: "live",
    summary: "What ByTheBook does and what an account adds.",
  },
  {
    href: "/dashboard/explorer",
    label: "Explorer",
    access: "everyone",
    status: "live",
    summary: "Board analysis with master-game statistics and an engine.",
    details:
      "Play moves on the board and the Explorer names the opening you are in, lists what masters played from that position and how those games ended, and draws a small tree of where the game has been and where it usually goes next, in whichever of five views you like. Turn on Stockfish, which runs in your own browser, to see the evaluation and the best move.",
  },
  {
    href: "/dashboard/visualizations",
    label: "Visualizations",
    access: "everyone",
    status: "live",
    summary: "Experimental ways to see opening theory as a place.",
    details:
      "The Labyrinth, the view in active development, draws every move as a region inside the move before it, sized by how often masters played it, so zooming in walks you deeper into a line. It needs an account for now. The Treemap, an earlier view, draws every named opening as one radial tree that you can pan, search and click through, with your own books highlighted on it. Five small visualizations each draw one book at a time, an example book or one of your own, beside a board. Prototypes of a 3D globe and a flat map are kept here as possible future visualizations.",
  },
  {
    href: "/dashboard/library",
    label: "Library",
    access: "everyone",
    status: "live",
    summary: "Your own data: the books you build.",
    details:
      "Everything that is yours. Create a book for an opening you play, add lines to it from the Explorer or the Treemap or paste them in, and open each book on a page of its own. Repertoires that combine books, and imports of your own games, will live here too. As a guest your books are kept in this browser, and you can back them up to a file; an account keeps them on the server.",
  },
  {
    href: "/dashboard/bookstore",
    label: "Bookstore",
    access: "everyone",
    status: "live",
    summary: "Ready-made books to add to your library.",
    details:
      "A shelf of ready-made books, such as the Queen's Gambit or the Caro-Kann, each drawn by its shape beside a board. Save one and it is copied into your library, to edit as your own. For now every book is ByTheBook's, made from Wikibooks, the opening catalog and master statistics; ratings and books from other players come later.",
  },
  {
    href: "/dashboard/train",
    label: "Train",
    access: "everyone",
    status: "coming_soon",
    summary: "Drill the lines in your books.",
    details:
      "Drills made from your books: the computer will play into your lines and you answer from memory, with the positions you miss coming back more often. An early scaffold is in place, and the trainer itself is not built yet.",
  },
  {
    href: "/dashboard/puzzles",
    label: "Puzzles",
    access: "everyone",
    status: "coming_soon",
    summary: "Tactical puzzles.",
    details:
      "Tactical puzzles from the Lichess puzzle database, with your attempts tracked. An early scaffold is in place, and no puzzles are loaded yet.",
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    access: "everyone",
    status: "live",
    summary: "The background style used across the app.",
    details:
      "Choose the background style used across the app. The choice is saved in this browser, so it works the same for guests and accounts.",
  },
];

/**
 * The pages behind the Visualizations page's buttons. A `prototype` is a possible future
 * visualization, kept from the former Lab, except the featured Labyrinth, which is in active
 * development. The small visualizations are the book views (`src/lib/books/views/`), each
 * on its own page.
 */
export const VISUALIZATIONS: PageLink[] = [
  {
    href: "/dashboard/visualizations/labyrinth",
    label: "Labyrinth",
    access: "account",
    status: "prototype",
    featured: true,
    summary:
      "Every move as a region inside the move before it, sized by how often masters played it. Zoom in to walk deeper into a line, with the opening's name above the map and its position on a board beside it.",
  },
  {
    href: "/dashboard/visualizations/treemap",
    label: "Treemap",
    access: "everyone",
    status: "live",
    summary:
      "Every named opening as one radial tree. Pan, search, and click a position to see its board and master statistics.",
  },
  ...BOOK_VIEWS.map(
    (view): PageLink => ({
      href: `/dashboard/visualizations/books/${view.id}`,
      label: view.label,
      access: "everyone",
      status: "live",
      small: true,
      summary: view.summary,
    }),
  ),
  {
    href: "/dashboard/visualizations/globe",
    label: "Globe",
    access: "account",
    status: "prototype",
    summary: "Openings placed on a rotating 3D globe.",
  },
  {
    href: "/dashboard/visualizations/map",
    label: "2D map",
    access: "account",
    status: "prototype",
    summary: "Openings as branches on a flat map that shows more detail as you zoom.",
  },
];

/** The sidebar links for this viewer. */
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

/** The guest and account differences, as shown on the Overview page. */
export const ACCESS_ROWS: AccessRow[] = [
  {
    feature: "Explorer, Treemap, the small visualizations and the engine",
    guest: "Yes",
    account: "Yes",
  },
  {
    feature: "Master-game statistics",
    guest: "Positions already saved on the server, which covers every named opening",
    account: "Any position, looked up live when it isn't saved yet",
  },
  {
    feature: "Books in your library",
    guest: "Kept in this browser, with backup to a file",
    account: "Saved to your account, on any device",
  },
  {
    feature: "Visualization prototypes",
    guest: "Listed, but opening one needs an account",
    account: "Yes",
  },
  {
    feature: "Appearance settings",
    guest: "Saved in your browser",
    account: "Saved in your browser",
  },
];
