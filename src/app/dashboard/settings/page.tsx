import { AppearancePanel } from "@/components/settings/AppearancePanel";
import { Panel, PanelLabel } from "@/components/ui/Panel";
import { InterimSpread } from "@/components/book/Spread";

// Moved from the Overview (plans/book-ui.md D10). The Settings step lays them out on its right
// page, with a message from the developer.
const deploymentNotes = [
  "ByTheBook is a solo project in beta, hosted on the free tiers of Vercel and Supabase. It may be slow to wake up after a quiet spell.",
  "Master-game statistics come from the Lichess masters database. They are saved on the server the first time anyone asks for a position, and every named opening is already saved.",
  "The engine is Stockfish running in your own browser, so its speed depends on your device.",
  "Accounts are limited to about 100 beta testers, and each needs a one-time beta key.",
];

export default function SettingsPage() {
  return (
    <InterimSpread>
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

        <section className="grid gap-1.5">
          <PanelLabel as="h2">About this deployment</PanelLabel>
          <Panel className="grid gap-2 py-2 pr-3 pl-7">
            <ul className="list-disc space-y-1.5 text-sm text-muted-foreground">
              {deploymentNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <p className="-ml-4 text-sm text-muted-foreground">
              Thank you to{" "}
              <a className="font-medium text-foreground underline" href="https://lichess.org" target="_blank" rel="noreferrer">
                Lichess
              </a>
              , whose free and open masters database gives the Explorer its statistics.
            </p>
          </Panel>
        </section>
      </main>
    </InterimSpread>
  );
}
