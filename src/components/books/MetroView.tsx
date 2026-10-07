import type { MetroLayout } from "@/lib/books/views/metro";
import { clashClass, familyColor, markClasses, type RenderProps } from "./viewParts";

/** Half the length of the bar across a route's last station. */
const TERMINUS = 5;

/**
 * C. Metro map: each line as a route of stations, colored by its family. Every route ends in
 * a terminus bar, and the main line and each family's first route carry its name there.
 */
export function MetroView({
  layout,
  marks,
  bind,
  side,
  family,
  names,
}: RenderProps & { layout: MetroLayout; names: ReadonlyMap<string, string> }) {
  const { points, tracks, colW } = layout;
  const at = (id: string) => points.get(id)!;

  return (
    <>
      <g>
        {tracks.map((track, index) => {
          const main = index === 0;
          const first = track.nodes[0];
          const familyStart = names.has(first.id);
          const width = main ? 5 : familyStart ? 4 : 2.6;
          const opacity = main || familyStart ? 1 : 0.75;
          const chain = track.from ? [track.from, ...track.nodes] : track.nodes;
          const last = track.nodes[track.nodes.length - 1];
          const end = at(last.id);
          const color = familyColor(family.get(last.id));
          return (
            <g key={first.id} style={{ opacity }}>
              {chain.slice(1).map((node, i) => {
                const p = at(chain[i].id);
                const c = at(node.id);
                let d = `M${p.x},${p.y} L${c.x},${c.y}`;
                // A branch drops straight down to its row, then runs into its first station.
                if (i === 0 && track.from) {
                  const dy = c.y - p.y;
                  const bend = colW * 0.9;
                  if (Math.abs(dy) > bend) d = `M${p.x},${p.y} V${c.y - Math.sign(dy) * bend} L${c.x},${c.y}`;
                }
                return (
                  <path
                    key={node.id}
                    d={d}
                    className={`bv-track${markClasses(marks, node.id)}`}
                    style={{ stroke: familyColor(family.get(node.id)) }}
                    strokeWidth={width}
                  />
                );
              })}
              {track.nodes.length > 0 && last.depth > 0 && (
                <line
                  x1={end.x}
                  x2={end.x}
                  y1={end.y - TERMINUS}
                  y2={end.y + TERMINUS}
                  className="bv-terminus"
                  style={{ stroke: color }}
                  strokeWidth={Math.max(width - 1, 2)}
                />
              )}
            </g>
          );
        })}
      </g>
      <g>
        {tracks.map((track, index) =>
          track.nodes.map((node) => {
            const c = at(node.id);
            const interchange = node.children.length > 1;
            const clash = clashClass(node, side);
            return (
              <g key={node.id}>
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={interchange ? 4.4 : 3}
                  className={`bv-station${interchange ? " interchange" : ""}${clash}${markClasses(marks, node.id)}`}
                  style={interchange || clash ? undefined : { stroke: familyColor(family.get(node.id)) }}
                />
                <text
                  x={c.x}
                  y={c.y + 13}
                  textAnchor="middle"
                  className={`bv-label${index === 0 ? "" : " minor"}${markClasses(marks, node.id)}`}
                  style={{ fontSize: "8.5px" }}
                >
                  {node.san ?? "Start"}
                </text>
                <circle cx={c.x} cy={c.y} r={7} {...bind(node, "bv-hit-area")} />
              </g>
            );
          }),
        )}
      </g>
      <g>
        {tracks.map((track) => {
          const name = names.get(track.nodes[0].id);
          if (!name) return null;
          const last = track.nodes[track.nodes.length - 1];
          const c = at(last.id);
          return (
            <text
              key={track.nodes[0].id}
              x={c.x + 9}
              y={c.y + 3.5}
              className="bv-label name"
              style={{ fill: familyColor(family.get(last.id)) }}
            >
              {name}
            </text>
          );
        })}
      </g>
    </>
  );
}
