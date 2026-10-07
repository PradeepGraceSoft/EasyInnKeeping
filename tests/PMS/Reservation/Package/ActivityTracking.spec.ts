import { AlertMessages } from "../../../../src/constants/AlertMessages";
import { ConstNames } from "../../../../src/constants/ConstNames";
import { expect, test } from "../../../../src/fixtures/sso.fixture";
import { SSOUsers } from "../../../../src/test-data/SSOUsers";
import { verifyReservationActivity } from "../activityTracking";

test.describe("Package reservation activity tracking", () => {
  test.setTimeout(180_000);

  test("tracks create, modify, billing, and cancel actions", async ({
    billingPage,
    findReservationPage,
    reservationDbHelper,
    reservationPage,
    setupDb,
    ssoLoginPage,
  }) => {
    const user = SSOUsers.UserAdmin;
    const paymentAccountCode =
      await setupDb.requireInventoryItemAccountCode(
        ConstNames.INVENTORY_PAYMENT_CASH_PAYMENT,
      );
    await setupDb.ensureCashDrawerOpen();
    await ssoLoginPage.propertyLogin(
      user.propertyShortName,
      user.loginName,
      user.password,
    );

    let reservationCreated = false;
    let testCompletedSuccessfully = false;
    try {
      await findReservationPage.chooseReservationTypePackage();
      await findReservationPage.addNewReservation();
      await reservationPage.chooseFirstPackage();
      await reservationPage.chooseFirstPackageRoom();
      await reservationPage.clickPackageAddRoomButton();

      let actionStartedAt = new Date();
      await reservationPage.saveGuestInfoAndVerify();
      reservationCreated = true;
      const confirmationNumber = await reservationPage.getReservationNumber();
      expect(confirmationNumber).toMatch(/^\d+$/);
      await verifyReservationActivity(
        reservationDbHelper,
        confirmationNumber,
        actionStartedAt,
        /^NEW RES$/i,
        /Guest Name\s*:.*New Reservation\s*:/i,
        user.loginName,
      );

      actionStartedAt = new Date();
      await reservationPage.enterNotes(`Package activity ${Date.now()}`);
      await reservationPage.clickSaveButton();
      await reservationPage.verifyAlertMessage(
        AlertMessages.RESERVATION_SAVED_SUCCESS,
      );
      await verifyReservationActivity(
        reservationDbHelper,
        confirmationNumber,
        actionStartedAt,
        /^EDIT BOOKING$/i,
        /Notes:.*=> Package activity \d+/is,
        user.loginName,
      );

      actionStartedAt = new Date();
      await billingPage.clickBillingTab();
      await billingPage.enterPaymentRefundAccountCode(paymentAccountCode);
      await billingPage.enterPaymentAmountTextBox("1.00");
      await billingPage.clickPaymentRefundSaveButton();
      await reservationPage.verifyAlertMessage(
        AlertMessages.BILLING_SAVED_SUCCESS,
      );
      await verifyReservationActivity(
        reservationDbHelper,
        confirmationNumber,
        actionStartedAt,
        /^ADD INV ITEM$/i,
        /Cash Payment added/i,
        user.loginName,
      );

      actionStartedAt = new Date();
      await reservationPage.clickReservationTab();
      await reservationPage.clickCancelButton();
      await reservationPage.verifyCancellationChargePopupDisplayed();
      await reservationPage.clickCancelReservation();
      await reservationPage.verifyAlertMessage(
        AlertMessages.RESERVATION_CANCELLED_SUCCESS,
      );
      await verifyReservationActivity(
        reservationDbHelper,
        confirmationNumber,
        actionStartedAt,
        /^CANCEL BOOKING$/i,
        /Reservation Canceled/i,
        user.loginName,
      );
      testCompletedSuccessfully = true;
    } finally {
      if (reservationCreated && testCompletedSuccessfully) {
        await reservationPage.deleteCurrentReservation();
      }
    }
  });
});
