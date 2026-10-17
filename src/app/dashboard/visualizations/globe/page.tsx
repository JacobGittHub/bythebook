import { LabHarness } from "@/components/lab/LabHarness";
import { VisualizationLevel } from "@/components/visualizations/VisualizationLevel";

export default function GlobePrototypePage() {
  return (
    <VisualizationLevel id="globe">
      <LabHarness view="globe" />
    </VisualizationLevel>
  );
}
