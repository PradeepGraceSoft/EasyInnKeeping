import { test } from "../../src/fixtures/sso.fixture";
import { AlertMessages } from "../../src/constants/AlertMessages";
import { ConstNames } from "../../src/constants/ConstNames";
import { SSOUsers } from "../../src/test-data/SSOUsers";

test.describe("SmokeGroupReservation", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ setupDb }) => {
    await setupDb.setTaxAmount(ConstNames.TAX_NAME_LODGING, 5);
    await setupDb.setTaxExempt(ConstNames.TAX_NAME_LODGING, 0, 0);
    await setupDb.setTaxAppliedToLodging(ConstNames.TAX_NAME_LODGING, 1);
    await setupDb.setTaxAmount(ConstNames.TAX_NAME_STATE, 0);
    await setupDb.setTaxExempt(ConstNames.TAX_NAME_STATE, 0, 0);
    await setupDb.setTaxAppliedToLodging(ConstNames.TAX_NAME_STATE, 0);
  });

  test("Create and Save a Group Reservation with Notes", async ({
    ssoLoginPage,
    reservationPage,
    findReservationPage,
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
    await reservationPage.saveGroupReservationAndVerify();

    await reservationPage.verifyNotes("Group Notes Added");
    await reservationPage.clickGroupIndividualDeleteButton();
  });

  test("Create and Save a Group Reservation with Multiple Rooms", async ({
    ssoLoginPage,
    reservationPage,
    setupDb,
    findReservationPage,
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
    await reservationPage.saveGroupReservationAndVerify();

    await reservationPage.verifyBookingSummaryRoomTotal("250.00");
    await reservationPage.verifyBookingSummaryTax("12.50");
    await reservationPage.verifyBookingSummaryPostTaxTotal("262.50");
    await reservationPage.verifyBookingSummaryAmountDue("262.50");
    await reservationPage.clickGroupIndividualDeleteButton();
  });

  test("Verify Booking Summary Totals when creating a Group Reservation", async ({
    ssoLoginPage,
    reservationPage,
    setupDb,
    findReservationPage,
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
    await reservationPage.saveGroupReservationAndVerify();

    await reservationPage.verifyBookingSummaryRoomTotal("200.00");
    await reservationPage.verifyBookingSummaryTax("10.00");
    await reservationPage.verifyBookingSummaryPostTaxTotal("210.00");
    await reservationPage.verifyBookingSummaryAmountDue("210.00");
    await reservationPage.clickGroupIndividualDeleteButton();
  });

  test("Verify Booking Summary Totals after modifying a Group Reservation", async ({
    ssoLoginPage,
    reservationPage,
    setupDb,
    findReservationPage,
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
    await reservationPage.saveGroupReservationAndVerify();

    await reservationPage.enterNumberOfNights("3");
    await reservationPage.selectAnotherAvailableRoomFromDropdown();
    await reservationPage.clickGroupSaveButton();
    await reservationPage.verifyAlertMessage(
      AlertMessages.RESERVATION_SAVED_SUCCESS,
    );
    await reservationPage.clickGroupSaveButton();
    await reservationPage.verifyAlertMessage(
      AlertMessages.RESERVATION_SAVED_SUCCESS,
    );

    await reservationPage.clickCloseButton();
    await findReservationPage.chooseReservationTypeGroup();
    await findReservationPage.openMostRecentGroupReservation();

    await reservationPage.verifyBookingSummaryRoomTotal("300.00");
    await reservationPage.verifyBookingSummaryTax("15.00");
    await reservationPage.verifyBookingSummaryPostTaxTotal("315.00");
    await reservationPage.verifyBookingSummaryAmountDue("315.00");
    await reservationPage.clickGroupIndividualDeleteButton();
  });

  test("Delete a Room from a Group Reservation", async ({
    ssoLoginPage,
    reservationPage,
    setupDb,
    findReservationPage,
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
    await reservationPage.saveGroupReservationAndVerify();

    await reservationPage.deleteRoomByRoomTypeName(
      ConstNames.ROOMTYPE_NAME_REGULAR_ROOM,
    );
    await reservationPage.clickGroupSaveButton();
    await reservationPage.verifyAlertMessage(
      AlertMessages.RESERVATION_SAVED_SUCCESS,
    );

    await reservationPage.verifyBookingSummaryRoomTotal("150.00");
    await reservationPage.verifyBookingSummaryTax("7.50");
    await reservationPage.verifyBookingSummaryPostTaxTotal("157.50");
    await reservationPage.verifyBookingSummaryAmountDue("157.50");
    await reservationPage.clickGroupIndividualDeleteButton();
  });

  test("Delete a Group Reservation", async ({
    ssoLoginPage,
    reservationPage,
    findReservationPage,
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
    await reservationPage.saveGroupReservationAndVerify();

    await reservationPage.clickGroupIndividualDeleteButton();
    await reservationPage.verifyAlertMessage(
      AlertMessages.RESERVATION_DELETE_SUCCESS,
    );
  });
});
