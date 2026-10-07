import { expect, Locator, Page } from "@playwright/test";
import { BasePage } from "../utils/BasePage";

export type GuestDetails = {
  firstName: string;
  lastName: string;
  email: string;
};

/** PMS Guest list and guest-creation dialog. */
export class GuestPage extends BasePage {
  private readonly guestNavigation = this.page.getByRole("link", {
    name: "Guest",
    exact: true,
  });
  private readonly addButton = this.page.getByRole("button", {
    name: /add/i,
  });
  private readonly guestDialog = this.page.getByRole("dialog").last();
  private readonly saveButton = this.guestDialog.getByRole("button", {
    name: "Save",
    exact: true,
  });

  constructor(page: Page) {
    super(page);
  }

  async clickGuestNavigation(): Promise<void> {
    await this.guestNavigation.click();
  }

  async clickAddGuest(): Promise<void> {
    await this.addButton.click();
    await expect(this.guestDialog).toBeVisible();
  }

  async enterGuestDetails(guest: GuestDetails): Promise<void> {
    await this.guestDialog
      .locator("input[formcontrolname='firstName']")
      .fill(guest.firstName);
    await this.guestDialog
      .locator("input[formcontrolname='lastName']")
      .fill(guest.lastName);
    await this.guestDialog
      .locator("input[formcontrolname='email']")
      .fill(guest.email);
  }

  async clickSaveGuest(): Promise<void> {
    await this.saveButton.click();
    await expect(this.guestDialog).toBeHidden();
  }
}
