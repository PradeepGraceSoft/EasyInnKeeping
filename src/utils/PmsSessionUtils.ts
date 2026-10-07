import type { Browser, BrowserContext, Page } from "@playwright/test";
import type { Cookie } from "playwright-core";
import { SSOLoginPage } from "../pages/SSOLoginPage";
import { SSODatabaseHelper } from "./DBHelper/SSODatabaseHelper";
import { ConfigManager } from "./ConfigManager";
import { Routes } from "../constants/Routes";
import { LoginSessionStorage, type SessionIdentity, type StorageState } from "./LoginSessionStorage";

export class PmsSessionUtils {
  static getSessionIdentity(): SessionIdentity {
    // Match the SPA's canonical deployment path, preserving the /list route.
    const baseUrl = new URL(`${ConfigManager.branch.verifyLogin.replace(/\/$/, "")}/`);
    baseUrl.pathname = baseUrl.pathname.toUpperCase();
    return {
      propertyId: ConfigManager.testData.propertyId,
      username: ConfigManager.testData.loginName,
      reservationListUrl: new URL(Routes.PMS_RESERVATION_LIST_URL, baseUrl).href,
    };
  }

  /**
   * Open the reservation list using the configured property's saved session.
   * Falls back to credentials/OTP and saves fresh state when needed.
   * ConfigManager must have the desired property selected, and the database
   * must be connected for OTP retrieval (provided by the sso fixture's dbHelper).
   */
  static async ensureAuthenticated(
    page: Page,
    dbHelper: SSODatabaseHelper = new SSODatabaseHelper(),
    preloadedState?: StorageState,
  ): Promise<void> {
    const credentials = ConfigManager.testData;
    await LoginSessionStorage.loginWithSavedSession(
      page,
      this.getSessionIdentity(),
      () => new SSOLoginPage(page, dbHelper).regularPropertyLogin(
        credentials.propertyShortName, credentials.loginName, credentials.password,
      ),
      undefined,
      preloadedState,
    );
  }

  static async createAuthenticatedCookies(
    browser: Browser,
  ): Promise<Cookie[]> {
    const loginContext = await browser.newContext();

    try {
      const page = await loginContext.newPage();
      await this.ensureAuthenticated(page);

      return await loginContext.cookies();
    } finally {
      await loginContext.close();
    }
  }

  static async restoreCookies(
    context: BrowserContext,
    cookies: Cookie[],
  ): Promise<void> {
    await context.addCookies(cookies);
  }
}
