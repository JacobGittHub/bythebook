import { BookViewIcon } from "@/components/books/BookViewRail";
import { Badge } from "@/components/shadcn/badge";
import { PanelLabel } from "@/components/ui/Panel";
import { RouteCard } from "@/components/ui/RouteCard";
import { SignInPrompt } from "@/components/ui/SignInPrompt";
import { VISUALIZATIONS, type PageLink } from "@/lib/auth/access";
import { getViewer } from "@/lib/auth/viewer";
import { isBookViewId } from "@/lib/books/views";

/** A small visualization's card shows a drawing of its view; its address ends with the view. */
function iconFor(page: PageLink) {
  const view = page.href.split("/").pop();
  return page.small && isBookViewId(view) ? <BookViewIcon view={view} /> : undefined;
}

export default async function VisualizationsPage() {
  const viewer = await getViewer();
  const featured = VISUALIZATIONS.filter((page) => page.featured);
  const live = VISUALIZATIONS.filter((page) => !page.featured && !page.small && page.status === "live");
  const small = VISUALIZATIONS.filter((page) => page.small);
  const prototypes = VISUALIZATIONS.filter(
    (page) => !page.featured && page.status === "prototype",
  );

  // A guest sees an account-only visualization listed, but not as a button.
  const card = (page: PageLink) => {
    const locked = page.access === "account" && !viewer.signedIn;
    return (
      <RouteCard
        key={page.href}
        href={locked ? undefined : page.href}
        label={page.label}
        summary={page.summary}
        status={page.status}
        featured={page.featured}
        icon={iconFor(page)}
        note={
          locked ? (
            <SignInPrompt
              action={page.featured ? `open the ${page.label}` : "open this prototype"}
              className={page.featured ? "text-sm" : "text-xs"}
            />
          ) : null
        }
      />
    );
  };

  return (
    <main className="space-y-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-heading text-2xl font-semibold">Visualizations</h1>
          <Badge variant="outline" className="font-normal text-muted-foreground">
            Experimental
          </Badge>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Different ways to see opening theory as a place you can move around in. These are
          experiments: they change often, and some may be replaced.
        </p>
      </div>

      <section>
        <PanelLabel as="h2" className="mb-1.5">Featured, in active development</PanelLabel>
        <div className="grid gap-2">{featured.map(card)}</div>
      </section>

      <section>
        <PanelLabel as="h2" className="mb-1.5">Available now</PanelLabel>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{live.map(card)}</div>
        <h3 className="mt-4 font-heading text-sm font-semibold">Small visualizations</h3>
        <p className="mb-2 max-w-3xl text-sm text-muted-foreground">
          Five ways to draw one book at a time beside a board: an example book, or one of your
          own once you have an account. The Explorer&apos;s side window can show any of them.
        </p>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{small.map(card)}</div>
      </section>

      <section>
        <PanelLabel as="h2" className="mb-1.5">Possible future visualizations</PanelLabel>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{prototypes.map(card)}</div>
      </section>
    </main>
  );
}
