import { Locator, Page, expect } from "@playwright/test";
import { BasePage } from "../../utils/BasePage";
import { ConfigManager } from "../../utils/ConfigManager";

export class CRMLoginPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ***************** Page Elements *********************************

  private readonly propertyShortName: Locator = this.page.getByRole("textbox", {
    name: "username",
    exact: true,
  });

  private readonly username: Locator = this.page.getByRole("textbox", {
    name: "email",
    exact: true,
  });

  private readonly password: Locator = this.page.getByLabel(/password/i);

  private readonly loginButton: Locator = this.page.getByRole("button", {
    name: /login|sign in/i,
  });

  // ***************** Navigation *********************************

  async navigateToLoginPage(): Promise<void> {
    const crmBaseUrl = ConfigManager.branch.crmBaseUrl;
    if (!crmBaseUrl) throw new Error("env_CRMBaseURL is missing from config/qa.env");
    await this.page.goto(crmBaseUrl);
  }

  // ***************** Credential Entry *********************************

  async enterPropertyShortName(value: string): Promise<void> {
    await this.propertyShortName.fill(value);
  }

  async enterUsername(value: string): Promise<void> {
    await this.username.fill(value);
  }

  async enterPassword(value: string): Promise<void> {
    await this.password.fill(value);
  }

  async clickLoginButton(): Promise<void> {
    await this.loginButton.click();
  }

  async loginToCRM(
    propertyShortName: string,
    username: string,
    password: string,
  ): Promise<void> {
    await this.navigateToLoginPage();
    await this.enterPropertyShortName(propertyShortName);
    await this.enterUsername(username);
    await this.enterPassword(password);
    await this.clickLoginButton();
    await this.verifyLoginSucceeded();
  }

  // ***************** Assertions *********************************

  async verifyLoginSucceeded(): Promise<void> {
    await expect(this.page, "CRM login did not reach the dashboard within 15 seconds.")
      .toHaveURL(/\/ui\/dashboard(?:[/?#]|$)/i, { timeout: 15000 });
  }
}
