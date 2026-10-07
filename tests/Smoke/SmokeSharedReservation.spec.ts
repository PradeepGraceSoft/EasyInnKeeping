import { test, expect } from "../../src/fixtures/sso.fixture";
import { AlertMessages } from "../../src/constants/AlertMessages";
import { ConstNames } from "../../src/constants/ConstNames";
import { DateUtils } from "../../src/utils/DateUtils";
import { SSOUsers } from "../../src/test-data/SSOUsers";
import { ReservationPage } from "../../src/pages/ReservationPage";
import { ReservationDatabaseHelper } from "../../src/utils/DBHelper/ReservationDatabaseHelper";

test.setTimeout(180_000);

test.beforeEach(async ({ ssoLoginPage, setupDb, findReservationPage }) => {
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
  await findReservationPage.deleteRecentSharedReservations();
});

// =========================================================================
// Verify a shared reservation is created successfully via Find Reservation screen
// =========================================================================

test("Verify a shared reservation is created successfully via Find Reservation screen", async ({
  layoutPage,
  findReservationPage,
  reservationPage,
}) => {
  await layoutPage.clickReservationListIcon();
  await findReservationPage.chooseReservationTypeShared();
  await findReservationPage.addNewReservation();

  await reservationPage.selectFirstAvailableRoomType();
  await reservationPage.selectFirstRoomFromDropdown();
  await reservationPage.saveGuestInfoAndVerify();

  await reservationPage.clickSharedAddGuestOption();
  await reservationPage.saveGuestInfoAndVerify();

  const reservationNumber2 = await reservationPage.getReservationNumber();
  expect(reservationNumber2).not.toEqual("");
  await reservationPage.clickDeleteButton();
});

// =========================================================================
// Verify a shared reservation is created successfully via Calendar screen
// =========================================================================

test("Verify a shared reservation is created successfully via Calendar screen", async ({
  page,
  layoutPage,
}) => {
  await layoutPage.clickCalendarIcon();
  const reservationPopupPromise = page.waitForEvent("popup");
  await page
    .getByRole("button", { name: "icon", description: "New Reservation" })
    .click();
  const reservationPopup = await reservationPopupPromise;

  const reservationPage2 = new ReservationPage(
    reservationPopup,
    new ReservationDatabaseHelper(),
  );

  await reservationPage2.selectBookingType("Shared");

  await reservationPage2.selectFirstAvailableRoomType();
  await reservationPage2.selectFirstRoomFromDropdown();
  await reservationPage2.saveGuestInfoAndVerify();

  await reservationPage2.clickSharedAddGuestOption();
  await reservationPage2.saveGuestInfoAndVerify();

  const reservationNumber = await reservationPage2.getReservationNumber();
  expect(reservationNumber).not.toEqual("");
  await reservationPage2.clickDeleteButton();
});

// =========================================================================
// Verifying adding a new room is restricted on new and existing reservation
// =========================================================================

test("Verifying adding a new room is restricted on new and existing reservation", async ({
  layoutPage,
  findReservationPage,
  reservationPage,
}) => {
  await layoutPage.clickReservationListIcon();
  await findReservationPage.chooseReservationTypeShared();
  await findReservationPage.addNewReservation();

  reservationPage.verifyAddAnotherRoomNotVisible();

  await reservationPage.selectFirstAvailableRoomType();
  await reservationPage.selectFirstRoomFromDropdown();
  await reservationPage.saveGuestInfoAndVerify();
  const reservationNumber = await reservationPage.getReservationNumber();
  expect(reservationNumber).not.toEqual("0");
  await reservationPage.clickSharedAddGuestOption();

  reservationPage.verifyAddAnotherRoomNotVisible();

  await reservationPage.saveGuestInfoAndVerify();

  reservationPage.verifyAddAnotherRoomNotVisible();
  await reservationPage.clickDeleteButton();
});

// =========================================================================
// Verify warning when clicking room selection fields on a shared reservation
// =========================================================================

test("Verify showing the warning message when click on room selection section of a shared reservation", async ({
  layoutPage,
  findReservationPage,
  reservationPage,
}) => {
  await layoutPage.clickReservationListIcon();
  await findReservationPage.chooseReservationTypeShared();
  await findReservationPage.addNewReservation();

  await reservationPage.selectFirstAvailableRoomType();
  await reservationPage.selectFirstRoomFromDropdown();
  await reservationPage.saveGuestInfoAndVerify();

  await reservationPage.clickSharedAddGuestOption();
  await reservationPage.saveGuestInfoAndVerify();

  await reservationPage.clickRoomSelectionEnableEdit();
  await reservationPage.verifySharedRoomEditWarningMessage(
    AlertMessages.SHARED_ROOM_EDIT_WARNING,
  );
  await reservationPage.clickSharedRoomEditWarningNo();
  await reservationPage.clickDeleteButton();
});

// =========================================================================
// Verify changing the arrival date on the primary guest updates the secondary guest
// =========================================================================

test("Verify changing the arrival date on the primary guest should change on the secondary guest", async ({
  layoutPage,
  findReservationPage,
  reservationPage,
}) => {
  const updatedArrivalDate = DateUtils.getTomorrow();
  await layoutPage.clickReservationListIcon();
  await findReservationPage.chooseReservationTypeShared();
  await findReservationPage.addNewReservation();

  await reservationPage.selectFirstAvailableRoomType();
  await reservationPage.selectFirstRoomFromDropdown();
  await reservationPage.saveGuestInfoAndVerify();

  await reservationPage.clickSharedAddGuestOption();
  await reservationPage.saveGuestInfoAndVerify();

  await reservationPage.selectSharedGuestOptionByIndex(0);
  await reservationPage.clickRoomSelectionEnableEdit();
  await reservationPage.clickSharedRoomEditWarningYes();
  await reservationPage.enterArrivalDate(updatedArrivalDate);
  await reservationPage.confirmUnavailableRoomDateChangeIfShown();
  await reservationPage.clickSaveButton();
  await reservationPage.verifyAlertMessage(
    AlertMessages.RESERVATION_SAVED_SUCCESS,
  );

  await reservationPage.selectSharedGuestOptionByIndex(1);
  await reservationPage.clickRoomSelectionEnableEdit();
  await reservationPage.clickSharedRoomEditWarningYes();
  await reservationPage.verifyArrivalDate(updatedArrivalDate);
  await reservationPage.clickDeleteButton();
});

// =========================================================================
// Verify changing the arrival date on the secondary guest updates the primary guest
// =========================================================================

test("Verify changing the arrival date on the secondary guest should change on primary guest", async ({
  layoutPage,
  findReservationPage,
  reservationPage,
}) => {
  const updatedArrivalDate = DateUtils.getTomorrow();
  await layoutPage.clickReservationListIcon();
  await findReservationPage.chooseReservationTypeShared();
  await findReservationPage.addNewReservation();

  await reservationPage.selectFirstAvailableRoomType();
  await reservationPage.selectFirstRoomFromDropdown();
  await reservationPage.saveGuestInfoAndVerify();

  await reservationPage.clickSharedAddGuestOption();
  await reservationPage.saveGuestInfoAndVerify();

  await reservationPage.selectSharedGuestOptionByIndex(1);
  await reservationPage.clickRoomSelectionEnableEdit();
  await reservationPage.clickSharedRoomEditWarningYes();
  await reservationPage.enterArrivalDate(updatedArrivalDate);
  await reservationPage.confirmUnavailableRoomDateChangeIfShown();
  await reservationPage.clickSaveButton();
  await reservationPage.verifyAlertMessage(
    AlertMessages.RESERVATION_SAVED_SUCCESS,
  );

  await reservationPage.selectSharedGuestOptionByIndex(0);
  await reservationPage.clickRoomSelectionEnableEdit();
  await reservationPage.clickSharedRoomEditWarningYes();
  await reservationPage.verifyArrivalDate(updatedArrivalDate);
  await reservationPage.clickDeleteButton();
});

// =========================================================================
// Verify changing the room on the primary guest updates the secondary guest
// =========================================================================

test("Verify changing the room on the primary guest should change on the secondary guest", async ({
  layoutPage,
  findReservationPage,
  reservationPage,
}) => {
  await layoutPage.clickReservationListIcon();
  await findReservationPage.chooseReservationTypeShared();
  await findReservationPage.addNewReservation();

  await reservationPage.selectFirstAvailableRoomType();
  await reservationPage.selectFirstRoomFromDropdown();
  await reservationPage.saveGuestInfoAndVerify();

  await reservationPage.clickSharedAddGuestOption();
  await reservationPage.saveGuestInfoAndVerify();

  await reservationPage.selectSharedGuestOptionByIndex(0);
  await reservationPage.clickRoomSelectionEnableEdit();
  await reservationPage.clickSharedRoomEditWarningYes();
  await reservationPage.selectSecondRoomFromDropdown();
  const selectedRoomName = await reservationPage.getSelectedRoomName();

  await reservationPage.clickSaveButton();
  await reservationPage.verifyAlertMessage(
    AlertMessages.RESERVATION_SAVED_SUCCESS,
  );
  await reservationPage.selectSharedGuestOptionByIndex(1);
  await reservationPage.verifyRoomNameDisplayed(selectedRoomName);
});
