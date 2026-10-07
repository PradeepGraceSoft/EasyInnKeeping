import type { Locator, Page } from "@playwright/test";
import { test as base, expect } from "../../../src/fixtures/pms.fixture";
import { AlertMessages } from "../../../src/constants/AlertMessages";

// npm run test:test1 -- tests/PMS/Dashboard/GuestActivity.spec.ts --project=property-a-5806
type Day = "Today" | "Tomorrow";
type Snapshot = { adults: number; children: number; rooms: number; revenue: number };
const labels = [
  "Cancellations", "Adults", "Children", "Avg Adults per Room",
  "Avg Revenue per Adult", "Avg Children per Room", "Avg Revenue per Child",
] as const;
type Metric = typeof labels[number];

class GuestActivityCard {
  readonly card: Locator;
  constructor(page: Page) {
    // Use the labelled card and rows rather than positional values elsewhere
    // on the Dashboard (Guest Mix also contains Adults and Children).
    this.card = page.getByRole("heading", { name: "Guest & Activity Metrics", exact: true })
      .locator("xpath=ancestor::*[.//*[normalize-space(text())='Cancellations']][1]");
  }

  private row(label: Metric): Locator {
    return this.card.getByText(label, { exact: true }).locator("..");
  }

  async read(label: Metric): Promise<number> {
    const row = this.row(label);
    const currency = label.startsWith("Avg Revenue");
    const average = label.startsWith("Avg");
    const format = currency ? /^\$\s*-?\d[\d,]*\.\d{2}$/
      : average ? /^\d[\d,]*\.\d{2}$/ : /^\d[\d,]*$/;
    await expect.poll(async () => (await row.innerText()).replace(label, "").trim(), {
      message: `${label} must display ${currency ? "currency" : average ? "an average" : "a count"} in the expected format`,
    }).toMatch(format);
    return Number((await row.innerText()).replace(label, "").replace(/[$,\s]/g, ""));
  }

  async verify(day: Day, expected: Snapshot): Promise<void> {
    await expect(this.card).toBeVisible();
    await expect(this.card.getByText(new RegExp(`^Period:\\s*${day}$`, "i"))).toBeVisible();
    for (const label of labels) await expect(this.card.getByText(label, { exact: true })).toBeVisible();
    // Contract: per-room averages use occupied rooms; per-person revenue uses
    // Total Revenue (room + other - discount), consistent with RevenueSummary.
    const divide = (numerator: number, denominator: number) => denominator === 0
      ? 0 : Number((numerator / denominator).toFixed(2));
    const values: Partial<Record<Metric, number>> = {
      Adults: expected.adults,
      Children: expected.children,
      "Avg Adults per Room": divide(expected.adults, expected.rooms),
      "Avg Children per Room": divide(expected.children, expected.rooms),
      "Avg Revenue per Adult": divide(expected.revenue, expected.adults),
      "Avg Revenue per Child": divide(expected.revenue, expected.children),
    };
    await this.read("Cancellations");
    for (const [label, value] of Object.entries(values)) {
      await expect.poll(() => this.read(label as Metric), {
        message: `${day} ${label} should equal ${value}`, timeout: 15_000,
      }).toBe(value);
    }
  }
}

type Scenario = {
  card: GuestActivityCard;
  open(day: Day): Promise<Snapshot>;
  create(day: Day, kind?: "arrival" | "stayover" | "departure" | "future"): Promise<string>;
  editGuests(confirmation: string, adults: number, children: number): Promise<void>;
  cancel(confirmation: string): Promise<void>;
  remove(confirmation: string): Promise<void>;
};

const test = base.extend<{ activity: Scenario }>({
  activity: async ({ page, dashboardPage, reservationDbHelper, layoutPage,
    findReservationPage, reservationPage, reservationApi }, use) => {
    const card = new GuestActivityCard(page);
    const created = new Set<string>();
    const today = await reservationDbHelper.getDashboardBusinessDate();
    const date = async (day: Day, offset = 0) => {
      expect(await reservationDbHelper.getDashboardBusinessDate(), "Business date changed during the test").toBe(today);
      return reservationDbHelper.getDashboardBusinessDate((day === "Tomorrow" ? 1 : 0) + offset);
    };
    const edit = async (confirmation: string) => {
      await layoutPage.clickReservationListIcon();
      await findReservationPage.openReservation(confirmation);
    };
    const scenario: Scenario = {
      card,
      open: async (day) => {
        const selected = await date(day);
        if (new URL(page.url()).pathname.endsWith("/dashboard")) await dashboardPage.refreshToday();
        else await dashboardPage.open();
        if (day === "Tomorrow") await dashboardPage.selectTomorrow();
        const mix = await reservationDbHelper.getDashboardGuestMixCounts(selected);
        const expected = { ...mix,
          rooms: await reservationDbHelper.getOccupiedRoomCount(selected),
          revenue: await reservationDbHelper.getDashboardConfirmedTotalRevenue(selected),
        };
        await card.verify(day, expected);
        await date(day);
        test.info().annotations.push({ type: "Guest Activity", description: `${day} ${selected}: ${JSON.stringify(expected)}` });
        return expected;
      },
      create: async (day, kind = "arrival") => {
        const selected = await date(day, kind === "future" ? 1 : 0);
        await layoutPage.clickReservationListIcon();
        const track = (confirmation: string) => { created.add(confirmation); };
        const confirmation = kind === "stayover"
          ? await reservationPage.createStayoverReservation(findReservationPage, selected, -1, 1, track)
          : kind === "departure"
            ? await reservationPage.createDepartureReservation(findReservationPage, selected, track)
            : await reservationPage.createArrivalReservation(findReservationPage, selected, track);
        await reservationPage.clickCloseButton();
        return confirmation;
      },
      editGuests: async (confirmation, adults, children) => {
        await edit(confirmation);
        await reservationPage.enterNumberOfAdults(String(adults));
        await reservationPage.enterNumberOfChildren(String(children));
        await page.locator("[name='children']").press("Tab");
        // Room editing can leave the next Material select open after tabbing.
        const backdrop = page.locator(".cdk-overlay-transparent-backdrop.cdk-overlay-backdrop-showing");
        if (await backdrop.isVisible()) {
          await page.keyboard.press("Escape");
          await expect(backdrop).toBeHidden();
        }
        await reservationPage.clickSaveButton();
        await reservationPage.verifyAlertMessage(AlertMessages.RESERVATION_SAVED_SUCCESS);
        await reservationPage.clickCloseButton();
      },
      cancel: async (confirmation) => {
        await edit(confirmation);
        await reservationPage.clickCancelButton();
        await reservationPage.verifyCancellationChargePopupDisplayed();
        await reservationPage.clickCancelReservation();
        await reservationPage.verifyAlertMessage(AlertMessages.RESERVATION_CANCELLED_SUCCESS);
        await reservationPage.clickCloseButton();
        expect((await reservationDbHelper.getReservationStayDates(confirmation))?.status).toMatch(/^Cancelled$/i);
      },
      remove: async (confirmation) => {
        await reservationApi.deleteReservation(confirmation);
        created.delete(confirmation);
      },
    };
    try { await use(scenario); }
    finally {
      const failures: string[] = [];
      for (const confirmation of created) {
        try { await reservationApi.deleteReservation(confirmation); }
        catch (error) { failures.push(`${confirmation}: ${String(error)}`); }
      }
      expect(failures, "All Guest Activity test reservations must be deleted").toEqual([]);
    }
  },
});

test.describe("Dashboard Guest & Activity Metrics", () => {
  test.describe.configure({ timeout: 180_000 });

  for (const day of ["Today", "Tomorrow"] as const) {
    test(`Functional: all seven metrics, formatting and calculations for ${day}`, async ({ activity }) => {
      await activity.open(day);
    });

    for (const kind of ["arrival", "stayover"] as const) {
      test(`Functional: include ${kind} adults and children for ${day}`, async ({ activity }) => {
        const before = await activity.open(day);
        const confirmation = await activity.create(day, kind);
        await activity.editGuests(confirmation, 2, 1);
        const after = await activity.open(day);
        expect(after.adults).toBe(before.adults + 2);
        expect(after.children).toBe(before.children + 1);
      });
    }

    test(`Regression: recalculate after editing guest counts for ${day}`, async ({ activity }) => {
      const confirmation = await activity.create(day);
      await activity.editGuests(confirmation, 1, 0);
      const before = await activity.open(day);
      await activity.editGuests(confirmation, 2, 1);
      const after = await activity.open(day);
      expect(after.adults).toBe(before.adults + 1);
      expect(after.children).toBe(before.children + 1);
      expect(after.rooms).toBe(before.rooms);
    });

    test(`Regression: cancellation increments activity and excludes guests for ${day}`, async ({ activity }) => {
      const baseline = await activity.open(day);
      const cancellations = await activity.card.read("Cancellations");
      const confirmation = await activity.create(day);
      await activity.editGuests(confirmation, 2, 1);
      await activity.open(day);
      expect(await activity.card.read("Cancellations")).toBe(cancellations);
      await activity.cancel(confirmation);
      const after = await activity.open(day);
      expect(after.adults).toBe(baseline.adults);
      expect(after.children).toBe(baseline.children);
      await expect.poll(() => activity.card.read("Cancellations")).toBe(cancellations + 1);
    });

    test(`Regression: deletion restores guest metrics for ${day}`, async ({ activity }) => {
      const before = await activity.open(day);
      const confirmation = await activity.create(day);
      await activity.editGuests(confirmation, 2, 1);
      const added = await activity.open(day);
      expect(added.adults).toBe(before.adults + 2);
      expect(added.children).toBe(before.children + 1);
      await activity.remove(confirmation);
      expect(await activity.open(day)).toEqual(before);
    });

    for (const kind of ["departure", "future"] as const) {
      test(`Regression: exclude ${kind} reservation guests for ${day}`, async ({ activity }) => {
        const before = await activity.open(day);
        const confirmation = await activity.create(day, kind);
        await activity.editGuests(confirmation, 2, 1);
        const after = await activity.open(day);
        expect(after.adults).toBe(before.adults);
        expect(after.children).toBe(before.children);
      });
    }

    test(`Regression: zero children displays zero child averages for ${day}`, async ({ activity, reservationDbHelper }) => {
      const date = await reservationDbHelper.getDashboardBusinessDate(day === "Tomorrow" ? 1 : 0);
      const mix = await reservationDbHelper.getDashboardGuestMixCounts(date);
      test.skip(mix.children !== 0, "Requires a date without children; existing reservations are not modified.");
      await activity.open(day);
      expect(await activity.card.read("Avg Children per Room")).toBe(0);
      expect(await activity.card.read("Avg Revenue per Child")).toBe(0);
    });
  }

  test("Regression: Today → Tomorrow → Today restores the selected period metrics", async ({ activity }) => {
    const confirmation = await activity.create("Tomorrow");
    await activity.editGuests(confirmation, 2, 1);
    const today = await activity.open("Today");
    const cancellations = await activity.card.read("Cancellations");
    await activity.open("Tomorrow");
    expect(await activity.open("Today")).toEqual(today);
    expect(await activity.card.read("Cancellations")).toBe(cancellations);
  });
});
