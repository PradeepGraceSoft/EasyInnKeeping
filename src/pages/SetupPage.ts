import { Locator, Page, expect } from "@playwright/test";
import { BasePage } from "../utils/BasePage";
import { BridgePayCredentials, type BridgePayConfiguration } from "../test-data/BridgePay";
import type { BridgePayCredentials as SavedBridgePayCredentials, OnlineBookingBridgePayCredentials } from "../utils/DBHelper/SetupDatabaseHelper";

export class SetupPage extends BasePage {
  private creditCardPage: Page | undefined;

  constructor(page: Page) {
    super(page);
  }

  private get creditCardRootPage(): Page {
    return this.creditCardPage ?? this.page;
  }

  // ***************** Page Elements *********************************

  private readonly creditCardLink: Locator = this.page.getByText(
    "Credit Card",
    { exact: true },
  );

  private get creditCardDialog(): Locator {
    return this.creditCardRootPage.getByRole("dialog").filter({
      has: this.creditCardRootPage.getByRole("heading", {
        name: "Centralized Payment Routing & Credit Card Validation",
        exact: true,
      }),
    });
  }

  private get pmsCreditCardValidation(): Locator {
    return this.pmsValidationSection.getByRole("combobox");
  }

  private get pmsValidationSection(): Locator {
    return this.creditCardDialog.locator(".validation-section").filter({
      has: this.creditCardRootPage.getByText("Easy InnKeeping PMS", {
        exact: true,
      }),
    });
  }

  private get bridgePayOption(): Locator {
    return this.creditCardRootPage.getByRole("option", {
      name: "BridgePay",
      exact: true,
    });
  }

  private get bridgePayUserName(): Locator {
    return this.creditCardCredential("User Name");
  }

  private get onlineBookingValidationSection(): Locator {
    return this.creditCardDialog.locator(".validation-section").filter({
      has: this.creditCardRootPage.getByText("Easy WebRez Online Booking", {
        exact: true,
      }),
    });
  }

  private get onlineBookingCreditCardValidation(): Locator {
    return this.onlineBookingValidationSection.getByRole("combobox");
  }

  private onlineBookingCredential(label: string): Locator {
    return this.onlineBookingValidationSection
      .locator(".validation-control-row")
      .filter({
        has: this.creditCardRootPage.getByText(label, { exact: true }),
      })
      .locator("input");
  }

  private creditCardCredential(label: string): Locator {
    // These visual labels are not associated with the inputs in the DOM.
    // Locate the owning row; password inputs also have no textbox role.
    return this.pmsValidationSection
      .locator(".validation-control-row")
      .filter({
        has: this.creditCardRootPage.getByText(label, { exact: true }),
      })
      .locator("input");
  }

  private get bridgePayPassword(): Locator {
    return this.creditCardCredential("Password");
  }

  private get merchantAccountCode(): Locator {
    return this.creditCardCredential("Merchant Account Code");
  }

  private get terminalId(): Locator {
    return this.creditCardCredential("Terminal Id");
  }

  private get merchantCode(): Locator {
    return this.creditCardCredential("Merchant Code");
  }

  private get passwordVisibilityButtons(): Locator {
    return this.creditCardDialog.getByRole("button", {
      name: "Show password",
    });
  }

  private get authorizeNetOption(): Locator {
    return this.creditCardRootPage.getByRole("option", {
      name: "Authorize.Net",
      exact: true,
    });
  }

  private get authorizeNetApiLoginId(): Locator {
    return this.creditCardCredential("API Login ID");
  }

  private get authorizeNetTransactionKey(): Locator {
    return this.creditCardCredential("Transaction Key");
  }

  private get merchantAccountCodeVisibilityButton(): Locator {
    return this.merchantAccountCode
      .locator("xpath=ancestor::*[.//button][1]")
      .getByRole("button");
  }

  private get bridgePayPasswordVisibilityButton(): Locator {
    return this.bridgePayPassword
      .locator("xpath=ancestor::*[.//button][1]")
      .getByRole("button");
  }

  private get saveButton(): Locator {
    return this.creditCardDialog.getByRole("button", {
      name: "Save",
      exact: true,
    });
  }

  private get closeButton(): Locator {
    return this.creditCardDialog.getByRole("button", {
      name: "Close",
      exact: true,
    });
  }

  // ***************** Navigation *********************************

  async clickCreditCard(): Promise<void> {
    await this.creditCardLink.click();
  }

  async navigateToCreditCardSetup(): Promise<void> {
    if (!(await this.creditCardLink.isVisible({ timeout: 15_000 }))) {
      throw new Error(
        "The Setup page did not display the Credit Card configuration link within 15 seconds.",
      );
    }

    const popupPromise = this.page.waitForEvent("popup").then((popup) => {
      this.creditCardPage = popup;
      return popup;
    });

    await this.creditCardLink.scrollIntoViewIfNeeded();
    await this.clickCreditCard();

    try {
      await Promise.race([
        popupPromise.then(() => "popup"),
        this.pmsCreditCardValidation
          .waitFor({
            state: "visible",
            timeout: 15_000,
          })
          .then(() => "inline"),
      ]);
    } catch {
      throw new Error(
        "The Credit Card setup did not open or render the PMS Credit Card Validation control within 15 seconds.",
      );
    }

    if (!(await this.pmsCreditCardValidation.isVisible({ timeout: 15_000 }))) {
      throw new Error(
        "The Credit Card setup popup did not display the PMS Credit Card Validation control within 15 seconds.",
      );
    }
  }

  // ***************** Credit Card Validation *********************************

  async openPmsCreditCardValidationDropdown(): Promise<void> {
    await this.pmsCreditCardValidation.click();
    if (!(await this.bridgePayOption.isVisible({ timeout: 15_000 }))) {
      throw new Error(
        "The PMS Credit Card Validation dropdown did not display the BridgePay option within 15 seconds.",
      );
    }
  }

  async verifyBridgePayIsAvailable(): Promise<void> {
    if (!(await this.bridgePayOption.isVisible({ timeout: 15_000 }))) {
      throw new Error(
        "The PMS Credit Card Validation dropdown did not keep the BridgePay option available within 15 seconds.",
      );
    }
  }

  async selectBridgePay(): Promise<void> {
    await this.bridgePayOption.click();
    await expect
      .poll(() => this.pmsCreditCardValidation.textContent(), {
        timeout: 15_000,
        message:
          "The PMS Credit Card Validation control did not apply BridgePay within 15 seconds.",
      })
      .toContain("BridgePay");
  }

  async verifyBridgePayCredentialFieldsDisplayed(): Promise<void> {
    const fields = [
      [this.bridgePayUserName, "User Name"],
      [this.bridgePayPassword, "Password"],
      [this.merchantAccountCode, "Merchant Account Code"],
      [this.terminalId, "Terminal Id"],
      [this.merchantCode, "Merchant Code"],
    ] as const;

    for (const [field, name] of fields) {
      await expect(
        field,
        `The BridgePay setup did not display the '${name}' credential field within 15 seconds.`,
      ).toBeVisible({ timeout: 15_000 });
    }
  }

  async openOnlineBookingCreditCardValidationDropdown(): Promise<void> {
    await expect(this.onlineBookingCreditCardValidation).toBeVisible();
    await expect(this.onlineBookingCreditCardValidation).toBeEnabled();
    await this.onlineBookingCreditCardValidation.click();
  }

  async verifyOnlineBookingBridgePayIsAvailable(): Promise<void> {
    await expect(
      this.bridgePayOption,
      "BridgePay was not available in the Online Booking payment gateway dropdown.",
    ).toBeVisible({ timeout: 15_000 });
  }

  async selectOnlineBookingBridgePay(): Promise<void> {
    await this.bridgePayOption.click();
    await expect(this.onlineBookingCreditCardValidation).toContainText(
      "BridgePay",
    );
  }

  async verifyOnlineBookingBridgePayCredentialFieldsDisplayed(): Promise<void> {
    for (const label of [
      "User Name",
      "Password",
      "Merchant Account Code",
      "Terminal Id",
      "Merchant Code",
    ]) {
      // Scope every field to Online Booking so PMS credentials cannot satisfy this check.
      const field = this.onlineBookingCredential(label);
      await expect(
        field,
        `Online Booking did not display the BridgePay '${label}' credential field.`,
      ).toBeVisible({ timeout: 15_000 });
      await expect(field).toBeEnabled();
    }
  }

  async enterOnlineBookingBridgePayCredentials(
    credentials: BridgePayConfiguration = BridgePayCredentials,
  ): Promise<void> {
    await this.onlineBookingCredential("User Name").fill(credentials.userName);
    await this.onlineBookingCredential("Password").fill(credentials.password);
    await this.onlineBookingCredential("Merchant Account Code").fill(
      credentials.merchantAccountCode,
    );
    await this.onlineBookingCredential("Terminal Id").fill(
      credentials.terminalId,
    );
    await this.onlineBookingCredential("Merchant Code").fill(
      credentials.merchantCode,
    );
  }

  async verifySavedOnlineBookingBridgePayCredentials(
    credentials: BridgePayConfiguration,
    savedCredentials: OnlineBookingBridgePayCredentials | null,
  ): Promise<void> {
    await expect(this.onlineBookingCreditCardValidation).toContainText(
      "BridgePay",
    );
    await expect(this.onlineBookingCredential("User Name")).toHaveValue(
      credentials.userName,
    );
    await expect(this.onlineBookingCredential("Terminal Id")).toHaveValue(
      credentials.terminalId,
    );
    await expect(this.onlineBookingCredential("Merchant Code")).toHaveValue(
      credentials.merchantCode,
    );
    await expect(this.onlineBookingCredential("Password")).toHaveValue(
      "X".repeat(15),
    );
    await expect(
      this.onlineBookingCredential("Merchant Account Code"),
    ).toHaveValue("X".repeat(15));
    expect(
      savedCredentials,
      "Online Booking BridgePay credentials were not found for property 5447.",
    ).not.toBeNull();
    expect(
      savedCredentials?.BridgePayPasswordOnline,
      "Online Booking BridgePay password does not match the database value.",
    ).toBe(credentials.password);
    expect(
      savedCredentials?.BridgePayMerchantAccountCodeOnline,
      "Online Booking BridgePay merchant account code does not match the database value.",
    ).toBe(credentials.merchantAccountCode);
  }

  async verifyBridgePayConfigurationsRemainIndependent(
    pmsCredentials: BridgePayConfiguration,
    onlineCredentials: BridgePayConfiguration,
    savedPmsCredentials: SavedBridgePayCredentials | null,
    savedOnlineCredentials: OnlineBookingBridgePayCredentials | null,
  ): Promise<void> {
    await expect(this.pmsCreditCardValidation).toContainText("BridgePay");
    await expect(this.bridgePayUserName).toHaveValue(pmsCredentials.userName);
    await expect(this.terminalId).toHaveValue(pmsCredentials.terminalId);
    await expect(this.merchantCode).toHaveValue(pmsCredentials.merchantCode);
    expect(savedPmsCredentials, "PMS BridgePay credentials were not found.").not.toBeNull();
    expect(
      savedPmsCredentials?.BridgePayPassword,
      "Saving Online Booking changed the PMS BridgePay password.",
    ).toBe(pmsCredentials.password);
    expect(
      savedPmsCredentials?.BridgePayMerchantAccountCode,
      "Saving Online Booking changed the PMS BridgePay merchant account code.",
    ).toBe(pmsCredentials.merchantAccountCode);
    await this.verifySavedOnlineBookingBridgePayCredentials(
      onlineCredentials,
      savedOnlineCredentials,
    );
  }

  async enterBridgePayCredentials(
    credentials: BridgePayConfiguration = BridgePayCredentials,
  ): Promise<void> {
    await this.bridgePayUserName.fill(credentials.userName);
    await this.bridgePayPassword.fill(credentials.password);
    await this.merchantAccountCode.fill(credentials.merchantAccountCode);
    await this.terminalId.fill(credentials.terminalId);
    await this.merchantCode.fill(credentials.merchantCode);
  }

  async saveBridgePayConfiguration(): Promise<void> {
    await this.saveButton.click();
    await expect(
      this.creditCardRootPage
        .getByText("Saved successfully", { exact: false })
        .last(),
    ).toBeVisible({ timeout: 15_000 });
  }

  async verifyBridgePayConfigurationSavedAlert(): Promise<void> {
    await expect(
      this.creditCardRootPage.getByText(
        "Credit card information saved successfully. Reloading the page to apply the settings.",
        { exact: true },
      ),
    ).toBeVisible({ timeout: 15_000 });
  }

  async closeBridgePayConfigurationSavedAlert(): Promise<void> {
    await this.page
      .getByRole("button", { name: "Close", exact: true })
      .last()
      .click();
    await this.page.waitForTimeout(5000);
  }

  async verifySavedBridgePayCredentials(
    credentials = BridgePayCredentials,
  ): Promise<void> {
    await expect(this.pmsCreditCardValidation).toContainText("BridgePay");
    await this.merchantAccountCodeVisibilityButton.click();
    await this.merchantAccountCodeVisibilityButton.click();
    await this.bridgePayPasswordVisibilityButton.click();
    await this.bridgePayPasswordVisibilityButton.click();
    await expect(this.bridgePayPassword).toHaveValue("X".repeat(15));
    await expect(this.merchantAccountCode).toHaveValue("X".repeat(15));
    await expect(this.terminalId).toHaveValue(credentials.terminalId);
    await expect(this.merchantCode).toHaveValue(credentials.merchantCode);
  }

  async selectAuthorizeNet(): Promise<void> {
    await this.pmsCreditCardValidation.click();
    await this.authorizeNetOption.click();
    await expect(this.pmsCreditCardValidation).toContainText("Authorize.Net");
  }

  async verifyBridgePayFieldsHidden(): Promise<void> {
    for (const [field, name] of [
      [this.bridgePayUserName, "User Name"],
      [this.bridgePayPassword, "Password"],
      [this.merchantAccountCode, "Merchant Account Code"],
      [this.terminalId, "Terminal Id"],
      [this.merchantCode, "Merchant Code"],
    ] as const) {
      await expect(
        field,
        `BridgePay field '${name}' remained visible after selecting Authorize.Net.`,
      ).toBeHidden();
    }
  }

  async verifyAuthorizeNetFieldsDisplayed(): Promise<void> {
    await expect(
      this.authorizeNetApiLoginId,
      "Authorize.Net API Login ID was not displayed after selecting Authorize.Net.",
    ).toBeVisible();
    await expect(
      this.authorizeNetTransactionKey,
      "Authorize.Net Transaction Key was not displayed after selecting Authorize.Net.",
    ).toBeVisible();
  }

  async enterAuthorizeNetCredentials(credentials: {
    apiLoginId: string;
    transactionKey: string;
  }): Promise<void> {
    await this.authorizeNetApiLoginId.fill(credentials.apiLoginId);
    await this.authorizeNetTransactionKey.fill(credentials.transactionKey);
  }

  async reloadCreditCardConfiguration(): Promise<void> {
    await this.closeButton.click();
    await this.clickCreditCard();
    await expect(this.pmsCreditCardValidation).toBeVisible();
  }

  async verifyAuthorizeNetIsActive(): Promise<void> {
    await expect(
      this.pmsCreditCardValidation,
      "Authorize.Net was not retained after saving and reopening Credit Card setup.",
    ).toContainText("Authorize.Net");
  }

  async verifyBridgePayRequiredFieldValidation(): Promise<void> {
    const fields = [
      [this.bridgePayUserName, BridgePayCredentials.userName],
      [this.bridgePayPassword, BridgePayCredentials.password],
      [this.merchantAccountCode, BridgePayCredentials.merchantAccountCode],
      [this.terminalId, BridgePayCredentials.terminalId],
      [this.merchantCode, BridgePayCredentials.merchantCode],
    ] as const;

    for (const [missingField] of fields) {
      await this.bridgePayUserName.fill(BridgePayCredentials.userName);
      await this.bridgePayPassword.fill(BridgePayCredentials.password);
      await this.merchantAccountCode.fill(
        BridgePayCredentials.merchantAccountCode,
      );
      await this.terminalId.fill(BridgePayCredentials.terminalId);
      await this.merchantCode.fill(BridgePayCredentials.merchantCode);
      await missingField.fill("");

      await this.saveButton.click();
      await expect(
        missingField,
        "BridgePay required credential was not left blank before Save.",
      ).toHaveValue("");
      await expect(
        this.creditCardDialog,
        "BridgePay configuration was saved or the credit-card dialog closed with a required credential missing.",
      ).toBeVisible();
      await expect(
        this.saveButton,
        "BridgePay Save control was not available after a required credential was missing.",
      ).toBeVisible();
    }
  }
}
