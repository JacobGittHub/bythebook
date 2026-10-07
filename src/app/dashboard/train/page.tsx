import { TrainBookList } from "@/components/training/TrainBookList";

export default function TrainPage() {
  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-slate-950">Select a training book</h1>
        <p className="mt-2 text-slate-600">
          Choose the repertoire branch you want to drill today.
        </p>
      </div>
      <div className="rounded-3xl border border-dashed border-slate-200 p-5">
        <p className="text-sm font-semibold text-slate-800">Coming soon</p>
        <p className="mt-1 text-sm text-slate-500">
          The trainer is still being built. What is here is an early scaffold.
        </p>
      </div>
      <TrainBookList />
    </main>
  );
}
