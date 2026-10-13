import { TrainBookList } from "@/components/training/TrainBookList";
import { Panel } from "@/components/ui/Panel";

export default function TrainPage() {
  return (
    <main className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold">Select a training book</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose the repertoire branch you want to drill today.
        </p>
      </div>
      <Panel className="border-dashed px-3 py-2">
        <p className="text-sm font-semibold">Coming soon</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          The trainer is still being built. What is here is an early scaffold.
        </p>
      </Panel>
      <TrainBookList />
    </main>
  );
}
