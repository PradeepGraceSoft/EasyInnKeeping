import { expect, Locator, Page } from "@playwright/test";
import { ConstNames } from "../constants/ConstNames";
import { BasePage } from "../utils/BasePage";

export class BillingPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // Billing tab and invoice date
  private readonly billingTabLabel = this.page.getByText("Billing", {
    exact: true,
  });
  private readonly reservationDialog = this.page
    .getByRole("dialog")
    .filter({ has: this.billingTabLabel })
    .last();
  private readonly billingTab = this.reservationDialog.getByText("Billing", {
    exact: true,
  });
  private readonly invoiceDatePicker = this.reservationDialog.locator(
    // Angular increments calendar IDs whenever another reservation opens.
    'input.mat-datepicker-input:visible:not([name="startDate"]):not([name="endDate"])',
  );

  // Payment & Refund
  private readonly paymentRefundInput = this.page.locator(
    "(//input[@aria-autocomplete='list'])[2]",
  );
  private readonly paymentModeDropdown = this.page.locator(
    "[name='MultiPaymentMode']",
  );
  private readonly paymentModePercentage = this.page.locator(
    "//span[@class='mat-option-text' and text()=' Percentage']",
  );
  private readonly paymentModeNights = this.page.locator(
    "//span[@class='mat-option-text' and text()=' No. of Nights']",
  );
  private readonly paymentModeNightsWithTax = this.page.locator(
    "//span[@class='mat-option-text' and text()=' No. of Nights + Tax']",
  );
  private readonly paymentModeValueInput = this.page.locator(
    "[name='valueInput']",
  );
  private readonly amountInput = this.page.locator("input[name='Amount']");
  private readonly ccTransactionIdInput = this.page.getByRole("textbox", {
    name: "CC Tran ID",
    exact: true,
  });
  private readonly billingCCExpMonthDropdown = this.page.locator(
    "[name='CardExpMonth']",
  );
  private readonly billingCCExpYearDropdown = this.page.locator(
    "[name='CardExpYear']",
  );
  private readonly billingProcessButton = this.page.getByRole("button", {
    name: "Process",
    exact: true,
  });
  private readonly authOnlyButton = this.page.getByRole("button", {
    name: "Auth Only",
    exact: true,
  });
  private readonly captureButton = this.page.getByRole("button", {
    name: "Capture",
    exact: true,
  });
  private readonly authOnlyTransactionsToggle = this.page.getByText(
    /Click here to view the Auth only Transactions/i,
  );
  private readonly refundButton = this.page
    .locator("app-payments-form")
    .getByRole("button", { name: "Refund", exact: true });
  private readonly paymentRefundSaveButton = this.page.locator(
    "(//button[@mat-raised-button and .//span[text()='Save']])[2]",
  );
  private readonly storedCreditCardInput = this.page
    .locator("app-payments-form")
    .getByRole("textbox", { name: "Credit Card", exact: true });
  private readonly viewStoredCreditCardButton = this.storedCreditCardInput.locator(
    "xpath=ancestor::mat-form-field//button",
  );
  private readonly creditCardDialog = this.page.getByRole("dialog").filter({
    has: this.page.getByRole("table", { name: "saved cards table" }),
  });
  private readonly creditCardPasswordDialog = this.page.getByRole("dialog").filter({
    has: this.page.locator("input[type='password']"),
  });
  private readonly creditCardViewPasswordInput =
    this.creditCardPasswordDialog.locator("input[type='password']");
  private readonly creditCardViewButton = this.creditCardPasswordDialog.getByRole(
    "button",
    { name: "View", exact: true },
  );
  private readonly invalidCreditCardPasswordMessage = this.page
    .locator("snack-bar-container")
    .getByText("Invalid Password", { exact: true });

  // Charges & Discount
  private readonly chargesDiscountInput = this.reservationDialog
    .locator("input[aria-autocomplete='list']")
    .first();
  private readonly chargeDiscountAmountInput = this.reservationDialog.locator(
    "input[name='rateTextBox']",
  );
  private readonly chargesDiscountTotalInput = this.reservationDialog.locator(
    "mat-label:text-is('Total')",
  ).locator("xpath=ancestor::mat-form-field//input");
  private readonly chargesDiscountSaveButton = this.reservationDialog.getByRole(
    "button",
    { name: "Save", exact: true },
  ).nth(0);

  // Line items
  private readonly voidButton = this.page.locator(
    "//button[span[normalize-space(text())='Void']]",
  );
  private readonly lineItemRefundButton = this.page
    .getByLabel("billing-grid")
    .getByRole("button", { name: "Refund", exact: true });
  private readonly voidPopupYesButton = this.page.locator(
    "//button[span[normalize-space(text())='Yes']]",
  );
  private readonly taxExemptCheckbox = this.page.locator(
    "//mat-checkbox[label/span[normalize-space(text())='Tax Exempt']]",
  );

  // Print and footer
  private readonly printEmailButton = this.page.locator(
    "//button[.//span[normalize-space(text())='Email']]",
  );
  private readonly printEmailSendButton = this.page.locator(
    "//button[.//span[normalize-space(text())='Send']]",
  );
  private readonly footerTotalAmount = this.page.locator(
    "//td[contains(@class,'mat-footer-cell') and contains(@class,'mat-column-Charges')]/span",
  );
  private readonly footerPayments = this.page.locator(
    "//td[contains(@class,'mat-footer-cell') and contains(@class,'mat-column-Payments')]/span",
  );
  private readonly footerAmountDue = this.page.locator(
    "//td[contains(@class,'mat-footer-cell') and contains(@class,'mat-column-Actions')]/span",
  );
  private readonly printEmailInvoiceButton = this.page.locator(
    "//button[.//span[normalize-space(text())='Print / Email Invoice']]",
  );
  private readonly printInvoiceDialog = this.page.getByRole("dialog").filter({
    has: this.page.getByRole("heading", { name: "Print Invoice", exact: true }),
  });
  private readonly printInvoiceTypeDropdown = this.printInvoiceDialog.getByRole(
    "combobox",
    { name: /Invoice Type/i },
  );
  private readonly printCloseButton = this.printInvoiceDialog.getByRole(
    "button",
    { name: "Close", exact: true },
  );

  async clickBillingTab(): Promise<void> {
    await this.billingTab.click();
  }

  async enterBillingInvoiceDate(inputDate: string): Promise<void> {
    await this.invoiceDatePicker.fill(inputDate);
    await this.invoiceDatePicker.press("Tab");
    await expect(this.invoiceDatePicker).toHaveValue(inputDate);
  }

  async enterChargesDiscountAccountCode(accountCode: string): Promise<void> {
    await this.chargesDiscountInput.fill(accountCode);
    await this.chargesDiscountInput.press("Tab");
    await expect(this.chargesDiscountInput).toHaveValue(
      new RegExp(`\\(${this.escapeRegExp(accountCode)}\\)\\s*$`),
    );
  }

  async enterChargesDiscountAmountTextbox(amountValue: string): Promise<void> {
    await expect(this.chargeDiscountAmountInput).toBeVisible();
    await expect(this.chargeDiscountAmountInput).toBeEnabled();
    await this.chargeDiscountAmountInput.fill(amountValue);
    await expect(this.chargeDiscountAmountInput).toHaveValue(amountValue);
    await this.chargeDiscountAmountInput.press("Tab");
    await expect(this.chargeDiscountAmountInput).not.toBeFocused();
    await expect(this.chargeDiscountAmountInput).toHaveValue(amountValue);
    await expect(this.chargesDiscountTotalInput).toHaveValue(amountValue);
  }

  async clickChargesDiscountSave(): Promise<void> {
    await expect(this.chargesDiscountSaveButton).toBeEnabled();
    await this.chargesDiscountSaveButton.click();
  }

  async enterPaymentRefundAccountCode(accountCode: string): Promise<void> {
    const selectedAccount = new RegExp(
      `\\(${this.escapeRegExp(accountCode)}\\)\\s*$`,
    );

    await expect(this.paymentRefundInput).not.toHaveValue("");
    const currentAccount = await this.paymentRefundInput.inputValue();
    const accountName = selectedAccount.test(currentAccount)
      ? currentAccount.replace(selectedAccount, "").trim()
      : accountCode;
    await this.paymentRefundInput.fill("");
    await this.paymentRefundInput.pressSequentially(accountName);
    await this.page
      .getByRole("option", {
        name: new RegExp(`^${this.escapeRegExp(accountCode)}\\s`),
      })
      .click();
    await expect(this.paymentRefundInput).toHaveValue(selectedAccount);
  }

  async selectPaymentModePercentage(): Promise<void> {
    await this.paymentModeDropdown.click();
    await this.paymentModePercentage.click();
  }

  async selectPaymentModeNights(): Promise<void> {
    await this.paymentModeDropdown.click();
    await this.paymentModeNights.click();
  }

  async selectPaymentModeNightsWithTax(): Promise<void> {
    await this.paymentModeDropdown.click();
    await this.paymentModeNightsWithTax.click();
  }

  async enterPaymentModeValue(value: string): Promise<void> {
    await this.paymentModeValueInput.fill(value);
    await this.paymentModeValueInput.press("Tab");
  }

  async enterPaymentAmountTextBox(amount: string): Promise<void> {
    await expect(this.amountInput).toBeVisible();
    await expect(this.amountInput).toBeEnabled();
    await this.amountInput.fill(amount);
    await expect(this.amountInput).toHaveValue(amount);
    await this.amountInput.press("Tab");
    await expect(this.amountInput).not.toBeFocused();
    await expect(this.amountInput).toHaveValue(amount);
  }

  async enterBillingCCDetails(
    cardNumber: string = "4111111111111111",
  ): Promise<void> {
    const cardFrame = this.page.frameLocator(
      "iframe[name*='tx_iframe_tokenExIframeDiv']",
    );
    const cardNumberInput = cardFrame.locator("input[name='cardNumber']");
    await expect(cardNumberInput).toBeVisible({ timeout: 15000 });
    await cardNumberInput.fill(cardNumber);
    await this.billingCCExpMonthDropdown.click();
    const monthOption = this.page
      .locator(".cdk-overlay-pane:visible")
      .getByRole("option")
      .nth(1);
    const month = (await monthOption.textContent())?.trim() ?? "";
    await monthOption.click();
    await expect(this.billingCCExpMonthDropdown).toContainText(month);

    await this.billingCCExpYearDropdown.click();
    const yearOption = this.page
      .locator(".cdk-overlay-pane:visible")
      .getByRole("option")
      .nth(1);
    const year = (await yearOption.textContent())?.trim() ?? "";
    await yearOption.click();
    await expect(this.billingCCExpYearDropdown).toContainText(year);
  }

  async clickProcessButton(): Promise<void> {
    await expect(this.billingProcessButton).toBeVisible({ timeout: 15000 });
    await expect(this.billingProcessButton).toBeEnabled();
    await this.billingProcessButton.click();
  }

  async clickAuthOnlyButton(): Promise<void> {
    await expect(this.authOnlyButton).toBeVisible({ timeout: 15000 });
    await expect(this.authOnlyButton).toBeEnabled();
    await this.authOnlyButton.click();
  }

  async clickCaptureButton(): Promise<void> {
    await expect(this.captureButton).toBeVisible({ timeout: 15000 });
    await expect(this.captureButton).toBeEnabled();
    await this.captureButton.click();
  }

  async clickAuthOnlyTransactions(): Promise<void> {
    await expect(this.authOnlyTransactionsToggle).toBeVisible({ timeout: 15000 });
    await this.authOnlyTransactionsToggle.click();
  }

  async verifyAuthOnlyTransactionIDDisplayed(): Promise<void> {
    await expect(this.page.getByText(/Tran ID\s*:/i).last()).toBeVisible({
      timeout: 15000,
    });
  }

  async verifyCaptureTransactionSelected(expectedAmount: string): Promise<void> {
    await expect(this.ccTransactionIdInput).toHaveValue(/\d+/, {
      timeout: 15000,
    });
    await expect(this.amountInput).toHaveValue(expectedAmount);
  }

  async clickVoidButton(): Promise<void> {
    await this.voidButton.click();
    await this.voidPopupYesButton.click();
  }

  async clickLineItemRefundButton(): Promise<void> {
    await this.lineItemRefundButton.click();
  }

  async clickEditBillingItem(itemName: string): Promise<void> {
    const row = this.billingItem(itemName).locator("xpath=ancestor::tr");
    const actionButtons = row.getByRole("cell").last().getByRole("button");
    await expect(actionButtons).toHaveCount(2, { timeout: 15000 });
    const editButton = actionButtons.first();
    await expect(editButton).toBeVisible({ timeout: 15000 });
    await expect(editButton).toBeEnabled();
    await editButton.click();
    await expect(this.chargesDiscountInput).toHaveValue(
      new RegExp(this.escapeRegExp(itemName), "i"),
    );
    await expect(this.chargeDiscountAmountInput).toBeEnabled();
  }

  async clickDeleteBillingItem(itemName: string): Promise<void> {
    const row = this.billingItem(itemName).locator("xpath=ancestor::tr");
    const actionButtons = row.getByRole("cell").last().getByRole("button");
    await expect(actionButtons).toHaveCount(2, { timeout: 15000 });
    const deleteButton = actionButtons.last();
    await expect(deleteButton).toBeVisible({ timeout: 15000 });
    await expect(deleteButton).toBeEnabled();
    await deleteButton.click();
    const confirmationText = this.page.getByText(
      "Are you sure to delete this item?",
      { exact: true },
    );
    await expect(confirmationText).toBeVisible();
    await this.page.getByRole("button", { name: "Yes", exact: true }).click();
    await expect(confirmationText).toBeHidden();
    await expect(this.billingItem(itemName)).toBeHidden({ timeout: 15000 });
  }

  async clickRefundButton(): Promise<void> {
    await this.refundButton.click();
  }

  async clickPaymentRefundSaveButton(): Promise<void> {
    await this.paymentRefundSaveButton.click();
  }

  async verifyStoredCreditCardDetails(
    cardNumber: string,
    viewPassword: string,
  ): Promise<void> {
    if (!viewPassword.trim()) {
      throw new Error(
        "CreditCardViewPassword is required for the active property in config/testdata.env.",
      );
    }

    const lastFourDigits = cardNumber.slice(-4);
    await expect(this.storedCreditCardInput).toHaveValue(
      `**** **** **** ${lastFourDigits}`,
    );
    await this.viewStoredCreditCardButton.click();
    await expect(this.creditCardPasswordDialog).toBeVisible({ timeout: 15000 });
    await this.creditCardViewPasswordInput.fill(viewPassword);
    await this.creditCardViewButton.click();

    await expect(
      this.creditCardDialog.or(this.invalidCreditCardPasswordMessage),
    ).toBeVisible({ timeout: 10000 });

    if (await this.invalidCreditCardPasswordMessage.isVisible()) {
      throw new Error(
        "The configured CreditCardViewPassword is invalid for the active property.",
      );
    }

    const savedCardRow = this.creditCardDialog
      .getByRole("table", { name: "saved cards table" })
      .getByRole("row")
      .nth(1);
    await expect(
      savedCardRow
        .getByRole("cell")
        .nth(0)
        .locator("iframe")
        .contentFrame()
        .locator("input:not([type='hidden'])"),
    ).toHaveValue(cardNumber);
    await expect(savedCardRow.getByRole("cell").nth(1)).toHaveText(
      /^\s*\d{2}\/\d{4}\s*$/,
    );
    await expect(savedCardRow.getByRole("cell").nth(3)).toHaveText(
      ConstNames.INVENTORY_PAYMENT_VISA_PAYMENT,
    );
    await expect(savedCardRow.getByRole("cell").nth(4)).not.toHaveText("");
    await this.creditCardDialog
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await expect(this.creditCardDialog).toBeHidden();
  }

  async clickPrintEmailInvoice(): Promise<void> {
    await this.printEmailInvoiceButton.click();
    await expect(this.printInvoiceDialog).toBeVisible();
  }

  async clickPrintEmailButton(): Promise<void> {
    await this.printEmailButton.click();
  }

  async clickPrintEmailSendButton(): Promise<void> {
    await this.printEmailSendButton.click();
  }

  async clickPrintCloseButton(): Promise<void> {
    await this.printCloseButton.click();
  }

  async selectPrintInvoiceType(printName: string): Promise<void> {
    await this.printInvoiceTypeDropdown.click();
    await this.page.getByRole("option", { name: printName, exact: true }).click();
    await expect(this.printInvoiceTypeDropdown).toContainText(printName);
  }

  async verifyInventoryTaxSplit(expectedNumberOfTaxes: number): Promise<void> {
    await expect(
      this.page.locator("//span[contains(text(),'Taxes - Inventory Item')]")
    ).toHaveCount(expectedNumberOfTaxes);
  }

  async verifyInventoryTaxOneLineDisplay(): Promise<void> {
    await expect(
      this.page.locator("//span[contains(text(),' Inventory Taxes ')]")
    ).toHaveCount(1);
  }

  async verifyPaymentAmount(expectedAmount: string): Promise<void> {
    await expect(this.amountInput).toHaveValue(expectedAmount);
  }

  async verifyBillingPaymentTransactionID(depositValue: string): Promise<void> {
    await this.clickBillingTab();
    const transaction = this.page.locator(
      "//span[text()=' VisaCard Deposit ']/following::span[1]",
    );

    if (depositValue === "No deposit") {
      await expect(transaction).toHaveCount(0);
    } else {
      await expect(transaction).toContainText("Tran ID");
    }
  }

  async verifyBillingPaymentTransactionIDDisplayed(
    accountName: string,
  ): Promise<void> {
    const transaction = this.page.locator(
      `//span[text()=${this.xpathLiteral(` ${accountName} `)}]/following::span[1]`,
    );
    await expect(transaction).toContainText("Tran ID");
  }

  async verifyBillingItemDisplay(expectedItemName: string): Promise<void> {
    await expect(this.billingItem(expectedItemName)).toBeVisible();
  }

  async verifyBillingItemNotDisplayed(expectedItemName: string): Promise<void> {
    await expect(this.billingItem(expectedItemName)).toBeHidden();
  }

  async verifyBillingItemDisplayBasedonInvoiceDate(
    expectedItemName: string,
    expectedInvoiceDate: string,
  ): Promise<void> {
    const invoiceDate = this.page.locator(
      `(//span[normalize-space(text())=${this.xpathLiteral(expectedItemName)}]/ancestor::tr//div[contains(@class,'ng-trigger-detailExpand')]/span)[2]`,
    );
    await expect(invoiceDate).toHaveText(expectedInvoiceDate);
  }

  async selectLineItemTaxExemptCheckbox(): Promise<void> {
    await this.taxExemptCheckbox.click();
  }

  async unselectLineItemTaxExemptCheckbox(): Promise<void> {
    if (await this.isTaxExemptSelected()) {
      await this.taxExemptCheckbox.click();
    }
  }

  async verifyBillingFooterAmount(expectedAmount: string): Promise<void> {
    await expect(this.footerTotalAmount).toHaveText(expectedAmount);
  }

  async verifyBillingFooterPayments(expectedAmount: string): Promise<void> {
    await expect(this.footerPayments).toHaveText(expectedAmount);
  }

  async verifyBillingFooterAmountDue(
    expectedAmountDueText: string,
  ): Promise<void> {
    await expect(this.footerAmountDue).toHaveText(
      `Amount Due : ${expectedAmountDueText}`,
    );
  }

  async verifyBillingTotals(
    expectedTotal: string,
    expectedPaid: string,
    expectedDue: string,
  ): Promise<void> {
    await this.verifyBillingFooterAmount(expectedTotal);
    await this.verifyBillingFooterPayments(expectedPaid);
    await this.verifyBillingFooterAmountDue(expectedDue);
  }

  async verifyLineItemTaxExemptCheckboxSelected(
    expectedSelected: boolean,
  ): Promise<void> {
    expect(await this.isTaxExemptSelected()).toBe(expectedSelected);
  }

  async verifyLineItemChargesAmount(
    itemName: string,
    expectedAmount: string,
  ): Promise<void> {
    const charges = this.page.locator(
      `//td[contains(@class,'mat-column-Description')]//span[normalize-space(text())=${this.xpathLiteral(itemName)}]/ancestor::td/following-sibling::td[contains(@class,'mat-column-Charges')]`,
    );
    await expect(charges).toHaveText(expectedAmount);
  }

  async verifyPrintTaxDisplayStatus(
    itemName: string,
    shouldDisplay: boolean,
  ): Promise<void> {
    const item = this.page.locator(
      `(//td[normalize-space(text())=${this.xpathLiteral(itemName)}])[2]`,
    );
    if (shouldDisplay) {
      await expect(item).toBeVisible();
    } else {
      await expect(item).toBeHidden();
    }
  }

  async verifyPrintBillingDescriptionCharge(
    description: string,
    expectedCharge: string,
  ): Promise<void> {
    const charge = this.page.locator(
      `((//tr[@class='ng-star-inserted'])[2])//*[contains(normalize-space(text()), ${this.xpathLiteral(description)})]/following::td[4]`,
    );
    await expect(charge).toHaveText(expectedCharge);
  }

  async verifyPrintBillingDescriptionChargeDaily(
    description: string,
    expectedCharge: string,
    _roomOrder: string,
  ): Promise<void> {
    const charge = this.page.locator(
      `(((//tr[@class='ng-star-inserted'])[2])//*[contains(normalize-space(text()), ${this.xpathLiteral(description)})]/following::td[4])[1]`,
    );
    await expect(charge).toHaveText(expectedCharge);
  }

  async verifyPrintBillingFooterTotals(
    description: string,
    expectedValue: string,
  ): Promise<void> {
    const total = this.page.locator(
      `//table[@aria-label='print-billing-grid-6']//*[normalize-space(text())=${this.xpathLiteral(description)}]/following::td[1]`,
    );
    await expect(total).toHaveText(expectedValue);
  }

  async verifyPrintedInvoiceTotals(
    roomAmount: string,
    taxAmount: string,
    grandTotal: string,
  ): Promise<void> {
    await this.verifyPrintBillingDescriptionCharge(
      ConstNames.BILLING_ROOM_CHARGE_NAME,
      roomAmount,
    );
    await this.verifyPrintBillingDescriptionCharge(
      ConstNames.BILLING_LODGING_TAX_NAME,
      taxAmount,
    );
    await this.verifyPrintFooter(grandTotal);
  }

  async verifyPrintFooter(grandTotal: string): Promise<void> {
    await this.verifyPrintBillingFooterTotals(
      ConstNames.BILLING_PRINT_FOOTER_TOTAL,
      grandTotal,
    );
    await this.verifyPrintBillingFooterTotals(
      ConstNames.BILLING_PRINT_FOOTER_DUE,
      grandTotal,
    );
    await this.verifyPrintBillingFooterTotals(
      ConstNames.BILLING_PRINT_FOOTER_PAID,
      "0.00",
    );
  }

  private billingItem(itemName: string): Locator {
    return this.reservationDialog.locator(
      `//span[normalize-space(text())=${this.xpathLiteral(itemName)}]`,
    );
  }

  private async isTaxExemptSelected(): Promise<boolean> {
    const input = this.taxExemptCheckbox.locator("input[type='checkbox']");
    return input.isChecked();
  }

  private xpathLiteral(value: string): string {
    if (!value.includes("'")) return `'${value}'`;
    if (!value.includes('"')) return `"${value}"`;
    return `concat('${value.replace(/'/g, `', "'", '`)}')`;
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
