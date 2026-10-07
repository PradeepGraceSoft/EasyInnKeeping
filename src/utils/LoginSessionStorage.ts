import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { BrowserContext, Page } from "@playwright/test";

export type StorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;
export type SessionIdentity = { propertyId: string; username: string; reservationListUrl: string };
type SavedSession = StorageState & { identity?: SessionIdentity };

export class LoginSessionStorage {
  /** Read state before Playwright creates the test context. */
  static async load(
    identity: SessionIdentity,
    directory = path.resolve("LoginSessionStorage"),
  ): Promise<StorageState> {
    if (!/^[a-zA-Z0-9_-]+$/.test(identity.propertyId)) {
      throw new Error("A valid PropertyID is required for login session storage.");
    }
    try {
      const saved: SavedSession = JSON.parse(await readFile(
        path.join(directory, `${identity.propertyId}.json`), "utf8",
      ));
      if (!saved || !Array.isArray(saved.cookies) || !Array.isArray(saved.origins)) {
        return { cookies: [], origins: [] };
      }
      if (saved.identity && (
        saved.identity.propertyId !== identity.propertyId ||
        saved.identity.username !== identity.username ||
        saved.identity.reservationListUrl !== identity.reservationListUrl
      )) return { cookies: [], origins: [] };
      return { cookies: saved.cookies, origins: saved.origins };
    } catch (error) {
      if (!(error instanceof SyntaxError) && (error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      return { cookies: [], origins: [] };
    }
  }

  /** Validate saved authentication in the test's own page before returning to the test. */
  static async loginWithSavedSession(
    page: Page,
    identity: SessionIdentity,
    regularLogin: () => Promise<void>,
    directory = path.resolve("LoginSessionStorage"),
    preloadedState?: StorageState,
  ): Promise<void> {
    if (!/^[a-zA-Z0-9_-]+$/.test(identity.propertyId)) {
      throw new Error("A valid PropertyID is required for login session storage.");
    }
    const sessionPath = path.join(directory, `${identity.propertyId}.json`);
    const saved = preloadedState ?? await this.load(identity, directory);
    const context = page.context();
    const hasSavedState = saved.cookies.length > 0 || saved.origins.length > 0;
    let accepted = false;
    if (hasSavedState) {
      try {
        if (!preloadedState) await context.setStorageState(saved);
        await this.openReservationList(page, identity.reservationListUrl);
        accepted = true;
      } catch (error) {
        if (page.isClosed()) throw error;
        console.info(`[LoginSessionStorage] Saved session rejected for property ${identity.propertyId}; logging in.`);
      }
    }

    if (accepted) {
      console.info(`[LoginSessionStorage] Reused session for property ${identity.propertyId}.`);
      return;
    }

    // Discard stale authentication before the normal credentials/OTP flow.
    await page.goto("about:blank");
    if (hasSavedState || !preloadedState) {
      await context.setStorageState({ cookies: [], origins: [] });
    }
    await regularLogin();
    // Login already redirects here. Let the SPA finish initializing its session
    // before saving state; reloading immediately can interrupt that initialization.
    await this.verifyReservationList(page, identity.reservationListUrl);
    await saveSession();
    console.info(`[LoginSessionStorage] Saved fresh session for property ${identity.propertyId}.`);

    async function saveSession(): Promise<void> {
      await mkdir(directory, { recursive: true });
      const state = await context.storageState({ indexedDB: true });
      const temporaryPath = `${sessionPath}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporaryPath, JSON.stringify({ ...state, identity }), "utf8");
        await rename(temporaryPath, sessionPath);
      } finally {
        await rm(temporaryPath, { force: true });
      }
    }
  }

  private static async openReservationList(page: Page, url: string): Promise<void> {
    const response = await page.goto(url, { waitUntil: "domcontentloaded" });
    if (response && !response.ok()) throw new Error(`Reservation list request failed (HTTP ${response.status()}).`);
    await this.verifyReservationList(page, url);
  }

  private static async verifyReservationList(page: Page, url: string): Promise<void> {
    const list = page.getByRole("combobox", { name: /Reservation Type/ });
    const login = page.getByRole("textbox", { name: "Property Short Name" });
    await list.or(login).first().waitFor({ state: "visible", timeout: 10_000 });
    if (new URL(page.url()).pathname.replace(/\/$/, "").toLowerCase() !== new URL(url).pathname.replace(/\/$/, "").toLowerCase() ||
        !(await list.isVisible()) || await login.isVisible()) {
      throw new Error("The saved session did not open the authenticated reservation list.");
    }
  }
}
