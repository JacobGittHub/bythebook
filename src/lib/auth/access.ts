// What a guest and a signed-in user may each reach (plans/deployment.md, D17 and D18). The
// sidebar, the proxy, the Overview page and the Visualizations page all read this file, so
// they can't disagree. It has no Supabase or browser imports: the proxy imports it, and the
// tests run in Node.

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
      "Play moves on the board and the Explorer names the opening you are in, lists what masters played from that position and how those games ended, and draws a small tree of where the game has been and where it usually goes next. Turn on Stockfish, which runs in your own browser, to see the evaluation and the best move.",
  },
  {
    href: "/dashboard/visualizations",
    label: "Visualizations",
    access: "everyone",
    status: "live",
    summary: "Experimental ways to see opening theory as a place.",
    details:
      "The Treemap draws every named opening as one radial tree that you can pan, search and click through, with your own books highlighted on it. Prototypes of other views, a 3D globe, a flat map and the Labyrinth, a zoomable map of regions, are kept here as possible future visualizations.",
  },
  {
    href: "/dashboard/library",
    label: "Library",
    access: "everyone",
    status: "live",
    summary: "Your own data: the books you build.",
    details:
      "Everything that is yours. Create a book for an opening you play, add lines to it from the Explorer or the Treemap, and come back to it later. Repertoires that combine books, and imports of your own games, will live here too. Books need an account for now.",
  },
  {
    href: "/dashboard/bookstore",
    label: "Bookstore",
    access: "everyone",
    status: "coming_soon",
    summary: "Ready-made books to add to your library.",
    details:
      "A public shelf of ready-made books, such as the Queen's Gambit or a collection of gambits, that you will be able to copy into your library and edit as your own. It is not built yet.",
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
 * visualization, kept from the former Lab.
 */
export const VISUALIZATIONS: PageLink[] = [
  {
    href: "/dashboard/visualizations/treemap",
    label: "Treemap",
    access: "everyone",
    status: "live",
    summary:
      "Every named opening as one radial tree. Pan, search, and click a position to see its board and master statistics.",
  },
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
  {
    href: "/dashboard/visualizations/labyrinth",
    label: "Labyrinth",
    access: "account",
    status: "prototype",
    summary:
      "Every move as a region inside the move before it, sized by how often masters played it. Zoom in to go deeper.",
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
    feature: "Explorer, Treemap and the engine",
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
    guest: "Not yet",
    account: "Create, edit and keep them between visits",
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
