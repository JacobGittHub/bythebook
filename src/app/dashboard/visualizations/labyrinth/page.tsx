import { RegionMapView } from "@/components/lab/RegionMapView";
import { parseRootCamera } from "@/lib/regions/camera";
import { InterimSpread } from "@/components/book/Spread";

type Props = {
  /** `camera` reopens a view, as a bug report's "Reproduce" address does. */
  searchParams: Promise<{ camera?: string }>;
};

// The Labyrinth: the region map prototype, reached from the Visualizations page. The
// viewer's books are read in the browser, from the library.
export default async function LabyrinthPage({ searchParams }: Props) {
  const { camera } = await searchParams;

  return (
    <InterimSpread>
      <div className="h-full min-h-0">
        <RegionMapView initialCamera={parseRootCamera(camera)} />
      </div>
    </InterimSpread>
  );
}
