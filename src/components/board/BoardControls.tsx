import { Button } from "@/components/ui/Button";

export function BoardControls() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="secondary">Flip board</Button>
      <Button variant="secondary">Show arrows</Button>
      <Button variant="ghost">Reset line</Button>
    </div>
  );
}
