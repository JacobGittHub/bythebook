# Vision

Status: living · Updated: 2026-10-07 · Depends on: —

The shared picture of where ByTheBook is going. Every plan in this folder should serve
something here. Agents propose changes to this file; the user decides them.

## What ByTheBook is for

An opening trainer built around memorability: a user should come away thinking of an opening
as a place with neighbors, not a move list. The full statement is "Product goal" in
`AGENTS.md`.

## Who it's for right now

- **Guests, including recruiters.** They can try the app right away, without an account, on
  whatever device they open the link on.
- **Beta testers (about 100).** They keep their books and progress between visits.
- **The developer.** This is also a portfolio project, so how it's built (plans, tests,
  docs, agent workflow) is part of what it shows.

## Near term

1. Public deployment for guests and beta testers: `deployment.md`.
2. The Labyrinth as the working demo guests see first: `region-map.md`.
3. Shared data served from static files and the CDN: `data-delivery.md`.
4. Automatic checks on every push: `testing.md`.

## Principles

- Server load stays bounded and predictable. The browser does the heavy work, and the server
  does small, bounded reads and writes by key.
- One TypeScript codebase for the browser, the server and the offline scripts
  (`data-delivery.md` D1).
- The project rules in `AGENTS.md` apply to every plan.

> ME:

## Not decided

- The long-term visualization direction beyond the Labyrinth. The territory map and the
  hyperbolic panel are candidates (`docs/design/`), not commitments, and the static atlas is
  a draft (`atlas.md`).
- What comes after deployment: the trainer, puzzles, or a new visualization.
- Telemetry beyond what load testing needs (`load-testing.md` Q5).

> ME:
