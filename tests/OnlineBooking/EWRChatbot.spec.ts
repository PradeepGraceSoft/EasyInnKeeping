import type { Page } from "@playwright/test";
import { test } from "../../src/fixtures/sso.fixture";
import type {
  BookingEnginePage,
  OnlineBookingPage,
} from "../../src/pages/OnlineBookingPage";
import type {
  OnlineBookingDatabaseHelper,
  OnlineBookingTemplate,
} from "../../src/utils/DBHelper/OnlineBookingDatabaseHelper";
import type { SetupDatabaseHelper } from "../../src/utils/DBHelper/SetupDatabaseHelper";

type ViewportSize = { width: number; height: number };
type ChatbotPages = {
  page: Page;
  onlineBookingPage: OnlineBookingPage;
  onlineBookingDb: OnlineBookingDatabaseHelper;
};

const desktop: ViewportSize = { width: 1920, height: 1080 };
const tablet: ViewportSize = { width: 768, height: 1024 };
const mobile: ViewportSize = { width: 390, height: 844 };
const contentPages: BookingEnginePage[] = [
  "About Us",
  "Gallery",
  "Check Availability",
];

test.describe("Online Booking - EWR AI Chatbot", () => {
  test("Modern desktop - content pages", async ({
    page,
    onlineBookingPage,
    onlineBookingDb,
  }) => {
    await verifyContentPages(
      { page, onlineBookingPage, onlineBookingDb },
      "Modern",
      desktop,
    );
  });

  test("Modern desktop - booking and Thank You", async ({
    page,
    onlineBookingPage,
    onlineBookingDb,
    setupDb,
  }) => {
    await verifyBookingPages(
      { page, onlineBookingPage, onlineBookingDb, setupDb },
      "Modern",
      desktop,
    );
  });

  test("Modern tablet - content pages", async ({
    page,
    onlineBookingPage,
    onlineBookingDb,
  }) => {
    await verifyContentPages(
      { page, onlineBookingPage, onlineBookingDb },
      "Modern",
      tablet,
    );
  });

  test("Modern tablet - booking and Thank You", async ({
    page,
    onlineBookingPage,
    onlineBookingDb,
    setupDb,
  }) => {
    await verifyBookingPages(
      { page, onlineBookingPage, onlineBookingDb, setupDb },
      "Modern",
      tablet,
    );
  });

  test("Modern mobile - content pages", async ({
    page,
    onlineBookingPage,
    onlineBookingDb,
  }) => {
    await verifyContentPages(
      { page, onlineBookingPage, onlineBookingDb },
      "Modern",
      mobile,
    );
  });

  test("Modern mobile - booking and Thank You", async ({
    page,
    onlineBookingPage,
    onlineBookingDb,
    setupDb,
  }) => {
    await verifyBookingPages(
      { page, onlineBookingPage, onlineBookingDb, setupDb },
      "Modern",
      mobile,
    );
  });

  test("Classic desktop - content pages", async ({
    page,
    onlineBookingPage,
    onlineBookingDb,
  }) => {
    await verifyContentPages(
      { page, onlineBookingPage, onlineBookingDb },
      "Classic",
      desktop,
    );
  });

  test("Classic desktop - booking and Thank You", async ({
    page,
    onlineBookingPage,
    onlineBookingDb,
    setupDb,
  }) => {
    await verifyBookingPages(
      { page, onlineBookingPage, onlineBookingDb, setupDb },
      "Classic",
      desktop,
    );
  });

  test("Classic tablet - content pages", async ({
    page,
    onlineBookingPage,
    onlineBookingDb,
  }) => {
    await verifyContentPages(
      { page, onlineBookingPage, onlineBookingDb },
      "Classic",
      tablet,
    );
  });

  test("Classic tablet - booking and Thank You", async ({
    page,
    onlineBookingPage,
    onlineBookingDb,
    setupDb,
  }) => {
    await verifyBookingPages(
      { page, onlineBookingPage, onlineBookingDb, setupDb },
      "Classic",
      tablet,
    );
  });

  test("Classic mobile - content pages", async ({
    page,
    onlineBookingPage,
    onlineBookingDb,
  }) => {
    await verifyContentPages(
      { page, onlineBookingPage, onlineBookingDb },
      "Classic",
      mobile,
    );
  });

  test("Classic mobile - booking and Thank You", async ({
    page,
    onlineBookingPage,
    onlineBookingDb,
    setupDb,
  }) => {
    await verifyBookingPages(
      { page, onlineBookingPage, onlineBookingDb, setupDb },
      "Classic",
      mobile,
    );
  });

  test("Modern desktop - chatbot disabled", async ({
    page,
    onlineBookingPage,
    onlineBookingDb,
    setupDb,
  }) => {
    await verifyDisabledChatbot(
      { page, onlineBookingPage, onlineBookingDb, setupDb },
      "Modern",
      desktop,
    );
  });

  test("Modern tablet - chatbot disabled", async ({
    page,
    onlineBookingPage,
    onlineBookingDb,
    setupDb,
  }) => {
    await verifyDisabledChatbot(
      { page, onlineBookingPage, onlineBookingDb, setupDb },
      "Modern",
      tablet,
    );
  });

  test("Modern mobile - chatbot disabled", async ({
    page,
    onlineBookingPage,
    onlineBookingDb,
    setupDb,
  }) => {
    await verifyDisabledChatbot(
      { page, onlineBookingPage, onlineBookingDb, setupDb },
      "Modern",
      mobile,
    );
  });

  test("Classic desktop - chatbot disabled", async ({
    page,
    onlineBookingPage,
    onlineBookingDb,
    setupDb,
  }) => {
    await verifyDisabledChatbot(
      { page, onlineBookingPage, onlineBookingDb, setupDb },
      "Classic",
      desktop,
    );
  });

  test("Classic tablet - chatbot disabled", async ({
    page,
    onlineBookingPage,
    onlineBookingDb,
    setupDb,
  }) => {
    await verifyDisabledChatbot(
      { page, onlineBookingPage, onlineBookingDb, setupDb },
      "Classic",
      tablet,
    );
  });

  test("Classic mobile - chatbot disabled", async ({
    page,
    onlineBookingPage,
    onlineBookingDb,
    setupDb,
  }) => {
    await verifyDisabledChatbot(
      { page, onlineBookingPage, onlineBookingDb, setupDb },
      "Classic",
      mobile,
    );
  });
});

async function verifyContentPages(
  fixtures: ChatbotPages,
  template: OnlineBookingTemplate,
  viewport: ViewportSize,
): Promise<void> {
  const { onlineBookingPage } = fixtures;
  await configureChatbot(fixtures, template, viewport);

  await test.step("Home", async () => {
    await onlineBookingPage.openHome();
    await verifyChatbot(onlineBookingPage);
  });

  for (const contentPage of contentPages) {
    await test.step(contentPage, async () => {
      await onlineBookingPage.clickBookingEnginePage(contentPage);
      await verifyChatbot(onlineBookingPage);
    });
  }

  await test.step("Individual room booking", async () => {
    await onlineBookingPage.openIndividualBooking(40);
    await onlineBookingPage.verifyChatbotLaunches();
  });
}

async function verifyBookingPages(
  fixtures: ChatbotPages & { setupDb: SetupDatabaseHelper },
  template: OnlineBookingTemplate,
  viewport: ViewportSize,
): Promise<void> {
  const { onlineBookingPage, setupDb } = fixtures;
  await configureChatbot(fixtures, template, viewport);
  await setupDb.disableDepositForAllRates();
  await setupDb.setPGAuthorizeNet();

  await test.step("Search results", async () => {
    await onlineBookingPage.openHome();
    await onlineBookingPage.selectNextAvailableStay();
    await onlineBookingPage.clickSearchButton();
    await verifyChatbot(onlineBookingPage);
  });

  await test.step("Booking summary", async () => {
    await onlineBookingPage.clickFirstBookButton();
    await verifyChatbot(onlineBookingPage);
  });

  await test.step("Registration", async () => {
    await onlineBookingPage.clickCompleteBookingButton();
    await verifyChatbot(onlineBookingPage);
  });

  await test.step("Thank You", async () => {
    await onlineBookingPage.enterGuestDetails();
    await onlineBookingPage.enterAuthorizeNetCardDetailsIfRequired();
    await onlineBookingPage.clickCompleteBookButton();
    await onlineBookingPage.verifyChatbotLaunches();
  });
}

async function configureChatbot(
  { page, onlineBookingDb }: ChatbotPages,
  template: OnlineBookingTemplate,
  viewport: ViewportSize,
): Promise<void> {
  await onlineBookingDb.enableEwrAiChatbot();
  await onlineBookingDb.setTemplateType(template);
  await page.setViewportSize(viewport);
}

async function verifyDisabledChatbot(
  fixtures: ChatbotPages & { setupDb: SetupDatabaseHelper },
  template: OnlineBookingTemplate,
  viewport: ViewportSize,
): Promise<void> {
  const { page, onlineBookingPage, onlineBookingDb, setupDb } = fixtures;
  await onlineBookingDb.disableEwrAiChatbot();
  await onlineBookingDb.setTemplateType(template);
  await setupDb.disableDepositForAllRates();
  await setupDb.setPGAuthorizeNet();
  await page.setViewportSize(viewport);

  await onlineBookingPage.openHome();
  await onlineBookingPage.verifyChatbotIsNotDisplayed();

  for (const contentPage of contentPages) {
    await onlineBookingPage.clickBookingEnginePage(contentPage);
    await onlineBookingPage.verifyChatbotIsNotDisplayed();
  }

  await onlineBookingPage.openHome();
  await onlineBookingPage.selectNextAvailableStay();
  await onlineBookingPage.clickSearchButton();
  await onlineBookingPage.verifyChatbotIsNotDisplayed();

  await onlineBookingPage.clickFirstBookButton();
  await onlineBookingPage.verifyChatbotIsNotDisplayed();

  await onlineBookingPage.clickCompleteBookingButton();
  await onlineBookingPage.verifyChatbotIsNotDisplayed();

  await onlineBookingPage.enterGuestDetails();
  await onlineBookingPage.enterAuthorizeNetCardDetailsIfRequired();
  await onlineBookingPage.clickCompleteBookButton();
  await onlineBookingPage.verifyChatbotIsNotDisplayed();

  await onlineBookingPage.openIndividualBooking(40);
  await onlineBookingPage.verifyChatbotIsNotDisplayed();
}

async function verifyChatbot(
  onlineBookingPage: OnlineBookingPage,
): Promise<void> {
  await onlineBookingPage.verifyChatbotLaunches();
  await onlineBookingPage.closeChatbot();
}
