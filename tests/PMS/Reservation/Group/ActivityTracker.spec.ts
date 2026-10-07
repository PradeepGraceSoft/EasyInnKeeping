import { AlertMessages } from "../../../../src/constants/AlertMessages";
import { ConstNames } from "../../../../src/constants/ConstNames";
import { expect, test } from "../../../../src/fixtures/sso.fixture";
import { SSOUsers } from "../../../../src/test-data/SSOUsers";
import type {
  ActivityLogEntry,
  ReservationDatabaseHelper,
} from "../../../../src/utils/DBHelper/ReservationDatabaseHelper";

const activityWindow = 24 * 60 * 60 * 1_000;

export async function verifyGroupActivity(
  helper: Pick<ReservationDatabaseHelper, "getGroupActivity">,
  groupCode: string,
  startedAt: Date,
  expectedActivity: RegExp,
  expectedStaffName: string,
  expectedDetails: RegExp,
): Promise<void> {
  let matchingEntry: ActivityLogEntry | undefined;
  const normalizedStaffName = expectedStaffName.trim().toLowerCase();

  await expect
    .poll(
      async () => {
        matchingEntry = (await helper.getGroupActivity(groupCode)).find(
          (entry) =>
            expectedActivity.test(entry.activity) &&
            expectedDetails.test(entry.details ?? "") &&
            entry.staffName.trim().toLowerCase() === normalizedStaffName &&
            isWithinActivityWindow(entry.createdAt, startedAt),
        );
        return Boolean(matchingEntry);
      },
      {
        message:
          `Expected group ${groupCode} activity ${expectedActivity} ` +
          `with details ${expectedDetails}`,
        timeout: 15_000,
      },
    )
    .toBe(true);

  expect(matchingEntry?.activity.trim()).toBeTruthy();
  expect(matchingEntry?.staffName.trim().toLowerCase()).toBe(
    normalizedStaffName,
  );
  expect(matchingEntry?.details.trim()).toBeTruthy();
  expect(matchingEntry?.details).toMatch(expectedDetails);
  expect(
    new Date(matchingEntry?.createdAt ?? Number.NaN).getTime(),
  ).not.toBeNaN();
}

export async function verifyGroupActivities(
  helper: Pick<ReservationDatabaseHelper, "getGroupActivity">,
  groupCode: string,
  startedAt: Date,
  expectedActivities: RegExp[],
  staffName: string,
): Promise<void> {
  for (const expectedActivity of expectedActivities) {
    await verifyGroupActivity(
      helper,
      groupCode,
      startedAt,
      expectedActivity,
      staffName,
      /\S+/,
    );
  }
}

function isWithinActivityWindow(createdAt: Date, startedAt: Date): boolean {
  const activityTime = new Date(createdAt).getTime();
  return (
    Number.isFinite(activityTime) &&
    Math.abs(activityTime - startedAt.getTime()) < activityWindow
  );
}

test.describe("Group reservation activity tracking @group", () => {
  test.setTimeout(180_000);

  test("captures history when creating a group reservation with notes", async ({
    findReservationPage,
    reservationDbHelper,
    reservationPage,
    ssoLoginPage,
  }) => {
    const user = SSOUsers.User1;
    await ssoLoginPage.propertyLogin(
      user.propertyShortName,
      user.loginName,
      user.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectBookingType("Group");
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.enterNotes("Group Notes Added");

    const startedAt = new Date();
    await reservationPage.saveGroupReservationAndVerify();
    const groupCode = await reservationPage.getGroupReservationNumber();
    await verifyGroupActivities(
      reservationDbHelper,
      groupCode,
      startedAt,
      [/^NEW RES$/i, /^ROOM BLOCK RESERVE$/i],
      user.loginName,
    );
    await reservationPage.verifyNotes("Group Notes Added");
    await reservationPage.clickGroupIndividualDeleteButton();
  });

  test("captures history when creating a group reservation with multiple rooms", async ({
    findReservationPage,
    reservationDbHelper,
    reservationPage,
    setupDb,
    ssoLoginPage,
  }) => {
    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE, 100);
    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE_TWO, 150);
    const user = SSOUsers.User2;
    await ssoLoginPage.propertyLogin(
      user.propertyShortName,
      user.loginName,
      user.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectBookingType("Group");
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.clickAddAnotherRoom();
    await reservationPage.selectSecondRoomType(
      ConstNames.ROOMTYPE_NAME_REGULAR_ROOM_TWO,
    );
    await reservationPage.selectFirstRoomFromDropdown();

    const startedAt = new Date();
    await reservationPage.saveGroupReservationAndVerify();
    const groupCode = await reservationPage.getGroupReservationNumber();
    await verifyGroupActivities(
      reservationDbHelper,
      groupCode,
      startedAt,
      [/^NEW RES$/i, /^ROOM BLOCK RESERVE$/i],
      user.loginName,
    );
    await reservationPage.clickGroupIndividualDeleteButton();
  });

  test("captures history when creating a group reservation with summary totals", async ({
    findReservationPage,
    reservationDbHelper,
    reservationPage,
    setupDb,
    ssoLoginPage,
  }) => {
    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE, 100);
    const user = SSOUsers.User3;
    await ssoLoginPage.propertyLogin(
      user.propertyShortName,
      user.loginName,
      user.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectBookingType("Group");
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.enterNumberOfNights("2");

    const startedAt = new Date();
    await reservationPage.saveGroupReservationAndVerify();
    const groupCode = await reservationPage.getGroupReservationNumber();
    await verifyGroupActivities(
      reservationDbHelper,
      groupCode,
      startedAt,
      [/^NEW RES$/i, /^ROOM BLOCK RESERVE$/i],
      user.loginName,
    );
    await reservationPage.clickGroupIndividualDeleteButton();
  });

  test("captures history when modifying a group reservation", async ({
    findReservationPage,
    reservationDbHelper,
    reservationPage,
    setupDb,
    ssoLoginPage,
  }) => {
    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE, 100);
    await setupDb.setRateWeekendDays(
      ConstNames.ROOMTYPE_NAME_REGULAR_ROOM,
      "UncheckAll",
    );
    const user = SSOUsers.User4;
    await ssoLoginPage.propertyLogin(
      user.propertyShortName,
      user.loginName,
      user.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectBookingType("Group");
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.enterNumberOfNights("2");
    const creationStartedAt = new Date();
    await reservationPage.saveGroupReservationAndVerify();
    const groupCode = await reservationPage.getGroupReservationNumber();
    await verifyGroupActivities(
      reservationDbHelper,
      groupCode,
      creationStartedAt,
      [/^NEW RES$/i, /^ROOM BLOCK RESERVE$/i],
      user.loginName,
    );

    const startedAt = new Date();
    await reservationPage.enterNumberOfNights("3");
    await reservationPage.selectAnotherAvailableRoomFromDropdown();
    await reservationPage.clickGroupSaveButton();
    await reservationPage.verifyAlertMessage(
      AlertMessages.RESERVATION_SAVED_SUCCESS,
    );
    await verifyGroupActivity(
      reservationDbHelper,
      groupCode,
      startedAt,
      /^EDIT BOOKING$/i,
      user.loginName,
      /\S+/,
    );
    await reservationPage.clickCloseButton();
    await findReservationPage.chooseReservationTypeGroup();
    await findReservationPage.openMostRecentGroupReservation();
    await reservationPage.clickGroupIndividualDeleteButton();
  });

  test("captures history when deleting a room from a group reservation", async ({
    findReservationPage,
    reservationDbHelper,
    reservationPage,
    setupDb,
    ssoLoginPage,
  }) => {
    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE, 100);
    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE_TWO, 150);
    const user = SSOUsers.User5;
    await ssoLoginPage.propertyLogin(
      user.propertyShortName,
      user.loginName,
      user.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectBookingType("Group");
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.clickAddAnotherRoom();
    await reservationPage.selectSecondRoomType(
      ConstNames.ROOMTYPE_NAME_REGULAR_ROOM_TWO,
    );
    await reservationPage.selectFirstRoomFromDropdown();
    const creationStartedAt = new Date();
    await reservationPage.saveGroupReservationAndVerify();
    const groupCode = await reservationPage.getGroupReservationNumber();
    await verifyGroupActivities(
      reservationDbHelper,
      groupCode,
      creationStartedAt,
      [/^NEW RES$/i, /^ROOM BLOCK RESERVE$/i],
      user.loginName,
    );

    const startedAt = new Date();
    await reservationPage.deleteRoomByRoomTypeName(
      ConstNames.ROOMTYPE_NAME_REGULAR_ROOM,
    );
    await reservationPage.clickGroupSaveButton();
    await reservationPage.verifyAlertMessage(
      AlertMessages.RESERVATION_SAVED_SUCCESS,
    );
    await verifyGroupActivity(
      reservationDbHelper,
      groupCode,
      startedAt,
      /^EDIT BOOKING$/i,
      user.loginName,
      /\S+/,
    );
    await reservationPage.clickGroupIndividualDeleteButton();
  });

  test("captures history when deleting a group reservation", async ({
    findReservationPage,
    reservationDbHelper,
    reservationPage,
    ssoLoginPage,
  }) => {
    const user = SSOUsers.User6;
    await ssoLoginPage.propertyLogin(
      user.propertyShortName,
      user.loginName,
      user.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectBookingType("Group");
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    const creationStartedAt = new Date();
    await reservationPage.saveGroupReservationAndVerify();
    const groupCode = await reservationPage.getGroupReservationNumber();
    await verifyGroupActivities(
      reservationDbHelper,
      groupCode,
      creationStartedAt,
      [/^NEW RES$/i, /^ROOM BLOCK RESERVE$/i],
      user.loginName,
    );

    const startedAt = new Date();
    await reservationPage.clickGroupIndividualDeleteButton();
    await reservationPage.verifyAlertMessage(
      AlertMessages.RESERVATION_DELETE_SUCCESS,
    );
    await verifyGroupActivity(
      reservationDbHelper,
      groupCode,
      startedAt,
      /DELETE/i,
      user.loginName,
      /\S+/,
    );
  });
});
