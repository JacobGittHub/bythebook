// Where a player's public games are fetched from (plans/game-history.md D42, step 24): the
// addresses only, tested in Node. `npm run books:players` uses them today; the import dialog's
// fetcher will, once its mockup is approved.

/** Chess.com's public API for one player. */
export const CHESS_COM_PLAYER_API = "https://api.chess.com/pub/player";

/** Lichess's game export for one player, which streams PGN. */
export const LICHESS_GAMES_API = "https://lichess.org/api/games/user";

const name = (username: string) => encodeURIComponent(username.trim().toLowerCase());

/** The list of a Chess.com player's monthly archives, as JSON `{ archives: string[] }`. */
export function chessComArchivesUrl(username: string): string {
  return `${CHESS_COM_PLAYER_API}/${name(username)}/games/archives`;
}

/** One month of a Chess.com player's games as PGN, from an address in their archive list. */
export function chessComMonthPgnUrl(archiveUrl: string): string {
  return `${archiveUrl.replace(/\/+$/, "")}/pgn`;
}

/** The month an archive address names, as "YYYY-MM", or null for an address that names none. */
export function archiveMonth(archiveUrl: string): string | null {
  const match = /\/games\/(\d{4})\/(\d{2})\/?$/.exec(archiveUrl);
  return match ? `${match[1]}-${match[2]}` : null;
}

export type LichessExportOptions = {
  /** Only games played at or after this time. */
  since?: Date;
  /** At most this many games, newest first. */
  max?: number;
  /** Lichess's speeds, such as "blitz"; every speed when left out. */
  perfTypes?: readonly string[];
};

/** A Lichess player's games as PGN, without clocks, analysis or opening names. */
export function lichessExportUrl(username: string, options: LichessExportOptions = {}): string {
  const query = new URLSearchParams({ moves: "true", tags: "true", clocks: "false", evals: "false", opening: "false" });
  if (options.since) query.set("since", String(options.since.getTime()));
  if (options.max !== undefined) query.set("max", String(options.max));
  if (options.perfTypes?.length) query.set("perfType", options.perfTypes.join(","));
  return `${LICHESS_GAMES_API}/${name(username)}?${query}`;
}
