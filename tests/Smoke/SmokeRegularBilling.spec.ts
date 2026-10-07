import { test } from "../../src/fixtures/sso.fixture";
import { AlertMessages } from "../../src/constants/AlertMessages";
import { ConstNames } from "../../src/constants/ConstNames";
import { SSOUsers } from "../../src/test-data/SSOUsers";
import { DateUtils } from "../../src/utils/DateUtils";
import { BillingPage } from "../../src/pages/BillingPage";
import { FindReservationPage } from "../../src/pages/FindReservationPage";
import { ReservationPage } from "../../src/pages/ReservationPage";
import { SetupDatabaseHelper } from "../../src/utils/DBHelper/SetupDatabaseHelper";

test.describe.configure({ timeout: 60_000 });

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

test("Add a charge as a new billing line item", async ({
  setupDb,
  findReservationPage,
  reservationPage,
  billingPage,
}) => {
  const accountCode = await setupDb.requireInventoryItemAccountCode(
    ConstNames.INVENTORY_CHARGES_CHARGE_ITEM,
  );
  await setupDb.setInventoryItemAmount(accountCode, 25);
  await createRegularReservation(findReservationPage, reservationPage);

  await billingPage.clickBillingTab();
  await billingPage.enterChargesDiscountAccountCode(accountCode);
  await billingPage.clickChargesDiscountSave();
  await reservationPage.verifyAlertMessage(AlertMessages.BILLING_SAVED_SUCCESS);

  await billingPage.verifyBillingItemDisplay(
    ConstNames.INVENTORY_CHARGES_CHARGE_ITEM,
  );
  await billingPage.verifyBillingFooterAmount("130.00");
  await billingPage.verifyBillingFooterAmountDue("130.00");
  await reservationPage.deleteCurrentReservation();
});

test("Apply Flat Discount under Charges & Discounts", async ({
  setupDb,
  findReservationPage,
  reservationPage,
  billingPage,
}) => {
  const accountCode = await setupDb.requireInventoryItemAccountCode(
    ConstNames.DISCOUNT_FLAT_DISCOUNT,
  );
  await createRegularReservation(findReservationPage, reservationPage);

  await billingPage.clickBillingTab();
  await billingPage.enterChargesDiscountAccountCode(accountCode);
  await billingPage.enterChargesDiscountAmountTextbox("20");
  await billingPage.clickChargesDiscountSave();
  await reservationPage.verifyAlertMessage(AlertMessages.BILLING_SAVED_SUCCESS);

  await billingPage.verifyBillingItemDisplay(ConstNames.DISCOUNT_FLAT_DISCOUNT);
  await billingPage.verifyBillingFooterAmount("85.00");
  await billingPage.verifyBillingFooterAmountDue("85.00");
  await reservationPage.deleteCurrentReservation();
});

test("Apply Percentage Discount under Charges & Discounts", async ({
  setupDb,
  findReservationPage,
  reservationPage,
  billingPage,
}) => {
  const accountCode = await setupDb.requireInventoryItemAccountCode(
    ConstNames.DISCOUNT_PERCENTAGE_DISCOUNT,
  );
  await createRegularReservation(findReservationPage, reservationPage);

  await billingPage.clickBillingTab();
  await billingPage.enterChargesDiscountAccountCode(accountCode);
  await billingPage.enterChargesDiscountAmountTextbox("25");
  await billingPage.clickChargesDiscountSave();
  await reservationPage.verifyAlertMessage(AlertMessages.BILLING_SAVED_SUCCESS);

  await billingPage.verifyBillingItemDisplay(
    ConstNames.DISCOUNT_PERCENTAGE_DISCOUNT,
  );
  await billingPage.verifyBillingFooterAmount("80.00");
  await billingPage.verifyBillingFooterAmountDue("80.00");
  await reservationPage.deleteCurrentReservation();
});

test("Display a changed invoice date on a new billing charge", async ({
  setupDb,
  findReservationPage,
  reservationPage,
  billingPage,
}) => {
  const accountCode = await setupDb.requireInventoryItemAccountCode(
    ConstNames.INVENTORY_CHARGES_CHARGE_ITEM,
  );
  const invoiceDate = DateUtils.addDaysMMDDYYYY(2);
  await createRegularReservation(findReservationPage, reservationPage);

  await billingPage.clickBillingTab();
  await billingPage.enterBillingInvoiceDate(invoiceDate);
  await billingPage.enterChargesDiscountAccountCode(accountCode);
  await billingPage.clickChargesDiscountSave();
  await reservationPage.verifyAlertMessage(AlertMessages.BILLING_SAVED_SUCCESS);

  await billingPage.verifyBillingItemDisplayBasedonInvoiceDate(
    ConstNames.INVENTORY_CHARGES_CHARGE_ITEM,
    invoiceDate,
  );
  await reservationPage.deleteCurrentReservation();
});

test("Record a cash payment and reduce the amount due", async ({
  setupDb,
  findReservationPage,
  reservationPage,
  billingPage,
}) => {
  const accountCode = await setupDb.requireInventoryItemAccountCode(
    ConstNames.INVENTORY_PAYMENT_CASH_PAYMENT,
  );
  await createRegularReservation(findReservationPage, reservationPage);

  await billingPage.clickBillingTab();
  await billingPage.enterPaymentRefundAccountCode(accountCode);
  await billingPage.enterPaymentAmountTextBox("50.00");
  await billingPage.clickPaymentRefundSaveButton();
  await reservationPage.verifyAlertMessage(AlertMessages.BILLING_SAVED_SUCCESS);

  await billingPage.verifyBillingItemDisplay(
    ConstNames.INVENTORY_PAYMENT_CASH_PAYMENT,
  );
  await billingPage.verifyBillingFooterAmount("105.00");
  await billingPage.verifyBillingFooterPayments("50.00");
  await billingPage.verifyBillingFooterAmountDue("55.00");
  await reservationPage.deleteCurrentReservation();
});

test("Process and void a credit-card payment", async ({
  setupDb,
  findReservationPage,
  reservationPage,
  billingPage,
}) => {
  await setupDb.setPGAuthorizeNet();
  const accountCode = await setupDb.requireInventoryItemAccountCode(
    ConstNames.INVENTORY_PAYMENT_VISA_PAYMENT,
  );
  await createRegularReservationCard(
    findReservationPage,
    reservationPage,
    setupDb,
    billingPage,
  );

  await billingPage.clickBillingTab();
  await billingPage.enterPaymentAmountTextBox("50.00");
  await billingPage.clickProcessButton();
  await reservationPage.verifyAlertMessage(
    AlertMessages.RESERVATION_PAYMENT_PROCESS_SUCCESS,
  );
  await billingPage.verifyBillingPaymentTransactionIDDisplayed(
    ConstNames.INVENTORY_PAYMENT_VISA_PAYMENT,
  );

  await billingPage.clickVoidButton();
  await reservationPage.verifyAlertMessage(
    AlertMessages.RESERVATION_PAYMENT_VOIDED_SUCCESS,
  );
  await billingPage.verifyBillingItemNotDisplayed(
    ConstNames.INVENTORY_PAYMENT_VISA_PAYMENT,
  );
  await reservationPage.deleteCurrentReservation();
});

test("Mark lodging tax exempt and omit it from the printed invoice", async ({
  findReservationPage,
  reservationPage,
  billingPage,
}) => {
  await createRegularReservation(findReservationPage, reservationPage);
  await billingPage.clickBillingTab();

  await billingPage.selectLineItemTaxExemptCheckbox();
  await reservationPage.verifyAlertMessage(AlertMessages.BILLING_SAVED_SUCCESS);
  await billingPage.verifyLineItemTaxExemptCheckboxSelected(true);
  await billingPage.verifyLineItemChargesAmount(
    ConstNames.INVENTORY_TAX_LODGING_TAX,
    "0.00",
  );

  await billingPage.clickPrintEmailInvoice();
  await billingPage.verifyPrintTaxDisplayStatus(
    ConstNames.INVENTORY_TAX_LODGING_TAX,
    false,
  );
  await billingPage.clickPrintCloseButton();
  await billingPage.verifyBillingFooterAmount("100.00");
  await billingPage.verifyBillingFooterAmountDue("100.00");
  await reservationPage.deleteCurrentReservation();
});

test("Print a cumulative reservation invoice", async ({
  findReservationPage,
  reservationPage,
  billingPage,
}) => {
  await createRegularReservation(findReservationPage, reservationPage);
  await billingPage.clickBillingTab();
  await billingPage.clickPrintEmailInvoice();
  await billingPage.selectPrintInvoiceType(
    ConstNames.BILLING_PRINT_TYPE_RESERVATION_INVOICE,
  );

  await billingPage.verifyPrintedInvoiceTotals("100.00", "5.00", "105.00");
  await billingPage.clickPrintCloseButton();
  await reservationPage.deleteCurrentReservation();
});

test("Print daily room charges for a two-night reservation", async ({
  findReservationPage,
  reservationPage,
  billingPage,
}) => {
  await findReservationPage.addNewReservation();
  await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
  await reservationPage.selectFirstRoomFromDropdown();
  await reservationPage.enterNumberOfNights("2");
  await reservationPage.saveGuestInfoAndVerify();
  const roomName = await reservationPage.getReservationRoomNameByRoomType(
    ConstNames.ROOMTYPE_NAME_REGULAR_ROOM,
  );

  await billingPage.clickBillingTab();
  await billingPage.clickPrintEmailInvoice();
  await billingPage.selectPrintInvoiceType(
    ConstNames.BILLING_PRINT_TYPE_RESERVATION_INVOICE_DAILY_SPLIT,
  );
  await billingPage.verifyPrintBillingDescriptionChargeDaily(
    roomName,
    "100.00",
    "1",
  );
  await billingPage.verifyPrintBillingDescriptionChargeDaily(
    roomName,
    "100.00",
    "2",
  );
  await billingPage.verifyPrintBillingDescriptionCharge(
    ConstNames.BILLING_LODGING_TAX_NAME,
    "10.00",
  );
  await billingPage.verifyPrintFooter("210.00");
  await billingPage.clickPrintCloseButton();
  await reservationPage.deleteCurrentReservation();
});

test("Print reservation invoice with room split per room", async ({
  setupDb,
  findReservationPage,
  reservationPage,
  billingPage,
}) => {
  await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE, 150);
  await findReservationPage.addNewReservation();
  await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
  await reservationPage.selectFirstRoomFromDropdown();
  await reservationPage.clickAddAnotherRoom();
  await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
  await reservationPage.selectFirstRoomFromDropdown();
  await reservationPage.saveGuestInfoAndVerify();
  const roomNames = await reservationPage.getReservationRoomNamesByRoomType(
    ConstNames.ROOMTYPE_NAME_REGULAR_ROOM,
  );

  await billingPage.clickBillingTab();
  await billingPage.clickPrintEmailInvoice();
  await billingPage.selectPrintInvoiceType(
    ConstNames.BILLING_PRINT_TYPE_RESERVATION_INVOICE_ROOM_SPLIT,
  );
  await billingPage.verifyPrintBillingDescriptionChargeDaily(
    roomNames[0],
    "150.00",
    "1",
  );
  await billingPage.verifyPrintBillingDescriptionChargeDaily(
    roomNames[1],
    "150.00",
    "1",
  );
  await billingPage.verifyPrintBillingDescriptionCharge(
    ConstNames.BILLING_LODGING_TAX_NAME,
    "15.00",
  );
  await billingPage.verifyPrintFooter("315.00");
  await billingPage.clickPrintCloseButton();
  await reservationPage.deleteCurrentReservation();
});

test("Email a reservation invoice", async ({
  findReservationPage,
  reservationPage,
  billingPage,
}) => {
  await createRegularReservation(findReservationPage, reservationPage);
  await billingPage.clickBillingTab();
  await billingPage.clickPrintEmailInvoice();
  await billingPage.clickPrintEmailButton();
  await billingPage.clickPrintEmailSendButton();
  await reservationPage.verifyAlertMessage(AlertMessages.BILLING_EMAIL_SUCCESS);
  await billingPage.clickPrintCloseButton();
  await reservationPage.deleteCurrentReservation();
});

async function createRegularReservation(
  findReservationPage: FindReservationPage,
  reservationPage: ReservationPage,
): Promise<void> {
  await findReservationPage.addNewReservation();
  await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
  await reservationPage.selectFirstRoomFromDropdown();
  await reservationPage.saveGuestInfoAndVerify();
}

async function createRegularReservationCard(
  findReservationPage: FindReservationPage,
  reservationPage: ReservationPage,
  setupDb: SetupDatabaseHelper,
  billingPage: BillingPage,
): Promise<void> {
  await findReservationPage.addNewReservation();
  await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
  await reservationPage.selectFirstRoomFromDropdown();
  await reservationPage.enterGuestInfo();

  const accountCode = await setupDb.requireInventoryItemAccountCode(
    ConstNames.INVENTORY_PAYMENT_VISA_PAYMENT,
  );
  await reservationPage.enterPaymentMethod(accountCode);
  await billingPage.enterBillingCCDetails();
  await reservationPage.clickSaveButton();
  await reservationPage.verifyAlertMessage(
    AlertMessages.RESERVATION_SAVED_SUCCESS,
  );
}
