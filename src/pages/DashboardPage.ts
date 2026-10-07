import { expect, Page, Response, test as playwrightTest } from "@playwright/test";
import { BasePage } from "../utils/BasePage";
import { ConfigManager } from "../utils/ConfigManager";
import { ReservationDatabaseHelper } from "../utils/DBHelper/ReservationDatabaseHelper";

export class DashboardPage extends BasePage {
  constructor(page: Page, private readonly reservationDbHelper: ReservationDatabaseHelper) {
    super(page);
  }

  // ***************** Page Elements *********************************

  private readonly dashboardLink = this.page.getByRole("link", { name: "dashboard icon Dashboard", exact: true });
  private readonly todayButton = this.page.getByRole("button", { name: "Today", exact: true });
  private readonly tomorrowButton = this.page.getByRole("button", { name: "Tomorrow", exact: true });
  // Scope the value to its labelled tile in both dashboard layouts.
  private readonly todayArrivalsCount = this.page.locator(".dashboard-card1, .clean-metric-card")
    .filter({ has: this.page.getByText(/^(Today|Tomorrow) Arrivals$/) })
    .locator(".card-value, .metric-number");

  private readonly todayDeparturesCount = this.page.locator(".dashboard-card1, .clean-metric-card")
    .filter({ has: this.page.getByText(/^(Today|Tomorrow) Departure$/) })
    .locator(".card-value, .metric-number");

  private readonly stayoverCount = this.page.locator(".dashboard-card1, .clean-metric-card")
    .filter({ has: this.page.getByText("Total Stayover", { exact: true }) })
    .locator(".card-value, .metric-number");

  private readonly blockedCount = this.page.locator(".dashboard-card1, .clean-metric-card")
    .filter({ has: this.page.getByText(/^(Blocked|Occupied\s*\/\s*Blocked\s*\/\s*Vacant)$/) })
    .locator(".card-value, .metric-number");

  private readonly vacantCount = this.page.locator(".dashboard-card1, .clean-metric-card")
    .filter({ has: this.page.getByText(/^(Vacant|Occupied\s*\/\s*Blocked\s*\/\s*Vacant)$/) })
    .locator(".card-value, .metric-number");

  private readonly totalOccupiedCount = this.page.locator(".dashboard-card1, .clean-metric-card")
    .filter({ has: this.page.getByText("Total Occupied", { exact: true }) })
    .locator(".card-value, .metric-number");

  private readonly sellableRoomsOccupancy = this.page.locator(".clean-kpi-card")
    .filter({ has: this.page.getByText("Occupancy % of Sellable Rooms", { exact: true }) })
    .locator(".kpi-number");

  private readonly reservedRoomsAdr = this.page.locator(".clean-kpi-card")
    .filter({ has: this.page.getByText("ADR (reserved rooms)", { exact: true }) })
    .locator(".kpi-number");

  private readonly totalGuestsCount = this.page.locator(".dashboard-card1, .clean-metric-card, .clean-kpi-card")
    .filter({ has: this.page.getByText("Total Guests", { exact: true }) })
    .locator(".card-value, .metric-number, .kpi-number");

  private readonly housekeepingCard = this.page
    .getByRole("heading", { name: "Housekeeping", exact: true })
    .locator("xpath=ancestor::*[.//*[contains(normalize-space(), 'total rooms')]][1]");

  // ***************** Navigation *********************************

  async openTodayPerformanceMetrics(): Promise<void> {
    const [response] = await Promise.all([
      this.page.waitForResponse(response =>
        new URL(response.url()).pathname.endsWith("/Lists/GetDashBoardStats") &&
        response.request().postDataJSON()?.Day === "Today",
      { timeout: 15_000 }).catch(() => {
        throw new Error("The Dashboard did not load Today performance metrics within 15 seconds.");
      }),
      this.open(),
    ]);
    expect(response.ok(), "The Dashboard performance metrics request should succeed.").toBeTruthy();
    const stats = await response.json();
    expect(typeof stats.BookableRooms, "The Dashboard should return numeric sellable-room occupancy.").toBe("number");
    // Wait for the loaded value, since the initial layout contains sample KPIs.
    await this.verifySellableRoomsOccupancy(stats.BookableRooms);
    await this.verifyTodaySelectedByDefault();
  }

  async selectTomorrowPerformanceMetrics(): Promise<void> {
    const [response] = await Promise.all([
      this.page.waitForResponse(response =>
        new URL(response.url()).pathname.endsWith("/Lists/GetDashBoardStats") &&
        response.request().postDataJSON()?.Day === "Tomorrow",
      { timeout: 15_000 }).catch(() => {
        throw new Error("The Dashboard did not load Tomorrow performance metrics within 15 seconds.");
      }),
      this.selectTomorrow(),
    ]);
    expect(response.ok(), "The Dashboard Tomorrow performance metrics request should succeed.").toBeTruthy();
    const stats = await response.json();
    expect(typeof stats.BookableRooms, "The Dashboard should return numeric sellable-room occupancy.").toBe("number");
    await this.verifySellableRoomsOccupancy(stats.BookableRooms);
    await this.verifyTomorrowSelected();
  }

  async open(): Promise<void> {
    await expect(this.dashboardLink, "The Dashboard navigation link did not become visible within 15 seconds.")
      .toBeVisible({ timeout: 15_000 });
    const [response] = await Promise.all([
      this.page.waitForResponse(response =>
        new URL(response.url()).pathname.endsWith("/Lists/GetCounts") &&
        response.request().postDataJSON()?.Day === "Today",
      { timeout: 15_000 }).catch(() => {
        throw new Error("The Dashboard did not load Today counts within 15 seconds.");
      }),
      this.dashboardLink.click(),
    ]);
    expect(response.ok(), "The Dashboard Today counts request did not succeed.").toBeTruthy();
    await response.finished();
    await this.verifyCountsRendered(response);
  }

  async verifyHousekeepingTotalRoomCount(expectedCount: number): Promise<void> {
    const subtitle = this.housekeepingCard.getByText(
      new RegExp(`^Of ${expectedCount.toLocaleString()} total rooms$`),
    );
    await expect(
      subtitle,
      `The Housekeeping chart should display the correct total room count of ${expectedCount}.`,
    ).toBeVisible({ timeout: 15_000 });
  }

  async getHousekeepingStatusCount(status: string): Promise<number> {
    const label = this.page.getByText(new RegExp(`^${status} \\(\\d+\\)$`)).first();
    await expect(label, `The Housekeeping chart did not display the '${status}' category.`)
      .toBeVisible({ timeout: 15_000 });
    const match = (await label.innerText()).match(/\((\d+)\)$/);
    if (!match) throw new Error(`The Housekeeping chart did not display a numeric '${status}' count.`);
    return Number(match[1]);
  }

  async verifyHousekeepingStatusCount(status: string, expectedCount: number): Promise<void> {
    await expect.poll(
      () => this.getHousekeepingStatusCount(status),
      `The Housekeeping chart should display ${expectedCount} rooms in '${status}'.`,
    ).toBe(expectedCount);
  }

  async openForDay(day: "Today" | "Tomorrow"): Promise<void> {
    const onDashboard = new URL(this.page.url()).pathname.endsWith("/dashboard");
    if (!onDashboard) await this.open();
    if (day === "Tomorrow") {
      if (!(await this.tomorrowButton.and(
        this.page.locator('[aria-pressed="true"], .btn-day-toggle.active'),
      ).isVisible())) {
        await this.selectTomorrow();
      }
    } else {
      await this.verifyTodaySelectedByDefault();
    }
    await this.verifyDataLoaded();
  }

  async selectTomorrow(): Promise<void> {
    const [response] = await Promise.all([
      this.page.waitForResponse(response =>
        new URL(response.url()).pathname.endsWith("/Lists/GetCounts") &&
        response.request().postDataJSON()?.Day === "Tomorrow",
      { timeout: 15_000 }).catch(() => {
        throw new Error("The Dashboard did not reload Tomorrow counts within 15 seconds.");
      }),
      this.tomorrowButton.click(),
    ]);
    expect(response.ok(), "The Dashboard Tomorrow counts request did not succeed.").toBeTruthy();
    await response.finished();
    await this.verifyCountsRendered(response);
    await expect(this.tomorrowButton.and(
      this.page.locator('[aria-pressed="true"], .btn-day-toggle.active'),
    ), "The Dashboard did not select Tomorrow within 15 seconds.").toBeVisible({ timeout: 15_000 });
    await this.verifyDataLoaded();
  }

  async refreshToday(): Promise<void> {
    const [response] = await Promise.all([
      this.page.waitForResponse(response =>
        new URL(response.url()).pathname.endsWith("/Lists/GetCounts") &&
        response.request().postDataJSON()?.Day === "Today",
      { timeout: 15_000 }).catch(() => {
        throw new Error("The Dashboard did not reload Today counts within 15 seconds.");
      }),
      this.todayButton.click(),
    ]);
    expect(response.ok(), "The Dashboard Today counts request did not succeed.").toBeTruthy();
    await response.finished();
    await this.verifyCountsRendered(response);
    await this.verifyTodaySelectedByDefault();
  }

  async returnToTomorrowDashboard(): Promise<void> {
    const [response] = await Promise.all([
      this.page.waitForResponse(response =>
        new URL(response.url()).pathname.endsWith("/Lists/GetCounts"),
      { timeout: 15_000 }),
      this.dashboardLink.click(),
    ]);
    expect(response.ok(), "The Dashboard counts request after unblocking did not succeed.").toBeTruthy();
    await response.finished();
    await this.verifyCountsRendered(response);
    // Dashboard navigation resets to Today, so explicitly restore the selected day.
    await this.selectTomorrow();
  }

  // ***************** Verifications *********************************

  async verifyNonExemptRoomRevenue(expectedRevenue: number): Promise<void> {
    const amount = this.page.locator(".summary-row")
      .filter({ has: this.page.getByText("Room Revenue (non-exempt)", { exact: true }) })
      .locator(".summary-amount");
    await expect(amount).toBeVisible();
    await expect.poll(async () => {
      const text = (await amount.innerText()).trim();
      expect(text, "Room revenue should display a dollar amount with two decimal places.")
        .toMatch(/^\$\s*-?[\d,]+\.\d{2}$/);
      return Number(text.replace(/[$,\s]/g, ""));
    }, {
      message: `Room Revenue (non-exempt) should match the database total ${expectedRevenue.toFixed(2)}.`,
      timeout: 15_000,
    }).toBe(Number(expectedRevenue.toFixed(2)));
    this.annotateMetricValidation("Room Revenue (non-exempt)", expectedRevenue.toFixed(2), await amount.innerText());
  }

  async verifyExemptRoomRevenue(expectedRevenue: number): Promise<void> {
    const amount = this.page.locator(".summary-row")
      .filter({ has: this.page.getByText("Room Revenue (exempt)", { exact: true }) })
      .locator(".summary-amount");
    await expect(amount).toBeVisible();
    await expect.poll(async () => Number((await amount.innerText()).replace(/[$,\s]/g, "")), {
      message: `Room Revenue (exempt) should match the database total ${expectedRevenue.toFixed(2)}.`,
      timeout: 15_000,
    }).toBe(Number(expectedRevenue.toFixed(2)));
    this.annotateMetricValidation("Room Revenue (exempt)", expectedRevenue.toFixed(2), await amount.innerText());
  }

  async verifyTotalRoomRevenue(expectedRevenue: number): Promise<void> {
    const amount = this.page.locator(".summary-row")
      .filter({ has: this.page.getByText("Total Room Revenue", { exact: true }) })
      .locator(".summary-amount");
    await expect(amount).toBeVisible();
    await expect.poll(async () => Number((await amount.innerText()).replace(/[$,\s]/g, "")), {
      message: `Total Room Revenue should match the database total ${expectedRevenue.toFixed(2)}.`,
      timeout: 15_000,
    }).toBe(Number(expectedRevenue.toFixed(2)));
    this.annotateMetricValidation("Total Room Revenue", expectedRevenue.toFixed(2), await amount.innerText());
  }

  async verifyOtherRevenue(expectedRevenue: number): Promise<void> {
    const amount = this.page.locator(".summary-row")
      .filter({ has: this.page.getByText("Other Revenue", { exact: true }) })
      .locator(".summary-amount");
    await expect(amount).toBeVisible();
    await expect.poll(async () => Number((await amount.innerText()).replace(/[$,\s]/g, "")), {
      message: `Other Revenue should match the database total ${expectedRevenue.toFixed(2)}.`,
      timeout: 15_000,
    }).toBe(Number(expectedRevenue.toFixed(2)));
    this.annotateMetricValidation("Other Revenue", expectedRevenue.toFixed(2), await amount.innerText());
  }

  async verifyDiscount(expectedDiscount: number): Promise<void> {
    const amount = this.page.locator(".summary-row").filter({ has: this.page.getByText("Discount", { exact: true }) }).locator(".summary-amount");
    await expect(amount).toBeVisible();
    await expect.poll(async () => Number((await amount.innerText()).replace(/[$,\s]/g, "")), { timeout: 15_000 }).toBe(Number(expectedDiscount.toFixed(2)));
    this.annotateMetricValidation("Discount", expectedDiscount.toFixed(2), await amount.innerText());
  }

  async verifyTotalRevenue(expectedRevenue: number): Promise<void> {
    const amount = this.page.locator(".summary-row").filter({ has: this.page.getByText("Total Revenue", { exact: true }) }).locator(".summary-amount");
    await expect(amount).toBeVisible();
    await expect.poll(async () => Number((await amount.innerText()).replace(/[$,\s]/g, "")), { timeout: 15_000 }).toBe(Number(expectedRevenue.toFixed(2)));
    this.annotateMetricValidation("Total Revenue", expectedRevenue.toFixed(2), await amount.innerText());
  }

  async verifySellableRoomsOccupancy(expectedPercentage: number): Promise<void> {
    await expect(this.sellableRoomsOccupancy,
      `Dashboard Occupancy % of Sellable Rooms should equal ${expectedPercentage.toFixed(2)}% within 15 seconds.`,
    ).toHaveText(`${expectedPercentage.toFixed(2)}%`, { timeout: 15_000 });
    this.annotateMetricValidation("Occupancy % of Sellable Rooms", `${expectedPercentage.toFixed(2)}%`, await this.sellableRoomsOccupancy.innerText());
  }

  async verifyReservedRoomsAdr(expectedAdr: number): Promise<void> {
    const expectedText = expectedAdr >= 10 ? `$${expectedAdr.toFixed(2)}` : String(expectedAdr);
    await expect(this.reservedRoomsAdr,
      `Dashboard ADR (reserved rooms) should equal ${expectedText} within 15 seconds.`,
    ).toHaveText(expectedText, { timeout: 15_000 });
    this.annotateMetricValidation("ADR (reserved rooms)", expectedText, await this.reservedRoomsAdr.innerText());
  }

  private async verifyCountsRendered(response: Response): Promise<void> {
    // A completed response can precede Angular's rendering; numeric placeholder
    // values must not decide whether the test needs to create a reservation.
    const counts = await response.json();
    await expect(this.todayArrivalsCount,
      "The Dashboard did not render the loaded arrivals count within 15 seconds.",
    ).toHaveText(String(counts.Arrival), { timeout: 15_000 });
    this.annotateMetricValidation("Arrivals", counts.Arrival, await this.todayArrivalsCount.innerText());
    // The Dashboard API spells its departure field 'Depature'.
    await expect(this.todayDeparturesCount,
      "The Dashboard did not render the loaded departure count within 15 seconds.",
    ).toHaveText(String(counts.Depature), { timeout: 15_000 });
    this.annotateMetricValidation("Departures", counts.Depature, await this.todayDeparturesCount.innerText());
    await expect(this.stayoverCount,
      "The Dashboard did not render the loaded stayover count within 15 seconds.",
    ).toHaveText(String(counts.StayOver), { timeout: 15_000 });
    this.annotateMetricValidation("Stayovers", counts.StayOver, await this.stayoverCount.innerText());
    await this.verifyBlockedCount(Number(counts.Blocked));
    await this.verifyVacantCount(Number(counts.Vacant));
    await this.verifyTotalOccupiedCount(Number(counts.Booked));
  }

  async verifyTomorrowArrivalsCount(selectedDate: string): Promise<void> {
    const databaseCount = await this.reservationDbHelper.getArrivalsCount(selectedDate);
    expect(await this.reservationDbHelper.getCurrentDate(1),
      "The server date changed during the Tomorrow comparison; rerun for a single date.",
    ).toBe(selectedDate);
    expect(databaseCount, "Tomorrow should contain at least one non-cancelled arrival.").toBeGreaterThan(0);
    await expect(this.todayArrivalsCount,
      `The arrivals tile with Tomorrow selected should match ${databaseCount} non-cancelled reservations for property ${ConfigManager.testData.propertyId} on ${selectedDate}.`,
    ).toHaveText(String(databaseCount), { timeout: 15_000 });
    this.annotateMetricValidation("Tomorrow Arrivals", databaseCount, await this.todayArrivalsCount.innerText());
  }

  async verifyTodaySelectedByDefault(): Promise<void> {
    // Trunk uses an ARIA toggle; test1 marks its day button with the active class.
    const selectedToday = this.todayButton.and(
      this.page.locator('[aria-pressed="true"], .btn-day-toggle.active'),
    );
    await expect(selectedToday, "The Dashboard did not select Today by default within 15 seconds.")
      .toBeVisible({ timeout: 15_000 });
  }

  async verifyTomorrowSelected(): Promise<void> {
    await expect(this.tomorrowButton.and(
      this.page.locator('[aria-pressed="true"], .btn-day-toggle.active'),
    ), "The Dashboard should retain Tomorrow when returning after unblocking a room.")
      .toBeVisible({ timeout: 15_000 });
  }

  async verifyDataLoaded(): Promise<void> {
    await expect(this.todayArrivalsCount, "The Dashboard did not display a numeric Today Arrivals count within 15 seconds.")
      .toHaveText(/^\d+$/, { timeout: 15_000 });
  }

  async verifyTodayArrivalsCount(selectedDate: string): Promise<void> {
    const displayedCount = await this.getTodayArrivalsCount();
    const databaseCount = await this.reservationDbHelper.getArrivalsCount(selectedDate);

    expect(
      await this.reservationDbHelper.getCurrentDate(),
      "The server date changed during the Dashboard comparison; rerun for a single date.",
    ).toBe(selectedDate);
    expect(databaseCount,
      `Today Arrivals for property ${ConfigManager.testData.propertyId} on ${selectedDate} should include at least one non-cancelled reservation.`,
    ).toBeGreaterThan(0);
    expect(
      displayedCount,
      `Today Arrivals for property ${ConfigManager.testData.propertyId} on ${selectedDate} should equal the non-cancelled reservation count.`,
    ).toBe(databaseCount);
    this.annotateMetricValidation("Today Arrivals", databaseCount, String(displayedCount));
  }

  async verifyCancelledReservationsExcluded(
    selectedDate: string,
    activeConfirmationNumber: string,
    cancelledConfirmationNumber: string,
  ): Promise<void> {
    const activeStatus = await this.reservationDbHelper.getArrivalStatus(activeConfirmationNumber, selectedDate);
    expect(activeStatus, `Active reservation ${activeConfirmationNumber} should arrive on ${selectedDate}.`).not.toBeNull();
    expect(activeStatus, `Reservation ${activeConfirmationNumber} should remain active.`).not.toMatch(/^Cancelled$/i);
    expect(
      await this.reservationDbHelper.getArrivalStatus(cancelledConfirmationNumber, selectedDate),
      `Reservation ${cancelledConfirmationNumber} should be Cancelled and arrive on ${selectedDate}.`,
    ).toMatch(/^Cancelled$/i);
    await this.verifyTodayArrivalsCount(selectedDate);
  }

  async verifyDeparturesCount(selectedDate: string, day: "Today" | "Tomorrow"): Promise<void> {
    const databaseCount = await this.reservationDbHelper.getDeparturesCount(selectedDate);
    expect(await this.reservationDbHelper.getCurrentDate(day === "Today" ? 0 : 1),
      "The server date changed during the departure comparison; rerun for a single date.",
    ).toBe(selectedDate);
    expect(databaseCount, `${day} should contain at least one non-cancelled departure.`).toBeGreaterThan(0);
    await expect(this.todayDeparturesCount,
      `The departure tile with ${day} selected should match ${databaseCount} non-cancelled reservations for property ${ConfigManager.testData.propertyId} on ${selectedDate}.`,
    ).toHaveText(String(databaseCount), { timeout: 15_000 });
    this.annotateMetricValidation(`${day} Departures`, databaseCount, await this.todayDeparturesCount.innerText());
  }

  async verifyDepartureReservation(confirmationNumber: string, date: string, cancelled = false): Promise<void> {
    const status = await this.reservationDbHelper.getDepartureStatus(confirmationNumber, date);
    expect(status, `Reservation ${confirmationNumber} should depart on ${date}.`).not.toBeNull();
    if (cancelled) {
      expect(status, `Reservation ${confirmationNumber} should be cancelled.`).toMatch(/^Cancelled$/i);
    } else {
      expect(status, `Reservation ${confirmationNumber} should remain active.`).not.toMatch(/^Cancelled$/i);
    }
  }

  async verifyCancelledDeparturesExcluded(date: string, active: string, cancelled: string): Promise<void> {
    await this.verifyDepartureReservation(active, date);
    await this.verifyDepartureReservation(cancelled, date, true);
    await this.verifyDeparturesCount(date, "Today");
  }

  async verifyStayoverCount(date: string, day: "Today" | "Tomorrow"): Promise<void> {
    const reservations = await this.reservationDbHelper.getStayoverReservations(date);
    expect(await this.reservationDbHelper.getCurrentDate(day === "Today" ? 0 : 1),
      "The server date changed during the stayover comparison; rerun for a single date.",
    ).toBe(date);
    expect(reservations.length, `${day} should have at least one qualifying stayover.`).toBeGreaterThan(0);
    await expect(this.stayoverCount,
      `Total Stayover for property ${ConfigManager.testData.propertyId} on ${date} should equal ${reservations.length} non-cancelled reservations arriving before and departing after that date.`,
    ).toHaveText(String(reservations.length), { timeout: 15_000 });
    this.annotateMetricValidation(`${day} Stayovers`, reservations.length, await this.stayoverCount.innerText());
  }

  async verifyStayoverReservation(confirmation: string, date: string): Promise<void> {
    const reservations = await this.reservationDbHelper.getStayoverReservations(date);
    expect(reservations.map(row => String(row.Confirm_num)),
      `Reservation ${confirmation} should be a non-cancelled stayover on ${date}.`,
    ).toContain(confirmation);
  }

  async verifyStayoverExclusion(
    date: string, qualifying: string, excluded: string,
    reason: "Cancelled" | "Arrival today" | "Departure today",
  ): Promise<void> {
    await this.verifyStayoverReservation(qualifying, date);
    const reservation = await this.reservationDbHelper.getReservationStayDates(excluded);
    expect(reservation, `Excluded reservation ${excluded} should exist in the selected property.`).not.toBeNull();
    if (!reservation) throw new Error(`Reservation ${excluded} was not found.`);
    if (reason === "Cancelled") {
      expect(reservation.status, `Reservation ${excluded} should be cancelled.`).toMatch(/^Cancelled$/i);
      expect(reservation.arrival < date && reservation.departure > date,
        `Cancelled reservation ${excluded} should span ${date}.`,
      ).toBeTruthy();
    } else {
      expect(reservation.status, `Boundary reservation ${excluded} should remain active.`).not.toMatch(/^Cancelled$/i);
      if (reason === "Arrival today") {
        expect(reservation.arrival, `Reservation ${excluded} should arrive today.`).toBe(date);
        expect(reservation.departure > date, `Reservation ${excluded} should depart after today.`).toBeTruthy();
      } else {
        expect(reservation.departure, `Reservation ${excluded} should depart today.`).toBe(date);
        expect(reservation.arrival < date, `Reservation ${excluded} should arrive before today.`).toBeTruthy();
      }
    }
    const reservations = await this.reservationDbHelper.getStayoverReservations(date);
    expect(reservations.map(row => String(row.Confirm_num)),
      `Stayovers on ${date} should exclude reservation ${excluded}: ${reason}.`,
    ).not.toContain(excluded);
    await this.verifyStayoverCount(date, "Today");
  }

  // ***************** Data Retrieval *********************************

  async verifyBlockedCount(expectedCount: number): Promise<void> {
    await expect(this.blockedCount, `Blocked room count should equal ${expectedCount}.`)
      .toHaveText(new RegExp(`^(?:${expectedCount}|\\d+\\s*/\\s*${expectedCount}\\s*/\\s*\\d+)$`), { timeout: 15_000 });
    this.annotateMetricValidation("Blocked rooms", expectedCount, await this.blockedCount.innerText());
  }

  async getBlockedCount(): Promise<number> {
    await expect(this.blockedCount, "The Dashboard did not display a numeric Blocked count within 15 seconds.")
      .toHaveText(/^\d+(?:\s*\/\s*\d+\s*\/\s*\d+)?$/, { timeout: 15_000 });
    const counts = (await this.blockedCount.innerText()).split("/");
    return Number(counts[counts.length === 3 ? 1 : 0].trim());
  }

  async verifyVacantCount(expectedCount: number): Promise<void> {
    await expect(this.vacantCount, `Vacant room count should equal ${expectedCount}.`)
      .toHaveText(new RegExp(`^(?:${expectedCount}|\\d+\\s*/\\s*\\d+\\s*/\\s*${expectedCount})$`), { timeout: 15_000 });
    this.annotateMetricValidation("Vacant rooms", expectedCount, await this.vacantCount.innerText());
  }

  async getVacantCount(): Promise<number> {
    await expect(this.vacantCount, "The Dashboard did not display a numeric Vacant count within 15 seconds.")
      .toHaveText(/^\d+(?:\s*\/\s*\d+\s*\/\s*\d+)?$/, { timeout: 15_000 });
    const counts = (await this.vacantCount.innerText()).split("/");
    return Number(counts[counts.length === 3 ? 2 : 0].trim());
  }

  async verifyTotalOccupiedCount(expectedCount: number): Promise<void> {
    await expect(this.totalOccupiedCount, `Total Occupied should equal ${expectedCount} rooms.`)
      .toHaveText(String(expectedCount), { timeout: 15_000 });
    this.annotateMetricValidation("Total Occupied rooms", expectedCount, await this.totalOccupiedCount.innerText());
  }

  async getTotalGuestsCount(): Promise<number> {
    await expect(this.totalGuestsCount, "The Dashboard should display a numeric Total Guests value.")
      .toHaveText(/^\d+$/, { timeout: 15_000 });
    return Number((await this.totalGuestsCount.innerText()).trim());
  }

  async getStayoverCount(): Promise<number> {
    await expect(this.stayoverCount, "The Dashboard did not display a numeric Total Stayover count within 15 seconds.")
      .toHaveText(/^\d+$/, { timeout: 15_000 });
    return Number((await this.stayoverCount.innerText()).trim());
  }

  async getTodayDeparturesCount(): Promise<number> {
    await expect(this.todayDeparturesCount,
      "The Dashboard did not display a numeric Today Departure count within 15 seconds.",
    ).toHaveText(/^\d+$/, { timeout: 15_000 });
    return Number((await this.todayDeparturesCount.innerText()).trim());
  }

  async getTodayArrivalsCount(): Promise<number> {
    await this.verifyDataLoaded();
    return Number((await this.todayArrivalsCount.innerText()).trim());
  }

  private annotateMetricValidation(metric: string, expected: number | string, actual: string): void {
    playwrightTest.info().annotations.push({
      type: "Dashboard metric validation",
      description: `${metric}: expected ${expected}; displayed ${actual.trim()}`,
    });
  }
}
