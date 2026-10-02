import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  redirects: async () => [
    // There is no landing page: a visitor goes straight to the dashboard, guest or not.
    { source: "/", destination: "/dashboard", permanent: false },
    // The Library page used to be called Repertoire.
    { source: "/dashboard/repertoire", destination: "/dashboard/library", permanent: false },
    // The opening tree and the Lab's prototypes moved under the Visualizations page. The tree
    // was called the Atlas until that name was kept for the static region map
    // (plans/atlas.md); drop its second redirect when that map takes the address.
    { source: "/dashboard/atlas", destination: "/dashboard/visualizations/treemap", permanent: false },
    { source: "/dashboard/visualizations/atlas", destination: "/dashboard/visualizations/treemap", permanent: false },
    { source: "/dashboard/lab", destination: "/dashboard/visualizations", permanent: false },
    // The region map prototype was listed as "Regions" before it was named the Labyrinth.
    { source: "/dashboard/visualizations/regions", destination: "/dashboard/visualizations/labyrinth", permanent: false },
  ],
  headers: async () => [
    {
      // Required for SharedArrayBuffer — enables multi-threaded Stockfish WASM.
      source: "/(.*)",
      headers: [
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
      ],
    },
  ],
};

export default nextConfig;
