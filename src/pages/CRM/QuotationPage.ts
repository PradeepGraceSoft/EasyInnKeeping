import { Locator, Page, expect } from "@playwright/test";
import { BasePage } from "../../utils/BasePage";

export class QuotationPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ***************** Page Elements *********************************

  private readonly addQuotationHeading: Locator = this.page.getByRole("heading", {
    name: "Add Quotation",
    exact: true,
  });
  private readonly addRowButton: Locator = this.page.getByRole("button", {
    name: "Add Row",
    exact: true,
  });
  private readonly sendQuotationButton: Locator = this.page.getByRole("button", {
    name: "Send Quotation",
    exact: true,
  });
  private readonly quotationSentMessage: Locator = this.page
    .locator("#toast-container .toast-success")
    .getByRole("alert")
    .filter({
      hasText: /^Quotation sent successfully\.$/,
    });
  private readonly roomTotal: Locator = this.getControlByLabel("Room Total");
  private readonly tax: Locator = this.getControlByLabel("Tax");
  private readonly grandTotal: Locator = this.getControlByLabel("Grand Total");

  // ***************** Quotation Actions ******************************

  async verifyDisplayed(): Promise<void> {
    await expect(this.addQuotationHeading).toBeVisible();
    await expect(this.sendQuotationButton).toBeVisible();
  }

  async selectFirstAvailableTemplate(): Promise<void> {
    await this.selectFirstAvailableOption("Template Name");
  }

  async selectTemplate(templateName: string): Promise<void> {
    const template = this.getControlByLabel("Template Name");
    await expect(template.locator("option", { hasText: templateName }))
      .toHaveCount(1, { timeout: 15000 });
    await template.selectOption({ label: templateName });
  }

  async selectFirstAvailableProperty(): Promise<void> {
    await this.selectFirstAvailableOption("Property Name");
  }

  async enterCheckInDate(value: string): Promise<void> {
    await this.getControlByLabel("Check In").fill(value);
  }

  async enterCheckOutDate(value: string): Promise<void> {
    await this.getControlByLabel("Check Out").fill(value);
  }

  async selectRoomType(roomType: string): Promise<void> {
    await this.selectOption("Room Type", roomType);
  }

  async selectFirstAvailableRoom(): Promise<void> {
    await this.selectFirstAvailableOption("Room Name");
  }

  async selectRate(rateName: string): Promise<void> {
    await this.selectOption("Rate Name", rateName);
  }

  async clickAddRow(): Promise<void> {
    await this.addRowButton.click();
  }

  async clickSendQuotation(): Promise<void> {
    const [response] = await Promise.all([
      this.page.waitForResponse((candidate) =>
        candidate.request().method() === "POST"
        && /\/api\/Quotation\/CreateQuotation(?:[/?#]|$)/i.test(candidate.url()),
      ),
      this.sendQuotationButton.click(),
    ]);

    if (!response.ok()) {
      throw new Error(
        `CreateQuotation failed with HTTP ${response.status()}: ${await response.text()}`,
      );
    }
  }

  // ***************** Assertions *************************************

  async verifyQuotationSentSuccessfully(): Promise<void> {
    await expect(this.quotationSentMessage).toBeVisible();
  }

  async verifyTemplateSelected(templateName: string): Promise<void> {
    await expect(this.getControlByLabel("Template Name"))
      .toHaveValue(await this.getOptionValue("Template Name", templateName));
  }

  async verifyRoomTotal(expected: string): Promise<void> {
    await expect(this.roomTotal).toHaveValue(expected);
  }

  async verifyTax(expected: string): Promise<void> {
    await expect(this.tax).toHaveValue(expected);
  }

  async verifyGrandTotal(expected: string): Promise<void> {
    await expect(this.grandTotal).toHaveValue(expected);
  }

  // ***************** Private Helpers ********************************

  private getControlByLabel(label: string): Locator {
    return this.page
      .getByText(new RegExp(`^${label}\\s*\\*?$`))
      .locator("..")
      .locator("input, select, [role='combobox']")
      .first();
  }

  private async selectOption(label: string, optionName: string): Promise<void> {
    const control = this.getControlByLabel(label);

    if ((await control.evaluate((element) => element.tagName)) === "SELECT") {
      const exactOption = control.locator("option").filter({
        hasText: new RegExp(`^\\s*${this.escape(optionName)}\\s*$`),
      });
      await expect(exactOption)
        .toHaveCount(1, { timeout: 15000 });
      await control.selectOption({ label: optionName });
      return;
    }

    await control.click();
    await this.page.getByRole("option", { name: optionName, exact: true }).click();
  }

  private async selectFirstAvailableOption(label: string): Promise<void> {
    const control = this.getControlByLabel(label);

    if ((await control.evaluate((element) => element.tagName)) === "SELECT") {
      let value = "";
      await expect.poll(async () => {
        value = await control.locator("option:not([disabled])").evaluateAll(
          (options) => options
            .map((option) => (option as HTMLOptionElement).value)
            .find((optionValue) => optionValue.trim() !== "") ?? "",
        );
        return value;
      }, {
        message: `Waiting for an available ${label} option`,
        timeout: 15000,
      }).not.toBe("");
      await control.selectOption(value);
      return;
    }

    await control.click();
    const firstOption = this.page.getByRole("option").filter({
      hasNotText: /^\s*(?:select|choose)?\s*$/i,
    }).first();
    await expect(firstOption).toBeVisible();
    await firstOption.click();
  }

  private async getOptionValue(label: string, optionName: string): Promise<string> {
    const option = this.getControlByLabel(label).locator("option").filter({
      hasText: new RegExp(`^\\s*${this.escape(optionName)}\\s*$`),
    });
    return await option.getAttribute("value") ?? "";
  }

  private escape(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
