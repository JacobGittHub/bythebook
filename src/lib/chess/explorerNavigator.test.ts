import { describe, expect, it } from "vitest";
import {
  ILLEGAL_MOVE_MESSAGE,
  canGoForward,
  createNavigator,
  lineIndex,
  navigatorReducer,
  remainingLineMoves,
  type NavigatorAction,
  type NavigatorState,
} from "@/lib/chess/explorerNavigator";
import type { CatalogMatch, Move } from "@/types/chess";

const e4: Move = { san: "e4", uci: "e2e4" };
const e5: Move = { san: "e5", uci: "e7e5" };
const nf3: Move = { san: "Nf3", uci: "g1f3" };
const c5: Move = { san: "c5", uci: "c7c5" };

const openGame: CatalogMatch = {
  eco: "C20",
  name: "King's Pawn Game",
  pgn: "1. e4 e5 2. Nf3",
  moves: [e4, e5, nf3],
  moveNode: { id: "root", san: null, uci: null, fen: "", children: [] },
};

function run(state: NavigatorState, ...actions: NavigatorAction[]): NavigatorState {
  return actions.reduce(navigatorReducer, state);
}

/** Commands the fake board has run. Like BoardInteractive, it runs each one once. */
const ran = new WeakSet<object>();

/** The board's side: it runs the last command and reports back. */
function boardRuns(state: NavigatorState): NavigatorState {
  const command = state.command;
  if (!command || ran.has(command)) return state;
  ran.add(command);
  if (command.type === "reset") return navigatorReducer(state, { type: "boardReset" });
  if (command.type === "undo") return navigatorReducer(state, { type: "boardUndone" });
  const uci = `${command.from}${command.to}${command.promotion ?? ""}`;
  return navigatorReducer(state, { type: "boardMoved", move: { san: uci, uci } });
}

/** Lets the board run commands until the navigator stops sending new ones. */
function settle(state: NavigatorState): NavigatorState {
  let current = state;
  for (let i = 0; i < 50; i++) {
    const next = boardRuns(current);
    if (next === current) return current;
    current = next;
  }
  throw new Error("The navigator never settled.");
}

const uci = (state: NavigatorState) => state.history.map((move) => move.uci);

describe("explorerNavigator", () => {
  it("starts empty, or plays its initial moves one at a time", () => {
    expect(createNavigator()).toMatchObject({ history: [], pending: [], command: null });

    const start = createNavigator([e4, e5]);
    expect(start.command).toMatchObject({ type: "move", from: "e2", to: "e4" });
    expect(start.pending).toEqual([e5]);
    expect(uci(settle(start))).toEqual(["e2e4", "e7e5"]);
  });

  it("gives every command a fresh id", () => {
    const ids = new Set<string>();
    let state = createNavigator();
    for (const move of [e4, e5, nf3]) {
      state = settle(run(state, { type: "playMove", move }));
      ids.add(state.command!.id);
    }
    expect(ids.size).toBe(3);
  });

  it("steps along a highlighted line and stops at its end", () => {
    let state = run(createNavigator(), { type: "highlight", line: openGame });
    expect(lineIndex(state)).toBe(0);
    expect(remainingLineMoves(state)).toEqual([e4, e5, nf3]);

    state = settle(run(state, { type: "stepForward" }));
    expect(uci(state)).toEqual(["e2e4"]);
    expect(lineIndex(state)).toBe(1);

    state = settle(run(state, { type: "goToEnd" }));
    expect(uci(state)).toEqual(["e2e4", "e7e5", "g1f3"]);
    expect(canGoForward(state)).toBe(false);
    expect(run(state, { type: "stepForward" })).toBe(state);
  });

  it("knows when the board has left the line", () => {
    const state = settle(
      run(createNavigator(), { type: "highlight", line: openGame }, { type: "playMove", move: e4 }),
    );
    const off = settle(run(state, { type: "playMove", move: c5 }));
    expect(lineIndex(off)).toBe(-1);
    expect(remainingLineMoves(off)).toEqual([]);
    expect(run(off, { type: "toggleAutoPlay" }).autoPlaying).toBe(false);
  });

  it("autoplays one move per tick and stops at the end of the line", () => {
    let state = run(createNavigator(), { type: "highlight", line: openGame }, { type: "toggleAutoPlay" });
    expect(state.autoPlaying).toBe(true);

    for (let i = 0; i < 3; i++) state = settle(run(state, { type: "autoPlayTick" }));
    expect(uci(state)).toEqual(["e2e4", "e7e5", "g1f3"]);
    expect(state.autoPlaying).toBe(false);
    expect(run(state, { type: "autoPlayTick" })).toBe(state);
  });

  it("stops autoplay when the user plays off the line, and on any navigation", () => {
    const playing = run(createNavigator(), { type: "highlight", line: openGame }, { type: "toggleAutoPlay" });
    expect(settle(run(playing, { type: "playMove", move: c5 })).autoPlaying).toBe(false);

    const stepped = settle(run(playing, { type: "autoPlayTick" }));
    for (const action of [{ type: "undo" }, { type: "goToStart" }, { type: "toggleAutoPlay" }] as const) {
      expect(run(stepped, action).autoPlaying).toBe(false);
    }
  });

  it("goes back to an earlier position through a reset and a replay", () => {
    let state = settle(run(createNavigator([e4, e5, nf3])));
    state = run(state, { type: "goToLine", moves: [e4] });
    expect(state.command?.type).toBe("reset");
    expect(state.afterReset).toEqual([e4]);

    state = settle(state);
    expect(uci(state)).toEqual(["e2e4"]);
    expect(state.afterReset).toEqual([]);
  });

  it("undoes and goes to the start only when there is a move to take back", () => {
    const empty = createNavigator();
    expect(run(empty, { type: "undo" })).toBe(empty);
    expect(run(empty, { type: "goToStart" })).toBe(empty);

    const played = settle(createNavigator([e4, e5]));
    expect(uci(settle(run(played, { type: "undo" })))).toEqual(["e2e4"]);
    expect(uci(settle(run(played, { type: "goToStart" })))).toEqual([]);
  });

  it("reports an illegal move, drops the queue, and clears the error on the next move", () => {
    const queued = createNavigator([e4, e5]);
    const failed = run(queued, { type: "illegalMove" });
    expect(failed.error).toBe(ILLEGAL_MOVE_MESSAGE);
    expect(failed.pending).toEqual([]);

    expect(settle(run(failed, { type: "playMove", move: e4 })).error).toBeNull();
  });

  it("clears the highlighted line without touching the board", () => {
    const state = settle(run(createNavigator([e4]), { type: "highlight", line: openGame }));
    const cleared = run(state, { type: "clearLine" });
    expect(cleared.line).toBeNull();
    expect(cleared.history).toBe(state.history);
    expect(cleared.command).toBe(state.command);
  });
});
