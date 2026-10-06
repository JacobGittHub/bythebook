import { defineConfig, devices } from "@playwright/test";

// Browser tests (plans/testing.md, D1). Vitest covers code that runs without a browser;
// everything that needs the running app is here.

// The test account's details, and the Supabase variables the dev server needs, live in
// .env.local locally and in repository secrets in CI.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No .env.local, as in CI.
}

const CI = Boolean(process.env.CI);
const PORT = 3000;

/** Signs the test account in once, for the specs that need an account (e2e/fixtures/account.ts). */
const setup = { name: "setup", testMatch: /auth\.setup\.ts/ };

/** Functional specs run in every browser and at phone sizes. Screenshots have their own project. */
const functional = {
  testIgnore: ["screens/**", "auth.setup.ts"],
  dependencies: ["setup"],
};

export default defineConfig({
  testDir: "e2e",
  // Reports and run output are gitignored, and `npm run test:e2e:clean` deletes them (D3).
  outputDir: "test-results",
  reporter: CI
    ? [["github"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  // The dev server compiles each page on its first visit, which can take a while.
  timeout: 60_000,
  expect: {
    timeout: 15_000,
    // CSS animations are finished before each screenshot.
    toHaveScreenshot: { animations: "disabled" },
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    setup,
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, ...functional },
    { name: "firefox", use: { ...devices["Desktop Firefox"] }, ...functional },
    { name: "webkit", use: { ...devices["Desktop Safari"] }, ...functional },
    { name: "phone-chromium", use: { ...devices["Pixel 7"] }, ...functional },
    { name: "phone-webkit", use: { ...devices["iPhone 14"] }, ...functional },
    // Screenshot tests run locally only, against Windows baselines (D8): Linux renders
    // fonts differently, so CI leaves this project out.
    {
      name: "screens",
      testDir: "e2e/screens",
      // Reduced motion stops the Overview's demos from cycling.
      use: { ...devices["Desktop Chrome"], reducedMotion: "reduce" },
      dependencies: ["setup"],
    },
  ],
  webServer: {
    command: CI ? "npm run start" : "npm run dev",
    url: `http://localhost:${PORT}/dashboard`,
    // Locally, a dev server that is already running is used as it is.
    reuseExistingServer: !CI,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
