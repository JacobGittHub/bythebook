import { Button } from "@/components/shadcn/button";

export function BoardControls() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline">Flip board</Button>
      <Button size="sm" variant="outline">Show arrows</Button>
      <Button size="sm" variant="ghost">Reset line</Button>
    </div>
  );
}
