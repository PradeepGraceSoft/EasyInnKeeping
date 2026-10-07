import { Locator, Page } from "@playwright/test";
import { BasePage } from "../../utils/BasePage";

export class CRMLeftMenuPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ***************** Page Elements *********************************

  private readonly leadMenuItem: Locator = this.page
    .getByRole("link", { name: /lead/i })
    .or(this.page.getByRole("button", { name: /lead/i }));

  private readonly customerMenuItem: Locator = this.page
    .getByRole("link", { name: /customer/i })
    .or(this.page.getByRole("button", { name: /customer/i }));

  private readonly staffResponseMenuItem: Locator = this.page
    .getByRole("link", { name: /staff response/i })
    .or(this.page.getByRole("button", { name: /staff response/i }));

  private readonly emailPromotionMenuItem: Locator = this.page
    .getByRole("link", { name: /email promotion/i })
    .or(this.page.getByRole("button", { name: /email promotion/i }));

  // ***************** Navigation *********************************

  async clickLeadIcon(): Promise<void> {
    await this.leadMenuItem.first().click();
  }

  async clickCustomerIcon(): Promise<void> {
    await this.customerMenuItem.first().click();
  }

  async clickStaffResponseIcon(): Promise<void> {
    await this.staffResponseMenuItem.first().click();
  }

  async clickEmailPromotion(): Promise<void> {
    await this.emailPromotionMenuItem.first().click();
  }
}
