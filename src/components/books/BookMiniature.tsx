import type { Miniature } from "@/lib/library/types";
import { cn } from "@/lib/utils";
import { familyColor } from "./viewParts";

/** The smallest block, in pixels, drawn with an outline; on a smaller one it would hide the fill. */
const MIN_OUTLINED = { width: 5, height: 3 };

type Props = {
  miniature: Miniature;
  /** The drawing's size in pixels; the miniature stretches to fill it. */
  width: number;
  height: number;
  className?: string;
};

/**
 * A book's icicle in miniature (`src/lib/library/miniature.ts`), drawn from its summary so the
 * list never loads a tree: one column per move, each block as tall as its share of the book's
 * lines, in its family's color. A book with several trees shows a rule between their bands.
 */
export function BookMiniature({ miniature, width, height, className }: Props) {
  const { units, depth, trees, blocks } = miniature;
  const columns = Math.max(depth, 1);
  const outlineColumns = width / columns >= MIN_OUTLINED.width;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${columns} ${units}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn("shrink-0 rounded-sm bg-muted", className)}
    >
      {blocks.map(([blockDepth, start, span, family], index) => (
        <rect
          key={index}
          x={blockDepth - 1}
          y={start}
          width={1}
          height={span}
          fill={familyColor(family)}
          stroke={outlineColumns && (span / units) * height >= MIN_OUTLINED.height ? "var(--bg-card)" : "none"}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {trees.slice(1).map(([start], index) => (
        <line
          key={index}
          x1={0}
          x2={columns}
          y1={start}
          y2={start}
          stroke="var(--text-primary)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
