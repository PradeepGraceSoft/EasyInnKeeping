import { test } from "../../src/fixtures/sso.fixture";
import { AlertMessages } from "../../src/constants/AlertMessages";
import { ConstNames } from "../../src/constants/ConstNames";
import { SSOUsers } from "../../src/test-data/SSOUsers";

// Smoke test suite: Regular Reservation flows

test.describe("SmokeRegularReservation", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ setupDb }) => {
    await setupDb.setTaxAmount(ConstNames.TAX_NAME_LODGING, 5);
    await setupDb.setTaxExempt(ConstNames.TAX_NAME_LODGING, 0, 0);
    await setupDb.setTaxAppliedToLodging(ConstNames.TAX_NAME_LODGING, 1);
    await setupDb.setTaxAmount(ConstNames.TAX_NAME_STATE, 0);
    await setupDb.setTaxExempt(ConstNames.TAX_NAME_STATE, 0, 0);
    await setupDb.setTaxAppliedToLodging(ConstNames.TAX_NAME_STATE, 0);
    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE, 100);
  });

  test("Create a Regular Reservation with Discount - Flat", async ({
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

    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.addDiscount(ConstNames.DISCOUNT_FLAT_DISCOUNT, "20");
    await reservationPage.saveGuestInfoAndVerify();

    await reservationPage.verifyBookingSummaryRoomTotal("100.00");
    await reservationPage.verifyBookingSummaryTax("5.00");
    await reservationPage.verifyBookingSummaryDiscount("20.00");
    await reservationPage.verifyBookingSummaryPostTaxTotal("85.00");
    await reservationPage.verifyBookingSummaryAmountDue("85.00");

    await reservationPage.clickDeleteButton();
  });

  test("Create a Regular Reservation with Discount - Percentage", async ({
    ssoLoginPage,
    reservationPage,
    findReservationPage,
  }) => {
    const user = SSOUsers.User2;
    await ssoLoginPage.propertyLogin(
      user.propertyShortName,
      user.loginName,
      user.password,
    );

    await findReservationPage.addNewReservation();

    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.addDiscount(
      ConstNames.DISCOUNT_PERCENTAGE_DISCOUNT,
      "20",
    );
    await reservationPage.saveGuestInfoAndVerify();

    await reservationPage.verifyBookingSummaryRoomTotal("100.00");
    await reservationPage.verifyBookingSummaryTax("5.00");
    await reservationPage.verifyBookingSummaryDiscount("20.00");
    await reservationPage.verifyBookingSummaryPostTaxTotal("85.00");
    await reservationPage.verifyBookingSummaryAmountDue("85.00");

    await reservationPage.clickDeleteButton();
  });

  test("Create a Regular Reservation with Notes", async ({
    ssoLoginPage,
    reservationPage,
    findReservationPage,
  }) => {
    const user = SSOUsers.User3;
    await ssoLoginPage.propertyLogin(
      user.propertyShortName,
      user.loginName,
      user.password,
    );

    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.enterNotes("Notes Added");
    await reservationPage.saveGuestInfoAndVerify();
    await reservationPage.verifyNotes("Notes Added");
    await reservationPage.clickDeleteButton();
  });

  test("Create a Regular Reservation with Multiple Rooms", async ({
    ssoLoginPage,
    reservationPage,
    setupDb,
    findReservationPage,
  }) => {
    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE_TWO, 150);

    const user = SSOUsers.User4;
    await ssoLoginPage.propertyLogin(
      user.propertyShortName,
      user.loginName,
      user.password,
    );

    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();

    await reservationPage.clickAddAnotherRoom();
    await reservationPage.selectRoomType(
      ConstNames.ROOMTYPE_NAME_REGULAR_ROOM_TWO,
    );
    await reservationPage.selectFirstRoomFromDropdown();

    await reservationPage.saveGuestInfoAndVerify();

    await reservationPage.verifyBookingSummaryRoomTotal("250.00");
    await reservationPage.verifyBookingSummaryTax("12.50");
    await reservationPage.verifyBookingSummaryPostTaxTotal("262.50");
    await reservationPage.verifyBookingSummaryAmountDue("262.50");

    await reservationPage.clickDeleteButton();
  });

  test("Verify Booking Summary Totals after modifying Number of Nights for a Regular Reservation", async ({
    ssoLoginPage,
    reservationPage,
    setupDb,
    findReservationPage,
  }) => {
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
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.saveGuestInfoAndVerify();

    await reservationPage.enterNumberOfNights("3");
    await reservationPage.clickSaveButton();
    await reservationPage.verifyAlertMessage(
      AlertMessages.RESERVATION_SAVED_SUCCESS,
    );

    await reservationPage.verifyBookingSummaryRoomTotal("300.00");
    await reservationPage.verifyBookingSummaryTax("15.00");
    await reservationPage.verifyBookingSummaryPostTaxTotal("315.00");
    await reservationPage.verifyBookingSummaryAmountDue("315.00");

    await reservationPage.clickDeleteButton();
  });

  test("Delete a Room from a Regular Reservation", async ({
    ssoLoginPage,
    reservationPage,
    setupDb,
    dbHelper,
    findReservationPage,
  }) => {
    const user = SSOUsers.User6;
    await dbHelper.resetSettings(user.loginName);
    await ssoLoginPage.propertyLogin(
      user.propertyShortName,
      user.loginName,
      user.password,
    );

    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE_TWO, 150);

    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();

    await reservationPage.clickAddAnotherRoom();
    await reservationPage.selectSecondRoomType(
      ConstNames.ROOMTYPE_NAME_REGULAR_ROOM_TWO,
    );
    await reservationPage.selectFirstRoomFromDropdown();

    await reservationPage.enterGuestInfo();
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.saveGuestInfoAndVerify();

    await reservationPage.deleteRoomByRoomTypeName(
      ConstNames.ROOMTYPE_NAME_REGULAR_ROOM,
    );
    await reservationPage.clickSaveButton();
    await reservationPage.verifyAlertMessage(
      AlertMessages.RESERVATION_SAVED_SUCCESS,
    );

    await reservationPage.verifyBookingSummaryRoomTotal("150.00");
    await reservationPage.verifyBookingSummaryTax("7.50");
    await reservationPage.verifyBookingSummaryPostTaxTotal("157.50");
    await reservationPage.verifyBookingSummaryAmountDue("157.50");

    await reservationPage.clickDeleteButton();
  });

  test("Cancel a Regular Reservation", async ({
    ssoLoginPage,
    reservationPage,
    findReservationPage,
  }) => {
    const user = SSOUsers.User7;
    await ssoLoginPage.propertyLogin(
      user.propertyShortName,
      user.loginName,
      user.password,
    );

    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.saveGuestInfoAndVerify();

    await reservationPage.clickCancelButton();
    await reservationPage.verifyCancellationChargePopupDisplayed();
    await reservationPage.clickCancelReservation();
    await reservationPage.verifyAlertMessage(
      AlertMessages.RESERVATION_CANCELLED_SUCCESS,
    );

    await reservationPage.clickDeleteButton();
  });

  test("Restore a Cancelled Regular Reservation", async ({
    ssoLoginPage,
    reservationPage,
    findReservationPage,
  }) => {
    const user = SSOUsers.User8;
    await ssoLoginPage.propertyLogin(
      user.propertyShortName,
      user.loginName,
      user.password,
    );

    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.saveGuestInfoAndVerify();
    await reservationPage.clickCancelButton();
    await reservationPage.verifyCancellationChargePopupDisplayed();
    await reservationPage.clickCancelReservation();
    await reservationPage.verifyAlertMessage(
      AlertMessages.RESERVATION_CANCELLED_SUCCESS,
    );

    await reservationPage.clickRestoreReservation();
    await reservationPage.verifyAlertMessage(
      AlertMessages.RESERVATION_CANCELLED_RESTORE,
    );
    await reservationPage.clickDeleteButton();
  });

  test("Delete a Regular Reservation", async ({
    ssoLoginPage,
    reservationPage,
    findReservationPage,
  }) => {
    const user = SSOUsers.UserAdmin;
    await ssoLoginPage.propertyLogin(
      user.propertyShortName,
      user.loginName,
      user.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.saveGuestInfoAndVerify();
    await reservationPage.clickDeleteButton();
    await reservationPage.verifyAlertMessage(
      AlertMessages.RESERVATION_DELETE_SUCCESS,
    );
  });
});
