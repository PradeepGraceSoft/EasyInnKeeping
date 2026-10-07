import { test } from "../../src/fixtures/sso.fixture";
import { AlertMessages } from "../../src/constants/AlertMessages";
import { ConstNames } from "../../src/constants/ConstNames";
import { SSOUsers } from "../../src/test-data/SSOUsers";
import { BillingPage } from "../../src/pages/BillingPage";
import { FindReservationPage } from "../../src/pages/FindReservationPage";
import { ReservationPage } from "../../src/pages/ReservationPage";
import { SetupDatabaseHelper } from "../../src/utils/DBHelper/SetupDatabaseHelper";
import { ConfigManager } from "../../src/utils/ConfigManager";

type PaymentGatewayFixtures = {
  setupDb: SetupDatabaseHelper;
  findReservationPage: FindReservationPage;
  reservationPage: ReservationPage;
  billingPage: BillingPage;
};

type GatewayExpectations = {
  refundAlert?: string;
  paymentVoidAlert?: string;
  authVoidAlert?: string;
  cardNumber?: string;
};

const PAYMENT_STEP_TIMEOUT = 60_000;
const AUTH_AMOUNT_CENTS = String((Date.now() % 89) + 10).padStart(2, "0");

function uniqueAuthAmount(dollars: number): string {
  return `${dollars}.${AUTH_AMOUNT_CENTS}`;
}

function partialCaptureAmount(authorizedAmount: string): string {
  return (Number(authorizedAmount) - 0.01).toFixed(2);
}

test.describe("PaymentProcessing", () => {
  test.beforeEach(async ({ ssoLoginPage, setupDb }) => {
    const user = SSOUsers.UserAdmin;
    await setupDb.setTaxAmount(ConstNames.TAX_NAME_LODGING, 5);
    await setupDb.setTaxExempt(ConstNames.TAX_NAME_LODGING, 0, 0);
    await setupDb.setTaxAppliedToLodging(ConstNames.TAX_NAME_LODGING, 1);
    await setupDb.setTaxAmount(ConstNames.TAX_NAME_STATE, 0);
    await setupDb.setTaxExempt(ConstNames.TAX_NAME_STATE, 0, 0);
    await setupDb.setTaxAppliedToLodging(ConstNames.TAX_NAME_STATE, 0);
    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE, 100);
    await setupDb.ensureCashDrawerOpen();

    await ssoLoginPage.propertyLogin(
      user.propertyShortName,
      user.loginName,
      user.password,
    );
  });

  test.afterEach(async ({ reservationPage }) => {
    await reservationPage.deleteCurrentReservationIfOpen();
  });

  test("Authorize.Net: all payment actions", async ({
    setupDb,
    findReservationPage,
    reservationPage,
    billingPage,
  }) => {
    await runPaymentGatewayTest(
      { setupDb, findReservationPage, reservationPage, billingPage },
      (db) => db.setPGAuthorizeNet(),
      { refundAlert: AlertMessages.RESERVATION_PAYMENT_REFUND_DECLINED },
    );
  });

  test("Shift4 for PMS and EWR", async ({
    setupDb,
    findReservationPage,
    reservationPage,
    billingPage,
  }) => {
    await runPaymentGatewayTest(
      { setupDb, findReservationPage, reservationPage, billingPage },
      (db) => db.setPGShift4(),
      { cardNumber: "4321000000001119" },
    );
  });

  test("Stripe: all payment actions", async ({
    setupDb,
    findReservationPage,
    reservationPage,
    billingPage,
  }) => {
    await runPaymentGatewayTest(
      { setupDb, findReservationPage, reservationPage, billingPage },
      (db) => db.setPGStripe(),
      {
        paymentVoidAlert:
          AlertMessages.RESERVATION_PAYMENT_VOID_REQUIRES_REFUND,
        authVoidAlert: AlertMessages.RESERVATION_PAYMENT_VOID_DECLINED,
      },
    );
  });

  // Current Paystack sandbox configuration cannot initiate a transaction.
  test.fixme("Paystack: all payment actions", async ({
    setupDb,
    findReservationPage,
    reservationPage,
    billingPage,
  }) => {
    await runPaymentGatewayTest(
      { setupDb, findReservationPage, reservationPage, billingPage },
      (db) => db.setPGPaystack(),
    );
  });

  // The configured Cashfree gateway does not expose VisaCard Payment in PMS.
  test.fixme("Cashfree: all payment actions", async ({
    setupDb,
    findReservationPage,
    reservationPage,
    billingPage,
  }) => {
    await runPaymentGatewayTest(
      { setupDb, findReservationPage, reservationPage, billingPage },
      (db) => db.setPGCashfree(),
    );
  });

  // The configured Moneris gateway does not expose the stored-card flow.
  test.fixme("Moneris: all payment actions", async ({
    setupDb,
    findReservationPage,
    reservationPage,
    billingPage,
  }) => {
    await runPaymentGatewayTest(
      { setupDb, findReservationPage, reservationPage, billingPage },
      (db) => db.setPGMoneris(),
    );
  });

  // The configured Square gateway does not expose the stored-card flow.
  test.fixme("Square: all payment actions", async ({
    setupDb,
    findReservationPage,
    reservationPage,
    billingPage,
  }) => {
    await runPaymentGatewayTest(
      { setupDb, findReservationPage, reservationPage, billingPage },
      (db) => db.setPGSquare(),
    );
  });

  // The configured Payroc gateway does not expose the stored-card flow.
  test.fixme("Payroc: all payment actions", async ({
    setupDb,
    findReservationPage,
    reservationPage,
    billingPage,
  }) => {
    await runPaymentGatewayTest(
      { setupDb, findReservationPage, reservationPage, billingPage },
      (db) => db.setPGPayroc(),
    );
  });

  // Current PayPal sandbox configuration cannot initiate a transaction.
  test.fixme("PayPal: all payment actions", async ({
    setupDb,
    findReservationPage,
    reservationPage,
    billingPage,
  }) => {
    await runPaymentGatewayTest(
      { setupDb, findReservationPage, reservationPage, billingPage },
      (db) => db.setPGPaypal(),
    );
  });

  test("USAePay: all payment actions", async ({
    setupDb,
    findReservationPage,
    reservationPage,
    billingPage,
  }) => {
    await runPaymentGatewayTest(
      { setupDb, findReservationPage, reservationPage, billingPage },
      (db) => db.setPGUSAePay(),
    );
  });
});

async function runPaymentGatewayTest(
  {
    setupDb,
    findReservationPage,
    reservationPage,
    billingPage,
  }: PaymentGatewayFixtures,
  configureGateway: (setupDb: SetupDatabaseHelper) => Promise<void>,
  expectations: GatewayExpectations = {},
): Promise<void> {
  test.setTimeout(PAYMENT_STEP_TIMEOUT * 7 + 60_000);
  await configureGateway(setupDb);
  const paymentAccountCode = await setupDb.requireInventoryItemAccountCode(
    ConstNames.INVENTORY_PAYMENT_VISA_PAYMENT,
  );

  const fixtures = { findReservationPage, reservationPage, billingPage };
  const refundAlert =
    expectations.refundAlert ??
    AlertMessages.RESERVATION_PAYMENT_PROCESS_SUCCESS;
  const paymentVoidAlert =
    expectations.paymentVoidAlert ??
    AlertMessages.RESERVATION_PAYMENT_VOIDED_SUCCESS;
  const authVoidAlert =
    expectations.authVoidAlert ??
    AlertMessages.RESERVATION_PAYMENT_VOIDED_SUCCESS;
  const cardNumber = expectations.cardNumber ?? "4111111111111111";
  await test.step("payment", () =>
    payment(fixtures, paymentAccountCode, cardNumber),
  );
  await test.step("refund", () =>
    refund(fixtures, paymentAccountCode, refundAlert, cardNumber),
  );
  await test.step("void", () =>
    voidPayment(fixtures, paymentAccountCode, paymentVoidAlert, cardNumber),
  );
  await test.step("auth only", () =>
    authOnly(fixtures, paymentAccountCode, cardNumber),
  );
  await test.step("auth only capture", () =>
    authOnlyCapture(fixtures, paymentAccountCode, cardNumber),
  );
  await test.step("auth only refund", () =>
    authOnlyRefund(fixtures, paymentAccountCode, refundAlert, cardNumber),
  );
  await test.step("auth only void", () =>
    authOnlyVoid(fixtures, paymentAccountCode, authVoidAlert, cardNumber),
  );
}

type PaymentPages = Omit<PaymentGatewayFixtures, "setupDb">;

async function payment(
  pages: PaymentPages,
  accountCode: string,
  cardNumber: string,
): Promise<void> {
  await createCardReservation(
    pages.findReservationPage,
    pages.reservationPage,
    pages.billingPage,
    accountCode,
    cardNumber,
  );
  await pages.billingPage.verifyStoredCreditCardDetails(
    cardNumber,
    ConfigManager.testData.creditCardViewPassword,
  );
  await processPayment(pages.reservationPage, pages.billingPage, "50.00");
  await pages.billingPage.verifyBillingTotals("105.00", "50.00", "55.00");
  await pages.reservationPage.waitForAlertMessageToClose();
  await pages.reservationPage.deleteCurrentReservation();
}

async function refund(
  pages: PaymentPages,
  accountCode: string,
  expectedRefundAlert: string,
  cardNumber: string,
): Promise<void> {
  await createCardReservation(
    pages.findReservationPage,
    pages.reservationPage,
    pages.billingPage,
    accountCode,
    cardNumber,
  );
  await processPayment(pages.reservationPage, pages.billingPage, "49.00");
  const refundSucceeded = await refundCurrentPayment(
    pages,
    "20.00",
    expectedRefundAlert,
  );
  if (refundSucceeded) {
    await pages.billingPage.verifyBillingTotals("105.00", "29.00", "76.00");
  }
  await pages.reservationPage.deleteCurrentReservation();
}

async function voidPayment(
  pages: PaymentPages,
  accountCode: string,
  expectedVoidAlert: string,
  cardNumber: string,
): Promise<void> {
  await createCardReservation(
    pages.findReservationPage,
    pages.reservationPage,
    pages.billingPage,
    accountCode,
    cardNumber,
  );
  await processPayment(pages.reservationPage, pages.billingPage, "50.00");
  const voidSucceeded = await voidCurrentPayment(pages, expectedVoidAlert);
  if (voidSucceeded) {
    await pages.billingPage.verifyBillingTotals("105.00", "0.00", "105.00");
  }
  await pages.reservationPage.deleteCurrentReservation();
}

async function authOnly(
  pages: PaymentPages,
  accountCode: string,
  cardNumber: string,
): Promise<void> {
  await createCardReservation(
    pages.findReservationPage,
    pages.reservationPage,
    pages.billingPage,
    accountCode,
    cardNumber,
  );
  await authorizePayment(
    pages.reservationPage,
    pages.billingPage,
    uniqueAuthAmount(46),
  );
  await pages.reservationPage.waitForAlertMessageToClose();
  await pages.reservationPage.deleteCurrentReservation();
}

async function authOnlyCapture(
  pages: PaymentPages,
  accountCode: string,
  cardNumber: string,
): Promise<void> {
  await createCardReservation(
    pages.findReservationPage,
    pages.reservationPage,
    pages.billingPage,
    accountCode,
    cardNumber,
  );
  const authorizedAmount = uniqueAuthAmount(48);
  const captureAmount = partialCaptureAmount(authorizedAmount);
  await authorizePayment(
    pages.reservationPage,
    pages.billingPage,
    authorizedAmount,
  );
  await captureCurrentAuthorization(pages, captureAmount);
  await pages.reservationPage.deleteCurrentReservation();
}

async function authOnlyRefund(
  pages: PaymentPages,
  accountCode: string,
  expectedRefundAlert: string,
  cardNumber: string,
): Promise<void> {
  await createCardReservation(
    pages.findReservationPage,
    pages.reservationPage,
    pages.billingPage,
    accountCode,
    cardNumber,
  );
  const authorizedAmount = uniqueAuthAmount(45);
  const captureAmount = partialCaptureAmount(authorizedAmount);
  await authorizePayment(
    pages.reservationPage,
    pages.billingPage,
    authorizedAmount,
  );
  await captureCurrentAuthorization(pages, captureAmount);
  const refundSucceeded = await refundCurrentPayment(
    pages,
    "20.00",
    expectedRefundAlert,
  );
  if (refundSucceeded) {
    const paidAfterRefund = (Number(captureAmount) - 20).toFixed(2);
    const dueAfterRefund = (105 - Number(paidAfterRefund)).toFixed(2);
    await pages.billingPage.verifyBillingTotals(
      "105.00",
      paidAfterRefund,
      dueAfterRefund,
    );
  }
  await pages.reservationPage.deleteCurrentReservation();
}

async function authOnlyVoid(
  pages: PaymentPages,
  accountCode: string,
  expectedVoidAlert: string,
  cardNumber: string,
): Promise<void> {
  await createCardReservation(
    pages.findReservationPage,
    pages.reservationPage,
    pages.billingPage,
    accountCode,
    cardNumber,
  );
  await authorizePayment(
    pages.reservationPage,
    pages.billingPage,
    uniqueAuthAmount(47),
  );
  await voidCurrentPayment(pages, expectedVoidAlert);
  await pages.reservationPage.deleteCurrentReservation();
}

async function captureCurrentAuthorization(
  pages: PaymentPages,
  amount: string,
): Promise<void> {
  await pages.reservationPage.waitForAlertMessageToClose();
  await pages.billingPage.clickCaptureButton();
  await pages.billingPage.enterPaymentAmountTextBox(amount);
  await pages.billingPage.verifyCaptureTransactionSelected(amount);
  await pages.billingPage.clickProcessButton();
  await pages.reservationPage.verifyAlertMessage(
    AlertMessages.RESERVATION_PAYMENT_PROCESS_SUCCESS,
  );
  await pages.billingPage.verifyBillingPaymentTransactionIDDisplayed(
    ConstNames.INVENTORY_PAYMENT_VISA_PAYMENT,
  );
}

async function refundCurrentPayment(
  pages: PaymentPages,
  amount: string,
  expectedAlert: string,
): Promise<boolean> {
  await pages.reservationPage.waitForAlertMessageToClose();
  await pages.billingPage.clickLineItemRefundButton();
  await pages.billingPage.enterPaymentAmountTextBox(amount);
  await pages.billingPage.clickRefundButton();
  await pages.reservationPage.verifyAlertMessage(expectedAlert);

  if (expectedAlert !== AlertMessages.RESERVATION_PAYMENT_PROCESS_SUCCESS) {
    return false;
  }

  await pages.billingPage.clickBillingTab();
  await pages.billingPage.verifyBillingItemDisplay(
    ConstNames.INVENTORY_PAYMENT_VISA_REFUND,
  );
  return true;
}

async function voidCurrentPayment(
  pages: PaymentPages,
  expectedAlert: string,
): Promise<boolean> {
  await pages.reservationPage.waitForAlertMessageToClose();
  await pages.billingPage.clickVoidButton();
  await pages.reservationPage.verifyAlertMessage(expectedAlert);

  if (expectedAlert !== AlertMessages.RESERVATION_PAYMENT_VOIDED_SUCCESS) {
    return false;
  }

  await pages.billingPage.verifyBillingItemNotDisplayed(
    ConstNames.INVENTORY_PAYMENT_VISA_PAYMENT,
  );
  return true;
}

async function createCardReservation(
  findReservationPage: FindReservationPage,
  reservationPage: ReservationPage,
  billingPage: BillingPage,
  paymentAccountCode: string,
  cardNumber: string,
): Promise<void> {
  await findReservationPage.addNewReservation();
  await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
  await reservationPage.selectFirstRoomFromDropdown();
  await reservationPage.enterGuestInfo();
  await reservationPage.enterPaymentMethod(paymentAccountCode);
  await billingPage.enterBillingCCDetails(cardNumber);
  await reservationPage.clickSaveButton();
  await reservationPage.verifyAlertMessage(
    AlertMessages.RESERVATION_SAVED_SUCCESS,
  );
  await billingPage.clickBillingTab();
}

async function processPayment(
  reservationPage: ReservationPage,
  billingPage: BillingPage,
  amount: string,
): Promise<void> {
  await billingPage.enterPaymentAmountTextBox(amount);
  await billingPage.clickProcessButton();
  await reservationPage.verifyAlertMessage(
    AlertMessages.RESERVATION_PAYMENT_PROCESS_SUCCESS,
  );
  await billingPage.verifyBillingPaymentTransactionIDDisplayed(
    ConstNames.INVENTORY_PAYMENT_VISA_PAYMENT,
  );
}

async function authorizePayment(
  reservationPage: ReservationPage,
  billingPage: BillingPage,
  amount: string,
): Promise<void> {
  await billingPage.enterPaymentAmountTextBox(amount);
  await billingPage.clickAuthOnlyButton();
  await reservationPage.verifyAlertMessage(
    AlertMessages.RESERVATION_PAYMENT_PROCESS_SUCCESS,
  );
  await billingPage.clickAuthOnlyTransactions();
  await billingPage.verifyAuthOnlyTransactionIDDisplayed();
}
