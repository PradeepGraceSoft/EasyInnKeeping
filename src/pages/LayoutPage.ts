import { Locator, Page } from "@playwright/test";
import { BasePage } from "../utils/BasePage";

export class LayoutPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ***************** Page Elements *********************************

  private readonly reservationListIcon: Locator = this.page.getByRole("link", {
    name: /Reservations/i,
  });

  private readonly reportIcon: Locator = this.page.locator(
    "//a[@routerlink='/reports']",
  );

  private readonly setupIcon: Locator = this.page.locator(
    "//a[@routerlink='/setup']",
  );

  private readonly calendarIcon: Locator = this.page.locator(
    "//a[@routerlink='/calendar']",
  );

  private readonly housekeepingIcon: Locator = this.page.getByRole("link", {
    name: /Housekeeping/i,
  });

  // Hamburger menu is conditionally present depending on viewport/state
  private readonly hamburgerMenuButton: Locator = this.page.locator(
    "//button[@class='hamberger ng-star-inserted']",
  );

  // ***************** Navigation *********************************

  async clickReservationListIcon(): Promise<void> {
    await this.expandMenuIfCollapsed();
    await this.reservationListIcon.waitFor({
      state: "visible",
      timeout: 15000,
    });
    await this.reservationListIcon.click();
  }

  async clickReportIcon(): Promise<void> {
    await this.reportIcon.waitFor({ state: "visible", timeout: 15000 });
    await this.reportIcon.click();
  }

  async clickSetupIcon(): Promise<void> {
    await this.setupIcon.waitFor({ state: "visible", timeout: 15000 });
    await this.setupIcon.click();
  }

  async clickCalendarIcon(): Promise<void> {
    await this.calendarIcon.waitFor({ state: "visible", timeout: 15000 });
    await this.calendarIcon.click();
  }

  async clickHousekeepingIcon(): Promise<void> {
    await this.expandMenuIfCollapsed();
    await this.housekeepingIcon.waitFor({ state: "visible", timeout: 15_000 });
    await this.housekeepingIcon.click();
  }

  // ***************** Private Helpers *********************************

  /**
   * The hamburger menu button is only present when the sidebar is collapsed.
   * Clicking it expands the nav before navigating to the reservation list.
   * If it is not present, the sidebar is already expanded and we proceed directly.
   */
  private async expandMenuIfCollapsed(): Promise<void> {
    const isVisible = await this.hamburgerMenuButton.isVisible();

    if (isVisible) {
      await this.hamburgerMenuButton.click();
    }
  }
}
