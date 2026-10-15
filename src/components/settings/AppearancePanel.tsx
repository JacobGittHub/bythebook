"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { Label } from "@/components/shadcn/label";
import { Separator } from "@/components/shadcn/separator";
import { Switch } from "@/components/shadcn/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/shadcn/toggle-group";
import { useAppearance } from "@/context/Appearance";
import { MOTIONS, THEME_CHOICES, type Motion, type ThemeChoice } from "@/lib/appearance";

const THEME_LABELS: Record<ThemeChoice, { label: string; Icon: typeof Sun }> = {
  light: { label: "Light", Icon: Sun },
  dark: { label: "Dark", Icon: Moon },
  system: { label: "System", Icon: Monitor },
};

const MOTION_LABELS: Record<Motion, string> = { turn: "Page turn", none: "None" };

/**
 * The theme, how pages move (plans/book-ui.md D13) and the vibes switch (plans/vibes.md D2),
 * kept in this browser.
 */
export function AppearancePanel() {
  const { themeChoice, setThemeChoice, vibes, setVibes, motionChoice, motion, setMotion } = useAppearance();
  const reduced = motion === "none" && motionChoice !== "none";

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p id="theme-label" className="text-sm font-medium">
            Theme
          </p>
          <p className="text-xs text-muted-foreground">
            System follows your device&apos;s light or dark setting.
          </p>
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          aria-labelledby="theme-label"
          value={themeChoice}
          onValueChange={(value) => {
            if (value) setThemeChoice(value as ThemeChoice);
          }}
        >
          {THEME_CHOICES.map((choice) => {
            const { label, Icon } = THEME_LABELS[choice];
            return (
              <ToggleGroupItem key={choice} value={choice} className="px-2.5">
                <Icon aria-hidden="true" />
                {label}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </div>

      <Separator />

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p id="motion-label" className="text-sm font-medium">
            Page turns
          </p>
          <p className="text-xs text-muted-foreground">
            {reduced
              ? "Your device asks for reduced motion, so pages change at once."
              : "How the book moves from one chapter to another."}
          </p>
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          aria-labelledby="motion-label"
          value={motionChoice}
          onValueChange={(value) => {
            if (value) setMotion(value as Motion);
          }}
        >
          {MOTIONS.map((choice) => (
            <ToggleGroupItem key={choice} value={choice} className="px-2.5">
              {MOTION_LABELS[choice]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <Separator />

      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Label htmlFor="vibes-switch">Vibes</Label>
          <p className="text-xs text-muted-foreground">
            The frame around the board takes on the mood of the opening on it. The first vibes
            are still being made; with this off, you keep the plain look.
          </p>
        </div>
        <Switch id="vibes-switch" checked={vibes} onCheckedChange={setVibes} />
      </div>
    </div>
  );
}
