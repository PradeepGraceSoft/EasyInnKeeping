import type { Locator, Page } from "@playwright/test";
import { test as base, expect } from "../../../src/fixtures/pms.fixture";
import { AlertMessages } from "../../../src/constants/AlertMessages";

type Activity = "Arrival" | "Departure" | "Stayover" | "Checked In";

class ReservationActivityCard {
  private readonly card: Locator;

  constructor(private readonly page: Page) {
    this.card = page.getByText("Reservation Activity", { exact: true })
      .locator("xpath=ancestor::*[.//table][1]");
  }

  async open(day: "Today" | "Tomorrow"): Promise<void> {
    // Activity validation must not depend on unrelated metric-card assertions.
    const navigate = async (action: () => Promise<void>, selectedDay: string) => {
      const [response] = await Promise.all([
        this.page.waitForResponse(response =>
          new URL(response.url()).pathname.endsWith("/Lists/GetCounts") &&
          response.request().postDataJSON()?.Day === selectedDay),
        action(),
      ]);
      expect(response.ok()).toBeTruthy();
      await response.finished();
    };
    await navigate(() => this.page.getByRole("link", { name: "dashboard icon Dashboard", exact: true }).click(), "Today");
    if (day === "Tomorrow") {
      await navigate(() => this.page.getByRole("button", { name: "Tomorrow", exact: true }).click(), day);
    }
    await expect(this.page.getByRole("button", { name: day, exact: true })
      .and(this.page.locator('[aria-pressed="true"], .btn-day-toggle.active'))).toBeVisible();
  }

  async select(activity: Activity): Promise<void> {
    await expect(this.card).toBeVisible();
    await this.card.getByRole("tab", { name: activity, exact: true })
      .or(this.card.getByRole("button", { name: activity, exact: true })).click();
    await expect(this.card.getByRole("columnheader", { name: /^Res\. No$/i })).toBeVisible();
  }

  // Read every page: an absent row on the first page is not an exclusion check.
  private async readRows(): Promise<string[][]> {
    const first = this.card.getByRole("button", { name: "First page", exact: true });
    const next = this.card.getByRole("button", { name: "Next page", exact: true });
    const range = this.card.locator(".mat-mdc-paginator-range-label, .mat-paginator-range-label");
    if (await first.isVisible() && await first.isEnabled()) {
      const previousRange = await range.innerText();
      await first.click();
      await expect(range).not.toHaveText(previousRange);
    }
    const result: string[][] = [];
    for (let index = 0; index < 1000; index++) {
      const rows = this.card.locator("tbody tr");
      for (const row of await rows.all()) {
        const cells = await row.getByRole("cell").allTextContents();
        if (cells.length > 1) result.push(cells.map(cell => cell.trim()));
      }
      if (!(await next.isVisible()) || await next.isDisabled()) return result;
      const previousRange = await range.innerText();
      await next.click();
      await expect(range).not.toHaveText(previousRange);
    }
    throw new Error("Reservation Activity pagination did not terminate.");
  }

  async verify(activity: Activity, included: string, excluded?: string,
    dates?: { arrival: string; departure: string }, status?: RegExp, guestName?: string): Promise<void> {
    await this.select(activity);
    await expect(async () => {
      const rows = await this.readRows();
      const matching = rows.filter(row => row[0] === included);
      expect(matching.length, `${activity} should contain reservation ${included}`).toBeGreaterThan(0);
      if (guestName !== undefined) {
        expect(guestName, "The reservation screen must contain a guest name").not.toBe("");
        expect(matching[0][3].replace(/\s+/g, " "), `Guest name for reservation ${included}`).toBe(guestName);
      }
      if (excluded) {
        expect(rows.map(row => row[0]), `${activity} should exclude reservation ${excluded}`)
          .not.toContain(excluded);
      }
      if (dates) {
        const format = (date: string) => {
          const [year, month, day] = date.split("-");
          return `${month}/${day}/${year}`;
        };
        expect(matching[0][1]).toBe(format(dates.arrival));
        expect(matching[0][2]).toBe(format(dates.departure));
      }
      if (status) {
        const headers = await this.card.getByRole("columnheader").allTextContents();
        const statusIndex = headers.findIndex(header => /^room status$/i.test(header.trim()));
        expect(statusIndex, "Reservation Activity should have a Room Status column").toBeGreaterThanOrEqual(0);
        expect(matching[0][statusIndex]).toMatch(status);
      }
    }).toPass({ timeout: 15_000 });
  }
}

type VerifyActivity = (activity: Activity, day: "Today" | "Tomorrow") => Promise<void>;
const test = base.extend<{
  activityCard: ReservationActivityCard;
  verifyExistingOrNewReservation: VerifyActivity;
}>({
  activityCard: async ({ page }, use) => use(new ReservationActivityCard(page)),
  verifyExistingOrNewReservation: async ({
    activityCard, reservationDbHelper, reservationPage, findReservationPage, reservationApi,
  }, use) => {
    await use(async (activity, day) => {
      test.setTimeout(180_000);
      const offset = day === "Today" ? 0 : 1;
      const date = await reservationDbHelper.getCurrentDate(offset);
      const created: string[] = [];
      const track = (number: string) => { created.push(number); };
      let failed = false;
      try {
        let number = await test.step("Find an existing " + day + " " + activity + " reservation", () =>
          reservationDbHelper.findReservationForActivity(date, activity));
        if (number) {
          await test.step("Open existing reservation " + number, async () => {
            await findReservationPage.openReservation(number!);
          });
        } else {
          number = await test.step("Create a qualifying reservation because none exists", async () => {
            if (activity === "Departure") return reservationPage.createDepartureReservation(findReservationPage, date, track);
            if (activity === "Stayover") return reservationPage.createStayoverReservation(findReservationPage, date, -1, 1, track);
            const confirmation = await reservationPage.createArrivalReservation(findReservationPage, date, track);
            if (activity === "Checked In") {
              await reservationPage.selectReservationStatus("Checked-In");
              await reservationPage.clickSaveButton();
              await reservationPage.verifyAlertMessage(AlertMessages.RESERVATION_SAVED_SUCCESS);
            }
            return confirmation;
          });
        }
        const guestName = await reservationPage.getGuestFullName();
        await reservationPage.clickCloseButton();
        const stay = await reservationDbHelper.getReservationStayDates(number);
        expect(stay).not.toBeNull();
        const status = activity === "Checked In" ? /^Checked[\s-]*In$/i : undefined;
        if (status) expect(stay!.status).toMatch(status);
        await test.step("Open " + day + " Reservation Activity > " + activity + " and verify #" + number + " and guest " + guestName, async () => {
          await activityCard.open(day);
          await activityCard.verify(activity, number!, undefined, stay!, status, guestName);
        });
        expect(await reservationDbHelper.getCurrentDate(offset), "Server date should remain unchanged").toBe(date);
      } catch (error) {
        failed = true;
        throw error;
      } finally {
        // Existing reservations are read-only; delete only successful test-created data.
        if (!failed) for (const number of created) await reservationApi.deleteReservation(number);
      }
    });
  },
});

test.describe("Dashboard Reservation Activity", () => {
  test("Verify Today Arrival reservation number and guest name in the Arrival tab", async ({ verifyExistingOrNewReservation }) => {
    await verifyExistingOrNewReservation("Arrival", "Today");
  });

  test("Verify Today Departure reservation number and guest name in the Departure tab", async ({ verifyExistingOrNewReservation }) => {
    await verifyExistingOrNewReservation("Departure", "Today");
  });

  test("Verify Today Stayover reservation number and guest name in the Stayover tab", async ({ verifyExistingOrNewReservation }) => {
    await verifyExistingOrNewReservation("Stayover", "Today");
  });

  test("Verify Today Checked In reservation number and guest name in the Checked In tab", async ({ verifyExistingOrNewReservation }) => {
    await verifyExistingOrNewReservation("Checked In", "Today");
  });

  test("Verify Tomorrow Arrival reservation number and guest name in the Arrival tab", async ({ verifyExistingOrNewReservation }) => {
    await verifyExistingOrNewReservation("Arrival", "Tomorrow");
  });

  test("Verify Tomorrow Departure reservation number and guest name in the Departure tab", async ({ verifyExistingOrNewReservation }) => {
    await verifyExistingOrNewReservation("Departure", "Tomorrow");
  });

  test("Verify Tomorrow Stayover reservation number and guest name in the Stayover tab", async ({ verifyExistingOrNewReservation }) => {
    await verifyExistingOrNewReservation("Stayover", "Tomorrow");
  });

  test("Verify Today Arrival excludes Cancelled reservations", async ({
    activityCard, reservationDbHelper, reservationPage,
    findReservationPage, reservationApi,
  }) => {
    test.setTimeout(180_000);
    const date = await reservationDbHelper.getCurrentDate();
    const created: string[] = [];
    const track = (number: string) => { created.push(number); };
    let failed = false;
    try {
      const active = await reservationPage.createArrivalReservation(findReservationPage, date, track);
      const guestName = await reservationPage.getGuestFullName();
      await reservationPage.clickCloseButton();
      const excluded = await reservationPage.createStayoverReservation(
        findReservationPage, date, 0, 1, track,
      );
      await reservationPage.clickCancelButton();
      await reservationPage.verifyCancellationChargePopupDisplayed();
      await reservationPage.clickCancelReservation();
      await reservationPage.verifyAlertMessage(AlertMessages.RESERVATION_CANCELLED_SUCCESS);
      await reservationPage.clickCloseButton();
      await activityCard.open("Today");
      await activityCard.verify("Arrival", active, excluded, undefined, undefined, guestName);
      expect(await reservationDbHelper.getCurrentDate()).toBe(date);
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      if (!failed) for (const number of created) await reservationApi.deleteReservation(number);
    }
  });

  test("Verify Today Departure excludes Cancelled reservations", async ({
    activityCard, reservationDbHelper, reservationPage,
    findReservationPage, reservationApi,
  }) => {
    test.setTimeout(180_000);
    const date = await reservationDbHelper.getCurrentDate();
    const created: string[] = [];
    const track = (number: string) => { created.push(number); };
    let failed = false;
    try {
      const active = await reservationPage.createDepartureReservation(findReservationPage, date, track);
      const guestName = await reservationPage.getGuestFullName();
      await reservationPage.clickCloseButton();
      const excluded = await reservationPage.createStayoverReservation(
        findReservationPage, date, -1, 0, track,
      );
      await reservationPage.clickCancelButton();
      await reservationPage.verifyCancellationChargePopupDisplayed();
      await reservationPage.clickCancelReservation();
      await reservationPage.verifyAlertMessage(AlertMessages.RESERVATION_CANCELLED_SUCCESS);
      await reservationPage.clickCloseButton();
      await activityCard.open("Today");
      await activityCard.verify("Departure", active, excluded, undefined, undefined, guestName);
      expect(await reservationDbHelper.getCurrentDate()).toBe(date);
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      if (!failed) for (const number of created) await reservationApi.deleteReservation(number);
    }
  });

  test("Verify Today Stayover excludes Cancelled reservations", async ({
    activityCard, reservationDbHelper, reservationPage,
    findReservationPage, reservationApi,
  }) => {
    test.setTimeout(180_000);
    const date = await reservationDbHelper.getCurrentDate();
    const created: string[] = [];
    const track = (number: string) => { created.push(number); };
    let failed = false;
    try {
      const active = await reservationPage.createStayoverReservation(findReservationPage, date, -1, 1, track);
      const guestName = await reservationPage.getGuestFullName();
      await reservationPage.clickCloseButton();
      const excluded = await reservationPage.createStayoverReservation(
        findReservationPage, date, -1, 1, track,
      );
      await reservationPage.clickCancelButton();
      await reservationPage.verifyCancellationChargePopupDisplayed();
      await reservationPage.clickCancelReservation();
      await reservationPage.verifyAlertMessage(AlertMessages.RESERVATION_CANCELLED_SUCCESS);
      await reservationPage.clickCloseButton();
      await activityCard.open("Today");
      await activityCard.verify("Stayover", active, excluded, undefined, undefined, guestName);
      expect(await reservationDbHelper.getCurrentDate()).toBe(date);
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      if (!failed) for (const number of created) await reservationApi.deleteReservation(number);
    }
  });

  test("Verify Today Stayover excludes Arrival today reservations", async ({
    activityCard, reservationDbHelper, reservationPage,
    findReservationPage, reservationApi,
  }) => {
    test.setTimeout(180_000);
    const date = await reservationDbHelper.getCurrentDate();
    const created: string[] = [];
    const track = (number: string) => { created.push(number); };
    let failed = false;
    try {
      const active = await reservationPage.createStayoverReservation(findReservationPage, date, -1, 1, track);
      const guestName = await reservationPage.getGuestFullName();
      await reservationPage.clickCloseButton();
      const excluded = await reservationPage.createStayoverReservation(
        findReservationPage, date, 0, 1, track,
      );

      await reservationPage.clickCloseButton();
      await activityCard.open("Today");
      await activityCard.verify("Stayover", active, excluded, undefined, undefined, guestName);
      expect(await reservationDbHelper.getCurrentDate()).toBe(date);
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      if (!failed) for (const number of created) await reservationApi.deleteReservation(number);
    }
  });

  test("Verify Today Stayover excludes Departure today reservations", async ({
    activityCard, reservationDbHelper, reservationPage,
    findReservationPage, reservationApi,
  }) => {
    test.setTimeout(180_000);
    const date = await reservationDbHelper.getCurrentDate();
    const created: string[] = [];
    const track = (number: string) => { created.push(number); };
    let failed = false;
    try {
      const active = await reservationPage.createStayoverReservation(findReservationPage, date, -1, 1, track);
      const guestName = await reservationPage.getGuestFullName();
      await reservationPage.clickCloseButton();
      const excluded = await reservationPage.createStayoverReservation(
        findReservationPage, date, -1, 0, track,
      );

      await reservationPage.clickCloseButton();
      await activityCard.open("Today");
      await activityCard.verify("Stayover", active, excluded, undefined, undefined, guestName);
      expect(await reservationDbHelper.getCurrentDate()).toBe(date);
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      if (!failed) for (const number of created) await reservationApi.deleteReservation(number);
    }
  });

  test("Verify Checked In includes an arrival after changing its reservation status", async ({
    activityCard, reservationDbHelper, reservationPage,
    findReservationPage, reservationApi, layoutPage,
  }) => {
    test.setTimeout(180_000);
    const date = await reservationDbHelper.getCurrentDate();
    const created: string[] = [];
    const track = (number: string) => { created.push(number); };
    let failed = false;
    try {
      const booked = await reservationPage.createArrivalReservation(findReservationPage, date, track);
      await reservationPage.clickCloseButton();
      await activityCard.open("Today");
      await activityCard.verify("Arrival", booked);
      await layoutPage.clickReservationListIcon();
      const checkedIn = await reservationPage.createArrivalReservation(findReservationPage, date, track);
      const guestName = await reservationPage.getGuestFullName();
      await test.step("Change the arrival status to Checked-In and save", async () => {
        await reservationPage.selectReservationStatus("Checked-In");
        await reservationPage.clickSaveButton();
        await reservationPage.verifyAlertMessage(AlertMessages.RESERVATION_SAVED_SUCCESS);
        await reservationPage.clickCloseButton();
      });
      const stay = await reservationDbHelper.getReservationStayDates(checkedIn);
      expect(stay).not.toBeNull();
      expect(stay!.arrival).toBe(date);
      expect(stay!.status).toMatch(/^Checked[\s-]*In$/i);
      await activityCard.open("Today");
      await activityCard.verify("Checked In", checkedIn, booked, stay!, /^Checked[\s-]*In$/i, guestName);
      expect(await reservationDbHelper.getCurrentDate()).toBe(date);
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      if (!failed) for (const number of created) await reservationApi.deleteReservation(number);
    }
  });
});
