import { ConstNames } from "../../../src/constants/ConstNames";
import { expect, test } from "../../../src/fixtures/sso.fixture";
import type { BillingPage } from "../../../src/pages/BillingPage";
import type { FindReservationPage } from "../../../src/pages/FindReservationPage";
import type { OnlineBookingPage } from "../../../src/pages/OnlineBookingPage";
import type { ReservationPage } from "../../../src/pages/ReservationPage";
import type { SSOLoginPage } from "../../../src/pages/SSOLoginPage";
import { SSOUsers } from "../../../src/test-data/SSOUsers";
import type { SetupDatabaseHelper } from "../../../src/utils/DBHelper/SetupDatabaseHelper";

type RateDepositCase = {
  name: string;
  databaseType: string;
  value?: number;
  expected: string;
};

const rateName = ConstNames.RATES_NAME_REGULAR_RATE;

const depositCases: RateDepositCase[] = [
  {
    name: "Number of Nights",
    databaseType: "NOOFDAYS",
    value: 1,
    expected: "100.00",
  },
  {
    name: "Number of Nights Plus Tax",
    databaseType: "NOOFNIGTHSWITHTAX",
    value: 1,
    expected: "105.00",
  },
  {
    name: "Percentage of Stay",
    databaseType: "PERCENTAGE",
    value: 50,
    expected: "50.00",
  },
  {
    name: "Percent of Reservation Total",
    databaseType: "ReservationTotal",
    value: 60,
    expected: "63.00",
  },
  { name: "Fixed Amount", databaseType: "FLAT", value: 40, expected: "40.00" },
  { name: "Full Amount of Stay", databaseType: "FULL", expected: "105.00" },
];

test.describe("Online Booking - Rate Based Deposit", () => {
  test.setTimeout(120_000);

  for (const depositCase of depositCases) {
    test(`calculates and downloads ${depositCase.name} deposit from the rate`, async ({
      onlineBookingPage,
      setupDb,
      ssoLoginPage,
      findReservationPage,
      reservationPage,
      billingPage,
    }) => {
      await setupRateBasedDepositTest(setupDb);
      await setupDb.setRateDepositRequired(rateName, true);
      await setupDb.setRateDepositApplyBySeason(rateName, false);
      await setupDb.setRateDepositType(rateName, depositCase.databaseType);
      if (depositCase.value !== undefined) {
        await setupDb.setRateDepositValue(rateName, depositCase.value);
      }

      const savedPolicy = await setupDb.getRateDepositPolicy(rateName);
      expect(savedPolicy).toMatchObject({
        DepositRequired: true,
        DepositType: depositCase.databaseType,
        ...(depositCase.value === undefined
          ? {}
          : { DepositValue: depositCase.value }),
      });

      const confirmationNumber = await completeOnlineBooking(
        onlineBookingPage,
        depositCase.expected,
      );
      await verifyReservationBilling({
        ssoLoginPage,
        findReservationPage,
        reservationPage,
        billingPage,
        confirmationNumber,
        expectedPaid: depositCase.expected,
        transactionName: depositCase.name,
      });
    });
  }

  test("creates a rate plan with Deposit Policy disabled", async ({
    onlineBookingPage,
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    billingPage,
  }) => {
    await setupDb.setDepositFixedOrFlat(40);
    await setupDb.disableDepositForAllRates();
    await setupRateBasedDepositTest(setupDb);

    const savedPolicy = await setupDb.getRateDepositPolicy(rateName);
    expect(savedPolicy).toMatchObject({ DepositRequired: false });

    const confirmationNumber = await completeOnlineBooking(
      onlineBookingPage,
      "40.00",
    );
    await verifyReservationBilling({
      ssoLoginPage,
      findReservationPage,
      reservationPage,
      billingPage,
      confirmationNumber,
      expectedPaid: "40.00",
      transactionName: "Fixed or flat",
    });
  });

  test("applies the enabled Holiday Season policy by arrival date", async ({
    onlineBookingPage,
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    billingPage,
  }) => {
    const arrival = new Date();
    arrival.setDate(arrival.getDate() + 7);
    const departure = new Date(arrival);
    departure.setDate(departure.getDate() + 1);
    const sqlDate = (date: Date): string => date.toISOString().slice(0, 10);

    await setupRateBasedDepositTest(setupDb);

    await setupDb.setRateDepositRequired(rateName, true);
    await setupDb.setRateDepositType(rateName, "FLAT");
    await setupDb.setRateDepositValue(rateName, 40);
    await setupDb.setSeasonDateRange(
      ConstNames.RATES_NAME_SEASONAL_DEFINITION,
      sqlDate(arrival),
      sqlDate(departure),
    );
    await setupDb.setRateSeasonDepositPolicy(
      rateName,
      ConstNames.RATES_NAME_SEASONAL_DEFINITION,
      "PERCENTAGE",
      50,
      true,
    );
    await setupDb.setRateDepositApplyBySeason(rateName, true);

    const confirmationNumber = await completeOnlineBooking(
      onlineBookingPage,
      "50.00",
    );
    await verifyReservationBilling({
      ssoLoginPage,
      findReservationPage,
      reservationPage,
      billingPage,
      confirmationNumber,
      expectedPaid: "50.00",
      transactionName: "Percentage of Stay",
    });
  });
});

async function setupRateBasedDepositTest(
  setupDb: SetupDatabaseHelper,
): Promise<void> {
  await setupDb.setPGAuthorizeNet();
  await setupDb.setRateAmount(rateName, 100);
  await setupDb.assignRateToRoomType(
    ConstNames.ROOMTYPE_NAME_ONLINE_ROOM,
    rateName,
  );
  await setupDb.assignRateToUnitSetup(
    ConstNames.ROOMTYPE_NAME_ONLINE_ROOM,
    rateName,
  );
  await setupDb.activateAllRoomsOfType(ConstNames.ROOMTYPE_NAME_ONLINE_ROOM);
  await setupDb.setOnlineRoomByRoomType(
    ConstNames.ROOMTYPE_NAME_ONLINE_ROOM,
    1,
  );
  await setupDb.setTaxAmount(ConstNames.TAX_NAME_LODGING, 5);
  await setupDb.setTaxAppliedToLodging(ConstNames.TAX_NAME_LODGING, 1);
  await setupDb.setTaxAmount(ConstNames.TAX_NAME_STATE, 0);
}

async function completeOnlineBooking(
  onlineBookingPage: OnlineBookingPage,
  expectedDeposit: string,
): Promise<string> {
  await onlineBookingPage.openHome();
  await onlineBookingPage.selectNextAvailableStay();
  await onlineBookingPage.clickSearchButton();
  await onlineBookingPage.clickFirstBookButton();
  await onlineBookingPage.clickCompleteBookingButton();
  await onlineBookingPage.verifyRegistrationDeposit(expectedDeposit);
  await onlineBookingPage.enterGuestDetails();
  await onlineBookingPage.enterAuthorizeNetCardDetailsIfRequired();
  await onlineBookingPage.clickCompleteBookButton();
  await onlineBookingPage.verifyThankYouAmountPaid(expectedDeposit);
  return onlineBookingPage.getConfirmationNumber();
}

type ReservationBillingVerification = {
  ssoLoginPage: SSOLoginPage;
  findReservationPage: FindReservationPage;
  reservationPage: ReservationPage;
  billingPage: BillingPage;
  confirmationNumber: string;
  expectedPaid: string;
  transactionName: string;
};

async function verifyReservationBilling({
  ssoLoginPage,
  findReservationPage,
  reservationPage,
  billingPage,
  confirmationNumber,
  expectedPaid,
  transactionName,
}: ReservationBillingVerification): Promise<void> {
  const user = SSOUsers.UserAdmin;
  await ssoLoginPage.propertyLogin(
    user.propertyShortName,
    user.loginName,
    user.password,
  );
  await findReservationPage.openReservation(confirmationNumber);
  await reservationPage.verifyBookingSummaryAmountPaid(expectedPaid);
  await billingPage.verifyBillingPaymentTransactionID(transactionName);
  await billingPage.verifyBillingFooterAmount("105.00");
  await billingPage.verifyBillingFooterAmountDue(
    (105 - Number(expectedPaid)).toFixed(2),
  );
}
