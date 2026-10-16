import { describe, expect, it } from "vitest";
import { ZOOM_SHOWN } from "./camera";
import { PHONE, SPREAD, SPREAD_MIN_WIDTH } from "./layout";
import { TURN_MS, ZOOM_OUT_TURN_START } from "./turns";
import { bookFrameCss } from "./frameCss";

describe("bookFrameCss", () => {
  it("states the layout's numbers", () => {
    const css = bookFrameCss();
    expect(css).toContain(`--strip: ${SPREAD.strip}px;`);
    expect(css).toContain(`--book-side: ${SPREAD.deskGap + SPREAD.cover.side + SPREAD.edges.max}px;`);
    expect(css).toContain(`--tab-out: ${PHONE.edges.max + PHONE.tabReach}px;`);
    expect(css).toContain(`--tab-in: ${PHONE.tabIn}px;`);
    expect(css).toContain(`(width < ${SPREAD_MIN_WIDTH}px)`);
    expect(css).toContain(`--zoom-shown: ${ZOOM_SHOWN}px;`);
    expect(css).toContain(`--turn: ${TURN_MS}ms;`);
    expect(css).toContain(`:root[data-zoom="out"] { --turn-start: ${ZOOM_OUT_TURN_START}ms; }`);
    expect(css).not.toMatch(/NaN|undefined/);
  });
});
