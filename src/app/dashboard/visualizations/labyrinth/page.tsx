import { RegionMapView } from "@/components/lab/RegionMapView";
import { VisualizationLevel } from "@/components/visualizations/VisualizationLevel";
import { parseRootCamera } from "@/lib/regions/camera";

type Props = {
  /** `camera` reopens a view, as a bug report's "Reproduce" address does. */
  searchParams: Promise<{ camera?: string }>;
};

// The Labyrinth: the region map prototype, a page of the Visualizations chapter. The viewer's
// books are read in the browser, from the library.
export default async function LabyrinthPage({ searchParams }: Props) {
  const { camera } = await searchParams;

  return (
    <VisualizationLevel id="labyrinth">
      <RegionMapView initialCamera={parseRootCamera(camera)} />
    </VisualizationLevel>
  );
}
