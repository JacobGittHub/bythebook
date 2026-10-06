// The Opening Explorer's move navigator: the highlighted line, the moves queued to play,
// autoplay, and the scripted commands it sends the board (plans/testing.md, D5). The board
// reports back what it did, so a command and its outcome are separate actions.
import {
  createMoveCommand,
  createResetCommand,
  createUndoCommand,
  getCurrentLineIndex,
  getRemainingMovesFromLine,
  type ScriptedBoardCommand,
} from "@/lib/chess/linePlayback";
import type { CatalogMatch, Move } from "@/types/chess";

export const ILLEGAL_MOVE_MESSAGE = "Move could not be applied to the current board state.";

/** `M` is the board's own move type, which carries more than a `Move`. */
export type NavigatorState<M extends Move = Move> = {
  /** The catalog line highlighted for stepping through. */
  line: CatalogMatch | null;
  /** The moves on the board, oldest first. */
  history: M[];
  /** Moves to send one at a time, each after the board reports the one before. */
  pending: Move[];
  /** Moves to play once the board reports a reset. */
  afterReset: Move[];
  /** The last command sent to the board. The board ignores one it has already run. */
  command: ScriptedBoardCommand | null;
  /** Counts commands, so each gets a fresh id. */
  commandCount: number;
  autoPlaying: boolean;
  error: string | null;
};

export type NavigatorAction<M extends Move = Move> =
  // From the user
  | { type: "highlight"; line: CatalogMatch }
  | { type: "clearLine" }
  | { type: "playMove"; move: Move }
  | { type: "goToLine"; moves: Move[] }
  | { type: "goToStart" }
  | { type: "undo" }
  | { type: "stepForward" }
  | { type: "goToEnd" }
  | { type: "toggleAutoPlay" }
  | { type: "autoPlayTick" }
  // From the board
  | { type: "boardMoved"; move: M }
  | { type: "boardUndone" }
  | { type: "boardReset" }
  | { type: "illegalMove" };

/** A navigator at the start position that plays `initialMoves` from it, if any. */
export function createNavigator<M extends Move = Move>(initialMoves: Move[] = []): NavigatorState<M> {
  const state: NavigatorState<M> = {
    line: null,
    history: [],
    pending: [],
    afterReset: [],
    command: null,
    commandCount: 0,
    autoPlaying: false,
    error: null,
  };
  return initialMoves.length > 0 ? playQueue(state, initialMoves) : state;
}

/** The moves of the highlighted line still to play, or none when the board has left it. */
export function remainingLineMoves(state: NavigatorState<Move>): Move[] {
  return state.line ? getRemainingMovesFromLine(state.history, state.line.moves) : [];
}

/** How far along the highlighted line the board is, or -1 when it has left the line. */
export function lineIndex(state: NavigatorState<Move>): number {
  return state.line ? getCurrentLineIndex(state.history, state.line.moves) : -1;
}

export function canGoForward(state: NavigatorState<Move>): boolean {
  return remainingLineMoves(state).length > 0;
}

function send<M extends Move>(
  state: NavigatorState<M>,
  make: (id: string) => ScriptedBoardCommand,
): NavigatorState<M> {
  const commandCount = state.commandCount + 1;
  return { ...state, commandCount, command: make(String(commandCount)) };
}

/** Sends the first move and queues the rest. */
function playQueue<M extends Move>(state: NavigatorState<M>, moves: Move[]): NavigatorState<M> {
  const [first, ...rest] = moves;
  if (!first) return { ...state, pending: [] };
  return send({ ...state, pending: rest }, (id) => createMoveCommand(first, id));
}

/** What every user navigation does first: drop the queue and stop autoplay. */
function interrupt<M extends Move>(state: NavigatorState<M>): NavigatorState<M> {
  return { ...state, pending: [], autoPlaying: false };
}

export function navigatorReducer<M extends Move>(
  state: NavigatorState<M>,
  action: NavigatorAction<M>,
): NavigatorState<M> {
  switch (action.type) {
    case "highlight":
      return { ...interrupt(state), line: action.line, error: null };

    case "clearLine":
      return { ...state, line: null, error: null };

    case "playMove":
      return send(interrupt(state), (id) => createMoveCommand(action.move, id));

    case "goToLine":
      return send({ ...interrupt(state), afterReset: action.moves }, createResetCommand);

    case "goToStart":
      if (state.history.length === 0) return state;
      return send(interrupt(state), createResetCommand);

    case "undo":
      if (state.history.length === 0) return state;
      return send(interrupt(state), createUndoCommand);

    case "stepForward": {
      const next = remainingLineMoves(state)[0];
      if (!next) return state;
      return send(interrupt(state), (id) => createMoveCommand(next, id));
    }

    case "goToEnd": {
      const remaining = remainingLineMoves(state);
      if (remaining.length === 0) return state;
      return playQueue({ ...state, autoPlaying: false }, remaining);
    }

    case "toggleAutoPlay":
      if (state.autoPlaying) return { ...state, autoPlaying: false };
      if (!canGoForward(state)) return state;
      return { ...state, pending: [], error: null, autoPlaying: true };

    case "autoPlayTick": {
      const next = remainingLineMoves(state)[0];
      if (!state.autoPlaying || !next) return state;
      return send(state, (id) => createMoveCommand(next, id));
    }

    case "boardMoved": {
      let next: NavigatorState<M> = {
        ...state,
        history: [...state.history, action.move],
        error: null,
      };
      // Autoplay stops at the end of the line, or when the board leaves it.
      if (next.autoPlaying && next.line && !canGoForward(next)) {
        next = { ...next, autoPlaying: false };
      }
      return next.pending.length > 0 ? playQueue(next, next.pending) : next;
    }

    case "boardUndone":
      return { ...interrupt(state), history: state.history.slice(0, -1), error: null };

    case "boardReset": {
      const reset: NavigatorState<M> = {
        ...state,
        history: [],
        afterReset: [],
        autoPlaying: false,
        error: null,
      };
      return playQueue(reset, state.afterReset);
    }

    case "illegalMove":
      return { ...interrupt(state), error: ILLEGAL_MOVE_MESSAGE };
  }
}
