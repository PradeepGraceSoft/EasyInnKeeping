import { expect, Locator, Page } from "@playwright/test";

import { BasePage } from "../../utils/BasePage";

export class PosTerminalPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ***************** POS navigation *********************************

  private readonly posMenu = this.page.getByRole("link", {
    name: /\bPOS\b/i,
  });

  private readonly posTerminalTab = this.page.getByText("POS Terminal", {
    exact: true,
  });

  // ***************** Outlet and catalog *********************************

  private readonly outletDialog = this.page.getByRole("dialog");

  private readonly changeOutletButton = this.page.getByText("Change", {
    exact: true,
  });

  private readonly selectedOutletHeading = this.page.locator(
    "app-pos h1, app-pos h2, app-pos h3, app-pos .heading",
  );

  private readonly catalogItems = this.page.locator("app-pos .pos-box");

  // ***************** Restaurant service *********************************

  private readonly restaurantSelects = this.page.locator("app-pos mat-select");

  // ***************** Order actions *********************************

  private readonly sendOrderButton = this.page
    .locator("app-pos")
    .getByRole("button", { name: /Send Order/i });

  private readonly saleFinishedButton = this.page
    .locator("app-pos")
    .getByRole("button", { name: /Sale Finished/i });

  private readonly payButton = this.page
    .locator("app-pos")
    .getByRole("button", { name: /^Pay$/i });

  // ***************** Payment dialog *********************************

  private readonly paymentDialog = this.page.getByRole("dialog");

  private readonly paymentAccountCode = this.paymentDialog.getByRole(
    "combobox",
    { name: "Account Code" },
  );

  private readonly paymentAmount = this.paymentDialog.getByRole("spinbutton", {
    name: "Amount :",
  });

  private readonly cashPaymentOption = this.page.getByRole("option", {
    name: /^106 Cash Payment$/i,
  });

  private readonly addPaymentButton = this.paymentDialog.getByRole("button", {
    name: /Add Payment/i,
  });

  private readonly receiptPreview = this.page.locator(
    "app-print-order, mat-dialog-container",
  );

  private readonly receiptDialog = this.page
    .getByRole("dialog")
    .filter({ has: this.page.getByRole("heading", { name: "Bill Details" }) });

  private readonly closeReceiptButton = this.receiptDialog.getByRole("button", {
    name: "Close",
  });

  // ***************** Navigation *********************************

  async clickPosMenu(): Promise<void> {
    await this.posMenu.click();
  }

  async clickPosTerminalTab(): Promise<void> {
    await this.posTerminalTab.click();
  }

  async clickChangeOutlet(): Promise<void> {
    await this.changeOutletButton.click();
  }

  // ***************** Outlet and catalog *********************************

  async clickOutletContaining(outletType: "Gift" | "Restaurant"): Promise<void> {
    const outletName = outletType === "Gift" ? "GIFT SHOP" : "RESTAURANT";
    const outlet = this.outletDialog.getByText(outletName, { exact: true });
    if (!(await outlet.first().isVisible({ timeout: 15_000 }))) {
      throw new Error(
        `The POS outlet selector did not show a ${outletType} outlet within 15 seconds.`,
      );
    }
    await outlet.first().click();
  }

  async clickFirstCatalogItem(): Promise<void> {
    const item = this.catalogItems.first();
    if (!(await item.isVisible({ timeout: 15_000 }))) {
      throw new Error(
        "The POS terminal did not show a saleable catalog item within 15 seconds.",
      );
    }
    await item.click();
  }

  async clickCatalogItem(itemName: string): Promise<void> {
    const item = this.page
      .locator("app-pos")
      .getByText(itemName, { exact: true })
      .first();
    if (!(await item.isVisible({ timeout: 15_000 }))) {
      throw new Error(
        `The POS terminal did not show the '${itemName}' catalog item within 15 seconds.`,
      );
    }
    await item.click();
  }

  // ***************** Restaurant service *********************************

  async selectFirstRestaurantServiceValues(): Promise<void> {
    const selects = this.restaurantSelects;
    const selectCount = await selects.count();
    if (selectCount < 4) {
      throw new Error(
        "The Restaurant POS terminal did not show service, table, captain, and waiter selectors within 15 seconds.",
      );
    }

    for (let index = 0; index < 4; index += 1) {
      await selects.nth(index).click();
      const firstOption = this.page.locator(
        "mat-option[role='option'][aria-disabled='false']",
      ).first();
      if (!(await firstOption.isVisible({ timeout: 15_000 }))) {
        throw new Error(
          "A Restaurant POS selector did not show an available option within 15 seconds.",
        );
      }
      await firstOption.click();
    }
  }

  // ***************** Order actions *********************************

  async clickSendOrder(): Promise<void> {
    await this.sendOrderButton.click();
  }

  async clickSaleFinished(): Promise<void> {
    await this.saleFinishedButton.click();
  }

  async clickPay(): Promise<void> {
    await this.payButton.click();
  }

  // ***************** Payment *********************************

  async selectCashPayment(): Promise<void> {
    await this.paymentAccountCode.click();
    if (!(await this.cashPaymentOption.isVisible({ timeout: 15_000 }))) {
      throw new Error(
        "The POS payment dialog did not offer Cash Payment within 15 seconds.",
      );
    }
    await this.cashPaymentOption.click();
  }

  async enterPaymentAmount(amount: string): Promise<void> {
    await this.paymentAmount.fill(amount);
  }

  async clickAddPayment(): Promise<void> {
    await this.addPaymentButton.click();
  }

  async clickCloseReceipt(): Promise<void> {
    await this.closeReceiptButton.click();
  }

  // ***************** Verification *********************************

  async verifyOutletSelected(outletType: "Gift" | "Restaurant"): Promise<void> {
    await expect(this.selectedOutletHeading).toContainText(
      new RegExp(outletType, "i"),
      { timeout: 15_000 },
    );
  }

  async verifyReceiptPreviewDisplayed(): Promise<void> {
    const receipt = this.receiptPreview.getByText(/Receipt|Amount Due|Total/i).first();
    if (!(await receipt.isVisible({ timeout: 15_000 }))) {
      throw new Error(
        "The POS terminal did not show a receipt preview after the cash payment within 15 seconds.",
      );
    }
  }

  async verifyAmountPaid(expectedAmount: string): Promise<void> {
    const escapedAmount = expectedAmount.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    await expect(this.receiptDialog).toContainText(
      new RegExp(`Amount Paid\\s*:\\s*${escapedAmount}`),
      {
      timeout: 15_000,
      },
    );
  }

  async verifyReceiptTax(expectedTax: string): Promise<void> {
    const escapedTax = expectedTax.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    await expect(this.receiptDialog).toContainText(
      new RegExp(`Tax\\s*:\\s*${escapedTax}(?:\\.00)?(?:\\s|$)`),
      { timeout: 15_000 },
    );
  }

  async verifyReceiptContainsItems(itemNames: string[]): Promise<void> {
    for (const itemName of itemNames) {
      await expect(
        this.receiptDialog.getByText(itemName, { exact: true }),
      ).toBeVisible({ timeout: 15_000 });
    }
  }

  async getPaymentAmount(): Promise<string> {
    return this.paymentAmount.inputValue();
  }
}
