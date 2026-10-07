import { AlertMessages } from "../../../src/constants/AlertMessages";
import { ConstNames } from "../../../src/constants/ConstNames";
import { test } from "../../../src/fixtures/sso.fixture";
import type { FindReservationPage } from "../../../src/pages/FindReservationPage";
import type { ReservationPage } from "../../../src/pages/ReservationPage";
import { SSOUsers } from "../../../src/test-data/SSOUsers";
import type { ReservationDatabaseHelper } from "../../../src/utils/DBHelper/ReservationDatabaseHelper";
import { verifyGroupActivity } from "./Group/ActivityTracker.spec";
import { verifyReservationActivity } from "./activityTracking";

const reservationTypes = ["Regular", "Group", "Package", "Hourly"] as const;
type ReservationType = (typeof reservationTypes)[number];

type ReservationFixtures = {
  findReservationPage: FindReservationPage;
  reservationPage: ReservationPage;
};

type CreatedReservation = {
  confirmationNumber: string;
  groupCode?: string;
};

test.describe("Find Reservation activity tracking @activity", () => {
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(async ({ ssoLoginPage }) => {
    const user = SSOUsers.User1;
    await ssoLoginPage.propertyLogin(
      user.propertyShortName,
      user.loginName,
      user.password,
    );
  });

  for (const reservationType of reservationTypes) {
    test(`tracks cancellation for a ${reservationType} reservation`, async ({
      findReservationPage,
      reservationDbHelper,
      reservationPage,
    }) => {
      const reservation = await createAndFindReservation(reservationType, {
        findReservationPage,
        reservationPage,
      });
      let testCompletedSuccessfully = false;
      try {
        const startedAt = new Date();

        await findReservationPage.clickReservationCancelButton(
          reservation.confirmationNumber,
        );
        await reservationPage.verifyCancellationChargePopupDisplayed();
        await reservationPage.clickCancelReservation();
        await reservationPage.verifyAlertMessage(
          AlertMessages.RESERVATION_CANCELLED_SUCCESS,
        );

        await verifyActionActivity(
          reservationDbHelper,
          reservation,
          startedAt,
          reservationType === "Hourly"
            ? /^CANCEL BOOKING$/i
            : /^EDIT BOOKING$/i,
          reservationType === "Hourly"
            ? /^Reservation Canceled$/i
            : /Cancelled on/i,
        );
        testCompletedSuccessfully = true;
      } finally {
        if (testCompletedSuccessfully) {
          await deleteReservation(
            reservationType,
            reservation,
            { findReservationPage, reservationPage },
          );
        }
      }
    });

    test(`tracks check-in for a ${reservationType} reservation`, async ({
      findReservationPage,
      reservationDbHelper,
      reservationPage,
    }) => {
      const reservation = await createAndFindReservation(reservationType, {
        findReservationPage,
        reservationPage,
      });
      let testCompletedSuccessfully = false;
      try {
        const startedAt = new Date();

        await findReservationPage.selectReservation(
          reservation.confirmationNumber,
        );
        await findReservationPage.clickCheckInButton();
        await findReservationPage.confirmCheckIn();

        await verifyActionActivity(
          reservationDbHelper,
          reservation,
          startedAt,
          /^EDIT BOOKING$/i,
          /Status:\s*Booked\s*=>\s*CheckIn/i,
        );
        testCompletedSuccessfully = true;
      } finally {
        if (testCompletedSuccessfully) {
          await deleteReservation(
            reservationType,
            reservation,
            { findReservationPage, reservationPage },
          );
        }
      }
    });
  }
});

async function createAndFindReservation(
  reservationType: ReservationType,
  fixtures: ReservationFixtures,
): Promise<CreatedReservation> {
  await chooseReservationType(fixtures.findReservationPage, reservationType);
  await fixtures.findReservationPage.addNewReservation();

  if (reservationType === "Group") {
    return createAndFindGroupMember(fixtures);
  }

  await selectReservationRoom(fixtures.reservationPage, reservationType);
  await fixtures.reservationPage.saveGuestInfoAndVerify();
  const confirmationNumber =
    await fixtures.reservationPage.getReservationNumber();
  await fixtures.reservationPage.clickCloseButton();
  await chooseReservationType(fixtures.findReservationPage, reservationType);
  await fixtures.findReservationPage.findReservationByNumber(
    confirmationNumber,
  );
  return { confirmationNumber };
}

async function createAndFindGroupMember(
  fixtures: ReservationFixtures,
): Promise<CreatedReservation> {
  await fixtures.reservationPage.selectFirstAvailableRoomType();
  await fixtures.reservationPage.selectFirstRoomFromDropdown();
  await fixtures.reservationPage.saveGroupReservationAndVerify();
  const groupCode = await fixtures.reservationPage.getGroupReservationNumber();

  // The group dialog represents the block. Reserve a room from that block to
  // create the individual reservation that Find Reservation can act upon.
  await fixtures.reservationPage.waitForAlertMessageToClose();
  await fixtures.reservationPage.clickGroupReserveButton();
  await fixtures.reservationPage.enterGroupMemberGuestInfo();
  await fixtures.reservationPage.enterGroupMemberPaymentMethod(
    ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
  );
  await fixtures.reservationPage.clickGroupMemberSaveButton();
  const confirmationNumber =
    await fixtures.reservationPage.getReservationNumber();
  await fixtures.reservationPage.clickCloseButton();
  await fixtures.reservationPage.clickCloseButton();

  // Group members are actionable in the Regular list. Their action rows must
  // retain the generated GroupCode, so both identifiers are validated.
  await fixtures.findReservationPage.chooseReservationTypeRegular();
  await fixtures.findReservationPage.findReservationByNumber(
    confirmationNumber,
  );
  return { confirmationNumber, groupCode };
}

async function selectReservationRoom(
  reservationPage: ReservationPage,
  reservationType: Exclude<ReservationType, "Group">,
): Promise<void> {
  if (reservationType === "Hourly") {
    await reservationPage.selectFirstHourlyRoom();
    await reservationPage.selectStartTime();
    await reservationPage.enterHours("1");
    return;
  }

  if (reservationType === "Package") {
    await reservationPage.chooseFirstPackage();
    await reservationPage.chooseFirstPackageRoom();
    await reservationPage.clickPackageAddRoomButton();
    return;
  }

  await reservationPage.selectFirstAvailableRoomType();
  await reservationPage.selectFirstRoomFromDropdown();
}

async function chooseReservationType(
  findReservationPage: FindReservationPage,
  reservationType: ReservationType,
): Promise<void> {
  const choices: Record<ReservationType, () => Promise<void>> = {
    Regular: () => findReservationPage.chooseReservationTypeRegular(),
    Group: () => findReservationPage.chooseReservationTypeGroup(),
    Package: () => findReservationPage.chooseReservationTypePackage(),
    Hourly: () => findReservationPage.chooseReservationTypeHourly(),
  };
  await choices[reservationType]();
}

async function verifyActionActivity(
  helper: ReservationDatabaseHelper,
  reservation: CreatedReservation,
  startedAt: Date,
  expectedActivity: RegExp,
  expectedDetails: RegExp,
): Promise<void> {
  const expectedStaffName = SSOUsers.User1.loginName;
  await verifyReservationActivity(
    helper,
    reservation.confirmationNumber,
    startedAt,
    expectedActivity,
    expectedDetails,
    expectedStaffName,
  );

  if (reservation.groupCode) {
    await verifyGroupActivity(
      helper,
      reservation.groupCode,
      startedAt,
      expectedActivity,
      expectedStaffName,
      expectedDetails,
    );
  }
}

async function deleteReservation(
  reservationType: ReservationType,
  reservation: CreatedReservation,
  fixtures: ReservationFixtures,
): Promise<void> {
  await chooseReservationType(
    fixtures.findReservationPage,
    reservationType === "Group" ? "Regular" : reservationType,
  );
  await fixtures.findReservationPage.openReservation(
    reservation.confirmationNumber,
  );
  await fixtures.reservationPage.clickDeleteButton();
  await fixtures.reservationPage.verifyAlertMessage(
    AlertMessages.RESERVATION_DELETE_SUCCESS,
  );

  if (reservation.groupCode) {
    await fixtures.findReservationPage.chooseReservationTypeGroup();
    const groupRemains =
      await fixtures.findReservationPage.openGroupReservationIfPresent(
        reservation.groupCode,
      );
    if (groupRemains) {
      await fixtures.reservationPage.deleteGroupReservationBlockAndGroup();
    }
  }
}
