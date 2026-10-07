import { isWhiteMove } from "@/lib/books/viewTree";
import { ICICLE_GAP, ICICLE_PAD, type IcicleLayout } from "@/lib/books/views/icicle";
import { familyColor, markClasses, rulerColumns, type RenderProps } from "./viewParts";

/** A block shows its move when it is at least this tall. */
const LABELLED_HEIGHT = 11;

/** D. Icicle: each move as a block, light for White's moves and dark for Black's. */
export function IcicleView({ tree, layout, marks, bind, family }: RenderProps & { layout: IcicleLayout }) {
  const pad = ICICLE_PAD;
  return (
    <>
      <g>
        {rulerColumns(tree.maxDepth, tree.root.ply).map(({ depth, number }) => (
          <text key={depth} x={pad.left + (depth - 0.5) * layout.colW} y={14} className="bv-ruler">
            {number}
          </text>
        ))}
      </g>
      {tree.nodes.map((node) => {
        const cell = layout.cells.get(node.id);
        if (!cell) return null;
        const white = isWhiteMove(node);
        const height = Math.max(cell.height - ICICLE_GAP, 0.8);
        const width = cell.width - ICICLE_GAP;
        return (
          <g key={node.id}>
            <rect
              x={cell.x}
              y={cell.y}
              width={width}
              height={height}
              rx={2}
              style={{ fill: familyColor(family.get(node.id)), fillOpacity: white ? 0.4 : 0.88 }}
              {...bind(node, `bv-cell${markClasses(marks, node.id)}`)}
            />
            {height >= LABELLED_HEIGHT && (
              <text
                x={cell.x + 3}
                y={cell.y + Math.min(height / 2 + 3.2, 12.5)}
                className={`bv-cell-label ${white ? "wm" : "bm"}`}
              >
                {node.san}
              </text>
            )}
          </g>
        );
      })}
    </>
  );
}
