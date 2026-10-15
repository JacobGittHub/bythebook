import { describe, expect, it } from "vitest";
import { expectNoViolations } from "@/lib/regions/testShapes";
import { BOOK_WINDOW_SIZES, PHONE, SPREAD, SPREAD_MIN_WIDTH, formFor, layoutBook } from "./layout";
import { bodyOffset, bookFrameCss } from "./frameCss";

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

describe("bodyOffset", () => {
  it("leaves a page's body exactly the window less the offset, at every listed window size", () => {
    const wrong: string[] = [];
    for (const size of BOOK_WINDOW_SIZES) {
      const form = formFor(size);
      const layout = layoutBook({ window: size, form, at: 0, pages: 8, slide: null, tabs: [], chapters: "names" });
      const body = layout.pages[0].body.height;
      const offset = bodyOffset(form, { width: size.width, height: 600 });
      if (size.height - offset !== body) wrong.push(`${size.name}: body ${body}, offset ${offset}`);
    }
    expectNoViolations(wrong);
  });
});
