import type { Page } from "@playwright/test";
import { AlertMessages } from "../../../../src/constants/AlertMessages";
import { ConstNames } from "../../../../src/constants/ConstNames";
import { expect, test } from "../../../../src/fixtures/sso.fixture";
import type { FindReservationPage } from "../../../../src/pages/FindReservationPage";
import type { ReservationPage } from "../../../../src/pages/ReservationPage";
import { SSOUsers } from "../../../../src/test-data/SSOUsers";
import { verifyReservationActivity } from "../activityTracking";

const user = SSOUsers.UserAdmin;

test.describe("Hourly reservation activity tracking", () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ ssoLoginPage }) => {
    await ssoLoginPage.propertyLogin(
      user.propertyShortName,
      user.loginName,
      user.password,
    );
  });

  test.afterEach(async ({ page, reservationPage }) => {
    await deleteHourlyReservationIfOpen(page, reservationPage);
  });

  test("tracks reservation creation", async ({
    findReservationPage,
    reservationDbHelper,
    reservationPage,
  }) => {
    const reservation = await createHourlyReservation(
      findReservationPage,
      reservationPage,
    );

    await verifyReservationActivity(
      reservationDbHelper,
      reservation.confirmationNumber,
      reservation.createdAt,
      /^NEW RES$/i,
      /New Reservation/i,
      user.loginName,
    );
  });

  test("tracks reservation modification", async ({
    findReservationPage,
    reservationDbHelper,
    reservationPage,
  }) => {
    const { confirmationNumber } = await createHourlyReservation(
      findReservationPage,
      reservationPage,
    );

    const actionStartedAt = new Date();
    await reservationPage.selectReservationStatus("Confirmed");
    await reservationPage.clickSaveButton();
    await reservationPage.verifyAlertMessage(
      AlertMessages.RESERVATION_SAVED_SUCCESS,
    );
    await verifyReservationActivity(
      reservationDbHelper,
      confirmationNumber,
      actionStartedAt,
      /^EDIT BOOKING$/i,
      /Status:.*Confirmed/i,
      user.loginName,
    );
  });

  test("tracks a billing payment", async ({
    billingPage,
    findReservationPage,
    reservationDbHelper,
    reservationPage,
    setupDb,
  }) => {
    const paymentAccountCode =
      await setupDb.requireInventoryItemAccountCode(
        ConstNames.INVENTORY_PAYMENT_CASH_PAYMENT,
      );
    await setupDb.ensureCashDrawerOpen();
    const { confirmationNumber } = await createHourlyReservation(
      findReservationPage,
      reservationPage,
    );

    const actionStartedAt = new Date();
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
  });

  test("tracks reservation cancellation", async ({
    findReservationPage,
    reservationDbHelper,
    reservationPage,
  }) => {
    const { confirmationNumber } = await createHourlyReservation(
      findReservationPage,
      reservationPage,
    );

    const actionStartedAt = new Date();
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
  });
});

async function createHourlyReservation(
  findReservationPage: FindReservationPage,
  reservationPage: ReservationPage,
): Promise<{ confirmationNumber: string; createdAt: Date }> {
  await findReservationPage.chooseReservationTypeHourly();
  await findReservationPage.addNewReservation();
  await reservationPage.selectFirstHourlyRoom();
  await reservationPage.selectStartTime();
  await reservationPage.enterHours("1");

  const createdAt = new Date();
  await reservationPage.saveGuestInfoAndVerify();
  const confirmationNumber = await reservationPage.getReservationNumber();
  expect(confirmationNumber).toMatch(/^\d+$/);
  return { confirmationNumber, createdAt };
}

async function deleteHourlyReservationIfOpen(
  page: Page,
  reservationPage: ReservationPage,
): Promise<void> {
  if (!page.isClosed()) {
    await reservationPage.deleteCurrentReservationIfOpen();
  }
}
