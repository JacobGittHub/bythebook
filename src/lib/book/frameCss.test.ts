import { describe, expect, it } from "vitest";
import { PHONE, SPREAD, SPREAD_MIN_WIDTH } from "./layout";
import { bookFrameCss } from "./frameCss";

describe("bookFrameCss", () => {
  it("states the layout's numbers", () => {
    const css = bookFrameCss();
    expect(css).toContain(`--strip: ${SPREAD.strip}px;`);
    expect(css).toContain(`--book-side: ${SPREAD.deskGap + SPREAD.cover.side + SPREAD.edges.max}px;`);
    expect(css).toContain(`--tab-out: ${PHONE.edges.max + PHONE.tabReach}px;`);
    expect(css).toContain(`(width < ${SPREAD_MIN_WIDTH}px)`);
    expect(css).not.toMatch(/NaN|undefined/);
  });
});
