import { test } from "../../../src/fixtures/sso.fixture";
import { ConstNames } from "../../../src/constants/ConstNames";
import { SSOUsers } from "../../../src/test-data/SSOUsers";

test.describe("Online Booking - Shopping Cart", () => {
  test.setTimeout(90_000);

  test("displays Shopping Cart after a guest selects a room when enabled", async ({
    onlineBookingDb,
    onlineBookingPage,
  }) => {
    const wasShoppingCartEnabled = await onlineBookingDb.getShoppingCartEnabled();

    try {
      await onlineBookingDb.setShoppingCartEnabled(true);

      await onlineBookingPage.openHome();
      await onlineBookingPage.selectNextAvailableStay();
      await onlineBookingPage.clickSearchButton();
      await onlineBookingPage.clickFirstBookButton();
      await onlineBookingPage.clickNextButton();
      await onlineBookingPage.verifyShoppingCartPageIsDisplayed();
    } finally {
      await onlineBookingDb.setShoppingCartEnabled(wasShoppingCartEnabled);
    }
  });

  test("does not display Shopping Cart after a guest selects a room when disabled", async ({
    onlineBookingDb,
    onlineBookingPage,
  }) => {
    const wasShoppingCartEnabled = await onlineBookingDb.getShoppingCartEnabled();

    try {
      await onlineBookingDb.setShoppingCartEnabled(false);

      await onlineBookingPage.openHome();
      await onlineBookingPage.selectNextAvailableStay();
      await onlineBookingPage.clickSearchButton();
      await onlineBookingPage.clickFirstBookButton();
      await onlineBookingPage.clickCompleteBookingButton();
      await onlineBookingPage.verifyShoppingCartPageIsNotDisplayed();
    } finally {
      await onlineBookingDb.setShoppingCartEnabled(wasShoppingCartEnabled);
    }
  });

  test("opens standalone Shopping Cart browsing when enabled", async ({
    onlineBookingDb,
    onlineBookingPage,
  }) => {
    const wasShoppingCartEnabled = await onlineBookingDb.getShoppingCartEnabled();

    try {
      await onlineBookingDb.setShoppingCartEnabled(true);

      await onlineBookingPage.openHome();
      await onlineBookingPage.clickShoppingCartLink();
      await onlineBookingPage.verifyShoppingCartPageIsDisplayed();
    } finally {
      await onlineBookingDb.setShoppingCartEnabled(wasShoppingCartEnabled);
    }
  });

  test("does not display the standalone Shopping Cart link in header when disabled", async ({
    onlineBookingDb,
    onlineBookingPage,
  }) => {
    const wasShoppingCartEnabled = await onlineBookingDb.getShoppingCartEnabled();

    try {
      await onlineBookingDb.setShoppingCartEnabled(false);

      await onlineBookingPage.openHome();
      await onlineBookingPage.verifyShoppingCartLinkIsNotDisplayed();
    } finally {
      await onlineBookingDb.setShoppingCartEnabled(wasShoppingCartEnabled);
    }
  });

  test("shows shopping-cart totals consistently in EWR and PMS", async ({
    onlineBookingDb,
    onlineBookingPage,
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    billingPage,
  }) => {
    test.setTimeout(120_000);
    const itemName = "Bed Cover";
    const roomTotal = "100.00";
    const cartTotal = "29.00";
    const taxTotal = "5.00";
    const grandTotal = "134.00";
    const paymentTotal = "105.00";
    const wasShoppingCartEnabled = await onlineBookingDb.getShoppingCartEnabled();

    try {
      await onlineBookingDb.setShoppingCartEnabled(true);
      await setupDb.disableDepositForAllRates();
      await setupDb.setPGAuthorizeNet();
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
      await setupDb.activateAllRoomsOfType(ConstNames.ROOMTYPE_NAME_ONLINE_ROOM);
      await setupDb.setOnlineRoomByRoomType(ConstNames.ROOMTYPE_NAME_ONLINE_ROOM, 1);
      await setupDb.setTaxAmount(ConstNames.TAX_NAME_LODGING, 5);
      await setupDb.setTaxAppliedToLodging(ConstNames.TAX_NAME_LODGING, 1);
      await setupDb.setTaxAmount(ConstNames.TAX_NAME_STATE, 0);
      await setupDb.setInventoryItemOnlineBooking(itemName, 1);
      await setupDb.setInventoryItemDisabled(itemName, 0);
      await setupDb.setOnlineBookingInventoryItemAmount(itemName, 29);

      await onlineBookingPage.openHome();
      await onlineBookingPage.selectNextAvailableStay();
      await onlineBookingPage.clickSearchButton();
      await onlineBookingPage.clickFirstBookButton();
      await onlineBookingPage.clickNextButton();
      await onlineBookingPage.verifyShoppingCartPageIsDisplayed();
      await onlineBookingPage.selectShoppingCartItem(itemName);
      await onlineBookingPage.verifyShoppingCartTotal(cartTotal);
      await onlineBookingPage.clickProceedToCheckoutButton();
      await onlineBookingPage.verifyRegistrationTotals(roomTotal, cartTotal, grandTotal);
      await onlineBookingPage.enterGuestDetails();
      await onlineBookingPage.enterAuthorizeNetCardDetailsIfRequired();
      await onlineBookingPage.clickCompleteBookButton();
      await onlineBookingPage.verifyThankYouTotals(roomTotal, cartTotal, grandTotal);
      await onlineBookingPage.verifyThankYouAmountPaid(paymentTotal);
      const confirmationNumber = await onlineBookingPage.getConfirmationNumber();

      const user = SSOUsers.UserAdmin;
      await ssoLoginPage.propertyLogin(
        user.propertyShortName,
        user.loginName,
        user.password,
      );
      await findReservationPage.openReservation(confirmationNumber);
      await reservationPage.verifyBookingSummaryRoomTotal(roomTotal);
      await reservationPage.verifyBookingSummaryMisc(cartTotal);
      await reservationPage.verifyBookingSummaryTax(taxTotal);
      await reservationPage.verifyBookingSummaryPostTaxTotal(grandTotal);
      await reservationPage.verifyBookingSummaryAmountPaid(paymentTotal);
      await billingPage.clickBillingTab();
      await billingPage.verifyBillingItemDisplay(ConstNames.BILLING_ROOM_CHARGE_NAME);
      await billingPage.verifyBillingItemDisplay(itemName);
      await billingPage.verifyLineItemChargesAmount(
        ConstNames.BILLING_ROOM_CHARGE_NAME,
        roomTotal,
      );
      await billingPage.verifyLineItemChargesAmount(itemName, cartTotal);
      await billingPage.verifyBillingTotals(grandTotal, paymentTotal, cartTotal);
    } finally {
      await onlineBookingDb.setShoppingCartEnabled(wasShoppingCartEnabled);
    }
  });
});
