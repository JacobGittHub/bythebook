import { AppearancePanel } from "@/components/settings/AppearancePanel";
import { Panel, PanelLabel } from "@/components/ui/Panel";

export default function SettingsPage() {
  return (
    <main className="grid max-w-3xl gap-4">
      <header>
        <h1 className="font-heading text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          User profile, board preferences, engine defaults, and notification options.
        </p>
      </header>

      <section className="grid gap-1.5">
        <PanelLabel as="h2">Appearance</PanelLabel>
        <Panel className="p-3">
          <AppearancePanel />
        </Panel>
      </section>

      <section className="grid gap-1.5">
        <PanelLabel as="h2">Board &amp; play</PanelLabel>
        <div className="grid gap-2 md:grid-cols-2">
          <Panel as="article" className="p-3">
            <h3 className="text-sm font-medium">Board preferences</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Coordinates, move highlights, and flip behavior.
            </p>
          </Panel>
          <Panel as="article" className="p-3">
            <h3 className="text-sm font-medium">Account</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Profile details, export settings, and linked auth providers.
            </p>
          </Panel>
        </div>
      </section>
    </main>
  );
}
