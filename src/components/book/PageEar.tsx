import Link from "next/link";

/**
 * A page ear (plans/book-ui.md D21, D22): the page's top corner turned down like a dog-ear, which
 * turns to the level it leads to. The turned-down paper carries a short word, since a control
 * that routes says so in words (AGENTS.md "UI"), and its accessible name is the whole
 * destination. Under the fold is the next leaf's paper. It lifts a little on hover. A page passes
 * it as its `ear` (`Spread`), which lays it on the page's corner.
 */
export function PageEar({
  side,
  word,
  label,
  href,
  size = "single",
}: {
  side: "left" | "right";
  /** The word on the fold, such as "Shelf". */
  word: string;
  /** Where it goes, in full, such as "Back to the shelf". */
  label: string;
  href: string;
  /** A two-fold ear's outer or inner fold. */
  size?: "single" | "outer" | "inner";
}) {
  return (
    <Link href={href} aria-label={label} title={label} data-side={side} data-size={size} className="book-ear">
      <span className="book-ear-under" aria-hidden />
      <span className="book-ear-shade" aria-hidden>
        <span className="book-ear-flap" />
      </span>
      <span className="book-ear-word" aria-hidden>
        {word}
      </span>
    </Link>
  );
}
