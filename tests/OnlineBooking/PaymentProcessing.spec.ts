import { test } from "../../src/fixtures/sso.fixture";
import { ConstNames } from "../../src/constants/ConstNames";
import { SSOUsers } from "../../src/test-data/SSOUsers";
import type { DepositType } from "../../src/pages/OnlineBookingPage";

const depositCases: Array<{ depositType: DepositType; expected: string }> = [
  { depositType: "No of nights", expected: "100.00" },
  { depositType: "No of nights with tax", expected: "105.00" },
  { depositType: "Percentage of stay", expected: "50.00" },
  { depositType: "Fixed or flat", expected: "40.00" },
  { depositType: "No deposit", expected: "0.00" },
  { depositType: "Full amount", expected: "105.00" },
  { depositType: "Percentage of total", expected: "63.00" },
];

test.describe("OnlineBooking - Payment Processing", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(120_000);

  test("Shift4", async ({
    onlineBookingPage,
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    billingPage,
  }) => {
    const expected = "105.00";
    await setupDb.disableDepositForAllRates();
    await setupDb.setPGShift4();
    await setupDb.setDepositType("Full amount");
    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE, 100);
    await setupDb.assignRateToRoomType(
      ConstNames.ROOMTYPE_NAME_ONLINE_ROOM,
      ConstNames.RATES_NAME_REGULAR_RATE,
    );
    await setupDb.assignRateToUnitSetup(
      ConstNames.ROOMTYPE_NAME_ONLINE_ROOM,
      ConstNames.RATES_NAME_REGULAR_RATE,
    );
    await setupDb.activateAllRoomsOfType(
      ConstNames.ROOMTYPE_NAME_ONLINE_ROOM,
    );
    await setupDb.setOnlineRoomByRoomType(
      ConstNames.ROOMTYPE_NAME_ONLINE_ROOM,
      1,
    );
    await setupDb.setTaxAmount(ConstNames.TAX_NAME_LODGING, 5);
    await setupDb.setTaxAppliedToLodging(ConstNames.TAX_NAME_LODGING, 1);
    await setupDb.setTaxAmount(ConstNames.TAX_NAME_STATE, 0);

    await onlineBookingPage.openHome();
    await onlineBookingPage.selectNextAvailableStay();
    await onlineBookingPage.clickSearchButton();
    await onlineBookingPage.clickFirstBookButton();
    await onlineBookingPage.clickCompleteBookingButton();
    await onlineBookingPage.verifyRegistrationDeposit(expected);
    await onlineBookingPage.enterGuestDetails();
    await onlineBookingPage.enterCardDetailsIfRequired("4321000000001119");
    await onlineBookingPage.clickCompleteBookButton();
    await onlineBookingPage.verifyThankYouAmountPaid(expected);
    const confirmationNumber = await onlineBookingPage.getConfirmationNumber();

    const user = SSOUsers.UserAdmin;
    await ssoLoginPage.propertyLogin(
      user.propertyShortName,
      user.loginName,
      user.password,
    );
    await findReservationPage.openReservation(confirmationNumber);
    await reservationPage.verifyBookingSummaryAmountPaid(expected);
    await billingPage.verifyBillingPaymentTransactionID("Full amount");
  });

  for (const { depositType, expected } of depositCases) {
    test(`payment processing new test - AuthorizeNet - ${depositType}`, async ({
      onlineBookingPage,
      setupDb,
      ssoLoginPage,
      findReservationPage,
      reservationPage,
      billingPage,
    }) => {
      await setupDb.disableDepositForAllRates();
      await setupDb.setPGAuthorizeNet();
      await setupDb.setDepositType(depositType);
      await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE, 100);
      await setupDb.assignRateToRoomType(
        ConstNames.ROOMTYPE_NAME_ONLINE_ROOM,
        ConstNames.RATES_NAME_REGULAR_RATE,
      );
      await setupDb.assignRateToUnitSetup(
        ConstNames.ROOMTYPE_NAME_ONLINE_ROOM,
        ConstNames.RATES_NAME_REGULAR_RATE,
      );
      await setupDb.activateAllRoomsOfType(
        ConstNames.ROOMTYPE_NAME_ONLINE_ROOM,
      );
      await setupDb.setOnlineRoomByRoomType(
        ConstNames.ROOMTYPE_NAME_ONLINE_ROOM,
        1,
      );
      await setupDb.setTaxAmount(ConstNames.TAX_NAME_LODGING, 5);
      await setupDb.setTaxAppliedToLodging(ConstNames.TAX_NAME_LODGING, 1);
      await setupDb.setTaxAmount(ConstNames.TAX_NAME_STATE, 0);

      await onlineBookingPage.openHome();
      await onlineBookingPage.selectNextAvailableStay();
      await onlineBookingPage.clickSearchButton();
      await onlineBookingPage.clickFirstBookButton();
      await onlineBookingPage.clickCompleteBookingButton();
      await onlineBookingPage.verifyRegistrationDeposit(expected);
      await onlineBookingPage.enterGuestDetails();
      await onlineBookingPage.enterAuthorizeNetCardDetailsIfRequired();
      await onlineBookingPage.clickCompleteBookButton();
      await onlineBookingPage.verifyThankYouAmountPaid(expected);
      const confirmationNumber =
        await onlineBookingPage.getConfirmationNumber();

      const user = SSOUsers.UserAdmin;
      await ssoLoginPage.propertyLogin(
        user.propertyShortName,
        user.loginName,
        user.password,
      );
      await findReservationPage.openReservation(confirmationNumber);
      await reservationPage.verifyBookingSummaryAmountPaid(expected);
      await billingPage.verifyBillingPaymentTransactionID(depositType);
    });
  }
});
