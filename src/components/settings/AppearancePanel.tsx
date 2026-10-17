"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { Switch } from "@/components/shadcn/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/shadcn/toggle-group";
import { useAppearance } from "@/context/Appearance";
import { MOTIONS, THEME_CHOICES, type Motion, type ThemeChoice } from "@/lib/appearance";
import { SettingRow } from "./SettingRow";

const THEME_LABELS: Record<ThemeChoice, { label: string; Icon: typeof Sun }> = {
  light: { label: "Light", Icon: Sun },
  dark: { label: "Dark", Icon: Moon },
  system: { label: "System", Icon: Monitor },
};

const MOTION_LABELS: Record<Motion, string> = { turn: "Page turn", none: "None" };

/**
 * The theme, the vibes switch (plans/vibes.md D2) and how pages move (plans/book-ui.md D13),
 * kept in this browser, as rows of the Settings page.
 */
export function AppearancePanel() {
  const { themeChoice, setThemeChoice, vibes, setVibes, motionChoice, motion, setMotion } = useAppearance();
  const reduced = motion === "none" && motionChoice !== "none";

  return (
    <div className="flex flex-col">
      <SettingRow label="Theme" labelId="theme-label" note="System follows your device's light or dark setting.">
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
      </SettingRow>

      <SettingRow
        label="Vibes"
        labelId="vibes-label"
        note="A vibe dresses the book for the opening on the board, never the strip around it. The first vibes are still being made; the same switch sits at the top right."
      >
        <Switch aria-labelledby="vibes-label" checked={vibes} onCheckedChange={setVibes} />
        <span className="text-sm">{vibes ? "On" : "Off"}</span>
      </SettingRow>

      <SettingRow
        label="Page turns"
        labelId="motion-label"
        note={
          reduced
            ? "Your device asks for reduced motion, so pages change at once."
            : "How the book moves from one chapter to another. None whenever your device asks for less motion."
        }
      >
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
      </SettingRow>

      <SettingRow label="Music" note="Comes with vibes." />
    </div>
  );
}
