import { test, expect } from "../../src/fixtures/sso.fixture";
import { ConstNames } from "../../src/constants/ConstNames";
import type { SetupDatabaseHelper } from "../../src/utils/DBHelper/SetupDatabaseHelper";
import { SSOUsers } from "../../src/test-data/SSOUsers";
import { RandomDataUtils } from "../../src/utils/RandomDataUtils";

type RateCase = {
  nights: number;
  roomTotal: string;
  taxTotal: string;
  grandTotal: string;
};

const rateCases: RateCase[] = [
  { nights: 1, roomTotal: "120.00", taxTotal: "6.00", grandTotal: "126.00" },
  { nights: 2, roomTotal: "240.00", taxTotal: "12.00", grandTotal: "252.00" },
];

const originalCartStates = new WeakMap<object, boolean>();
const reservations = new WeakMap<object, string>();

test.describe("Online Booking - Rates", () => {
  test.setTimeout(120_000);

  test.beforeEach(async ({ onlineBookingDb }) => {
    const wasEnabled = await onlineBookingDb.getShoppingCartEnabled();
    originalCartStates.set(test.info(), wasEnabled);
    await onlineBookingDb.setShoppingCartEnabled(false);
    expect(
      await onlineBookingDb.getShoppingCartEnabled(),
      "Shopping cart must be disabled for rate scenarios.",
    ).toBe(false);
  });

  test.afterEach(async ({ onlineBookingDb, reservationApi }, testInfo) => {
    try {
      const confirmationNumber = reservations.get(testInfo);
      if (testInfo.status === "passed" && confirmationNumber) {
        await reservationApi.deleteReservation(confirmationNumber);
      }
    } finally {
      const wasEnabled = originalCartStates.get(testInfo);
      if (wasEnabled !== undefined) {
        await onlineBookingDb.setShoppingCartEnabled(wasEnabled);
      }
    }
  });

  for (const rateCase of rateCases) {
    test(`calculates Regular Rate with weekend surcharge for ${rateCase.nights} night(s)`, async ({
      onlineBookingPage,
      setupDb,
      ssoLoginPage,
      findReservationPage,
      reservationPage,
    }) => {
      await configureRegularRate(setupDb);
      await setupDb.setPGAuthorizeNet();
      await setupDb.setDepositFullAmount();

      await onlineBookingPage.openHome();
      await onlineBookingPage.selectNextAvailableStay(rateCase.nights);
      await onlineBookingPage.clickSearchButton();
      await onlineBookingPage.clickFirstBookButton();

      await onlineBookingPage.verifySelectedBookingDetails(
        rateCase.nights,
        rateCase.roomTotal,
      );

      await onlineBookingPage.clickCompleteBookingButton();
      await onlineBookingPage.verifyRegistrationTotals(
        rateCase.roomTotal,
        null,
        rateCase.grandTotal,
      );

      await onlineBookingPage.enterGuestDetails();
      await onlineBookingPage.enterAuthorizeNetCardDetailsIfRequired();
      await onlineBookingPage.clickCompleteBookButton();
      await onlineBookingPage.verifyThankYouTotals(
        rateCase.roomTotal,
        null,
        rateCase.grandTotal,
      );

      const confirmationNumber =
        await onlineBookingPage.getConfirmationNumber();
      reservations.set(test.info(), confirmationNumber);

      const user = SSOUsers.UserAdmin;
      await ssoLoginPage.propertyLogin(
        user.propertyShortName,
        user.loginName,
        user.password,
      );
      await findReservationPage.openReservation(confirmationNumber);
      await reservationPage.verifyBookingSummaryRoomTotal(rateCase.roomTotal);
      await reservationPage.verifyBookingSummaryTax(rateCase.taxTotal);
      await reservationPage.verifyBookingSummaryPostTaxTotal(
        rateCase.grandTotal,
      );
      await reservationPage.verifyBookingSummaryAmountPaid(rateCase.grandTotal);
    });
  }

  for (const nights of [1, 2]) {
    test(`calculates Seasonal Rate with seasonal weekend surcharge for ${nights} night(s)`, async ({
      onlineBookingPage,
      setupDb,
      ssoLoginPage,
      findReservationPage,
      reservationPage,
    }) => {
      const seasonalBase = 10;
      const weekendSurcharge = RandomDataUtils.randomNumber(5, 15);
      const roomTotal = ((seasonalBase + weekendSurcharge) * nights).toFixed(2);
      const taxTotal = (Number(roomTotal) * 0.05).toFixed(2);
      const grandTotal = (Number(roomTotal) + Number(taxTotal)).toFixed(2);
      await configureSeasonalRate(setupDb, weekendSurcharge);
      await setupDb.setPGAuthorizeNet();
      await setupDb.setDepositFullAmount();

      await onlineBookingPage.openHome();
      await onlineBookingPage.selectNextAvailableStay(nights);
      await onlineBookingPage.clickSearchButton();
      await onlineBookingPage.clickBookButtonForRoom(
        ConstNames.ROOMTYPE_NAME_SEASONAL_ROOM,
      );
      await onlineBookingPage.clickCompleteBookingButton();
      await onlineBookingPage.verifyRegistrationTotals(
        roomTotal,
        null,
        grandTotal,
      );
      await onlineBookingPage.enterGuestDetails();
      await onlineBookingPage.enterAuthorizeNetCardDetailsIfRequired();
      await onlineBookingPage.clickCompleteBookButton();
      await onlineBookingPage.verifyThankYouTotals(roomTotal, null, grandTotal);

      const confirmationNumber =
        await onlineBookingPage.getConfirmationNumber();
      reservations.set(test.info(), confirmationNumber);
      const user = SSOUsers.UserAdmin;
      await ssoLoginPage.propertyLogin(
        user.propertyShortName,
        user.loginName,
        user.password,
      );
      await findReservationPage.openReservation(confirmationNumber);
      await reservationPage.verifyBookingSummaryRoomTotal(roomTotal);
      await reservationPage.verifyBookingSummaryTax(taxTotal);
      await reservationPage.verifyBookingSummaryPostTaxTotal(grandTotal);
      await reservationPage.verifyBookingSummaryAmountPaid(grandTotal);
    });
  }

  const regularExtraPersonCases = [
    {
      name: "Regular adult EPC",
      nights: 1,
      adults: 3,
      children: 0,
    },
    {
      name: "Regular adult EPC",
      nights: 1,
      adults: 4,
      children: 0,
    },
    {
      name: "Regular adult EPC",
      nights: 2,
      adults: 3,
      children: 0,
    },
    {
      name: "Regular adult EPC",
      nights: 2,
      adults: 4,
      children: 0,
    },
    {
      name: "Regular child EPC",
      nights: 1,
      adults: 2,
      children: 1,
    },
    {
      name: "Regular child EPC",
      nights: 1,
      adults: 2,
      children: 2,
    },
    {
      name: "Regular child EPC",
      nights: 2,
      adults: 2,
      children: 1,
    },
    {
      name: "Regular child EPC",
      nights: 2,
      adults: 2,
      children: 2,
    },
    {
      name: "Regular adult and child EPC",
      nights: 1,
      adults: 3,
      children: 2,
    },
    {
      name: "Regular adult and child EPC",
      nights: 2,
      adults: 3,
      children: 2,
    },
  ];

  for (const rateCase of regularExtraPersonCases) {
    test(`${rateCase.name} for ${rateCase.nights} night(s), ${rateCase.adults} adult(s), ${rateCase.children} child(ren)`, async ({
      onlineBookingPage,
      setupDb,
      ssoLoginPage,
      findReservationPage,
      reservationPage,
    }) => {
      const base = 100;
      const surcharge = RandomDataUtils.randomNumber(5, 15);
      const adultEpc = RandomDataUtils.randomNumber(20, 30);
      const childEpc = RandomDataUtils.randomNumber(10, 20);
      await configureRegularRateWithEpc(setupDb, surcharge, adultEpc, childEpc);
      await setupDb.setPGAuthorizeNet();
      await setupDb.setDepositFullAmount();
      const roomTotal = (
        rateCase.nights *
        (base +
          surcharge +
          Math.max(0, rateCase.adults - 2) * adultEpc +
          rateCase.children * childEpc)
      ).toFixed(2);
      const taxTotal = (Number(roomTotal) * 0.05).toFixed(2);
      const grandTotal = (Number(roomTotal) + Number(taxTotal)).toFixed(2);
      await onlineBookingPage.openHome();
      await onlineBookingPage.setGuestCounts(
        rateCase.adults,
        rateCase.children,
      );
      await onlineBookingPage.selectNextAvailableStay(rateCase.nights);
      await onlineBookingPage.clickSearchButton();
      await onlineBookingPage.clickFirstBookButton();
      await onlineBookingPage.clickCompleteBookingButton();
      await onlineBookingPage.verifyRegistrationTotals(
        roomTotal,
        null,
        grandTotal,
      );
      await onlineBookingPage.enterGuestDetails();
      await onlineBookingPage.enterAuthorizeNetCardDetailsIfRequired();
      await onlineBookingPage.clickCompleteBookButton();
      await onlineBookingPage.verifyThankYouTotals(roomTotal, null, grandTotal);
      const confirmationNumber =
        await onlineBookingPage.getConfirmationNumber();
      reservations.set(test.info(), confirmationNumber);
      const user = SSOUsers.UserAdmin;
      await ssoLoginPage.propertyLogin(
        user.propertyShortName,
        user.loginName,
        user.password,
      );
      await findReservationPage.openReservation(confirmationNumber);
      await reservationPage.verifyBookingSummaryRoomTotal(roomTotal);
      await reservationPage.verifyBookingSummaryTax(taxTotal);
      await reservationPage.verifyBookingSummaryPostTaxTotal(grandTotal);
      await reservationPage.verifyBookingSummaryAmountPaid(grandTotal);
    });
  }

  const seasonalExtraPersonCases = [
    {
      name: "Seasonal adult EPC",
      nights: 1,
      adults: 3,
      children: 0,
    },
    {
      name: "Seasonal adult EPC",
      nights: 2,
      adults: 4,
      children: 0,
    },
    {
      name: "Seasonal child EPC",
      nights: 1,
      adults: 2,
      children: 1,
    },
    {
      name: "Seasonal child EPC",
      nights: 2,
      adults: 2,
      children: 2,
    },
    {
      name: "Seasonal adult and child EPC",
      nights: 1,
      adults: 3,
      children: 2,
    },
    {
      name: "Seasonal adult and child EPC",
      nights: 2,
      adults: 3,
      children: 2,
    },
  ];

  for (const rateCase of seasonalExtraPersonCases) {
    test(`${rateCase.name} for ${rateCase.nights} night(s), ${rateCase.adults} adult(s), ${rateCase.children} child(ren)`, async ({
      onlineBookingPage,
      setupDb,
      ssoLoginPage,
      findReservationPage,
      reservationPage,
    }) => {
      const base = 10;
      const surcharge = RandomDataUtils.randomNumber(5, 15);
      const adultEpc = RandomDataUtils.randomNumber(20, 30);
      const childEpc = RandomDataUtils.randomNumber(10, 20);
      await configureSeasonalRate(setupDb, surcharge, adultEpc, childEpc);
      await setupDb.setPGAuthorizeNet();
      await setupDb.setDepositFullAmount();
      const roomTotal = (
        rateCase.nights *
        (base +
          surcharge +
          Math.max(0, rateCase.adults - 2) * adultEpc +
          rateCase.children * childEpc)
      ).toFixed(2);
      const taxTotal = (Number(roomTotal) * 0.05).toFixed(2);
      const grandTotal = (Number(roomTotal) + Number(taxTotal)).toFixed(2);
      await onlineBookingPage.openHome();
      await onlineBookingPage.setGuestCounts(
        rateCase.adults,
        rateCase.children,
      );
      await onlineBookingPage.selectNextAvailableStay(rateCase.nights);
      await onlineBookingPage.clickSearchButton();
      await onlineBookingPage.clickBookButtonForRoom(
        ConstNames.ROOMTYPE_NAME_SEASONAL_ROOM,
      );
      await onlineBookingPage.clickCompleteBookingButton();
      await onlineBookingPage.verifyRegistrationTotals(
        roomTotal,
        null,
        grandTotal,
      );
      await onlineBookingPage.enterGuestDetails();
      await onlineBookingPage.enterAuthorizeNetCardDetailsIfRequired();
      await onlineBookingPage.clickCompleteBookButton();
      await onlineBookingPage.verifyThankYouTotals(roomTotal, null, grandTotal);
      const confirmationNumber =
        await onlineBookingPage.getConfirmationNumber();
      reservations.set(test.info(), confirmationNumber);
      const user = SSOUsers.UserAdmin;
      await ssoLoginPage.propertyLogin(
        user.propertyShortName,
        user.loginName,
        user.password,
      );
      await findReservationPage.openReservation(confirmationNumber);
      await reservationPage.verifyBookingSummaryRoomTotal(roomTotal);
      await reservationPage.verifyBookingSummaryTax(taxTotal);
      await reservationPage.verifyBookingSummaryPostTaxTotal(grandTotal);
      await reservationPage.verifyBookingSummaryAmountPaid(grandTotal);
    });
  }
});

async function configureRegularRate(
  setupDb: SetupDatabaseHelper,
): Promise<void> {
  const rateName = ConstNames.RATES_NAME_REGULAR_RATE;
  const roomType = ConstNames.ROOMTYPE_NAME_REGULAR_ROOM;

  await setupDb.setPGNoValidation();
  await setupDb.setRateAmount(rateName, 100);
  await setupDb.setRateWeekendAmount(roomType, 20);
  await setupDb.setRateWeekendDaysByRateName(
    rateName,
    "Mon Tue Wed Thu Fri Sat Sun",
  );
  await setupDb.assignRateToRoomType(roomType, rateName);
  await setupDb.assignRateToUnitSetup(roomType, rateName);
  await setupDb.activateAllRoomsOfType(roomType);
  await setupDb.setOnlineRoomByRoomType(roomType, 1);
  await setupDb.setTaxAmount(ConstNames.TAX_NAME_LODGING, 5);
  await setupDb.setTaxAppliedToLodging(ConstNames.TAX_NAME_LODGING, 1);
  await setupDb.setTaxAmount(ConstNames.TAX_NAME_STATE, 0);
  await setupDb.setTaxAppliedToLodging(ConstNames.TAX_NAME_STATE, 1);
}

async function configureSeasonalRate(
  setupDb: SetupDatabaseHelper,
  weekendSurcharge: number,
  adultEpc = 0,
  childEpc = 0,
): Promise<void> {
  const roomType = ConstNames.ROOMTYPE_NAME_SEASONAL_ROOM;
  const rateName = ConstNames.RATES_NAME_SEASONAL_RATE;
  await setupDb.setPGNoValidation();
  await setupDb.setSeasonalRateAmountByRateName(rateName, 10);
  await setupDb.setSeasonalWeekendAmount(
    "2026-01-01",
    "2030-12-31",
    roomType,
    weekendSurcharge,
  );
  await setupDb.setSeasonalWeekendDays(roomType, "Mon Tue Wed Thu Fri Sat Sun");
  await setupDb.setSeasonalEPCAdult("2026-10-01", roomType, adultEpc);
  await setupDb.setSeasonalEPCChild("2026-10-01", roomType, childEpc);
  await setupDb.assignRateToRoomType(roomType, rateName);
  await setupDb.assignRateToUnitSetup(roomType, rateName);
  await setupDb.activateAllRoomsOfType(roomType);
  await setupDb.setOnlineRoomByRoomType(roomType, 1);
  await setupDb.setTaxAmount(ConstNames.TAX_NAME_LODGING, 5);
  await setupDb.setTaxAppliedToLodging(ConstNames.TAX_NAME_LODGING, 1);
  await setupDb.setTaxAmount(ConstNames.TAX_NAME_STATE, 0);
  await setupDb.setTaxAppliedToLodging(ConstNames.TAX_NAME_STATE, 1);
}

async function configureRegularRateWithEpc(
  setupDb: SetupDatabaseHelper,
  weekendSurcharge: number,
  adultEpc: number,
  childEpc: number,
): Promise<void> {
  await configureRegularRate(setupDb);
  const roomType = ConstNames.ROOMTYPE_NAME_ONLINE_ROOM;
  await setupDb.setRateWeekendAmount(roomType, weekendSurcharge);
  await setupDb.setRateEPCAdult(roomType, adultEpc);
  await setupDb.setRateEPCChild(roomType, childEpc);
}
