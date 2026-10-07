import { expect, Locator, Page } from "@playwright/test";
import { BasePage } from "../utils/BasePage";

export class FindReservationPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ***************** Page Elements *********************************

  private readonly selectAllCheckbox: Locator = this.page
    .getByRole("table")
    .getByRole("checkbox")
    .first();

  private readonly addResButton: Locator = this.page.locator(
    "//span[text()=' Add']",
  );

  private readonly searchBox: Locator = this.page.getByRole("textbox", {
    name: "Enter",
    exact: true,
  });

  private readonly searchByDropdown: Locator = this.page.getByRole(
    "combobox",
    { name: /Search by/i },
  );

  private readonly reservationTypeDropdown: Locator = this.page.getByRole(
    "combobox",
    { name: /Reservation Type/ },
  );

  private readonly reservationTypeHourly: Locator = this.page.locator(
    "//span[contains(text(),'Hourly') and @class='mat-option-text']",
  );

  private readonly reservationTypeRegular: Locator = this.page.locator(
    "//span[contains(text(),'Regular') and @class='mat-option-text']",
  );

  private readonly reservationTypeGroup: Locator = this.page.locator(
    "//span[contains(text(),'Group') and @class='mat-option-text']",
  );

  private readonly reservationTypePackage: Locator = this.page.locator(
    "//span[contains(text(),'Package') and @class='mat-option-text']",
  );

  private readonly reservationTypeShared: Locator = this.page.locator(
    "//span[contains(text(),'Shared') and @class='mat-option-text']",
  );

  private readonly reservationTypeUnassigned: Locator = this.page.locator(
    "//span[contains(text(),'Unassigned') and @class='mat-option-text']",
  );

  private readonly findButton: Locator = this.page.locator(
    "//button[@class='mat-focus-indicator blue-btn wid-45 mat-raised-button mat-button-base']",
  );

  private readonly firstGuestLink: Locator = this.page.locator(
    "(//td[@class='mat-cell cdk-cell cdk-column-FullName mat-column-FullName ng-star-inserted'])[1]/a",
  );

  private readonly firstGroupCell: Locator = this.page
    .locator("td.cdk-column-GroupName")
    .first();

  private readonly deleteButton: Locator = this.page.getByRole("button", {
    name: "Delete",
  });

  private readonly checkInButton: Locator = this.page.getByRole("button", {
    name: /Check-In/i,
  });

  private readonly deleteOKButton: Locator = this.page.getByRole("button", {
    name: "OK",
  });

  // ***************** Reservation Type *********************************

  async chooseReservationTypeHourly(): Promise<void> {
    await this.openReservationTypeDropdown();
    await this.reservationTypeHourly.click();
  }

  async chooseReservationTypeRegular(): Promise<void> {
    await this.openReservationTypeDropdown();
    await this.reservationTypeRegular.click();
  }

  async chooseReservationTypeGroup(): Promise<void> {
    await this.openReservationTypeDropdown();
    await this.reservationTypeGroup.click();
  }

  async chooseReservationTypePackage(): Promise<void> {
    await this.openReservationTypeDropdown();
    await this.reservationTypePackage.click();
  }

  async chooseReservationTypeShared(): Promise<void> {
    await this.openReservationTypeDropdown();
    await this.reservationTypeShared.click();
  }

  async chooseReservationTypeUnassigned(): Promise<void> {
    await this.openReservationTypeDropdown();
    await this.reservationTypeUnassigned.click();
  }

  // ***************** Search *********************************

  async searchReservation(searchTerm: string): Promise<void> {
    await this.searchBox.fill(searchTerm);
    await this.findButton.click();
  }

  async openReservation(confirmationNumber: string): Promise<void> {
    await this.findReservationByNumber(confirmationNumber);
    const guestName = this.getReservationRow(confirmationNumber)
      .locator("td.cdk-column-FullName a");
    await expect(guestName,
      `Reservation search did not display a clickable Guest Name for reservation ${confirmationNumber} within 15 seconds.`,
    ).toBeVisible({ timeout: 15_000 });
    await guestName.click();
    await expect(this.page.getByRole("dialog").locator("h2").filter({ hasText: "Reservation #:" }).locator("span"),
      `Guest Name did not open reservation ${confirmationNumber} within 15 seconds.`,
    ).toHaveText(confirmationNumber, { timeout: 15_000 });
  }

  async findReservationByNumber(confirmationNumber: string): Promise<void> {
    await this.selectReservationNumberSearch();
    await this.searchReservation(confirmationNumber);
    await expect(this.getReservationRow(confirmationNumber),
      `Reservation search did not display reservation ${confirmationNumber} within 15 seconds.`,
    ).toBeVisible({ timeout: 15_000 });
  }

  async openMostRecentGroupReservation(): Promise<void> {
    await this.searchReservation("");
    await expect(this.firstGroupCell).toBeVisible();
    await this.clickFirstGroupResult();
  }

  async openGroupReservationIfPresent(searchTerm: string): Promise<boolean> {
    await this.selectReservationNumberSearch();
    const groupResultsLoaded = this.page.waitForResponse(
      (response) =>
        response.url().includes("/Group/GetGroupBlockList") &&
        response.request().method() === "POST",
    );
    await this.searchReservation(searchTerm);
    await groupResultsLoaded;
    if (!(await this.firstGroupCell.isVisible())) return false;

    await this.clickFirstGroupResult();
    return true;
  }

  // ***************** Actions *********************************

  async addNewReservation(): Promise<void> {
    await this.addResButton.click();
  }

  async selectReservation(confirmationNumber: string): Promise<void> {
    await this.getReservationRow(confirmationNumber)
      .getByRole("checkbox")
      .click();
  }

  async clickReservationCancelButton(
    confirmationNumber: string,
  ): Promise<void> {
    await this.getReservationRow(confirmationNumber)
      .getByRole("button", { name: "cancel", exact: true })
      .click();
  }

  async clickCheckInButton(): Promise<void> {
    await this.checkInButton.click();
  }

  async confirmCheckIn(): Promise<void> {
    const confirmationDialog = this.page.getByRole("dialog").filter({
      hasText: /Are you sure to Check In these reservations/i,
    });
    await confirmationDialog
      .getByRole("button", { name: "OK", exact: true })
      .click();
  }

  async deleteReservation(resNum: string): Promise<void> {
    await this.searchBox.waitFor({ state: "visible" });
    await this.findReservationByNumber(resNum);
    await this.getReservationRow(resNum).getByRole("checkbox").click();
    await this.deleteButton.click();
    await this.page.waitForEvent("dialog").then((dialog) => dialog.accept());
    await this.deleteOKButton.click();
  }

  async deleteRecentGroupReservations(): Promise<void> {
    await this.deleteRecentReservationsByType(this.reservationTypeGroup);
  }

  async deleteRecentSharedReservations(): Promise<void> {
    await this.deleteRecentReservationsByType(this.reservationTypeShared);
  }

  async deleteRecentRegularReservations(): Promise<void> {
    await this.deleteRecentReservationsByType(this.reservationTypeRegular);
  }

  async deleteRecentPackageReservations(): Promise<void> {
    await this.deleteRecentReservationsByType(this.reservationTypePackage);
  }

  async deleteRecentHourlyReservations(): Promise<void> {
    await this.deleteRecentReservationsByType(this.reservationTypeHourly);
  }

  async deleteRecentUnassignedReservations(): Promise<void> {
    await this.deleteRecentReservationsByType(this.reservationTypeUnassigned);
  }

  // ***************** Assertions *********************************

  async verifyFirstGuestLinkVisible(): Promise<void> {
    await this.firstGuestLink.waitFor({ state: "visible" });
  }

  // ***************** Getters *********************************

  async getFirstGuestName(): Promise<string> {
    return (await this.firstGuestLink.textContent())?.trim() ?? "";
  }

  // ***************** Private Helpers *********************************

  private async openReservationTypeDropdown(): Promise<void> {
    await this.reservationTypeDropdown.click();
  }

  private async selectReservationNumberSearch(): Promise<void> {
    await this.searchByDropdown.click();
    await this.page
      .locator(".cdk-overlay-pane:visible")
      .getByRole("option", { name: "Reservation #", exact: true })
      .click();
  }

  private async clickFirstGroupResult(): Promise<void> {
    await this.clickGroupResult(this.firstGroupCell.locator("xpath=.."));
  }

  private async clickGroupResult(groupRow: Locator): Promise<void> {
    const groupCell = groupRow.locator("td.cdk-column-GroupName");
    const groupLink = groupCell.getByRole("link");
    if (await groupLink.isVisible()) {
      await groupLink.click();
      return;
    }

    await groupCell.click();
  }

  private getReservationRow(confirmationNumber: string): Locator {
    const escapedNumber = confirmationNumber.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Source icons contribute alt text to the accessible name, but not cell text.
    return this.page.getByRole("row").filter({
      has: this.page.getByRole("cell").filter({
        hasText: new RegExp(`^\\s*${escapedNumber}\\s*$`),
      }),
    });
  }

  private async deleteRecentReservationsByType(
    reservationType: Locator,
  ): Promise<void> {
    await this.openReservationTypeDropdown();
    const reservationsResponsePromise = this.page.waitForResponse(
      (response) =>
        response.url().includes("/Reservation/GetReservationList") &&
        response.request().method() === "POST",
    );
    await reservationType.click();
    const reservationsResponse = await reservationsResponsePromise;
    const reservations = (await reservationsResponse.json()) as unknown[];

    if (reservations.length === 0) {
      return;
    }

    await this.selectAllCheckbox.check();
    await expect(this.selectAllCheckbox).toBeChecked();
    await this.deleteButton.click();
    await this.deleteOKButton.click();
  }
}
