import { expect, Page } from "@playwright/test";

import { BasePage } from "../../utils/BasePage";

export class PosDashboardPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ***************** Dashboard navigation *********************************

  private readonly dashboardTab = this.page
    .getByText("Dashboard", { exact: true })
    .last();

  // ***************** Sales card *********************************

  private readonly salesCardValue = this.page
    .getByText(/^[$€£]\s*[\d,]+(?:\.\d{1,2})?$/)
    .first();

  async clickDashboardTab(): Promise<void> {
    await this.dashboardTab.click();
  }

  async getSalesAmount(): Promise<number> {
    const salesText = await this.salesCardValue.innerText();
    const amount = salesText.match(/[$€£]\s*([\d,]+(?:\.\d{1,2})?)/)?.[1];

    if (!amount) {
      throw new Error(
        `The Dashboard Sales card did not show a currency amount. Received: '${salesText}'.`,
      );
    }

    return Number(amount.replace(/,/g, ""));
  }

  async verifySalesAmount(expectedAmount: number): Promise<void> {
    await expect.poll(() => this.getSalesAmount(), {
      message:
        "The Dashboard Sales card did not include the completed Gift Shop cash payment within 15 seconds.",
      timeout: 15_000,
    }).toBeCloseTo(expectedAmount, 2);
  }

  async verifySalesCurrency(expectedCurrency: string): Promise<void> {
    await expect(this.salesCardValue).toContainText(expectedCurrency, {
      timeout: 15_000,
    });
  }
}
