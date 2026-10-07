import { FrameLocator, Locator, Page, expect } from "@playwright/test";
import { Routes } from "../constants/Routes";
import { BasePage } from "../utils/BasePage";
import { ConfigManager } from "../utils/ConfigManager";
import { RandomDataUtils } from "../utils/RandomDataUtils";
import { TestDataGenerator } from "../utils/TestDataGenerator";
import { Logger } from "../utils/Logger";

export type DepositType =
  | "No of nights"
  | "No of nights with tax"
  | "Percentage of stay"
  | "Fixed or flat"
  | "No deposit"
  | "Full amount"
  | "Percentage of total";

export type BookingEnginePage = "About Us" | "Gallery" | "Check Availability";
export type SelectedStayDates = { startDate: string; endDate: string };

export class OnlineBookingPage extends BasePage {
  // ***************** Home and results *********************************
  private readonly searchButton = this.page.getByRole("button", { name: /search/i });
  private readonly dateRangeInput = this.page.locator(".item-date input, .date-input input").first();
  private readonly firstBookButton = this.page.locator("button#submit").first();
  private readonly completeBookingButton = this.page
    .locator(".booking-summary-com-btn, button:has-text('Complete Booking')")
    .first();
  private readonly nextButton = this.page
    .getByRole("button", { name: /^(next|complete booking)$/i })
    .first();
  private readonly shoppingCartPageHeading = this.page
    .getByRole("heading", {
      name: /^(Optional Items & Services|Customize Your Stay with Add-ons)$/,
    })
    .first();
  private readonly proceedToCheckoutButton = this.page.getByRole("button", {
    name: /proceed to checkout/i,
  });
  private readonly bookingSummaryContent = this.page.locator("body");

  // ***************** Navigation *********************************
  private readonly mobileMenuButton = this.page.locator(
    "button[aria-label*='menu' i], button[aria-label*='navigation' i], button.navbar-toggler, .navbar-toggler",
  ).first();
  private readonly shoppingCartLink = this.page
    .locator(`a[href*='${Routes.ONLINE_SHOPPING_CART}']`)
    .first();

  // ***************** AI chatbot *********************************
  private readonly chatbotLauncher = this.page.locator(
    "button[aria-label*='chat' i], [role='button'][aria-label*='chat' i], .chatbot-toggler, .chatbot-toggle, .chat-icon",
  ).last();
  private readonly chatbotTitle = this.page.getByText("Grace AI Assistant", {
    exact: true,
  });
  private readonly chatbotMessageInput = this.page.getByRole("textbox", {
    name: "Type a message...",
  });
  private readonly chatbotCloseButton = this.page
    .getByRole("button", { name: "Reset Chat" })
    .locator("xpath=following-sibling::button[1]");

  // ***************** Registration *********************************
  private readonly firstNameInput = this.page.locator("input[name='firstname']");
  private readonly lastNameInput = this.page.locator("input[name='lastname']");
  private readonly emailInput = this.page.locator("input[name='Email']");
  private readonly phoneInput = this.page.locator("input[name='Phone']");
  private readonly addressInput = this.page.locator("input[name='address']");
  private readonly cityInput = this.page.locator("input[name='city']");
  private readonly stateInput = this.page.locator("input[name='state']");
  private readonly countryInput = this.page.locator("input[name='country']");
  private readonly zipInput = this.page.locator("input[name='userPincode']");
  private readonly adultCountInput = this.page.locator(
    "select[name*='adult' i], input[name*='adult' i], select[id*='adult' i], input[id*='adult' i]",
  ).first();
  private readonly childCountInput = this.page.locator(
    "select[name*='child' i], input[name*='child' i], select[id*='child' i], input[id*='child' i]",
  ).first();
  private readonly cardType = this.page.locator("[name='cardType']");
  private readonly visaOption = this.page.getByRole("option", { name: "Visa", exact: true });
  private readonly cardFrame: FrameLocator = this.page.frameLocator("iframe[name='tx_iframe_tokenExIframeDiv']");
  private readonly cardNumberInput = this.cardFrame.locator("input[name='cardNumber']");
  private readonly cardNameInput = this.page.locator("input[name='User Card Name']");
  private readonly expiryMonth = this.page.locator("[name='expiry-month']");
  private readonly expiryYear = this.page.locator("[name='expiry-year']");
  private readonly agreement = this.page.locator("input[name='userAgree']");
  private readonly completeBookButton = this.page.locator("#bookBtn");
  private readonly depositDue = this.page.locator("xpath=//b[normalize-space()='Deposit Due']/following::b[1]");

  // ***************** Thank you *********************************
  private readonly amountPaid = this.page.locator(
    "xpath=//dt[normalize-space()='Amount Paid']/following-sibling::dd[1] | //h6[normalize-space()='Amount Paid:']/following::h4[2]",
  );
  private readonly thankYouPageContent = this.page.locator("body");

  constructor(page: Page) {
    super(page);
  }

  async openHome(): Promise<void> {
    const baseUrl = ConfigManager.branch.onlineBookingBaseUrl;
    if (!baseUrl) throw new Error("env_OnlinebookingBaseURL is missing from config/qa.env");
    const propertyId = ConfigManager.testData.propertyId;
    if (!propertyId) throw new Error("The active property's PropertyID is not configured");
    const homeUrl = new URL(`${Routes.ONLINE_HOME}${propertyId}`, baseUrl);
    await this.page.goto(homeUrl.toString(), {
      waitUntil: "domcontentloaded",
    });
    await expect(this.page).toHaveURL(new RegExp(Routes.ONLINE_HOME.replace(/\/$/, "")));
    await expect(this.searchButton).toBeVisible();
  }

  async openIndividualBooking(roomId = 40): Promise<void> {
    const baseUrl = this.getOnlineBookingBaseUrl();
    const propertyId = this.getPropertyId();
    const url = new URL(
      `${Routes.ONLINE_INDIVIDUAL_BOOKING}${propertyId}/${roomId}`,
      baseUrl,
    );
    await this.page.goto(url.toString(), { waitUntil: "domcontentloaded" });
    await expect(this.page).toHaveURL(
      new RegExp(`${Routes.ONLINE_INDIVIDUAL_BOOKING}${propertyId}/${roomId}`),
    );
  }

  async clickBookingEnginePage(name: BookingEnginePage): Promise<void> {
    const link = this.page.getByRole("link", { name, exact: true });
    if (!(await link.isVisible())) {
      await this.mobileMenuButton.click();
    }
    await link.click();
    const route = {
      "About Us": Routes.ONLINE_ABOUT_US,
      Gallery: Routes.ONLINE_GALLERY,
      "Check Availability": Routes.ONLINE_CHECKAVAILABILITY,
    }[name];
    await expect(this.page).toHaveURL(new RegExp(route.replace(/\/$/, "")));
  }

  async clickCheckAvailability(): Promise<void> {
    await this.clickBookingEnginePage("Check Availability");
  }

  async clickShoppingCartLink(): Promise<void> {
    await expect(this.shoppingCartLink).toBeVisible();
    await this.shoppingCartLink.click();
    await expect(this.page).toHaveURL(
      new RegExp(Routes.ONLINE_SHOPPING_CART.replace(/\/$/, "")),
    );
  }

  async verifyShoppingCartLinkIsNotDisplayed(): Promise<void> {
    await expect(this.shoppingCartLink).toHaveCount(0);
  }

  async verifyChatbotLaunches(): Promise<void> {
    await expect(this.chatbotLauncher).toBeVisible({ timeout: 10_000 });
    await this.chatbotLauncher.click();
    await expect(this.chatbotTitle).toBeVisible();
    await expect(this.chatbotMessageInput).toBeVisible();
  }

  async verifyChatbotIsNotDisplayed(): Promise<void> {
    await expect(this.chatbotLauncher).toHaveCount(0);
    await expect(this.chatbotTitle).toHaveCount(0);
    await expect(this.chatbotMessageInput).toHaveCount(0);
  }

  async closeChatbot(): Promise<void> {
    await this.chatbotCloseButton.click();
  }

  async clickSearchButton(): Promise<void> {
    await this.searchButton.click();
    await expect(this.page, "Online booking did not open search results within 15 seconds.").toHaveURL(
      new RegExp(Routes.ONLINE_RESULT), { timeout: 15_000 },
    );
  }

  async selectNextAvailableStay(nights = 1): Promise<void> {
    if (!Number.isInteger(nights) || nights < 1) {
      throw new Error("The online booking stay must contain at least one night.");
    }
    // Classic supplies valid default check-in/check-out dates as two inputs.
    // Modern uses a single date-range control that must be selected explicitly.
    if (!(await this.dateRangeInput.isVisible())) {
      const dates = this.page.locator("input[data-mat-calendar]:visible");
      await expect(dates, "Online booking must display check-in and check-out controls.").toHaveCount(2);
      // The classic search form has ordered check-in and check-out inputs.
      const arrival = await dates.nth(0).inputValue();
      const [month, day, year] = arrival.split("/").map(Number);
      const departure = new Date(year, month - 1, day + nights);
      await dates.nth(1).click();
      const calendar = this.page.locator("mat-datepicker-content");
      await expect(calendar).toBeVisible();
      const target = calendar.getByRole("button", { name: departure.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }), exact: true });
      // A stay starting at month end can depart in the following month.
      if (departure.getMonth() !== month - 1) {
        await calendar.getByRole("button", { name: "Next month" }).click();
      }
      await target.click();
      await expect(calendar).toBeHidden();
      await expect(dates.nth(1)).toHaveValue(`${departure.getMonth() + 1}/${departure.getDate()}/${departure.getFullYear()}`);
      return;
    }

    await this.dateRangeInput.click();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const checkout = new Date(tomorrow);
    checkout.setDate(checkout.getDate() + nights);
    await this.clickVisibleCalendarDay(tomorrow);
    await this.clickVisibleCalendarDay(checkout);
    const doneButton = this.page.locator(".calendar-popup").getByRole("button", { name: "Done", exact: true });
    await expect(doneButton).toBeVisible({ timeout: 10_000 });
    await doneButton.click();
    await expect(this.page.locator(".calendar-popup")).toBeHidden();
    await expect(this.dateRangeInput, "Online booking did not apply the selected stay dates within 10 seconds.").toHaveValue(/\d/, { timeout: 10_000 });
  }

  private async clickVisibleCalendarDay(date: Date): Promise<void> {
    const monthLabel = date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const month = this.page.locator(".calendar-popup .calendar-month").filter({
      has: this.page.locator(".calendar-header").getByText(monthLabel, { exact: true }),
    });
    const day = month.locator(".day:not(.disabled)").filter({
      has: this.page.locator(".date-number").getByText(String(date.getDate()), { exact: true }),
    });
    await expect(day, `Online booking did not display a selectable ${monthLabel} ${date.getDate()} within 10 seconds.`).toBeVisible({ timeout: 10_000 });
    await day.click();
  }

  async getSelectedStayDates(): Promise<SelectedStayDates> {
    const dateInputs = this.page.locator(
      "input[data-mat-calendar], .item-date input, .date-input input",
    );
    const values: string[] = [];
    for (let index = 0; index < await dateInputs.count(); index += 1) {
      const input = dateInputs.nth(index);
      if (await input.isVisible()) values.push(await input.inputValue());
    }
    const rawDates = values.flatMap((value) => [
      ...(value.match(/\d{1,2}\/\d{1,2}\/\d{4}/g) ?? []),
      ...(value.match(/[A-Za-z]{3,9}\s+\d{1,2},\s+\d{4}/g) ?? []),
    ]);
    if (rawDates.length < 2) {
      throw new Error(
        `Unable to read check-in/check-out dates from EWR inputs: ${values.join(" | ")}`,
      );
    }
    const dates = rawDates.map((value) => {
      if (value.includes("/")) return value;
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        throw new Error(`EWR supplied an invalid stay date: ${value}`);
      }
      return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    });
    return { startDate: dates[0], endDate: dates[1] };
  }

  async clickFirstBookButton(): Promise<void> {
    await expect(
      this.firstBookButton,
      "Online booking did not provide a bookable room for the requested stay.",
    ).toBeVisible({ timeout: 15_000 });
    await this.firstBookButton.click();
  }

  async clickBookButtonForRoom(roomName: string): Promise<void> {
    const escapedRoomName = roomName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const room = this.page
      .getByText(new RegExp(`^${escapedRoomName}(?:\\s|$)`))
      .filter({ visible: true })
      .first();
    await expect(
      room,
      `Online booking did not display the ${roomName} room within 15 seconds.`,
    ).toBeVisible({ timeout: 15_000 });
    const roomCard = room.locator("xpath=ancestor::*[.//button[@id='submit']][1]");
    const bookButton = roomCard.locator("button#submit");
    await expect(
      bookButton,
      `Online booking did not provide a Book button for the ${roomName} room within 15 seconds.`,
    ).toBeVisible({ timeout: 15_000 });
    await bookButton.click();
  }

  async verifySelectedBookingDetails(nights: number, roomTotal: string): Promise<void> {
    await expect(this.page.getByRole("heading", { name: "Booking Details", exact: true }),
      "Online booking did not display the selected booking details.").toBeVisible();
    const nightsValue = this.page.getByRole("heading", { name: "No Of Nights", exact: true })
      .locator("xpath=following-sibling::p[1]");
    const totalValue = this.page.getByRole("heading", { name: "Total", exact: true })
      .locator("xpath=following-sibling::p[1]");
    await expect(nightsValue, `Online booking did not apply the requested ${nights}-night stay.`)
      .toHaveText(String(nights));
    await expect(totalValue, "Online booking did not include the configured rate and weekend surcharge in the selected room total.")
      .toHaveText(roomTotal);
  }

  async clickBookButtonAt(index: number): Promise<void> {
    if (!Number.isInteger(index) || index < 0) {
      throw new Error("Online booking result index must be a non-negative integer.");
    }
    const bookButtonCount = await this.page.locator("button#submit").count();
    if (bookButtonCount <= index) {
      throw new Error(
        `Online booking results did not provide bookable option ${index + 1} for this parallel test.`,
      );
    }
    await this.page.locator("button#submit").nth(index).click();
  }

  async clickCompleteBookingButton(): Promise<void> {
    await expect(this.completeBookingButton, "Online booking did not enable Complete Booking within 15 seconds.")
      .toBeEnabled({ timeout: 15_000 });
    await this.completeBookingButton.click();
    await expect(this.page, "Online booking did not open guest registration within 15 seconds.")
      .toHaveURL(new RegExp(Routes.ONLINE_REGISTRATION.replace(/\/$/, "")), { timeout: 15_000 });
  }

  async clickNextButton(): Promise<void> {
    await this.nextButton.click();
  }

  async verifyShoppingCartPageIsDisplayed(): Promise<void> {
    await expect(this.shoppingCartPageHeading).toBeVisible();
  }

  async verifyShoppingCartPageIsNotDisplayed(): Promise<void> {
    await expect(this.shoppingCartPageHeading).toHaveCount(0);
  }

  async selectShoppingCartItem(itemName: string): Promise<void> {
    const escapedItemName = itemName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const item = this.page
      .getByRole("heading", { name: new RegExp(`^${escapedItemName}$`) })
      .first();
    await expect(item).toBeVisible();

    await item
      .locator("xpath=following::button[starts-with(normalize-space(), 'Add')][1]")
      .click();
  }

  async verifyShoppingCartTotal(expected: string): Promise<void> {
    await this.verifyLabeledAmount("Cart Items", expected);
  }

  async clickProceedToCheckoutButton(): Promise<void> {
    if (await this.proceedToCheckoutButton.count()) {
      await this.proceedToCheckoutButton.click();
      await expect(this.page).toHaveURL(
        new RegExp(Routes.ONLINE_REGISTRATION.replace(/\/$/, "")),
      );
      return;
    }
    await expect(this.firstNameInput).toBeVisible();
  }

  async verifyRegistrationTotals(
    roomTotal: string,
    cartTotal: string | null,
    grandTotal: string,
  ): Promise<void> {
    await this.verifyLabeledAmount("Room Total", roomTotal);
    if (cartTotal !== null) await this.verifyLabeledAmount("Cart Items", cartTotal);
    await this.verifyLabeledAmount("Grand Total", grandTotal);
  }

  async enterGuestDetails(): Promise<void> {
    await this.firstNameInput.fill(TestDataGenerator.firstName().replace(/[^a-z -]/gi, ""));
    await this.lastNameInput.fill(TestDataGenerator.lastName().replace(/[^a-z -]/gi, ""));
    await this.emailInput.fill(RandomDataUtils.randomEmail());
    await this.phoneInput.fill(RandomDataUtils.randomPhoneNumber());
    await this.addressInput.fill(TestDataGenerator.address());
    await this.cityInput.fill(TestDataGenerator.city());
    await this.stateInput.fill(TestDataGenerator.state());
    await this.countryInput.fill(TestDataGenerator.country());
    await this.zipInput.fill(TestDataGenerator.zipCode());
  }

  async enterGuestDetailsFor(guest: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    zip?: string;
  }): Promise<void> {
    await this.firstNameInput.fill(guest.firstName);
    await this.lastNameInput.fill(guest.lastName);
    await this.emailInput.fill(guest.email);
    await this.phoneInput.fill(guest.phone ?? RandomDataUtils.randomPhoneNumber());
    await this.addressInput.fill(guest.address ?? TestDataGenerator.address());
    await this.cityInput.fill(guest.city ?? TestDataGenerator.city());
    await this.stateInput.fill(guest.state ?? TestDataGenerator.state());
    await this.countryInput.fill(guest.country ?? TestDataGenerator.country());
    await this.zipInput.fill(guest.zip ?? TestDataGenerator.zipCode());
  }

  async setGuestCounts(adults: number, children = 0): Promise<void> {
    if (!Number.isInteger(adults) || adults < 1 || !Number.isInteger(children) || children < 0) {
      throw new Error("Online booking guest counts must contain at least one adult and no negative children.");
    }
    await this.setGuestCount(this.adultCountInput, adults, "adult");
    if (await this.childCountInput.count()) {
      await this.setGuestCount(this.childCountInput, children, "child");
    } else if (children > 0) {
      throw new Error("Online booking did not display a child-count control for the requested guests.");
    }
  }

  private async setGuestCount(input: Locator, value: number, guestType: string): Promise<void> {
    await expect(input, `Online booking did not display the ${guestType}-count control.`).toBeVisible();
    if (await input.evaluate((element) => element.tagName.toLowerCase() === "select")) {
      await input.selectOption(String(value));
    } else {
      await input.fill(String(value));
      await input.press("Tab");
    }
    await expect(input, `Online booking did not apply the requested ${guestType} count of ${value} within 5 seconds.`)
      .toHaveValue(String(value), { timeout: 5_000 });
  }

  async enterAuthorizeNetCardDetailsIfRequired(): Promise<void> {
    await this.enterCardDetailsIfRequired();
  }

  async enterCardDetailsIfRequired(
    cardNumber: string = "4111111111111111",
  ): Promise<void> {
    if (!(await this.cardType.isVisible())) return;
    await this.cardType.click();
    await this.visaOption.click();
    await expect(this.cardNumberInput, "Registration did not load the credit-card number field within 15 seconds.")
      .toBeVisible({ timeout: 15_000 });
    await this.cardNumberInput.fill(cardNumber);
    await this.cardNameInput.fill("Playwright Test");
    await this.expiryMonth.click();
    await this.page.getByRole("option").nth(1).click();
    await this.expiryYear.click();
    await this.page.getByRole("option").nth(1).click();
  }

  async verifyRegistrationDeposit(expected: string): Promise<void> {
    if (expected === "0.00") {
      await expect(this.depositDue).toHaveCount(0);
      return;
    }
    await expect(this.depositDue).toContainText(expected);
  }

  async clickCompleteBookButton(): Promise<void> {
    await expect(this.agreement, "Registration did not display the terms acceptance checkbox within 15 seconds.")
      .toBeVisible({ timeout: 15_000 });
    await this.agreement.check();
    await expect(this.completeBookButton, "Registration did not enable Complete Booking within 15 seconds.")
      .toBeEnabled({ timeout: 15_000 });
    await this.completeBookButton.click();
    await expect(this.page, "Registration did not complete the booking and display the confirmation page within 60 seconds.").toHaveURL(new RegExp(Routes.ONLINE_THANKYOU.replace(/\/$/, "")), {
      timeout: 60_000,
    });
  }

  async verifyThankYouAmountPaid(expected: string): Promise<void> {
    await expect(this.amountPaid).toContainText(expected);
  }

  async verifyThankYouTotals(
    roomTotal: string,
    cartTotal: string | null,
    grandTotal: string,
  ): Promise<void> {
    await this.verifyLabeledAmount("Room Charge", roomTotal);
    if (cartTotal !== null) await this.verifyLabeledAmount("Cart Charges", cartTotal);
    await this.verifyLabeledAmount("Total Price", grandTotal);
  }

  async getConfirmationNumber(): Promise<string> {
    let confirmationNumber = "";
    await expect
      .poll(
        async () => {
          const thankYouText = await this.thankYouPageContent.innerText();
          confirmationNumber =
            thankYouText.match(/Booking\s+Number\s*:?\s*#?(\d+)/i)?.[1] ?? "";
          return confirmationNumber;
        },
        {
          message: "Expected a numeric booking number on the online-booking success page",
          timeout: 15_000,
        },
      )
      .toMatch(/^\d+$/);
    return confirmationNumber;
  }

  async getDepartureDate(): Promise<Date> {
    const text = await this.thankYouPageContent.innerText();
    const value = text.match(/Check-out\s*:?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i)?.[1];
    if (!value) throw new Error("The online booking confirmation did not display a departure date.");
    const [month, day, year] = value.split("/").map(Number);
    return new Date(year, month - 1, day);
  }

  async verifyRoomLabelsInDisplayOrder(
    expectedNames: readonly string[],
    checkpoint = "EWR page",
  ): Promise<void> {
    Logger.step(`Validate ${checkpoint}`);
    Logger.info(`Expected UI order: ${expectedNames.join(" -> ")}`);
    await expect.soft.poll(() => this.getVisibleCandidateOrder(expectedNames), {
      message: `Expected EWR room order: ${expectedNames.join(", ")}`,
    }).toEqual(expectedNames);
    const actualNames = await this.getVisibleCandidateOrder(expectedNames);
    Logger.info(`Actual UI order: ${actualNames.join(" -> ")}`);
  }

  async verifyAllRoomsLabelsInDisplayOrder(expectedNames: readonly string[]): Promise<void> {
    Logger.step("Validate EWR home - All Rooms carousel");
    Logger.info(`Expected UI order: ${expectedNames.join(" -> ")}`);
    const allRoomsHeading = this.page.getByRole("heading", { name: /all rooms/i }).last();
    await allRoomsHeading.scrollIntoViewIfNeeded();
    await expect(allRoomsHeading).toBeVisible();
    const modernCarousel = this.page.locator(".room-swiper");
    const isModernCarousel = (await modernCarousel.count()) > 0;
    const carousel = isModernCarousel
      ? modernCarousel
      : this.page.locator("#theCarousel");
    const originalRoomTitles = carousel.locator(
      isModernCarousel
        ? ".swiper-slide:not(.swiper-slide-duplicate) .room-title"
        : ".carousel-item .room-title",
    );

    await expect(carousel).toBeVisible();
    const candidateNames = new Set(expectedNames);
    const actualNames = (await originalRoomTitles.allTextContents())
      .map((name) => name.replace(/\s+/g, " ").trim())
      .filter((name) => candidateNames.has(name));

    Logger.info(`Actual carousel data order: ${actualNames.join(" -> ")}`);
    expect(actualNames).toEqual(expectedNames);
  }

  private getOnlineBookingBaseUrl(): string {
    const baseUrl = ConfigManager.branch.onlineBookingBaseUrl;
    if (!baseUrl) {
      throw new Error("env_OnlinebookingBaseURL is missing from config/qa.env");
    }
    return baseUrl;
  }

  private getPropertyId(): string {
    const propertyId = ConfigManager.testData.propertyId;
    if (!propertyId) {
      throw new Error("The active property's PropertyID is not configured");
    }
    return propertyId;
  }

  private async verifyLabeledAmount(label: string, expected: string): Promise<void> {
    const labelPattern = {
      // Registration uses the booked room name instead of "Room Total".
      "Room Total": "(?:Room Total|Regular Room|Seasonal Room)",
      "Cart Items": "(?:Your Cart|Cart Items|Cart Total)",
      "Cart Total": "(?:Your Cart|Cart Items|Cart Total)",
    }[label] ?? label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const expectedAmount = expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    await expect(
      this.bookingSummaryContent,
      `Online booking did not display ${label} of $${expected} within the booking summary.`,
    ).toContainText(
      new RegExp(
        `${labelPattern}[^$]{0,160}?\\$\\s*${expectedAmount}`,
        "i",
      ),
    );
  }

  private async getVisibleCandidateOrder(
    candidates: readonly string[],
    minimumY = 0,
  ): Promise<string[]> {
    return this.page.locator("body *").evaluateAll((elements, input) => {
      const { names, minY } = input as { names: string[]; minY: number };
      const wanted = new Set(names.map((name) => name.trim()));
      const matches = elements
        .map((element) => {
          const text = (element.textContent ?? "").replace(/\s+/g, " ").trim();
          const rect = element.getBoundingClientRect();
          return { text, top: rect.top, left: rect.left, visible: rect.width > 0 && rect.height > 0 };
        })
        .filter((item) => item.visible && item.top >= minY && wanted.has(item.text))
        .sort((a, b) => a.top - b.top || a.left - b.left);
      return [...new Set(matches.map((item) => item.text))];
    }, { names: [...candidates], minY: minimumY });
  }
}
