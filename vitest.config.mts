import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resolve the `@/*` alias from tsconfig.json instead of repeating it here.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    // docs/docs.test.ts checks the agent docs against the code.
    include: ["src/**/*.test.ts", "docs/**/*.test.ts"],
  },
});
