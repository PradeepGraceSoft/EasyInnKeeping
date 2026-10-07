import { defineConfig } from "@playwright/test";

type TestEnvironment = "test1" | "trunk";

const environmentArgument = process.argv.find((argument) =>
  /^\$env:(test1|trunk)$/i.test(argument),
);
if (environmentArgument) {
  process.env.TEST_ENV = environmentArgument
    .slice("$env:".length)
    .toLowerCase();
  process.argv.splice(process.argv.indexOf(environmentArgument), 1);
}

if (process.argv.includes("--headed")) {
  process.env.PLAYWRIGHT_RUN_MODE = "headed";
}

const isHeaded = process.env.PLAYWRIGHT_RUN_MODE === "headed";
const configuredSlowMo = Number(process.env.PLAYWRIGHT_SLOW_MO ?? 100);
if (!Number.isFinite(configuredSlowMo) || configuredSlowMo < 0) {
  throw new Error(
    "PLAYWRIGHT_SLOW_MO must be a non-negative number of milliseconds.",
  );
}
const slowMo = isHeaded ? configuredSlowMo : 0;

const testEnvironment = (process.env.TEST_ENV ?? "trunk").toLowerCase();
if (testEnvironment !== "trunk" && testEnvironment !== "test1") {
  throw new Error(
    `Unknown TEST_ENV "${testEnvironment}". Expected "trunk" or "test1".`,
  );
}

const environment: TestEnvironment = testEnvironment;

const propertyProject = (
  name: string,
  propertyKey: string,
  testMatch: string[],
  options: { workers: number; testIgnore?: string[] },
) => ({
  name,
  testMatch,
  ...(options.testIgnore ? { testIgnore: options.testIgnore } : {}),
  workers: options.workers,
  metadata: { propertyKey, environment },
  use: { browserName: "chromium" as const },
});

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  workers: 4,
  reporter: [["html"], ["junit", { outputFile: "results.xml" }]],
  use: {
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    headless: !isHeaded,
    viewport: isHeaded ? null : { width: 1920, height: 1080 },
    launchOptions: {
      args: isHeaded ? ["--start-maximized"] : [],
      slowMo,
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  globalSetup: require.resolve("./global.setup"),
  globalTeardown: require.resolve("./global.teardown"),
  projects: [
    propertyProject(
      "property-a-5806",
      "A",
      [
        "**/SmokeRegularReservation.spec.ts",
        "**/SmokeSSOLogin.spec.ts",
        "**/Calendar/**/*.spec.ts",
        "**/PMS/Reservation/FindReservation.spec.ts",
        "**/PMS/Reservation/Package/ActivityTracking.spec.ts",
        "**/PMS/Reservation/Hourly/ActivityTracking.spec.ts",
        "**/POS/**/*.spec.ts",
        "**/PMS/Dashboard/RoomsCountMetric.spec.ts",
        "**/PMS/Dashboard/ReservationActivity.spec.ts",
        "**/PMS/Dashboard/PerformanceMetrics.spec.ts",
        "**/PMS/Dashboard/PieChart.spec.ts",
        "**/PMS/Dashboard/RevenueSummary.spec.ts",
        "**/PMS/Dashboard/GuestActivity.spec.ts",
        "**/PMS/Dashboard/Housekeeping.spec.ts",
      ],
      { workers: 1 },
    ),
    propertyProject(
      "property-5447",
      "B",
      [
        "**/SmokeRegularBilling.spec.ts",
        "**/PMS/**/*.spec.ts",
        "**/PMS/PaymentProcessing.spec.ts",
      ],
      {
        workers: 1,
        testIgnore: [
          "**/PMS/Dashboard/RoomsCountMetric.spec.ts",
          "**/PMS/Dashboard/ReservationActivity.spec.ts",
          "**/PMS/Dashboard/PerformanceMetrics.spec.ts",
          "**/PMS/Dashboard/PieChart.spec.ts",
          "**/PMS/Dashboard/RevenueSummary.spec.ts",
          "**/PMS/Dashboard/GuestActivity.spec.ts",
          "**/PMS/Dashboard/Housekeeping.spec.ts",
          "**/PMS/Reservation/Group/ActivityTracker.spec.ts",
          "**/PMS/Reservation/FindReservation.spec.ts",
          "**/PMS/Reservation/Package/ActivityTracking.spec.ts",
          "**/PMS/Reservation/Hourly/ActivityTracking.spec.ts",
        ],
      },
    ),
    propertyProject(
      "property-c-5652",
      "C",
      [
        "**/SmokeGroupReservation.spec.ts",
        "**/PMS/Reservation/Group/ActivityTracker.spec.ts",
        "**/OnlineBooking/**/*.spec.ts",
      ],
      {
        workers: 1,
        testIgnore: ["**/OnlineBooking/GuestHub/**/*.spec.ts"],
      },
    ),
    propertyProject(
      "property-c-5652-parallel",
      "C",
      ["**/OnlineBooking/GuestHub/**/*.spec.ts"],
      {
        workers: 4,
        testIgnore: ["**/OnlineBooking/GuestHub/Loyalty.spec.ts"],
      },
    ),
    propertyProject(
      "property-d-5807",
      "D",
      [
        "**/SmokeSharedReservation.spec.ts",
        "**/CRM/**/*.spec.ts",
        "**/OnlineBooking/GuestHub/Loyalty.spec.ts",
      ],
      {
        workers: 2,
        testIgnore: ["**/CRM/Lead.spec.ts", "**/CRM/Customer.spec.ts"],
      },
    ),
    propertyProject(
      "property-d-5807-parallel",
      "D",
      ["**/CRM/Lead.spec.ts", "**/CRM/Customer.spec.ts"],
      {
        workers: 4,
      },
    ),
    propertyProject("ota-property-a-1885", "A", ["**/OTA/**/*.spec.ts"], {
      workers: 1,
    }),
  ],
});
