import { findPageByName } from "../utils/pageParser";
import { generateFromTemplate } from "../templates/testTemplates";

export interface GenerateTestInput {
  title: string;
  pages?: string[];
  steps?: string[];
  includeLogin?: boolean;
  userKey?: string;
  templateId?: string;
  includeTeardown?: boolean;
}

const PAGE_FIXTURE_MAP: Record<string, string> = {
  SSOLoginPage: "ssoLoginPage",
  LayoutPage: "layoutPage",
  FindReservationPage: "findReservationPage",
  ReservationPage: "reservationPage",
  CalendarPage: "calendarPage",
};

function inferPagesFromTitle(title: string): string[] {
  const lower = title.toLowerCase();
  const pages: string[] = ["ssoLoginPage", "layoutPage"];

  if (lower.includes("reservation")) {
    pages.push("findReservationPage", "reservationPage");
  }
  if (lower.includes("calendar")) {
    pages.push("calendarPage");
  }
  if (lower.includes("login") || lower.includes("sso")) {
    return ["ssoLoginPage", "dbHelper"];
  }

  return [...new Set(pages)];
}

function inferSteps(title: string, pages: string[]): string[] {
  const lower = title.toLowerCase();
  const steps: string[] = [];

  if (pages.includes("ssoLoginPage")) {
    steps.push(
      "const user = SSOUsers.UserAdmin;",
      "await dbHelper.resetSettings(user.loginName);",
      "await ssoLoginPage.propertyLogin(user.propertyShortName, user.loginName, user.password);",
    );
  }

  if (lower.includes("shared") && pages.includes("findReservationPage")) {
    steps.push(
      "await layoutPage.clickReservationListIcon();",
      "await findReservationPage.chooseReservationTypeShared();",
      "await findReservationPage.addNewReservation();",
    );
  } else if (
    lower.includes("delete a room") &&
    lower.includes("regular reservation") &&
    pages.includes("findReservationPage")
  ) {
    steps.push(
      "await layoutPage.clickReservationListIcon();",
      "await findReservationPage.addNewReservation();",
      "await reservationPage.selectBookingType(\"Regular\");",
    );
  } else if (lower.includes("reservation") && pages.includes("findReservationPage")) {
    steps.push(
      "await layoutPage.clickReservationListIcon();",
      "await findReservationPage.addNewReservation();",
    );
  }

  if (pages.includes("reservationPage")) {
    if (
      lower.includes("delete a room") &&
      lower.includes("regular reservation")
    ) {
      steps.push(
        "await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);",
        "await reservationPage.selectFirstRoomFromDropdown();",
        "await reservationPage.enterNumberOfNights(\"1\");",
        "",
        "await reservationPage.clickAddAnotherRoom();",
        "await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM_TWO);",
        "await reservationPage.selectFirstRoomFromDropdown();",
        "await reservationPage.enterNumberOfNights(\"1\");",
        "",
        "await reservationPage.enterGuestInfo();",
        "await reservationPage.enterPaymentMethod(ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH);",
        "await reservationPage.saveGuestInfoAndVerify();",
        "",
        "await reservationPage.deleteRoomByRoomTypeName(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);",
        "await reservationPage.clickSaveButton();",
        "",
        'await reservationPage.verifyBookingSummaryRoomTotal("150.00");',
        'await reservationPage.verifyBookingSummaryTax("7.50");',
        'await reservationPage.verifyBookingSummaryPostTaxTotal("157.50");',
        'await reservationPage.verifyBookingSummaryAmountDue("157.50");',
      );
    } else {
      steps.push(
        "await reservationPage.selectFirstAvailableRoomType();",
        "await reservationPage.selectFirstRoomFromDropdown();",
        "await reservationPage.enterGuestInfo();",
        "await reservationPage.enterPaymentMethod(ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH);",
        "await reservationPage.clickSaveButton();",
        "await reservationPage.verifyAlertMessage(AlertMessages.RESERVATION_SAVED_SUCCESS);",
      );
    }
  }

  if (steps.length <= 3) {
    steps.push("// TODO: add page actions for this scenario");
  }

  return steps;
}

export function generateTest(input: GenerateTestInput): string {
  if (input.templateId) {
    return generateFromTemplate({
      templateId: input.templateId,
      title: input.title,
      customSteps: input.steps,
      includeTeardown: input.includeTeardown,
    });
  }

  const fixtureNames = input.pages?.length
    ? input.pages.map((page) => PAGE_FIXTURE_MAP[page] ?? page)
    : inferPagesFromTitle(input.title);

  const uniqueFixtures = [...new Set(fixtureNames)];
  const needsDbHelper = uniqueFixtures.includes("ssoLoginPage");
  const imports = [
    'import { test, expect } from "../src/fixtures/sso.fixture";',
    'import { AlertMessages } from "../src/constants/AlertMessages";',
    'import { ConstNames } from "../src/constants/ConstNames";',
    'import { SSOUsers } from "../src/test-data/SSOUsers";',
  ];

  if (needsDbHelper && !uniqueFixtures.includes("dbHelper")) {
    uniqueFixtures.unshift("dbHelper");
  }

  const steps = input.steps ?? inferSteps(input.title, uniqueFixtures);
  const fixtureParams = uniqueFixtures.join(",\n  ");

  return `${imports.join("\n")}

// =========================================================================
// ${input.title}
// =========================================================================

test("${input.title}", async ({
  ${fixtureParams},
}) => {
${steps.map((step) => `  ${step}`).join("\n")}
});
`;
}

export function suggestAssertions(pageName: string): string[] {
  const page = findPageByName(pageName);
  if (!page) {
    return [];
  }

  return page.methods
    .filter((method) => method.startsWith("verify"))
    .slice(0, 10);
}
