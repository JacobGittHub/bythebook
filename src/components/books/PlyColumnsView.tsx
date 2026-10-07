import { PLY_COLUMNS_PAD, type PlyColumnsLayout } from "@/lib/books/views/plyColumns";
import { clashClass, markClasses, moveClass, rulerColumns, type RenderProps } from "./viewParts";

/** Labels show on branches at least this big, near the root, and on the selected or hovered line. */
const LABELLED_SIZE = 10;

/** A. Ply columns: every position as a dot in its ply's column. */
export function PlyColumnsView({ tree, layout, marks, bind, side, weight }: RenderProps & { layout: PlyColumnsLayout }) {
  const { points, colW } = layout;
  const pad = PLY_COLUMNS_PAD;
  const at = (id: string) => points.get(id)!;

  return (
    <>
      <g>
        {rulerColumns(tree.maxDepth, tree.root.ply).map(({ depth, number }) => {
          const x = pad.left + depth * colW;
          return (
            <g key={depth}>
              <line x1={x} x2={x} y1={pad.top - 10} y2={layout.height - pad.bottom + 6} className="bv-grid" />
              <text x={x} y={13} className="bv-ruler">
                {number}
              </text>
            </g>
          );
        })}
      </g>
      <g>
        {tree.nodes.map((node) => {
          if (!node.parent) return null;
          const p = at(node.parent.id);
          const c = at(node.id);
          const k = colW * 0.55;
          return (
            <path
              key={node.id}
              d={`M${p.x},${p.y} C${p.x + k},${p.y} ${c.x - k},${c.y} ${c.x},${c.y}`}
              className={`bv-edge${markClasses(marks, node.id)}`}
              strokeWidth={0.7 + 3.3 * weight(node)}
            />
          );
        })}
      </g>
      <g>
        {tree.nodes.map((node) => {
          const c = at(node.id);
          return (
            <circle
              key={node.id}
              cx={c.x}
              cy={c.y}
              r={node.depth ? 2.8 : 4.2}
              className={`bv-node ${moveClass(node)}${clashClass(node, side)}${markClasses(marks, node.id)}`}
            />
          );
        })}
      </g>
      <g>
        {tree.nodes.map((node) => {
          const c = at(node.id);
          // A line's last move is labelled only when rows are far enough apart for its text.
          const labelled =
            (node.size >= LABELLED_SIZE || node.depth <= 3) && (node.children.length > 0 || layout.rowH >= 12);
          // White's moves are labelled above their dot and Black's below, so neighbours don't collide.
          const above = node.depth === 0 || node.ply % 2 === 1;
          return (
            <text
              key={node.id}
              x={c.x}
              y={above ? c.y - 5 : c.y + 11}
              textAnchor="middle"
              className={`bv-label${labelled ? "" : " minor"}${markClasses(marks, node.id)}`}
            >
              {node.san ?? "Start"}
            </text>
          );
        })}
      </g>
      <g>
        {tree.nodes.map((node) => {
          const c = at(node.id);
          return <circle key={node.id} cx={c.x} cy={c.y} r={6.5} {...bind(node, "bv-hit-area")} />;
        })}
      </g>
    </>
  );
}
