import { test as base } from "./sso.fixture";
import { LoginSessionStorage, type StorageState } from "../utils/LoginSessionStorage";
import { PmsSessionUtils } from "../utils/PmsSessionUtils";
import { DashboardPage } from "../pages/DashboardPage";
import { HousekeepingPage } from "../pages/HousekeepingPage";

/** Import this test for PMS tests that need an authenticated reservation list. */
export const test = base.extend<{ pmsStorageState: StorageState; dashboardPage: DashboardPage; housekeepingPage: HousekeepingPage }>({
  dashboardPage: async ({ page, reservationDbHelper }, use) => {
    await use(new DashboardPage(page, reservationDbHelper));
  },
  housekeepingPage: async ({ page }, use) => {
    await use(new HousekeepingPage(page));
  },

  pmsStorageState: async ({ propertyContext }, use) => {
    await use(await LoginSessionStorage.load(PmsSessionUtils.getSessionIdentity()));
  },

  // Keep Playwright's built-in context lifecycle, options, tracing and isolation.
  // State is applied during context creation, before the test page is created.
  storageState: async ({ pmsStorageState }, use) => {
    await use(pmsStorageState);
  },

  page: [async ({ page, dbHelper, pmsStorageState }, use) => {
    await PmsSessionUtils.ensureAuthenticated(page, dbHelper, pmsStorageState);
    await use(page);
  }, { scope: "test", timeout: 90_000 }],
});

export { expect } from "@playwright/test";
