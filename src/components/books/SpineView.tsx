import type { SpineLayout } from "@/lib/books/views/spine";
import { clashClass, familyColor, markClasses, moveClass, type RenderProps } from "./viewParts";

/**
 * E. Spine and ribs: the spine up to the selected position is solid, the rest of it dotted
 * ahead. Ribs are the other moves at each spine position.
 */
export function SpineView({
  layout,
  marks,
  bind,
  side,
  family,
}: RenderProps & { layout: SpineLayout }) {
  const { spine, ribs, midY, step } = layout;
  const selectedIndex = spine.findIndex(({ node }) => node.id === marks.selectedId);
  const ahead = (i: number) => selectedIndex >= 0 && i > selectedIndex;
  const xOf = (id: string) => spine.find(({ node }) => node.id === id)!.x;

  return (
    <>
      <g>
        {spine.slice(1).map(({ node, x }, i) => (
          <line
            key={node.id}
            x1={spine[i].x}
            y1={midY}
            x2={x}
            y2={midY}
            className={`bv-spine${ahead(i + 1) ? " ahead" : ""}`}
          />
        ))}
        {ribs.map((rib) => {
          const x0 = xOf(rib.from.id);
          return (
            <path
              key={rib.node.id}
              d={`M${x0},${midY} C${x0 + step * 0.5},${midY} ${rib.x - step * 0.55},${rib.y} ${rib.x},${rib.y}`}
              className={`bv-rib${markClasses(marks, rib.node.id)}`}
            />
          );
        })}
      </g>
      <g>
        {ribs.map((rib) => {
          const [move, count] = rib.label.split(" ");
          const marked = markClasses(marks, rib.node.id);
          return (
            <g key={rib.node.id}>
              <circle
                cx={rib.x}
                cy={rib.y}
                r={rib.r}
                className={`bv-rib-dot${marked}`}
                style={{ fill: familyColor(family.get(rib.node.id)) }}
              />
              <text x={rib.x + rib.r + 3} y={rib.y + 3.3} className={`bv-rib-label${marked}`}>
                {move} <tspan className="bv-rib-count">{count}</tspan>
              </text>
              <circle cx={rib.x} cy={rib.y} r={Math.max(rib.r + 3, 8)} {...bind(rib.node, "bv-hit-area")} />
            </g>
          );
        })}
        {spine.map(({ node, x }, i) => (
          <g key={node.id}>
            <circle
              cx={x}
              cy={midY}
              r={node.depth ? 4.2 : 5}
              className={`bv-node ${moveClass(node)}${clashClass(node, side)}${markClasses(marks, node.id)}`}
            />
            <text x={x} y={midY + 17} className={`bv-spine-label${ahead(i) ? " ahead" : ""}`}>
              {node.san ?? "Start"}
            </text>
            {node.ply % 2 === 1 && (
              <text x={x} y={midY - 11} className="bv-spine-num">
                {(node.ply + 1) / 2}.
              </text>
            )}
            <circle cx={x} cy={midY} r={9} {...bind(node, "bv-hit-area")} />
          </g>
        ))}
      </g>
    </>
  );
}
