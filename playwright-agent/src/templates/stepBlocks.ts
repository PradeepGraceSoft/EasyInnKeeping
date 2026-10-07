/**
 * Reusable step blocks extracted from tests/SharedReservation.spec.ts.
 * Compose these into new tests via templates or the generate-from-template command.
 */
export interface StepBlock {
  id: string;
  name: string;
  description: string;
  fixtures: string[];
  extraImports?: string[];
  steps: string[];
}

export const STEP_BLOCKS: Record<string, StepBlock> = {
  "login-admin-with-reset": {
    id: "login-admin-with-reset",
    name: "Login as UserAdmin with DB reset",
    description:
      "Reset SSO settings in DB, then property login as UserAdmin. Use when tests need a clean admin state.",
    fixtures: ["ssoLoginPage", "dbHelper"],
    steps: [
      "const user = SSOUsers.UserAdmin;",
      "await dbHelper.resetSettings(user.loginName);",
      "await ssoLoginPage.propertyLogin(",
      "  user.propertyShortName,",
      "  user.loginName,",
      "  user.password,",
      ");",
    ],
  },

  "login-user1": {
    id: "login-user1",
    name: "Login as User1",
    description:
      "Property login as User1 (staff1) without DB reset. Matches calendar and restriction tests.",
    fixtures: ["ssoLoginPage"],
    steps: [
      "const user = SSOUsers.User1;",
      "await ssoLoginPage.propertyLogin(",
      "  user.propertyShortName,",
      "  user.loginName,",
      "  user.password,",
      ");",
    ],
  },

  "login-user2": {
    id: "login-user2",
    name: "Login as User2",
    description:
      "Property login as User2 (staff2) without DB reset.",
    fixtures: ["ssoLoginPage"],
    steps: [
      "const user = SSOUsers.User2;",
      "await ssoLoginPage.propertyLogin(",
      "  user.propertyShortName,",
      "  user.loginName,",
      "  user.password,",
      ");",
    ],
  },

  "navigate-shared-via-find-list": {
    id: "navigate-shared-via-find-list",
    name: "Open new shared reservation via Find Reservation list",
    description:
      "Navigate to reservation list, choose Shared type, and start a new reservation.",
    fixtures: ["layoutPage", "findReservationPage", "reservationPage"],
    steps: [
      "await layoutPage.clickReservationListIcon();",
      "await findReservationPage.chooseReservationTypeShared();",
      "await findReservationPage.addNewReservation();",
    ],
  },

  "navigate-shared-via-calendar-popup": {
    id: "navigate-shared-via-calendar-popup",
    name: "Open new shared reservation via Calendar popup",
    description:
      "Open calendar, click New Reservation, capture popup, and create ReservationPage instance.",
    fixtures: ["page", "layoutPage"],
    extraImports: [
      'import { ReservationPage } from "../src/pages/ReservationPage";',
      'import { ReservationDatabaseHelper } from "../src/utils/DBHelper/ReservationDatabaseHelper";',
    ],
    steps: [
      "await layoutPage.clickCalendarIcon();",
      "const reservationPopupPromise = page.waitForEvent(\"popup\");",
      "await page",
      "  .getByRole(\"button\", { name: \"icon\", description: \"New Reservation\" })",
      "  .click();",
      "const reservationPopup = await reservationPopupPromise;",
      "",
      "const reservationPage = new ReservationPage(",
      "  reservationPopup,",
      "  new ReservationDatabaseHelper(),",
      ");",
      "",
      "await reservationPage.selectBookingType(\"Shared\");",
    ],
  },

  "save-primary-shared-guest": {
    id: "save-primary-shared-guest",
    name: "Fill and save primary shared guest",
    description:
      "Select room, enter guest/payment info, save, and verify success alert.",
    fixtures: ["reservationPage"],
    steps: [
      "await reservationPage.selectFirstAvailableRoomType();",
      "await reservationPage.selectFirstRoomFromDropdown();",
      "await reservationPage.enterGuestInfo();",
      "await reservationPage.enterPaymentMethod(",
      "  ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,",
      ");",
      "await reservationPage.clickSaveButton();",
      "await reservationPage.verifyAlertMessage(",
      "  AlertMessages.RESERVATION_SAVED_SUCCESS,",
      ");",
    ],
  },

  "add-second-shared-guest-and-save": {
    id: "add-second-shared-guest-and-save",
    name: "Add second shared guest and save",
    description:
      "Add another guest on a shared reservation, fill details, save, and verify alert.",
    fixtures: ["reservationPage"],
    steps: [
      "await reservationPage.clickSharedAddGuestOption();",
      "await reservationPage.enterGuestInfo();",
      "await reservationPage.enterPaymentMethod(",
      "  ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,",
      ");",
      "await reservationPage.clickSaveButton();",
      "await reservationPage.verifyAlertMessage(",
      "  AlertMessages.RESERVATION_SAVED_SUCCESS,",
      ");",
    ],
  },

  "teardown-delete-reservation": {
    id: "teardown-delete-reservation",
    name: "Assert reservation number and delete",
    description: "Verify reservation number is assigned, then delete the reservation.",
    fixtures: ["reservationPage"],
    steps: [
      "const reservationNumber = await reservationPage.getReservationNumber();",
      "expect(reservationNumber).not.toEqual(\"\");",
      "await reservationPage.deleteCurrentReservation();",
    ],
  },
};

export function getStepBlock(blockId: string): StepBlock | undefined {
  return STEP_BLOCKS[blockId];
}

export function listStepBlocks(): StepBlock[] {
  return Object.values(STEP_BLOCKS);
}
