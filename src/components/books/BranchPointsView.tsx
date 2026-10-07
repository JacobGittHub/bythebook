import { lineText, moveLabel } from "@/lib/books/viewTree";
import { LABEL_CHAR_W } from "@/lib/books/views/common";
import { BRANCH_POINTS_PAD, type BranchPointsLayout, type BranchSegment } from "@/lib/books/views/branchPoints";
import { clashClass, markClasses, moveClass, rulerColumns, type RenderProps } from "./viewParts";

/** The stretch's moves as far as they fit before its end, else its last move, else nothing. */
function stretchLabel(s: BranchSegment): string {
  const full = lineText(s.run);
  const fits = Math.floor((s.x - s.fromX - 9) / LABEL_CHAR_W);
  if (full.length <= fits) return full;
  const last = moveLabel(s.end);
  return fits >= last.length + 1 ? `…${last}` : "";
}

/** B. Branch points: each stretch of single moves as one line ending at the next split. */
export function BranchPointsView({ tree, layout, marks, bind, side }: RenderProps & { layout: BranchPointsLayout }) {
  const pad = BRANCH_POINTS_PAD;
  return (
    <>
      <g>
        {rulerColumns(tree.maxDepth, tree.root.ply).map(({ depth, number }) => {
          const x = pad.left + depth * layout.colW;
          return (
            <g key={depth}>
              <line x1={x} x2={x} y1={pad.top - 10} y2={layout.height - pad.bottom + 8} className="bv-grid" />
              <text x={x} y={13} className="bv-ruler">
                {number}
              </text>
            </g>
          );
        })}
      </g>
      {layout.segments.map((s) => {
        const id = s.end.id;
        const text = stretchLabel(s);
        const marked = markClasses(marks, id);
        return (
          <g key={id}>
            <path d={`M${s.fromX},${s.fromY} V${s.y} H${s.x}`} className={`bv-seg${marked}`} />
            <path d={`M${s.fromX},${s.y} H${s.x}`} {...bind(s.end, "bv-seg-hit")} />
            {text && (
              <text x={s.fromX + 5} y={s.y - 4} className={`bv-label${marked}`}>
                {text}
              </text>
            )}
            {s.children.length ? (
              <rect
                x={s.x - 3.5}
                y={s.y - 3.5}
                width={7}
                height={7}
                rx={1.5}
                {...bind(s.end, `bv-branch${clashClass(s.end, side)}${marked}`)}
              />
            ) : (
              <>
                <circle cx={s.x} cy={s.y} r={3} className={`bv-node ${moveClass(s.end)}${marked}`} />
                <circle cx={s.x} cy={s.y} r={7} {...bind(s.end, "bv-hit-area")} />
              </>
            )}
            {s.folded > 0 && (
              <text x={s.x + 6} y={s.children.length ? s.y + 12 : s.y + 3.2} className="bv-stub">
                +{s.folded}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}
