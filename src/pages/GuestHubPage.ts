import { Dialog, Locator, Page, expect } from "@playwright/test";
import { ConfigManager } from "../utils/ConfigManager";
import { BasePage } from "../utils/BasePage";
import type { LoyaltyTier } from "../utils/DBHelper/GuestDatabaseHelper";

/** Page object for the public Guest Hub OTP sign-in flow. */
export class GuestHubPage extends BasePage {
  private static readonly controlTimeoutMs = 20_000;
  private static readonly resendOtpTimeoutMs = 70_000;
  private static readonly otpDeliveryTimeoutMs = 90_000;
  private lastOtpAlertMessage = "";

  // ***************** Login *********************************
  private readonly emailInput = this.page.getByRole("textbox", {
    name: /^(email address|enter your email)$/i,
  });
  private readonly bookingNumberInput = this.page.getByRole("textbox", {
    name: /^(booking number|enter confirmation #)$/i,
  });
  private readonly validateGuestButton = this.page.getByRole("button", {
    name: /validate|continue|send.*otp|next/i,
  });

  // ***************** OTP verification *********************************
  private readonly otpInput = this.page.getByRole("textbox", {
    name: /otp|one.?time|verification code|code/i,
  });
  private readonly verifyOtpButton = this.page.getByRole("button", {
    name: /verify|submit|continue|login/i,
  });
  private readonly resendOtpButton = this.page.getByRole("button", {
    name: /resend/i,
  });

  // ***************** Authenticated Guest Hub *********************************
  private readonly guestHubDashboardHeading = this.page.getByRole("heading", {
    name: /thank you\s+for your booking/i,
  });
  private readonly guestHubContent = this.page.locator("body");
  private readonly purchaseCartItemsButton = this.page.getByRole("button", {
    name: /purchase cart items/i,
  });
  private readonly selfCheckInButton = this.page
    .getByRole("button", { name: /self check-in/i })
    .or(this.page.getByRole("link", { name: /self check-in/i }));
  private readonly payAmountDueButton = this.page
    .getByRole("button", { name: /pay amount due/i })
    .or(this.page.getByRole("link", { name: /pay amount due/i }));
  private readonly payOtherAmountButton = this.page
    .getByRole("button", { name: /pay other amount/i })
    .or(this.page.getByRole("link", { name: /pay other amount/i }));
  private readonly logoutButton = this.page
    .getByRole("button", { name: /logout|log out/i })
    .or(this.page.getByRole("link", { name: /logout|log out/i }));
  private readonly sessionTimeoutMessage = this.page.getByText(
    /session\s+(?:has\s+)?(?:expired|timed\s*out)|(?:expired|timed\s*out)\s+session/i,
  );
  private readonly loyaltySummary = this.page.getByRole("button", {
    name: /view loyalty points and tier details/i,
  });
  private readonly loyaltyJourneyCard = this.page
    .getByRole("region", { name: "LOYALTY REWARDS", exact: true })
    .getByRole("article")
    .filter({ has: this.page.getByRole("heading", { name: "Your loyalty journey", exact: true }) });
  private readonly loyaltyProgressBar = this.loyaltyJourneyCard.getByRole("progressbar", {
    name: /progress to next tier/i,
  });
  private readonly loyaltyChartCard = this.page.locator("article.loyalty-chart-card");

  constructor(page: Page) {
    super(page);
  }

  async open(urlKey: string): Promise<void> {
    const baseUrl = ConfigManager.branch.guestHubBaseUrl;
    if (!baseUrl) throw new Error("env_GuestHubBaseURL is missing from config/test1.env");
    await this.page.goto(new URL(urlKey, baseUrl).toString(), { waitUntil: "domcontentloaded" });
    await this.requireVisible(
      this.emailInput,
      "login page",
      "display the registered-email field",
    );
  }

  async openProtectedPath(path: string): Promise<void> {
    const baseUrl = ConfigManager.branch.onlineBookingBaseUrl;
    if (!baseUrl) throw new Error("env_OnlinebookingBaseURL is missing from config.");
    await this.page.goto(new URL(path, baseUrl).toString(), {
      waitUntil: "domcontentloaded",
    });
  }

  async enterRegisteredEmail(email: string): Promise<void> {
    await this.requireVisible(this.emailInput, "login page", "display the registered-email field");
    await this.emailInput.fill(email);
  }

  async enterBookingNumber(bookingNumber: string): Promise<void> {
    await this.requireVisible(this.bookingNumberInput, "login page", "display the booking-number field");
    await this.bookingNumberInput.fill(bookingNumber);
  }

  async clickValidateGuest(): Promise<void> {
    await this.requireEnabled(this.validateGuestButton, "login page", "enable the guest-validation button");
    await this.validateGuestButton.click();
  }

  async clickValidateGuestExpectingAlert(): Promise<void> {
    await this.requireEnabled(this.validateGuestButton, "login page", "enable the guest-validation button");
    const alert = this.page.waitForEvent("dialog", {
      timeout: GuestHubPage.controlTimeoutMs,
    });
    await this.validateGuestButton.click({ noWaitAfter: true });
    const dialog = await this.requireDialog(alert, "login page", "display the validation message");
    this.lastOtpAlertMessage = dialog.message();
    await dialog.accept();
  }

  async enterOtp(otp: string): Promise<void> {
    await this.requireVisible(this.otpInput, "OTP verification", "display the OTP field");
    await this.otpInput.fill(otp);
  }

  async clickVerifyOtp(): Promise<void> {
    await this.requireEnabled(this.verifyOtpButton, "OTP verification", "enable the Verify OTP button");
    await this.verifyOtpButton.click();
  }

  async clickVerifyOtpExpectingAlert(): Promise<void> {
    await this.requireEnabled(this.verifyOtpButton, "OTP verification", "enable the Verify OTP button");
    const alert = this.page.waitForEvent("dialog", {
      timeout: GuestHubPage.controlTimeoutMs,
    });
    await this.verifyOtpButton.click({ noWaitAfter: true });
    const dialog = await this.requireDialog(alert, "OTP verification", "display the validation message");
    this.lastOtpAlertMessage = dialog.message();
    await dialog.accept();
  }

  async clickResendOtp(): Promise<void> {
    await this.requireEnabled(
      this.resendOtpButton,
      "OTP verification",
      "enable the Resend OTP button",
      GuestHubPage.resendOtpTimeoutMs,
    );
    await this.resendOtpButton.click();
  }

  async clickResendOtpExpectingAlert(): Promise<void> {
    await this.requireEnabled(
      this.resendOtpButton,
      "OTP verification",
      "enable the Resend OTP button",
      GuestHubPage.resendOtpTimeoutMs,
    );
    const alert = this.page.waitForEvent("dialog", {
      timeout: GuestHubPage.controlTimeoutMs,
    });
    await this.resendOtpButton.click({ noWaitAfter: true });
    const dialog = await this.requireDialog(alert, "OTP verification", "display the resend-limit message");
    this.lastOtpAlertMessage = dialog.message();
    await dialog.accept();
  }

  async clickPurchaseCartItems(): Promise<void> {
    await this.requireEnabled(
      this.purchaseCartItemsButton,
      "booking dashboard",
      "enable the Purchase Cart Items action",
    );
    await this.purchaseCartItemsButton.click();
  }

  async clickSelfCheckIn(): Promise<void> {
    await this.requireEnabled(
      this.selfCheckInButton.first(),
      "booking dashboard",
      "enable the Self Check-In action",
    );
    await this.selfCheckInButton.first().click();
  }

  async expireGuestHubToken(): Promise<void> {
    await this.page.evaluate(() => {
      localStorage.setItem("guesthub_token_expire", String(Date.now() - 1));
    });
  }

  async clickPayAmountDue(): Promise<void> {
    await this.requireEnabled(this.payAmountDueButton.first(), "booking dashboard", "enable Pay Amount Due");
    await this.payAmountDueButton.first().click();
  }

  async clickPayOtherAmount(): Promise<void> {
    await this.requireEnabled(this.payOtherAmountButton.first(), "booking dashboard", "enable Pay Other Amount");
    await this.payOtherAmountButton.first().click();
  }

  async clickLogout(): Promise<void> {
    await this.requireVisible(this.logoutButton.first(), "booking dashboard", "display the Logout action");
    await this.logoutButton.first().click();
  }

  async verifyResendOtpUnavailable(): Promise<void> {
    try {
      await expect(this.resendOtpButton).toBeDisabled({
        timeout: GuestHubPage.controlTimeoutMs,
      });
    } catch {
      throw new Error(
        "The Guest Hub OTP verification did not keep the Resend OTP button unavailable during the cooldown within 20 seconds.",
      );
    }
  }

  async verifyLoginPageVisible(): Promise<void> {
    await this.requireVisible(this.emailInput, "login page", "display the registered-email field");
    await this.requireVisible(this.bookingNumberInput, "login page", "display the booking-number field");
  }

  async verifyOtpInputVisible(): Promise<void> {
    await this.requireVisible(
      this.otpInput,
      "OTP verification",
      "finish sending the verification code and display the OTP field",
      GuestHubPage.otpDeliveryTimeoutMs,
    );
  }

  async verifyAccessDenied(): Promise<void> {
    await this.verifyOtpAlertMessage(/invalid\s+otp/i);
    await this.requireVisible(this.otpInput, "OTP verification", "keep the OTP field visible after access is denied");
  }

  async verifyGuestLoginLocked(): Promise<void> {
    await this.verifyOtpAlertMessage(/^This guest login is locked\.$/i);
    await this.requireVisible(this.otpInput, "OTP verification", "keep the OTP field visible after the guest login is locked");
  }

  async verifyOtpAlertMessage(expected: RegExp): Promise<void> {
    if (!expected.test(this.lastOtpAlertMessage)) {
      throw new Error(
        `The Guest Hub OTP verification did not display the expected alert message after submission. Received: "${this.lastOtpAlertMessage}".`,
      );
    }
  }

  async verifyGuestValidationRejected(): Promise<void> {
    await this.verifyOtpAlertMessage(/^No reservation found\.$/i);
    if ((await this.otpInput.count()) !== 0) {
      throw new Error(
        "The Guest Hub login page did not keep the OTP field hidden after guest validation was rejected.",
      );
    }
  }

  async verifyGuestHubAccessGranted(confirmationNumber?: string): Promise<void> {
    await this.requireVisible(
      this.guestHubDashboardHeading,
      "booking dashboard",
      "display after successful OTP authentication",
    );
    if (confirmationNumber) {
      await expect(
        this.guestHubContent,
        "The Guest Hub booking dashboard did not display the authenticated reservation number within 20 seconds.",
      ).toContainText(
        new RegExp(`Booking\\s+Number\\s*:\\s*#?${confirmationNumber}`),
        { timeout: GuestHubPage.controlTimeoutMs },
      );
    }
  }

  async verifyLoyaltyRewardsWidget(expectedPoints: string, expectedTier: string): Promise<void> {
    await this.requireVisible(
      this.loyaltySummary,
      "loyalty rewards widget",
      "display the loyalty points and tier summary",
    );
    await expect(
      this.loyaltySummary,
      "The Guest Hub loyalty rewards widget did not display the expected membership tier and points.",
    ).toContainText(new RegExp(`${escapeRegExp(expectedTier)}|${escapeRegExp(expectedPoints)}\\s+Loyalty\\s+Points`, "i"));
    await expect(this.loyaltySummary).toContainText(expectedTier);
    await expect(this.loyaltySummary).toContainText(new RegExp(`${escapeRegExp(expectedPoints)}\\s+Loyalty\\s+Points`, "i"));
  }

  async verifyLoyaltyTierProgressBar(currentTier: string, points: number, tiers: LoyaltyTier[], expectedNextTier?: LoyaltyTier): Promise<void> {
    await this.requireVisible(
      this.loyaltyJourneyCard,
      "loyalty tier progress card",
      "display the loyalty journey card",
    );
    await expect(
      this.loyaltyJourneyCard.locator(".loyalty-tier-summary strong"),
      "The loyalty journey card did not display the guest's current membership tier.",
    ).toHaveText(currentTier);
    await this.requireVisible(
      this.loyaltyProgressBar,
      "loyalty tier progress bar",
      "display progress toward the next loyalty tier",
    );

    const nextTier = expectedNextTier ?? tiers.find(tier => tier.minimumPoints > points);
    const nextTierMessage = this.loyaltyJourneyCard.locator("p.loyalty-next");
    if (!nextTier) {
      await expect(nextTierMessage, "The highest-tier loyalty journey did not display its highest-tier message.")
        .toHaveText("You’re at the highest tier");
      await expect(this.loyaltyProgressBar).toHaveAttribute("aria-valuenow", "100");
    } else {
      await expect(
        nextTierMessage,
        "The loyalty journey did not display the correct remaining points and next tier.",
      ).toHaveText(`${(nextTier.minimumPoints - points).toLocaleString("en-US")} points to ${nextTier.name}Next tier`);
    }

    const levels = this.loyaltyJourneyCard.locator("ol.loyalty-levels");
    await expect(levels.getByRole("listitem"), "The loyalty journey did not display every configured tier.").toHaveCount(tiers.length);
    await expect(levels.getByText("Your tier", { exact: true }), "The loyalty journey must mark exactly one current tier.").toHaveCount(1);
    for (const tier of tiers) {
      const row = levels.getByRole("listitem").filter({
        has: this.page.locator("span").filter({ hasText: new RegExp(`^${escapeRegExp(tier.name)}(?:Your tier)?$`) }),
      });
      await expect(row, `The loyalty journey did not display tier ${tier.name}.`).toBeVisible();
      const range = tier.maximumPoints === null
        ? `${tier.minimumPoints.toLocaleString("en-US")}–No Limit pts`
        : `${tier.minimumPoints.toLocaleString("en-US")}–${tier.maximumPoints.toLocaleString("en-US")} pts`;
      await expect(row.locator(".loyalty-level-range"), `The ${tier.name} points range did not match the database.`)
        .toHaveText(range);
      await expect(row.getByText("Your tier", { exact: true }), `The Your tier marker was incorrect for ${tier.name}.`)
        .toHaveCount(tier.name === currentTier ? 1 : 0);
    }
  }

  async verifyLoyaltyAnalyticsPoints(departureDate: Date, expectedPoints: number): Promise<void> {
    await this.requireVisible(
      this.loyaltyChartCard,
      "loyalty analytics chart",
      "display the monthly loyalty points chart",
    );
    await expect(this.loyaltyChartCard.getByRole("img", { name: /monthly loyalty points earned/i }))
      .toBeVisible();

    const summary = this.loyaltyChartCard.getByText("View monthly points", { exact: true });
    await summary.click();
    const monthName = departureDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const row = this.loyaltyChartCard.getByRole("row").filter({
      has: this.loyaltyChartCard.getByRole("rowheader", { name: monthName, exact: true }),
    });
    await expect(row, `The loyalty analytics chart did not display the departure month ${monthName}.`).toBeVisible();
    await expect(row.getByRole("cell"), `The loyalty analytics chart did not display points for ${monthName}.`)
      .toHaveText(expectedPoints.toLocaleString("en-US"));
    await expect(this.loyaltyChartCard.locator("circle title").filter({
      hasText: new RegExp(`${monthName}:\\s*${expectedPoints.toLocaleString("en-US")} points earned`, "i"),
    })).toHaveCount(1);
  }

  async verifyLoyaltyAnalyticsMonthlyPoints(expectedPointsByMonth: Record<string, number>): Promise<void> {
    await this.requireVisible(this.loyaltyChartCard, "loyalty analytics chart", "display the monthly loyalty points chart");
    await expect(this.loyaltyChartCard.getByRole("img", { name: /monthly loyalty points earned/i })).toBeVisible();
    await this.loyaltyChartCard.getByText("View monthly points", { exact: true }).click();
    for (const [month, points] of Object.entries(expectedPointsByMonth)) {
      const monthName = new Date(`${month}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
      const row = this.loyaltyChartCard.getByRole("row").filter({ has: this.loyaltyChartCard.getByRole("rowheader", { name: monthName, exact: true }) });
      await expect(row, `The loyalty analytics chart did not display ${monthName}.`).toBeVisible();
      await expect(row.getByRole("cell"), `The loyalty analytics chart did not display points for ${monthName}.`).toHaveText(points.toLocaleString("en-US"));
    }
  }

  async verifySessionTimeoutMessage(): Promise<void> {
    await this.requireVisible(
      this.sessionTimeoutMessage,
      "session-expiry flow",
      "display the session timeout message",
    );
  }

  private async requireVisible(
    locator: Locator,
    feature: string,
    expectedBehavior: string,
    timeoutMs = GuestHubPage.controlTimeoutMs,
  ): Promise<void> {
    try {
      await locator.waitFor({ state: "visible", timeout: timeoutMs });
    } catch {
      throw new Error(
        `The Guest Hub ${feature} did not ${expectedBehavior} within ${timeoutMs / 1_000} seconds.`,
      );
    }
  }

  private async requireEnabled(
    locator: Locator,
    feature: string,
    expectedBehavior: string,
    timeoutMs = GuestHubPage.controlTimeoutMs,
  ): Promise<void> {
    try {
      await expect(locator).toBeEnabled({ timeout: timeoutMs });
    } catch {
      throw new Error(
        `The Guest Hub ${feature} did not ${expectedBehavior} within ${timeoutMs / 1_000} seconds.`,
      );
    }
  }

  private async requireDialog(
    dialogPromise: Promise<Dialog>,
    feature: string,
    expectedBehavior: string,
  ): Promise<Dialog> {
    try {
      return await dialogPromise;
    } catch {
      throw new Error(
        `The Guest Hub ${feature} did not ${expectedBehavior} within ${GuestHubPage.controlTimeoutMs / 1_000} seconds.`,
      );
    }
  }

}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\[\]\\]/g, "\\$&");
}
