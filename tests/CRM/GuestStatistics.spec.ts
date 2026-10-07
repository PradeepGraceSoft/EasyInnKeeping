import { test, expect } from "../../src/fixtures/sso.fixture";
import { AlertMessages } from "../../src/constants/AlertMessages";
import { ConstNames } from "../../src/constants/ConstNames";
import { ConfigManager } from "../../src/utils/ConfigManager";
import { DateUtils } from "../../src/utils/DateUtils";
import { TestDataGenerator } from "../../src/utils/TestDataGenerator";
import { PmsSessionUtils } from "../../src/utils/PmsSessionUtils";
import type { Cookie } from "playwright-core";

const lodgingTaxAmount = 10;
let pmsSessionCookies: Cookie[];

test.describe("Guest Statistics - Loyalty Tier Display", () => {
  test.beforeAll(async ({ browser, setupDb }) => {
    pmsSessionCookies =
      await PmsSessionUtils.createAuthenticatedCookies(browser);
    await setupDb.setTaxAmount(ConstNames.TAX_NAME_LODGING, lodgingTaxAmount);
    await setupDb.setTaxExempt(ConstNames.TAX_NAME_LODGING, 0, 0);
    await setupDb.setTaxAppliedToLodging(ConstNames.TAX_NAME_LODGING, 1);
  });

  test.beforeEach(async ({ context }) => {
    await PmsSessionUtils.restoreCookies(context, pmsSessionCookies);
  });

  test("displays Silver loyalty tier, crown icon, silver color, and points balance", async ({
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();

    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);

    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectFirstAvailableRoomType();
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });

    try {
      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);

      await customerPage.verifyGuestNameAndEmail(firstName, lastName, email);
      await customerPage.verifyLoyaltyTier("Silver", 500, "rgb(166, 166, 166)");
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteCurrentReservation();
      }
    }
  });

  test("calculates total revenue from room, extra-person, and other charges", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    billingPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();

    const roomCharge = 100;
    const extraPersonCharge = 20;
    const otherCharge = 30;
    const includedOccupants = 1;
    const adults = includedOccupants + 1;
    const expectedTotalRevenue = roomCharge + extraPersonCharge + otherCharge;
    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);
    const inventoryAccountCode = await setupDb.requireInventoryItemAccountCode(
      ConstNames.INVENTORY_CHARGES_CHAMPAGNE_DUVET_COVER,
    );

    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE, roomCharge);
    await setupDb.setRateIncludedOccupants(
      ConstNames.ROOMTYPE_NAME_REGULAR_ROOM,
      includedOccupants,
    );
    await setupDb.setRateEPCAdult(
      ConstNames.ROOMTYPE_NAME_REGULAR_ROOM,
      extraPersonCharge,
    );
    await setupDb.setInventoryItemAmount(inventoryAccountCode, otherCharge);

    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.enterNumberOfAdults(String(adults));
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });

    try {
      await billingPage.clickBillingTab();
      await billingPage.enterChargesDiscountAccountCode(inventoryAccountCode);
      await billingPage.clickChargesDiscountSave();

      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);
      await customerPage.verifyTotalRevenue(expectedTotalRevenue);
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteCurrentReservation();
      }
    }
  });

  test("includes inventory-item tax in total revenue", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    billingPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();

    const roomAmount = 100;
    const inventoryAmount = 30;
    const inventoryTaxPercentage = 10;
    const expectedTotalRevenue = roomAmount + inventoryAmount;
    const inventoryName = ConstNames.INVENTORY_CHARGES_CHAMPAGNE_DUVET_COVER;
    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);
    const inventoryAccountCode =
      await setupDb.requireInventoryItemAccountCode(inventoryName);

    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE, roomAmount);
    await setupDb.setInventoryItemAmount(inventoryAccountCode, inventoryAmount);
    await setupDb.setTaxAmount(
      ConstNames.TAX_NAME_INVENTORY_TAX_1,
      inventoryTaxPercentage,
    );
    await setupDb.setTaxExempt(ConstNames.TAX_NAME_INVENTORY_TAX_1, 0, 0);
    await setupDb.setInventoryItemTax1(
      inventoryName,
      ConstNames.TAX_NAME_INVENTORY_TAX_1,
    );

    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });

    try {
      await billingPage.clickBillingTab();
      await billingPage.enterChargesDiscountAccountCode(inventoryAccountCode);
      await billingPage.clickChargesDiscountSave();

      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);
      await customerPage.verifyTotalRevenue(expectedTotalRevenue);
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteCurrentReservation();
      }
    }
  });

  test("excludes reservation discounts and billing payments from total revenue", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    billingPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();

    const roomTotal = 100;
    const discountAmount = "20";
    const paymentAmount = "50.00";
    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);
    const paymentAccountCode = await setupDb.requireInventoryItemAccountCode(
      ConstNames.INVENTORY_PAYMENT_CASH_PAYMENT,
    );

    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE, roomTotal);
    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.addDiscount(
      ConstNames.DISCOUNT_ROOM_DISCOUNT,
      discountAmount,
    );
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });

    try {
      await billingPage.clickBillingTab();
      await billingPage.enterPaymentRefundAccountCode(paymentAccountCode);
      await billingPage.enterPaymentAmountTextBox(paymentAmount);
      await billingPage.clickPaymentRefundSaveButton();
      await reservationPage.verifyAlertMessage(
        AlertMessages.BILLING_SAVED_SUCCESS,
      );

      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);
      await customerPage.verifyTotalRevenue(roomTotal);
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteCurrentReservation();
      }
    }
  });

  test("calculates room revenue for two rooms with different rates", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();

    const firstRoomAmount = 100;
    const secondRoomAmount = 200;
    const expectedRoomRevenue = firstRoomAmount + secondRoomAmount;
    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);

    expect(firstRoomAmount).not.toBe(secondRoomAmount);
    await setupDb.setRateAmount(
      ConstNames.RATES_NAME_REGULAR_RATE,
      firstRoomAmount,
    );
    await setupDb.setRateAmount(
      ConstNames.RATES_NAME_REGULAR_RATE_TWO,
      secondRoomAmount,
    );

    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.clickAddAnotherRoom();
    await reservationPage.selectSecondRoomType(
      ConstNames.ROOMTYPE_NAME_REGULAR_ROOM_TWO,
    );
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.verifyBookingSummaryRoomTotal(
      expectedRoomRevenue.toFixed(2),
    );
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });

    try {
      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);
      await customerPage.verifyTotalRevenue(expectedRoomRevenue);
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteCurrentReservation();
      }
    }
  });

  test("calculates room revenue for a two-night reservation", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();

    const nightlyRoomRate = 100;
    const numberOfNights = 2;
    const expectedRoomRevenue = nightlyRoomRate * numberOfNights;
    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);

    await setupDb.setRateAmount(
      ConstNames.RATES_NAME_REGULAR_RATE,
      nightlyRoomRate,
    );
    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.enterNumberOfNights(String(numberOfNights));
    await reservationPage.verifyBookingSummaryRoomTotal(
      expectedRoomRevenue.toFixed(2),
    );
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });

    try {
      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);
      await customerPage.verifyTotalRevenue(expectedRoomRevenue);
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteCurrentReservation();
      }
    }
  });

  test("calculates room revenue for two rooms over two nights", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();

    const firstNightlyRoomRate = 100;
    const secondNightlyRoomRate = 200;
    const numberOfNights = 2;
    const expectedRoomRevenue =
      (firstNightlyRoomRate + secondNightlyRoomRate) * numberOfNights;
    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);

    expect(firstNightlyRoomRate).not.toBe(secondNightlyRoomRate);
    await setupDb.setRateAmount(
      ConstNames.RATES_NAME_REGULAR_RATE,
      firstNightlyRoomRate,
    );
    await setupDb.setRateAmount(
      ConstNames.RATES_NAME_REGULAR_RATE_TWO,
      secondNightlyRoomRate,
    );

    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.enterNumberOfNights(String(numberOfNights));
    await reservationPage.clickAddAnotherRoom();
    await reservationPage.selectSecondRoomType(
      ConstNames.ROOMTYPE_NAME_REGULAR_ROOM_TWO,
    );
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.verifyBookingSummaryRoomTotal(
      expectedRoomRevenue.toFixed(2),
    );
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });

    try {
      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);
      await customerPage.verifyTotalRevenue(expectedRoomRevenue);
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteCurrentReservation();
      }
    }
  });

  test("displays guest statistics for a reserved room from a group block", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    billingPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();

    const roomAmount = 100;
    const inventoryAmount = 30;
    const inventoryName = ConstNames.INVENTORY_CHARGES_CHAMPAGNE_DUVET_COVER;
    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);
    const inventoryAccountCode =
      await setupDb.requireInventoryItemAccountCode(inventoryName);

    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE, roomAmount);
    await setupDb.setInventoryItemAmount(inventoryAccountCode, inventoryAmount);
    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectBookingType("Group");
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    const roomName = await reservationPage.getSelectedRoomName();
    const checkInDate = await reservationPage.getArrivalDate();
    const checkOutDate = await reservationPage.getDepartureDate();
    const stayLength = await reservationPage.getNumberOfNights();
    await reservationPage.saveGroupReservationAndVerify();
    const groupCode = await reservationPage.getGroupReservationNumber();
    expect(groupCode).toMatch(/^\d+$/);

    await reservationPage.waitForAlertMessageToClose();
    await reservationPage.clickGroupReserveButton();
    await reservationPage.addDiscount(ConstNames.DISCOUNT_ROOM_DISCOUNT, "20");
    await reservationPage.enterGroupMemberGuestDetails({
      firstName,
      lastName,
      email,
    });
    await reservationPage.enterGroupMemberPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickGroupMemberSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });
    test.info().annotations.push({ type: "group", description: groupCode });

    try {
      await billingPage.clickBillingTab();
      await billingPage.enterChargesDiscountAccountCode(inventoryAccountCode);
      await billingPage.clickChargesDiscountSave();

      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);

      await customerPage.verifyTotalRevenue(roomAmount + inventoryAmount);
      await customerPage.verifyTotalDiscountedStays(1);
      await customerPage.verifyFavoriteRoom(roomName);
      await customerPage.verifyTotalStays(1);
      await customerPage.verifyPurchasedItem(inventoryName);
      await customerPage.verifySpendByStayChart([roomAmount]);
      await customerPage.verifyReservationHistoryCount(1);
      await customerPage.verifyReservationHistory({
        confirmationNumber,
        roomName,
        checkInDate: padDateParts(checkInDate),
        checkOutDate: padDateParts(checkOutDate),
        stayLength: `${stayLength} nights`,
        status: "Booked",
        roomAmount: `USD ${roomAmount.toFixed(2)}`,
      });
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteGroupReservation(groupCode);
      }
    }
  });

  test("aggregates revenue for multiple rooms reserved from a group block", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();

    const firstRoomAmount = 100;
    const secondRoomAmount = 200;
    const expectedTotalRevenue = firstRoomAmount + secondRoomAmount;
    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);

    await setupDb.setRateAmount(
      ConstNames.RATES_NAME_REGULAR_RATE,
      firstRoomAmount,
    );
    await setupDb.setRateAmount(
      ConstNames.RATES_NAME_REGULAR_RATE_TWO,
      secondRoomAmount,
    );
    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
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
    const groupCode = await reservationPage.getGroupReservationNumber();
    expect(groupCode).toMatch(/^\d+$/);
    test.info().annotations.push({ type: "group", description: groupCode });

    await reservationPage.waitForAlertMessageToClose();
    await reservationPage.clickGroupReserveButton();
    await reservationPage.enterGroupMemberGuestDetails({
      firstName,
      lastName,
      email,
    });
    await reservationPage.enterGroupMemberPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickGroupMemberSaveButton();
    const firstConfirmationNumber =
      await reservationPage.getReservationNumber();
    expect(firstConfirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: firstConfirmationNumber,
    });

    await reservationPage.clickCloseButton();
    await reservationPage.clickGroupReserveButton();
    await reservationPage.enterGroupMemberGuestDetails({
      firstName,
      lastName,
      email,
    });
    await reservationPage.enterGroupMemberPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickGroupMemberSaveButton();
    const secondConfirmationNumber =
      await reservationPage.getReservationNumber();
    expect(secondConfirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: secondConfirmationNumber,
    });

    try {
      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);

      await customerPage.verifyTotalRevenue(expectedTotalRevenue);
      await customerPage.verifyTotalStays(2);
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteGroupReservation(groupCode);
      }
    }
  });

  test("displays guest statistics for a guest in a shared reservation", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    billingPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();

    const roomAmount = 100;
    const inventoryAmount = 30;
    const inventoryName = ConstNames.INVENTORY_CHARGES_CHAMPAGNE_DUVET_COVER;
    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);
    const sharedFirstName = TestDataGenerator.firstName().replace(
      /[^a-z]/gi,
      "",
    );
    const sharedLastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const sharedEmail = TestDataGenerator.email(
      sharedFirstName,
      sharedLastName,
    );
    const inventoryAccountCode =
      await setupDb.requireInventoryItemAccountCode(inventoryName);

    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE, roomAmount);
    await setupDb.setInventoryItemAmount(inventoryAccountCode, inventoryAmount);
    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.chooseReservationTypeShared();
    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    const roomName = await reservationPage.getSelectedRoomName();
    const checkInDate = await reservationPage.getArrivalDate();
    const checkOutDate = await reservationPage.getDepartureDate();
    const stayLength = await reservationPage.getNumberOfNights();
    await reservationPage.addDiscount(ConstNames.DISCOUNT_ROOM_DISCOUNT, "20");
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const primaryConfirmationNumber =
      await reservationPage.getReservationNumber();
    expect(primaryConfirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: primaryConfirmationNumber,
    });

    await reservationPage.clickSharedAddGuestOption();
    await reservationPage.enterGuestDetails({
      firstName: sharedFirstName,
      lastName: sharedLastName,
      email: sharedEmail,
    });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();

    await reservationPage.selectSharedGuestOptionByIndex(0);

    let testCompletedSuccessfully = false;
    try {
      await billingPage.clickBillingTab();
      await billingPage.enterChargesDiscountAccountCode(inventoryAccountCode);
      await billingPage.clickChargesDiscountSave();

      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);

      await customerPage.verifyTotalRevenue(roomAmount + inventoryAmount);
      await customerPage.verifyTotalDiscountedStays(1);
      await customerPage.verifyFavoriteRoom(roomName);
      await customerPage.verifyTotalStays(1);
      await customerPage.verifyPurchasedItem(inventoryName);
      await customerPage.verifySpendByStayChart([roomAmount]);
      await customerPage.verifyReservationHistoryCount(1);
      await customerPage.verifyReservationHistory({
        confirmationNumber: primaryConfirmationNumber,
        roomName,
        checkInDate: padDateParts(checkInDate),
        checkOutDate: padDateParts(checkOutDate),
        stayLength: `${stayLength} nights`,
        status: "Booked",
        roomAmount: `USD ${roomAmount.toFixed(2)}`,
      });
      testCompletedSuccessfully = true;
    } finally {
      if (testCompletedSuccessfully) {
        await reservationPage.deleteSharedReservation(
          primaryConfirmationNumber,
        );
      }
    }
  });

  test("marks an existing reservation as a discounted stay after adding a discount", async ({
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();

    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);

    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectFirstAvailableRoomType();
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });

    await reservationPage.addDiscount(ConstNames.DISCOUNT_ROOM_DISCOUNT, "20");
    await reservationPage.clickSaveButton();

    try {
      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);

      await customerPage.verifyTotalDiscountedStays(1);
      await customerPage.verifyDiscountedStayTagInReservationHistory();
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteCurrentReservation();
      }
    }
  });

  test("removes the discounted-stay indicators when an existing discount is removed", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    billingPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();

    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);

    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectFirstAvailableRoomType();
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.addDiscount(ConstNames.DISCOUNT_ROOM_DISCOUNT, "20");
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });

    try {
      await billingPage.clickBillingTab();
      await billingPage.clickDeleteBillingItem(
        ConstNames.DISCOUNT_ROOM_DISCOUNT,
      );
      await billingPage.verifyBillingItemNotDisplayed(
        ConstNames.DISCOUNT_ROOM_DISCOUNT,
      );

      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);
      await customerPage.verifyTotalDiscountedStays(0);
      await customerPage.verifyDiscountedStayTagIsNotInReservationHistory();
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteCurrentReservation();
      }
    }
  });

  test("Identifies the favorite room from reservation history", async ({
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();

    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);

    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectFirstAvailableRoomType();
    await reservationPage.selectFirstRoomFromDropdown();
    const selectedRoomName = await reservationPage.getSelectedRoomName();
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });

    try {
      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);

      await customerPage.verifyFavoriteRoom(selectedRoomName);
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteCurrentReservation();
      }
    }
  });

  test("Increments total stays for a reservation", async ({
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();

    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);

    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectFirstAvailableRoomType();
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });

    try {
      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);

      await customerPage.verifyTotalStays(1);
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteCurrentReservation();
      }
    }
  });

  test("excludes a cancelled discounted reservation from total stays and discounted stays", async ({
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();

    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);

    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectFirstAvailableRoomType();
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.addDiscount(ConstNames.DISCOUNT_ROOM_DISCOUNT, "20");
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });

    try {
      await reservationPage.clickCancelButton();
      await reservationPage.verifyCancellationChargePopupDisplayed();
      await reservationPage.clickCancelReservation();
      await reservationPage.verifyAlertMessage(
        AlertMessages.RESERVATION_CANCELLED_SUCCESS,
      );

      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);

      await customerPage.verifyTotalStays(0);
      await customerPage.verifyTotalDiscountedStays(0);
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteCurrentReservation();
      }
    }
  });

  test("Displays purchased inventory in the guest purchase history", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    billingPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();

    const inventoryName = ConstNames.INVENTORY_CHARGES_CHAMPAGNE_DUVET_COVER;
    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);
    const inventoryAccountCode =
      await setupDb.requireInventoryItemAccountCode(inventoryName);

    await setupDb.setInventoryItemAmount(inventoryAccountCode, 30);
    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectFirstAvailableRoomType();
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });

    try {
      await billingPage.clickBillingTab();
      await billingPage.enterChargesDiscountAccountCode(inventoryAccountCode);
      await billingPage.clickChargesDiscountSave();

      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);

      await customerPage.verifyPurchasedItem(inventoryName);
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteCurrentReservation();
      }
    }
  });

  test("Displays complete reservation details in reservation history", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();

    const roomAmount = 100;
    const notes = "Completed reservation history notes";
    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);

    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE, roomAmount);
    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    const roomName = await reservationPage.getSelectedRoomName();
    const checkInDate = await reservationPage.getArrivalDate();
    const checkOutDate = await reservationPage.getDepartureDate();
    const stayLength = await reservationPage.getNumberOfNights();
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterNotes(notes);
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });

    try {
      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);
      await customerPage.verifyReservationHistory({
        confirmationNumber,
        roomName,
        checkInDate: padDateParts(checkInDate),
        checkOutDate: padDateParts(checkOutDate),
        stayLength: `${stayLength} nights`,
        status: "Booked",
        roomAmount: `USD ${roomAmount.toFixed(2)}`,
        notes,
      });
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteCurrentReservation();
      }
    }
  });

  test("aggregates revenue across multiple reservations with room, extra-person, and inventory charges", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    billingPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();

    const roomAmount = 100;
    const extraPersonCharge = 20;
    const inventoryAmount = 30;
    const inventoryName = ConstNames.INVENTORY_CHARGES_CHAMPAGNE_DUVET_COVER;
    const firstReservationNotes = "First reservation notes";
    const secondReservationNotes = "Second reservation notes";
    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);
    const inventoryAccountCode =
      await setupDb.requireInventoryItemAccountCode(inventoryName);

    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE, roomAmount);
    await setupDb.setRateIncludedOccupants(
      ConstNames.ROOMTYPE_NAME_REGULAR_ROOM,
      1,
    );
    await setupDb.setRateEPCAdult(
      ConstNames.ROOMTYPE_NAME_REGULAR_ROOM,
      extraPersonCharge,
    );
    await setupDb.setTaxAmount(ConstNames.TAX_NAME_LODGING, lodgingTaxAmount);
    await setupDb.setTaxExempt(ConstNames.TAX_NAME_LODGING, 0, 0);
    await setupDb.setTaxAppliedToLodging(ConstNames.TAX_NAME_LODGING, 1);
    await setupDb.setTaxAmount(ConstNames.TAX_NAME_STATE, 0);
    await setupDb.setTaxExempt(ConstNames.TAX_NAME_STATE, 0, 0);
    await setupDb.setTaxAppliedToLodging(ConstNames.TAX_NAME_STATE, 0);
    await setupDb.setInventoryItemAmount(inventoryAccountCode, inventoryAmount);

    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.enterArrivalDateBeforeRoomSelection(
      DateUtils.addDaysMdYYYY(10),
    );
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.enterNumberOfAdults("2");
    const firstRoomName = await reservationPage.getSelectedRoomName();
    const firstCheckInDate = await reservationPage.getArrivalDate();
    const firstCheckOutDate = await reservationPage.getDepartureDate();
    const firstStayLength = await reservationPage.getNumberOfNights();
    await reservationPage.addDiscount(ConstNames.DISCOUNT_ROOM_DISCOUNT, "20");
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterNotes(firstReservationNotes);
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const firstConfirmationNumber =
      await reservationPage.getReservationNumber();
    expect(firstConfirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: firstConfirmationNumber,
    });

    await billingPage.clickBillingTab();
    await billingPage.enterChargesDiscountAccountCode(inventoryAccountCode);
    await billingPage.clickChargesDiscountSave();
    await reservationPage.clickCloseButton();

    await findReservationPage.addNewReservation();
    await reservationPage.enterArrivalDateBeforeRoomSelection(
      DateUtils.addDaysMdYYYY(12),
    );
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    const secondRoomName = await reservationPage.getSelectedRoomName();
    const secondCheckInDate = await reservationPage.getArrivalDate();
    const secondCheckOutDate = await reservationPage.getDepartureDate();
    const secondStayLength = await reservationPage.getNumberOfNights();
    expect(secondRoomName).toBe(firstRoomName);
    await reservationPage.addDiscount(ConstNames.DISCOUNT_ROOM_DISCOUNT, "20");
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterNotes(secondReservationNotes);
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const secondConfirmationNumber =
      await reservationPage.getReservationNumber();
    expect(secondConfirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: secondConfirmationNumber,
    });

    try {
      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);

      await customerPage.verifyGuestNameAndEmail(firstName, lastName, email);
      await customerPage.verifyLoyaltyTier("Silver", 1000);
      await customerPage.verifyTotalRevenue(
        roomAmount * 2 + extraPersonCharge + inventoryAmount,
      );
      await customerPage.verifyTotalDiscountedStays(2);
      await customerPage.verifyFavoriteRoom(firstRoomName);
      await customerPage.verifyTotalStays(2);
      await customerPage.verifyPurchasedItem(inventoryName);
      await customerPage.verifyReservationHistoryCount(2);
      await customerPage.verifyReservationHistory({
        confirmationNumber: firstConfirmationNumber,
        roomName: firstRoomName,
        checkInDate: padDateParts(firstCheckInDate),
        checkOutDate: padDateParts(firstCheckOutDate),
        stayLength: `${firstStayLength} nights`,
        status: "Booked",
        roomAmount: `USD ${roomAmount.toFixed(2)}`,
        notes: firstReservationNotes,
      });
      await customerPage.verifyReservationHistory({
        confirmationNumber: secondConfirmationNumber,
        roomName: secondRoomName,
        checkInDate: padDateParts(secondCheckInDate),
        checkOutDate: padDateParts(secondCheckOutDate),
        stayLength: `${secondStayLength} nights`,
        status: "Booked",
        roomAmount: `USD ${roomAmount.toFixed(2)}`,
        notes: secondReservationNotes,
      });
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteCurrentReservation();
        await reservationPage.deleteCurrentReservation();
      }
    }
  });

  test("updates guest statistics when a reservation room rate is modified", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();

    const originalRoomAmount = 100;
    const updatedRoomAmount = 150;
    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);

    await setupDb.setRateAmount(
      ConstNames.RATES_NAME_REGULAR_RATE,
      originalRoomAmount,
    );
    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    const roomName = await reservationPage.getSelectedRoomName();
    const checkInDate = await reservationPage.getArrivalDate();
    const checkOutDate = await reservationPage.getDepartureDate();
    const stayLength = await reservationPage.getNumberOfNights();
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });

    try {
      await reservationPage.clickEditRoomRate();
      await reservationPage.enterEditedRoomRate(updatedRoomAmount.toFixed(2));
      await reservationPage.clickSaveEditedRoomRate();
      await reservationPage.clickSaveButton();

      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);
      await customerPage.verifyTotalRevenue(updatedRoomAmount);
      await customerPage.verifyReservationHistory({
        confirmationNumber,
        roomName,
        checkInDate: padDateParts(checkInDate),
        checkOutDate: padDateParts(checkOutDate),
        stayLength: `${stayLength} nights`,
        status: "Booked",
        roomAmount: `USD ${updatedRoomAmount.toFixed(2)}`,
      });
      await customerPage.verifySpendByStayChart([updatedRoomAmount]);
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteCurrentReservation();
      }
    }
  });

  test("updates favorite room and reservation history when a room is changed", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();

    const roomAmount = 100;
    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);

    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE, roomAmount);
    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    const checkInDate = await reservationPage.getArrivalDate();
    const checkOutDate = await reservationPage.getDepartureDate();
    const stayLength = await reservationPage.getNumberOfNights();
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });

    try {
      await reservationPage.selectAnotherAvailableRoomFromDropdown();
      const updatedRoomName = await reservationPage.getSelectedRoomName();
      await reservationPage.clickSaveButton();

      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);
      await customerPage.verifyFavoriteRoom(updatedRoomName);
      await customerPage.verifyReservationHistory({
        confirmationNumber,
        roomName: updatedRoomName,
        checkInDate: padDateParts(checkInDate),
        checkOutDate: padDateParts(checkOutDate),
        stayLength: `${stayLength} nights`,
        status: "Booked",
        roomAmount: `USD ${roomAmount.toFixed(2)}`,
      });
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteCurrentReservation();
      }
    }
  });

  test("updates guest statistics when a second room is added to an existing reservation", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();

    const firstRoomAmount = 100;
    const secondRoomAmount = 200;
    const expectedTotalRevenue = firstRoomAmount + secondRoomAmount;
    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);

    await setupDb.setRateAmount(
      ConstNames.RATES_NAME_REGULAR_RATE,
      firstRoomAmount,
    );
    await setupDb.setRateAmount(
      ConstNames.RATES_NAME_REGULAR_RATE_TWO,
      secondRoomAmount,
    );
    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    const firstRoomName = await reservationPage.getSelectedRoomName();
    const checkInDate = await reservationPage.getArrivalDate();
    const checkOutDate = await reservationPage.getDepartureDate();
    const stayLength = await reservationPage.getNumberOfNights();
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });

    try {
      await reservationPage.clickAddAnotherRoom();
      await reservationPage.selectSecondRoomType(
        ConstNames.ROOMTYPE_NAME_REGULAR_ROOM_TWO,
      );
      await reservationPage.selectFirstRoomFromDropdown();
      await reservationPage.clickSaveButton();

      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);
      await customerPage.verifyTotalRevenue(expectedTotalRevenue);
      await customerPage.verifyReservationHistoryCount(2);
      await customerPage.verifyReservationHistory({
        confirmationNumber,
        roomName: firstRoomName,
        checkInDate: padDateParts(checkInDate),
        checkOutDate: padDateParts(checkOutDate),
        stayLength: `${stayLength} nights`,
        status: "Booked",
        roomAmount: `USD ${firstRoomAmount.toFixed(2)}`,
      });
      await customerPage.verifySpendByStayChart([expectedTotalRevenue]);
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteCurrentReservation();
      }
    }
  });

  test("updates total revenue and history after removing a room from a multi-room reservation", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();
    const firstRoomAmount = 100;
    const secondRoomAmount = 200;
    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);
    await setupDb.setRateAmount(
      ConstNames.RATES_NAME_REGULAR_RATE,
      firstRoomAmount,
    );
    await setupDb.setRateAmount(
      ConstNames.RATES_NAME_REGULAR_RATE_TWO,
      secondRoomAmount,
    );
    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    const roomName = await reservationPage.getSelectedRoomName();
    const checkInDate = await reservationPage.getArrivalDate();
    const checkOutDate = await reservationPage.getDepartureDate();
    const stayLength = await reservationPage.getNumberOfNights();
    await reservationPage.clickAddAnotherRoom();
    await reservationPage.selectSecondRoomType(
      ConstNames.ROOMTYPE_NAME_REGULAR_ROOM_TWO,
    );
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });
    try {
      await reservationPage.deleteRoomByRoomTypeName(
        ConstNames.ROOMTYPE_NAME_REGULAR_ROOM_TWO,
      );
      await reservationPage.clickSaveButton();
      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);
      await customerPage.verifyTotalRevenue(firstRoomAmount);
      await customerPage.verifyReservationHistory({
        confirmationNumber,
        roomName,
        checkInDate: padDateParts(checkInDate),
        checkOutDate: padDateParts(checkOutDate),
        stayLength: `${stayLength} nights`,
        status: "Booked",
        roomAmount: `USD ${firstRoomAmount.toFixed(2)}`,
      });
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteCurrentReservation();
      }
    }
  });

  test("updates revenue, stay details, history, and chart when the number of nights changes", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();
    const nightlyRoomAmount = 100;
    const updatedNights = 2;
    const expectedRevenue = nightlyRoomAmount * updatedNights;
    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);
    await setupDb.setRateAmount(
      ConstNames.RATES_NAME_REGULAR_RATE,
      nightlyRoomAmount,
    );
    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    const roomName = await reservationPage.getSelectedRoomName();
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });
    try {
      await reservationPage.enterNumberOfNights(String(updatedNights));
      const updatedCheckInDate = await reservationPage.getArrivalDate();
      const updatedCheckOutDate = await reservationPage.getDepartureDate();
      const updatedStayLength = await reservationPage.getNumberOfNights();
      await reservationPage.clickSaveButton();
      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);
      await customerPage.verifyTotalRevenue(expectedRevenue);
      await customerPage.verifyReservationHistory({
        confirmationNumber,
        roomName,
        checkInDate: padDateParts(updatedCheckInDate),
        checkOutDate: padDateParts(updatedCheckOutDate),
        stayLength: `${updatedStayLength} nights`,
        status: "Booked",
        roomAmount: `USD ${expectedRevenue.toFixed(2)}`,
      });
      await customerPage.verifySpendByStayChart([expectedRevenue]);
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteCurrentReservation();
      }
    }
  });

  test("updates extra-person revenue when the number of adults changes", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();
    const roomAmount = 100;
    const extraPersonCharge = 20;
    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);
    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE, roomAmount);
    await setupDb.setRateIncludedOccupants(
      ConstNames.ROOMTYPE_NAME_REGULAR_ROOM,
      1,
    );
    await setupDb.setRateEPCAdult(
      ConstNames.ROOMTYPE_NAME_REGULAR_ROOM,
      extraPersonCharge,
    );
    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });
    try {
      await reservationPage.enterNumberOfAdults("2");
      await reservationPage.clickSaveButton();
      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);
      await customerPage.verifyTotalRevenue(roomAmount + extraPersonCharge);
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteCurrentReservation();
      }
    }
  });

  test("updates total revenue and favorite items when inventory is added through billing", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    billingPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();
    const roomAmount = 100;
    const inventoryAmount = 30;
    const inventoryName = ConstNames.INVENTORY_CHARGES_CHAMPAGNE_DUVET_COVER;
    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);
    const accountCode =
      await setupDb.requireInventoryItemAccountCode(inventoryName);
    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE, roomAmount);
    await setupDb.setInventoryItemAmount(accountCode, inventoryAmount);
    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });
    try {
      await billingPage.clickBillingTab();
      await billingPage.enterChargesDiscountAccountCode(accountCode);
      await billingPage.clickChargesDiscountSave();
      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);
      await customerPage.verifyTotalRevenue(roomAmount + inventoryAmount);
      await customerPage.verifyPurchasedItem(inventoryName);
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteCurrentReservation();
      }
    }
  });

  test("updates total revenue when an existing billing inventory charge is edited", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    billingPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();
    const roomAmount = 100;
    const originalInventoryAmount = 30;
    const updatedInventoryAmount = 50;
    const inventoryName = ConstNames.INVENTORY_CHARGES_CHAMPAGNE_DUVET_COVER;
    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);
    const accountCode =
      await setupDb.requireInventoryItemAccountCode(inventoryName);
    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE, roomAmount);
    await setupDb.setInventoryItemAmount(accountCode, originalInventoryAmount);
    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });
    try {
      await billingPage.clickBillingTab();
      await billingPage.enterChargesDiscountAccountCode(accountCode);
      await billingPage.clickChargesDiscountSave();
      await billingPage.clickEditBillingItem(inventoryName);
      await billingPage.enterChargesDiscountAmountTextbox(
        updatedInventoryAmount.toFixed(2),
      );
      await billingPage.clickChargesDiscountSave();
      await billingPage.verifyLineItemChargesAmount(
        inventoryName,
        updatedInventoryAmount.toFixed(2),
      );
      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);
      await customerPage.verifyTotalRevenue(
        roomAmount + updatedInventoryAmount,
      );
      await customerPage.verifyPurchasedItem(inventoryName);
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteCurrentReservation();
      }
    }
  });

  test("removes inventory from guest statistics when a billing charge is deleted", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    billingPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();
    const roomAmount = 100;
    const inventoryAmount = 30;
    const inventoryName = ConstNames.INVENTORY_CHARGES_CHAMPAGNE_DUVET_COVER;
    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);
    const accountCode =
      await setupDb.requireInventoryItemAccountCode(inventoryName);
    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE, roomAmount);
    await setupDb.setInventoryItemAmount(accountCode, inventoryAmount);
    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });
    try {
      await billingPage.clickBillingTab();
      await billingPage.enterChargesDiscountAccountCode(accountCode);
      await billingPage.clickChargesDiscountSave();
      await billingPage.clickDeleteBillingItem(inventoryName);
      await billingPage.verifyBillingItemNotDisplayed(inventoryName);
      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);
      await customerPage.verifyTotalRevenue(roomAmount);
      await customerPage.verifyPurchasedItemIsNotDisplayed(inventoryName);
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteCurrentReservation();
      }
    }
  });

  test("reflects added, edited, and removed reservation notes in history", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();
    const roomAmount = 100;
    const addedNote = "Initial reservation note";
    const updatedNote = "Updated reservation note";
    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);
    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE, roomAmount);
    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    const roomName = await reservationPage.getSelectedRoomName();
    const checkInDate = await reservationPage.getArrivalDate();
    const checkOutDate = await reservationPage.getDepartureDate();
    const stayLength = await reservationPage.getNumberOfNights();
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });
    try {
      await reservationPage.enterNotes(addedNote);
      await reservationPage.clickSaveButton();
      await reservationPage.enterNotes(updatedNote);
      await reservationPage.clickSaveButton();
      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);
      await customerPage.verifyReservationHistory({
        confirmationNumber,
        roomName,
        checkInDate: padDateParts(checkInDate),
        checkOutDate: padDateParts(checkOutDate),
        stayLength: `${stayLength} nights`,
        status: "Booked",
        roomAmount: `USD ${roomAmount.toFixed(2)}`,
        notes: updatedNote,
      });
      await customerPage.clickCloseGuestStatistics();
      await ssoLoginPage.propertyLogin(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await findReservationPage.openReservation(confirmationNumber);
      await reservationPage.verifyNotes(updatedNote);
      await reservationPage.enterNotes("");
      await reservationPage.clickSaveButton();
      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);
      await customerPage.verifyReservationHistoryNotesAreNotDisplayed();
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteCurrentReservation();
      }
    }
  });

  test("updates history and revenue when check-in and checkout dates change", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();
    const nightlyRoomAmount = 100;
    const updatedCheckInDate = DateUtils.addDaysMdYYYY(10);
    const updatedCheckOutDate = DateUtils.addDaysMdYYYY(12);
    const expectedRevenue = nightlyRoomAmount * 2;
    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);
    await setupDb.setRateAmount(
      ConstNames.RATES_NAME_REGULAR_RATE,
      nightlyRoomAmount,
    );
    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    const roomName = await reservationPage.getSelectedRoomName();
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });
    try {
      await reservationPage.clickRoomSelectionEnableEdit();
      await reservationPage.enterArrivalDate(updatedCheckInDate);
      await reservationPage.enterDepartureDate(updatedCheckOutDate);
      const stayLength = await reservationPage.getNumberOfNights();
      await reservationPage.clickSaveButton();
      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);
      await customerPage.verifyTotalRevenue(expectedRevenue);
      await customerPage.verifyReservationHistory({
        confirmationNumber,
        roomName,
        checkInDate: padDateParts(updatedCheckInDate),
        checkOutDate: padDateParts(updatedCheckOutDate),
        stayLength: `${stayLength} nights`,
        status: "Booked",
        roomAmount: `USD ${expectedRevenue.toFixed(2)}`,
      });
      await customerPage.verifySpendByStayChart([expectedRevenue]);
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteCurrentReservation();
      }
    }
  });

  test("displays guest statistics under updated guest profile details", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();
    const roomAmount = 100;
    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);
    const updatedFirstName = `${firstName}Updated`;
    const updatedLastName = `${lastName}Updated`;
    const updatedEmail = TestDataGenerator.email(
      updatedFirstName,
      updatedLastName,
    );
    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE, roomAmount);
    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });
    try {
      await reservationPage.enterGuestDetails({
        firstName: updatedFirstName,
        lastName: updatedLastName,
        email: updatedEmail,
      });
      await reservationPage.clickSaveButton();
      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(updatedEmail);
      await customerPage.clickGuestStatistics(
        updatedFirstName,
        updatedLastName,
      );
      await customerPage.verifyGuestNameAndEmail(
        updatedFirstName,
        updatedLastName,
        updatedEmail,
      );
      await customerPage.verifyTotalRevenue(roomAmount);
      await customerPage.verifyTotalStays(1);
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteCurrentReservation();
      }
    }
  });

  test("moves guest statistics from the original guest to a reassigned guest", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();
    const roomAmount = 100;
    const credentials = ConfigManager.testData;
    const originalFirstName = TestDataGenerator.firstName().replace(
      /[^a-z]/gi,
      "",
    );
    const originalLastName = TestDataGenerator.lastName().replace(
      /[^a-z]/gi,
      "",
    );
    const originalEmail = TestDataGenerator.email(
      originalFirstName,
      originalLastName,
    );
    const newFirstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const newLastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const newEmail = TestDataGenerator.email(newFirstName, newLastName);
    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE, roomAmount);
    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.enterGuestDetails({
      firstName: originalFirstName,
      lastName: originalLastName,
      email: originalEmail,
    });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });
    try {
      await reservationPage.enterGuestDetails({
        firstName: newFirstName,
        lastName: newLastName,
        email: newEmail,
      });
      await reservationPage.clickSaveButton();
      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(originalEmail);
      await customerPage.clickGuestStatistics(
        originalFirstName,
        originalLastName,
      );
      await customerPage.verifyTotalRevenue(0);
      await customerPage.verifyTotalStays(0);
      await customerPage.clickCloseGuestStatistics();
      await customerPage.enterSearchKeyword(newEmail);
      await customerPage.clickGuestStatistics(newFirstName, newLastName);
      await customerPage.verifyGuestNameAndEmail(
        newFirstName,
        newLastName,
        newEmail,
      );
      await customerPage.verifyTotalRevenue(roomAmount);
      await customerPage.verifyTotalStays(1);
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteCurrentReservation();
      }
    }
  });

  test("includes guest statistics again after restoring a cancelled reservation", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();
    const roomAmount = 100;
    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);
    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE, roomAmount);
    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });
    try {
      await reservationPage.clickCancelButton();
      await reservationPage.clickCancelReservation();
      await reservationPage.clickRestoreReservation();
      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);
      await customerPage.verifyTotalRevenue(roomAmount);
      await customerPage.verifyTotalStays(1);
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteCurrentReservation();
      }
    }
  });

  test("attributes statistics to both guests after converting a regular reservation to shared", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();
    const roomAmount = 100;
    const credentials = ConfigManager.testData;
    const primaryFirstName = TestDataGenerator.firstName().replace(
      /[^a-z]/gi,
      "",
    );
    const primaryLastName = TestDataGenerator.lastName().replace(
      /[^a-z]/gi,
      "",
    );
    const primaryEmail = TestDataGenerator.email(
      primaryFirstName,
      primaryLastName,
    );
    const secondaryFirstName = TestDataGenerator.firstName().replace(
      /[^a-z]/gi,
      "",
    );
    const secondaryLastName = TestDataGenerator.lastName().replace(
      /[^a-z]/gi,
      "",
    );
    const secondaryEmail = TestDataGenerator.email(
      secondaryFirstName,
      secondaryLastName,
    );
    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE, roomAmount);
    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.enterGuestDetails({
      firstName: primaryFirstName,
      lastName: primaryLastName,
      email: primaryEmail,
    });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });
    try {
      await reservationPage.selectBookingType("Shared");
      await reservationPage.clickSharedAddGuestOption();
      await reservationPage.enterGuestDetails({
        firstName: secondaryFirstName,
        lastName: secondaryLastName,
        email: secondaryEmail,
      });
      await reservationPage.enterPaymentMethod(
        ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
      );
      await reservationPage.clickSaveButton();
      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(primaryEmail);
      await customerPage.clickGuestStatistics(
        primaryFirstName,
        primaryLastName,
      );
      await customerPage.verifyTotalStays(1);
      await customerPage.clickCloseGuestStatistics();
      await customerPage.enterSearchKeyword(secondaryEmail);
      await customerPage.clickGuestStatistics(
        secondaryFirstName,
        secondaryLastName,
      );
      await customerPage.verifyTotalStays(1);
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteSharedReservation(confirmationNumber);
      }
    }
  });

  test("keeps shared-reservation statistics with the correct guest after updating a secondary guest", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();
    const roomAmount = 100;
    const credentials = ConfigManager.testData;
    const primaryFirstName = TestDataGenerator.firstName().replace(
      /[^a-z]/gi,
      "",
    );
    const primaryLastName = TestDataGenerator.lastName().replace(
      /[^a-z]/gi,
      "",
    );
    const primaryEmail = TestDataGenerator.email(
      primaryFirstName,
      primaryLastName,
    );
    const secondaryFirstName = TestDataGenerator.firstName().replace(
      /[^a-z]/gi,
      "",
    );
    const secondaryLastName = TestDataGenerator.lastName().replace(
      /[^a-z]/gi,
      "",
    );
    const secondaryEmail = TestDataGenerator.email(
      secondaryFirstName,
      secondaryLastName,
    );
    const updatedSecondaryFirstName = `${secondaryFirstName}Updated`;
    const updatedSecondaryLastName = `${secondaryLastName}Updated`;
    const updatedSecondaryEmail = TestDataGenerator.email(
      updatedSecondaryFirstName,
      updatedSecondaryLastName,
    );
    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE, roomAmount);
    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectBookingType("Shared");
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.enterGuestDetails({
      firstName: primaryFirstName,
      lastName: primaryLastName,
      email: primaryEmail,
    });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });
    try {
      await reservationPage.clickSharedAddGuestOption();
      await reservationPage.enterGuestDetails({
        firstName: secondaryFirstName,
        lastName: secondaryLastName,
        email: secondaryEmail,
      });
      await reservationPage.enterPaymentMethod(
        ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
      );
      await reservationPage.clickSaveButton();
      await reservationPage.selectSharedGuestOptionByIndex(1);
      await reservationPage.enterGuestDetails({
        firstName: updatedSecondaryFirstName,
        lastName: updatedSecondaryLastName,
        email: updatedSecondaryEmail,
      });
      await reservationPage.enterPaymentMethod(
        ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
      );
      await reservationPage.clickSaveButton();
      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(primaryEmail);
      await customerPage.clickGuestStatistics(
        primaryFirstName,
        primaryLastName,
      );
      await customerPage.verifyTotalStays(1);
      await customerPage.clickCloseGuestStatistics();
      await customerPage.enterSearchKeyword(updatedSecondaryEmail);
      await customerPage.clickGuestStatistics(
        updatedSecondaryFirstName,
        updatedSecondaryLastName,
      );
      await customerPage.verifyTotalStays(1);
      await customerPage.verifyTotalRevenue(roomAmount);
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteSharedReservation(confirmationNumber);
      }
    }
  });

  test("updates a group member discount and billing charge in guest statistics", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    billingPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();
    const roomAmount = 100;
    const inventoryAmount = 30;
    const inventoryName = ConstNames.INVENTORY_CHARGES_CHAMPAGNE_DUVET_COVER;
    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);
    const accountCode =
      await setupDb.requireInventoryItemAccountCode(inventoryName);
    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE, roomAmount);
    await setupDb.setInventoryItemAmount(accountCode, inventoryAmount);
    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectBookingType("Group");
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.saveGroupReservationAndVerify();
    const groupCode = await reservationPage.getGroupReservationNumber();
    expect(groupCode).toMatch(/^\d+$/);
    test.info().annotations.push({ type: "group", description: groupCode });
    await reservationPage.waitForAlertMessageToClose();
    await reservationPage.clickGroupReserveButton();
    await reservationPage.enterGroupMemberGuestDetails({
      firstName,
      lastName,
      email,
    });
    await reservationPage.enterGroupMemberPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickGroupMemberSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });
    try {
      await reservationPage.addDiscount(
        ConstNames.DISCOUNT_ROOM_DISCOUNT,
        "20",
      );
      await reservationPage.clickSaveButton();
      await billingPage.clickBillingTab();
      await billingPage.clickDeleteBillingItem(
        ConstNames.DISCOUNT_ROOM_DISCOUNT,
      );
      await billingPage.enterChargesDiscountAccountCode(accountCode);
      await billingPage.clickChargesDiscountSave();
      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);
      await customerPage.verifyTotalRevenue(roomAmount + inventoryAmount);
      await customerPage.verifyTotalDiscountedStays(0);
      await customerPage.verifyPurchasedItem(inventoryName);
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteGroupReservation(groupCode);
      }
    }
  });

  test("updates reservation history and eligible statistics across status changes", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();
    const roomAmount = 100;
    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);
    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE, roomAmount);
    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    const roomName = await reservationPage.getSelectedRoomName();
    const checkInDate = await reservationPage.getArrivalDate();
    const checkOutDate = await reservationPage.getDepartureDate();
    const stayLength = await reservationPage.getNumberOfNights();
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });
    try {
      await reservationPage.selectReservationStatus("Checked-in");
      await reservationPage.clickSaveButton();
      await reservationPage.verifyAlertMessage(
        AlertMessages.RESERVATION_SAVED_SUCCESS,
      );
      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);
      await customerPage.verifyReservationHistory({
        confirmationNumber,
        roomName,
        checkInDate: padDateParts(checkInDate),
        checkOutDate: padDateParts(checkOutDate),
        stayLength: `${stayLength} nights`,
        status: "Checked-In",
        roomAmount: `USD ${roomAmount.toFixed(2)}`,
      });
      await customerPage.verifyTotalRevenue(roomAmount);
      await customerPage.verifyTotalStays(1);
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteCurrentReservation();
      }
    }
  });

  test("Displays a single reservation in the spend by stay chart", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();

    const roomAmount = 100;
    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);

    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE, roomAmount);
    await setupDb.setTaxAmount(ConstNames.TAX_NAME_LODGING, lodgingTaxAmount);
    await setupDb.setTaxExempt(ConstNames.TAX_NAME_LODGING, 0, 0);
    await setupDb.setTaxAppliedToLodging(ConstNames.TAX_NAME_LODGING, 1);
    await setupDb.setTaxAmount(ConstNames.TAX_NAME_STATE, 0);
    await setupDb.setTaxExempt(ConstNames.TAX_NAME_STATE, 0, 0);
    await setupDb.setTaxAppliedToLodging(ConstNames.TAX_NAME_STATE, 0);

    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const confirmationNumber = await reservationPage.getReservationNumber();
    expect(confirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: confirmationNumber,
    });

    try {
      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);

      await customerPage.verifySpendByStayChart([roomAmount]);
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteCurrentReservation();
      }
    }
  });

  test("Displays multiple reservation amounts in the spend by stay chart", async ({
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();

    const firstRoomAmount = 100;
    const secondRoomAmount = 200;
    const credentials = ConfigManager.testData;
    const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
    const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
    const email = TestDataGenerator.email(firstName, lastName);

    await setupDb.setRateAmount(
      ConstNames.RATES_NAME_REGULAR_RATE,
      firstRoomAmount,
    );
    await setupDb.setRateAmount(
      ConstNames.RATES_NAME_REGULAR_RATE_TWO,
      secondRoomAmount,
    );
    await setupDb.setTaxAmount(ConstNames.TAX_NAME_LODGING, lodgingTaxAmount);
    await setupDb.setTaxExempt(ConstNames.TAX_NAME_LODGING, 0, 0);
    await setupDb.setTaxAppliedToLodging(ConstNames.TAX_NAME_LODGING, 1);
    await setupDb.setTaxAmount(ConstNames.TAX_NAME_STATE, 0);
    await setupDb.setTaxExempt(ConstNames.TAX_NAME_STATE, 0, 0);
    await setupDb.setTaxAppliedToLodging(ConstNames.TAX_NAME_STATE, 0);

    await ssoLoginPage.propertyLogin(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const firstConfirmationNumber =
      await reservationPage.getReservationNumber();
    expect(firstConfirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: firstConfirmationNumber,
    });
    await reservationPage.clickCloseButton();

    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(
      ConstNames.ROOMTYPE_NAME_REGULAR_ROOM_TWO,
    );
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.enterGuestDetails({ firstName, lastName, email });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    const secondConfirmationNumber =
      await reservationPage.getReservationNumber();
    expect(secondConfirmationNumber).toMatch(/^\d+$/);
    test.info().annotations.push({
      type: "reservation",
      description: secondConfirmationNumber,
    });

    try {
      await crmLoginPage.loginToCRM(
        credentials.propertyShortName,
        credentials.loginName,
        credentials.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.enterSearchKeyword(email);
      await customerPage.clickGuestStatistics(firstName, lastName);

      await customerPage.verifySpendByStayChart([
        firstRoomAmount,
        secondRoomAmount,
      ]);
    } catch (error) {
      test.info().annotations.push({ type: "cleanup-skipped" });
      throw error;
    } finally {
      if (
        !test.info().annotations.some(({ type }) => type === "cleanup-skipped")
      ) {
        await reservationPage.deleteCurrentReservation();
        await reservationPage.deleteCurrentReservation();
      }
    }
  });
});

function padDateParts(date: string): string {
  return date
    .split("/")
    .map((part) => part.padStart(2, "0"))
    .join("/");
}
