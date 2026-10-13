import { Panel } from "@/components/ui/Panel";
import type { SessionResult } from "@/types/training";

export function SessionSummary({ result }: { result: SessionResult }) {
  return (
    <Panel className="px-3 py-2">
      <h3 className="font-heading font-semibold">Latest summary</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Accuracy {result.accuracy}% across {result.completedLines} completed lines.
      </p>
    </Panel>
  );
}
