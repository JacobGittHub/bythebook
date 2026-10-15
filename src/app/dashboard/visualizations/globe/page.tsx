import { LabHarness } from "@/components/lab/LabHarness";
import { InterimSpread } from "@/components/book/Spread";

export default function GlobePrototypePage() {
  return (
    <InterimSpread>
      <LabHarness view="globe" />
    </InterimSpread>
  );
}
