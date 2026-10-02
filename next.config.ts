import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  redirects: async () => [
    // There is no landing page: a visitor goes straight to the dashboard, guest or not.
    { source: "/", destination: "/dashboard", permanent: false },
    // The Library page used to be called Repertoire.
    { source: "/dashboard/repertoire", destination: "/dashboard/library", permanent: false },
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
