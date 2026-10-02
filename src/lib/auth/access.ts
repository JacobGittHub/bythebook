// What a guest and a signed-in user may each reach (plans/deployment.md, D17 and D18). The
// sidebar, the proxy and the Overview page all read this file, so they can't disagree.
// It has no Supabase or browser imports: the proxy imports it, and the tests run in Node.

export type NavAccess = "everyone" | "account";
export type PageStatus = "live" | "coming_soon";

export type NavItem = {
  href: string;
  label: string;
  /** `account` pages are hidden from guests and redirect them to sign in. */
  access: NavAccess;
  status: PageStatus;
  /** One line for the Overview page. */
  summary: string;
};

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
    summary:
      "Board analysis: play moves, see master-game statistics and opening names, and run the engine in your browser.",
  },
  {
    href: "/dashboard/atlas",
    label: "Atlas",
    access: "everyone",
    status: "live",
    summary: "Visualizations of opening theory, starting with the full opening tree.",
  },
  {
    href: "/dashboard/library",
    label: "Library",
    access: "everyone",
    status: "live",
    summary: "Your own data: the books you build, and later repertoires and imported games.",
  },
  {
    href: "/dashboard/bookstore",
    label: "Bookstore",
    access: "everyone",
    status: "coming_soon",
    summary: "Ready-made books to add to your library.",
  },
  {
    href: "/dashboard/train",
    label: "Train",
    access: "everyone",
    status: "coming_soon",
    summary: "Drill the lines in your books.",
  },
  {
    href: "/dashboard/puzzles",
    label: "Puzzles",
    access: "everyone",
    status: "coming_soon",
    summary: "Tactical puzzles.",
  },
  {
    href: "/dashboard/settings",
    label: "Settings",
    access: "everyone",
    status: "live",
    summary: "Background and board appearance, saved in your browser.",
  },
  {
    href: "/dashboard/lab",
    label: "⚗ Lab",
    access: "account",
    status: "live",
    summary: "Visualization prototypes.",
  },
];

/** The sidebar links for this viewer. */
export function visibleNavItems(signedIn: boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => signedIn || item.access === "everyone");
}

/** True when a guest asking for this path must sign in first. */
export function requiresAccount(pathname: string): boolean {
  return NAV_ITEMS.some(
    (item) =>
      item.access === "account" &&
      (pathname === item.href || pathname.startsWith(`${item.href}/`)),
  );
}

export type AccessRow = { feature: string; guest: string; account: string };

/** The guest and account differences, as shown on the Overview page. */
export const ACCESS_ROWS: AccessRow[] = [
  {
    feature: "Explorer, Atlas and the engine",
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
    feature: "Appearance settings",
    guest: "Saved in your browser",
    account: "Saved in your browser",
  },
];
