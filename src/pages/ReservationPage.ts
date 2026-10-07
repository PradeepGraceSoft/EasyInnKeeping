import { expect, Locator, Page } from "@playwright/test";
import { AlertMessages } from "../constants/AlertMessages";
import { ConstNames } from "../constants/ConstNames";
import { BasePage } from "../utils/BasePage";
import { ConfigManager } from "../utils/ConfigManager";
import { ReservationDatabaseHelper } from "../utils/DBHelper/ReservationDatabaseHelper";
import { ReservationApi } from "../api/ReservationApi";
import { TestDataGenerator } from "../utils/TestDataGenerator";
import type { FindReservationPage } from "./FindReservationPage";

export class ReservationPage extends BasePage {
  private lastAlertMessage = "";
  private readonly createdReservationNumbers: string[] = [];

  constructor(
    page: Page,
    private readonly reservationDatabaseHelper: ReservationDatabaseHelper,
    private readonly reservationApi: ReservationApi = new ReservationApi(),
  ) {
    super(page);
  }

  // ***************** Page Elements *********************************

  private readonly reservationDialog: Locator = this.page.getByRole("dialog");

  private readonly reservationNumber: Locator = this.page.locator(
    "//h2[text()='Reservation #:']/child::span",
  );

  private readonly groupReservationHeader: Locator =
    this.reservationDialog.getByRole("heading", { name: /^Group: #/ });

  private readonly statusLabel: Locator = this.page.locator(
    "//label[text()='Status : ']",
  );

  private readonly reservationTab: Locator = this.page.locator(
    "//span[text()='Reservation ']",
  );

  private readonly historyTab: Locator = this.page.getByText("History", {
    exact: true,
  });

  // ***************** Booking Type *********************************

  private readonly bookingTypeDropdown: Locator = this.reservationDialog
    .getByRole("combobox")
    .first();

  private readonly sharedGuestDropdown: Locator = this.page.locator(
    "(//mat-select[contains(@class,'status-select')])[2]",
  );

  private readonly reservationStatusDropdown: Locator = this.page
    .locator("mat-select.status-select.sta-sel")
    .last();

  private readonly addGuestOption: Locator = this.page.locator(
    "//span[normalize-space(text())='Add Guest']",
  );

  // ***************** Room Selection *********************************

  private readonly roomSelectionEnableEditRow: Locator = this.page.locator(
    "xpath=(//tr[@class='ng-star-inserted'])[2]",
  );

  private readonly arrivalDateInput: Locator =
    this.page.locator("#startDateControl");

  private readonly departureDateInput: Locator =
    this.page.locator("#endDateControl");

  private readonly startDateCalendarButton: Locator = this.page.locator(
    "(//button[@aria-label='Open calendar'])[2]",
  );

  private readonly datePickerMonthYearButton: Locator = this.page.locator(
    "//button[@aria-label='Choose month and year']",
  );

  private readonly numberOfNightsInput: Locator =
    this.page.locator("#nightsControl");

  private readonly roomTypeDropdown: Locator =
    this.page.locator("#roomTypeControl");

  private readonly roomTypeOptions = this.page.locator("mat-option");

  private readonly roomTypeDropdownText: Locator = this.page.locator(
    "//mat-select[@id='roomTypeControl']//span[contains(@class,'mat-select-min-line')]",
  );

  private readonly roomDropdown: Locator = this.page
    .locator("tr[approomedit] mat-select")
    .nth(1);

  private readonly roomNameWarning: Locator = this.page
    .locator("//mat-spinner[@role='progressbar']")
    .nth(1);

  private readonly roomEditProgressBars: Locator = this.page.locator(
    "tr[approomedit] mat-spinner",
  );

  private readonly roomTypeDropdownOptions: Locator = this.page.locator(
    "mat-option[role='option']",
  );

  private readonly roomDropdownOptions: Locator = this.page.locator(
    "mat-option[role='option']",
  );

  private readonly roomTypeName: Locator = this.page.locator(
    "//table[@class='rooms-regular-table']/tr[2]/td[4]",
  );

  private readonly adultsInput: Locator = this.page.locator("[name='adults']");

  private readonly childrenInput: Locator =
    this.page.locator("[name='children']");

  private readonly unitTotalCell: Locator = this.page.locator(
    "//tr[@class='ng-star-inserted']/td[8]",
  );

  private readonly roomTotalCell: Locator = this.page.locator(
    "//tr[@class='ng-star-inserted']/td[9]",
  );

  private readonly roomTotalEditButton: Locator = this.page.locator(
    "//button[@class='mat-focus-indicator edit-rate mat-icon-button mat-button-base ng-star-inserted']",
  );

  private readonly addAnotherRoomButton: Locator = this.page.getByRole(
    "button",
    { name: "+ Add Another Room" },
  );

  private readonly groupReserveButton: Locator = this.page.locator(
    "(//button[span[text()='Reserve']])[1]",
  );

  // ***************** Daily Rate Edit Popup *********************************

  private readonly rateEditPopupRoomTotal: Locator = this.page.locator(
    "(//strong[text()='Total Rate']//following::div)[1]",
  );

  private readonly rateEditPopup: Locator = this.page
    .getByRole("dialog")
    .filter({ has: this.page.getByText("Total Rate", { exact: true }) });

  private readonly rateEditPopupAmountInput: Locator = this.rateEditPopup
    .locator("input")
    .first();

  private readonly rateEditPopupSaveButton: Locator = this.rateEditPopup.getByRole(
    "button",
    { name: "Save", exact: true },
  );

  // ***************** Hourly *********************************

  private readonly hourlyRoomDropdown: Locator = this.page.locator(
    "(//mat-form-field[@floatlabel='always'])[3]",
  );

  private readonly startTimeDropdown: Locator = this.page.locator(
    "//mat-select[@id='startTimeControl']",
  );

  private readonly hoursInput: Locator = this.page.locator(
    "//input[@id='hoursControl']",
  );

  private readonly firstStartTimeOption: Locator = this.page.locator(
    "(//mat-option[@aria-disabled='false'])[1]",
  );

  // ***************** Package *********************************

  private readonly packageDropdown: Locator = this.page.locator(
    "//mat-select[@formcontrolname='package']",
  );

  private readonly packageRoomDropdown: Locator = this.page.locator(
    "//mat-select[@formcontrolname='roomName']",
  );

  private readonly packageFirstOption: Locator = this.page.locator(
    "(//mat-option//span[@class='mat-option-text'])[1]",
  );

  private readonly packageAddRoomButton: Locator = this.page.locator(
    "//button[span[normalize-space()='Add Room']]",
  );

  // ***************** Guest Info - Regular *********************************

  private readonly firstNameInput: Locator = this.page
    .locator("input[formcontrolname='firstName']")
    .first();

  private readonly lastNameInput: Locator = this.page
    .locator("input[formcontrolname='lastName']")
    .first();

  private readonly addressInput: Locator = this.page
    .locator("input[formcontrolname='address']")
    .first();

  private readonly cityInput: Locator = this.page
    .locator("input[formcontrolname='city']")
    .first();

  private readonly stateInput: Locator = this.page
    .locator("input[formcontrolname='state']")
    .first();

  private readonly countryInput: Locator = this.page
    .locator("input[formcontrolname='country']")
    .first();

  private readonly zipInput: Locator = this.page
    .locator("input[formcontrolname='zip']")
    .first();

  private readonly mobileInput: Locator = this.page
    .locator("input[formcontrolname='phone']")
    .first();

  private readonly emailInput: Locator = this.page
    .locator("input[formcontrolname='email']")
    .first();

  private readonly removeGuestButton: Locator = this.page.getByRole("button", {
    name: /remove guest|delete guest/i,
  });

  // ***************** Guest Info - Group *********************************

  private readonly groupNameInput: Locator = this.reservationDialog.getByRole(
    "textbox",
    { name: "Group Name" },
  );

  private readonly groupFirstNameInput: Locator =
    this.reservationDialog.getByRole("combobox", { name: "First Name" });

  private readonly groupLastNameInput: Locator =
    this.reservationDialog.getByRole("combobox", { name: "Last Name" });

  private readonly groupAddressInput: Locator =
    this.reservationDialog.getByRole("textbox", { name: "Address" });

  private readonly groupCityInput: Locator = this.reservationDialog.getByRole(
    "textbox",
    { name: "City" },
  );

  private readonly groupStateInput: Locator = this.reservationDialog.getByRole(
    "textbox",
    { name: "State" },
  );

  private readonly groupCountryInput: Locator =
    this.reservationDialog.getByRole("textbox", { name: "Country" });

  private readonly groupZipInput: Locator = this.reservationDialog.getByRole(
    "combobox",
    { name: "Zip" },
  );

  private readonly groupMobileInput: Locator =
    this.reservationDialog.getByRole("textbox", { name: "Home Phone" });

  private readonly groupEmailInput: Locator =
    this.reservationDialog.getByRole("combobox", { name: "Email ID" });

  private readonly zipSuggestionOptions: Locator = this.page
    .locator(".cdk-overlay-pane:visible")
    .getByRole("option");

  private readonly noZipRecordsMessage: Locator = this.page.getByRole(
    "option",
    { name: "No Record Found", exact: true },
  );

  // ***************** Payment Info *********************************

  private readonly paymentMethodInput: Locator = this.page.getByRole(
    "dialog"
  ).filter({ has: this.page.getByRole("button", { name: "Save", exact: true }) })
    .getByRole("combobox", { name: "Account Code", exact: true })
    .first();

  // ***************** Notes *********************************

  private readonly notesTextbox: Locator = this.page.locator(
    "//textarea[@matinput]",
  );

  // ***************** Booking Summary *********************************

  private readonly bookingSummaryRoomTotal: Locator = this.page.locator(
    "//label[text()='Room Total ']//following::label[1]",
  );

  private readonly bookingSummaryEPC: Locator = this.page.locator(
    "//label[text()='Extra Person Charge ']//following::label[1]",
  );

  private readonly bookingSummaryDiscount: Locator = this.page.locator(
    "//label[text()='Discounts ']//following::label[1]",
  );

  private readonly bookingSummaryAddDiscountButton: Locator = this.page.locator(
    "//label[text()='Discounts ']//following-sibling::button",
  );

  private readonly bookingSummaryTax: Locator = this.page.locator(
    "//label[text()='Tax ']//following::div[1]",
  );

  private readonly bookingSummaryMisc: Locator = this.page.locator(
    "//label[text()='Miscellenous ']//following::div[1]",
  );

  private readonly bookingSummaryPostTaxTotal: Locator = this.page.locator(
    "//label[text()='Post Tax Total ']//following::div[1]",
  );

  private readonly bookingSummaryPaid: Locator = this.page.locator(
    "//label[text()='Total Paid ']//following::div[1]",
  );

  private readonly bookingSummaryAmountDue: Locator = this.page.locator(
    "//div[text()='Amount Due ']//following::div[1]",
  );

  private readonly bookingSummaryProgressBar: Locator = this.page
    .locator("//h4[normalize-space()='Booking Summary']/following-sibling::div")
    .getByRole("progressbar");

  // ***************** Discount *********************************

  private readonly discountDropdown: Locator = this.page.locator(
    "//mat-select[@name='discountName']",
  );

  private readonly discountRateInput: Locator = this.page.locator(
    "//input[@name='discountrate']",
  );

  private readonly discountApplyButton: Locator = this.page.locator(
    "//button[span[normalize-space(text())='Apply']]",
  );

  private readonly discountRemoveButton: Locator = this.page.locator(
    "//app-discounts//button[.//mat-icon[normalize-space()='delete']]",
  );

  private readonly discountAmountProgressBar: Locator = this.page.locator(
    "app-discounts mat-spinner",
  );

  // ***************** Footer Buttons *********************************

  private readonly saveButton: Locator = this.page.locator(
    "//span[text()='Save']",
  );

  private readonly groupSaveButton: Locator = this.reservationDialog.getByRole(
    "button",
    { name: "Save", exact: true },
  );

  private readonly deleteButton: Locator = this.page.getByRole("button", {
    name: "Delete",
  });

  private readonly groupIndividualDeleteButton: Locator =
    this.reservationDialog.getByRole("button", {
      name: "Delete",
      exact: true,
    });

  private readonly cancelButton: Locator = this.page.getByRole("button", {
    name: "Cancel",
  });

  private readonly cancelReservationButton: Locator = this.page.getByRole(
    "button",
    { name: /Cancel Reservation/i },
  );

  private readonly cancelReservationDialogButton: Locator = this.page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel Reservation", exact: true });

  private readonly restoreReservationButton: Locator = this.page.locator(
    "//button[@mat-raised-button and span[text()='Restore Reservation']]",
  );

  private readonly closeButton: Locator = this.page.locator(
    "//span[text()='Close']",
  ).last();

  // ***************** Alert / Rule Override *********************************

  private readonly alertMessage: Locator = this.page.locator(
    "simple-snack-bar > span",
  );

  private readonly ruleOverridePopup: Locator = this.page.locator(
    "//h3[@class='col-sm-12 text-center']",
  );

  private readonly ruleOverridePasswordInput: Locator = this.page.locator(
    "//input[@type='password']",
  );

  private readonly ruleOverrideConfirmButton: Locator = this.page.locator(
    "//button[@class='mat-focus-indicator mat-raised-button mat-button-base mat-primary']",
  );

  private readonly ruleOverrideCancelButton: Locator = this.page.locator(
    "//button[@class='mat-focus-indicator mat-raised-button mat-button-base mat-warn']",
  );

  // ***************** Overlap Popup *********************************

  private readonly overlapPopupText: Locator = this.page.locator(
    "//div[@class='col-sm-12 text-center']/p",
  );

  private readonly overlapYesButton: Locator = this.page.locator(
    "//div[contains(@class,'text-center')]/button[.//span[normalize-space()='Yes']]",
  );

  private readonly overlapNoButton: Locator = this.page.locator(
    "//div[contains(@class,'text-center')]/button[.//span[normalize-space()='No']]",
  );

  private readonly cancellationChargePopup: Locator = this.page.locator(
    "//div[@class='col-sm-6']/p[contains(normalize-space(),'(Cancellation Charge)')]",
  );

  // ***************** Shared Room Edit Warning *********************************

  private readonly sharedRoomEditWarningText: Locator = this.page.locator(
    "//p[contains(normalize-space(),'Editing this room will update all shared guest room details')]",
  );

  private readonly sharedRoomEditWarningNoButton: Locator = this.page.getByRole(
    "button",
    { name: "No" },
  );

  private readonly sharedRoomEditWarningYesButton: Locator =
    this.page.getByRole("button", { name: "Yes" });

  // ***************** Navigation *********************************

  async clickReservationTab(): Promise<void> {
    await this.reservationTab.click();
  }

  async verifyHistoryContains(expectedText: RegExp): Promise<void> {
    await expect(this.historyTab).toBeVisible({ timeout: 15_000 });
    await this.historyTab.click();
    await expect(this.page.getByText(expectedText).first()).toBeVisible();
  }

  async verifyHistoryContainsRoomChange(
    sourceRoom: string,
    targetRoom: string,
    expectedWorker = ConfigManager.testData.loginName,
  ): Promise<void> {
    await expect(this.historyTab).toBeVisible({ timeout: 15_000 });
    await this.historyTab.click();
    for (const header of ["Date", "Time", "Worker", "Action", "Details"]) {
      await expect(this.page.getByText(header, { exact: true })).toBeVisible({
        timeout: 15_000,
      });
    }
    const roomChangeRow = this.page.locator("tr").filter({
      hasText: new RegExp(
        `${this.escapeRegExp(sourceRoom)}[\\s\\S]*${this.escapeRegExp(targetRoom)}|${this.escapeRegExp(targetRoom)}[\\s\\S]*${this.escapeRegExp(sourceRoom)}`,
        "i",
      ),
    });
    const matchingRow = roomChangeRow.first();
    await expect(matchingRow).toBeVisible({ timeout: 15_000 });
    const cells = matchingRow.locator("td");
    expect(await cells.count()).toBeGreaterThanOrEqual(5);
    await expect(cells.nth(0)).toHaveText(/\d{2}\/\d{2}\/\d{4}/);
    await expect(cells.nth(1)).toHaveText(/\d{1,2}:\d{2}/);
    await expect(cells.nth(2)).toContainText(expectedWorker, {
      ignoreCase: true,
      timeout: 15_000,
    });
    await expect(cells.nth(3)).toHaveText(/EDIT BOOKING/i);
    await expect(cells.nth(4)).toContainText(sourceRoom, {
      ignoreCase: true,
    });
    await expect(cells.nth(4)).toContainText(targetRoom, {
      ignoreCase: true,
    });
  }

  async deleteCurrentReservation(): Promise<void> {
    const reservationNumber = this.createdReservationNumbers.pop()
      ?? await this.getReservationNumber();
    await this.reservationApi.deleteReservation(reservationNumber);
  }

  async deleteGroupReservation(groupCode: string): Promise<void> {
    await this.deleteCurrentReservation();
    await this.reservationApi.deleteGroupReservation(groupCode);
  }

  async deleteSharedReservation(primaryConfirmationNumber: string): Promise<void> {
    await this.reservationApi.deleteSharedReservations(primaryConfirmationNumber);
  }

  async deleteCurrentReservationIfOpen(): Promise<void> {
    if (this.page.isClosed()) return;
    if (!(await this.reservationNumber.isVisible())) return;

    const reservationNumber =
      (await this.reservationNumber.textContent())?.trim() ?? "";
    if (reservationNumber && reservationNumber !== "0") {
      await this.reservationApi.deleteReservation(reservationNumber);
    }
  }

  async scrollToReservationHeader(): Promise<void> {
    await this.page
      .locator("//h2[contains(text(),'Reservation #:')]")
      .scrollIntoViewIfNeeded();
  }

  // ***************** Shared Guest *********************************

  async createArrivalReservation(
    findReservationPage: FindReservationPage,
    arrivalDate: string,
    onCreated?: (confirmationNumber: string) => void,
    room?: { roomType: string; name: string },
    email?: string,
    nights = 1,
  ): Promise<string> {
    return this.createRegularReservation(
      findReservationPage,
      arrivalDate,
      this.addDays(arrivalDate, nights),
      onCreated,
      room,
      email,
    );
  }

  async getGuestFullName(): Promise<string> {
    const firstName = await this.firstNameInput.inputValue();
    const lastName = await this.lastNameInput.inputValue();
    return `${firstName} ${lastName}`.replace(/\s+/g, " ").trim();
  }

  async createDepartureReservation(
    findReservationPage: FindReservationPage,
    departureDate: string,
    onCreated?: (confirmationNumber: string) => void,
    email?: string,
  ): Promise<string> {
    return this.createRegularReservation(
      findReservationPage,
      this.addDays(departureDate, -1),
      departureDate,
      onCreated,
      undefined,
      email,
    );
  }

  async createStayoverReservation(
    findReservationPage: FindReservationPage,
    selectedDate: string,
    arrivalOffset: number,
    departureOffset: number,
    onCreated?: (confirmationNumber: string) => void,
  ): Promise<string> {
    return this.createRegularReservation(
      findReservationPage,
      this.addDays(selectedDate, arrivalOffset),
      this.addDays(selectedDate, departureOffset),
      onCreated,
    );
  }

  private async createRegularReservation(
    findReservationPage: FindReservationPage,
    arrivalDate: string,
    departureDate: string,
    onCreated?: (confirmationNumber: string) => void,
    room?: { roomType: string; name: string },
    email?: string,
  ): Promise<string> {
    const formatDate = (isoDate: string): string => {
      const [year, month, day] = isoDate.split("-");
      if (!year || !month || !day) throw new Error(`Expected a YYYY-MM-DD date, got '${isoDate}'.`);
      return `${Number(month)}/${Number(day)}/${year}`;
    };
    const formattedArrival = formatDate(arrivalDate);
    const formattedDeparture = formatDate(departureDate);
    await findReservationPage.chooseReservationTypeRegular();
    await findReservationPage.addNewReservation();
    await this.enterArrivalDateBeforeRoomSelection(formattedArrival);
    await this.enterDepartureDate(formattedDeparture);
    await this.selectRoomType(room?.roomType ?? ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    if (room) await this.selectRoomByName(room.name);
    else await this.selectFirstRoomFromDropdown();
    await this.enterGuestInfo(email ?? TestDataGenerator.email());
    await this.enterPaymentMethod(ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH);
    await this.verifyArrivalDate(formattedArrival);
    await this.verifyDepartureDate(formattedDeparture);
    await this.clickSaveButton();
    const confirmationNumber = await this.getReservationNumber();
    onCreated?.(confirmationNumber);
    await this.verifyAlertMessage(AlertMessages.RESERVATION_SAVED_SUCCESS);
    return confirmationNumber;
  }

  private addDays(isoDate: string, offset: number): string {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate) || !Number.isInteger(offset)) {
      throw new Error("Reservation date offsets require a YYYY-MM-DD date and whole-day offset.");
    }
    const date = new Date(`${isoDate}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  }

  async selectBookingType(bookingType: string): Promise<void> {
    await this.bookingTypeDropdown.click();
    await this.page
      .locator(".cdk-overlay-pane:visible")
      .getByRole("option", { name: bookingType, exact: true })
      .click();
    await expect(this.bookingTypeDropdown).toContainText(bookingType);
  }

  async clickSharedGuestDropdown(): Promise<void> {
    await this.sharedGuestDropdown.click();
  }

  async clickSharedAddGuestOption(): Promise<void> {
    await this.clickSharedGuestDropdown();
    await this.addGuestOption.click();
  }

  async selectSharedGuestOptionByIndex(index: number): Promise<void> {
    await this.clickSharedGuestDropdown();
    await this.page
      .locator(".cdk-overlay-pane:visible")
      .last()
      .getByRole("option")
      .nth(index)
      .click();
  }

  // ***************** Room Selection - Dates *********************************

  async clickRoomSelectionEnableEdit(): Promise<void> {
    await this.roomSelectionEnableEditRow.click();
  }

  async enterArrivalDate(date: string): Promise<void> {
    const calculateTaxesResponse = this.waitForCalculateTaxesResponse();
    await this.arrivalDateInput.fill(date);
    await this.arrivalDateInput.press("Tab");
    await calculateTaxesResponse;
    await this.confirmUnavailableRoomDateChangeIfShown();
  }

  async enterArrivalDateBeforeRoomSelection(date: string): Promise<void> {
    await this.arrivalDateInput.fill(date);
    await this.arrivalDateInput.press("Tab");
    await expect(this.arrivalDateInput).toHaveValue(date);
  }

  async confirmUnavailableRoomDateChangeIfShown(): Promise<void> {
    const unavailableRoomMessage = this.page.getByText(
      /selected Room is not available.*change dates/i,
    );

    const messageAppeared = await unavailableRoomMessage
      .waitFor({ state: "visible", timeout: 3000 })
      .then(() => true)
      .catch(() => false);

    const openSelectBackdrop = this.page.locator(
      ".cdk-overlay-transparent-backdrop.cdk-overlay-backdrop-showing",
    );

    if (messageAppeared) {
      if (await openSelectBackdrop.isVisible()) {
        await this.page.keyboard.press("Escape");
        await expect(openSelectBackdrop).toBeHidden();
      }

      await this.overlapYesButton.click();
      await expect(unavailableRoomMessage).toBeHidden();
    }

    if (await openSelectBackdrop.isVisible()) {
      await this.page.keyboard.press("Escape");
      await expect(openSelectBackdrop).toBeHidden();
    }
  }

  async enterDepartureDate(date: string): Promise<void> {
    await this.departureDateInput.waitFor({ state: "visible" });
    await this.departureDateInput.selectText();
    await this.page.evaluate(
      (el) => {
        (el as HTMLInputElement).value = "";
      },
      await this.departureDateInput.elementHandle(),
    );
    await this.departureDateInput.fill(date);
    await this.departureDateInput.dispatchEvent("input");
    await this.departureDateInput.dispatchEvent("change");
    await this.departureDateInput.press("Tab");
    await this.confirmUnavailableRoomDateChangeIfShown();
  }

  async chooseArrivalDateFromCalendar(fullDate: string): Promise<void> {
    await this.startDateCalendarButton.click();
    await this.page
      .locator(`//td[@role='gridcell' and @aria-label='${fullDate}']`)
      .click();
  }

  async chooseCustomArrivalDate(
    year: string,
    month: string,
    date: string,
  ): Promise<void> {
    await this.startDateCalendarButton.click();
    await this.datePickerMonthYearButton.click();
    await this.page.locator(`//div[contains(text(),'${year}')]`).click();
    await this.page.locator(`//*[contains(text(),'${month}')]`).click();
    await this.page
      .locator(`//td[@aria-label='${month} ${date}, ${year}']`)
      .click();
  }

  async enterNumberOfNights(nights: string): Promise<void> {
    await this.page
      .locator("//span[contains(text(),'Nights')]")
      .scrollIntoViewIfNeeded();
    await this.enableRoomEditRow();
    await expect(this.numberOfNightsInput).toBeVisible({ timeout: 15000 });
    await expect(this.numberOfNightsInput).toBeEnabled({ timeout: 15000 });
    await expect(this.roomEditProgressBars).toHaveCount(0, { timeout: 15000 });
    const previousRoomTotal =
      (await this.bookingSummaryRoomTotal.textContent())?.trim() ?? "";
    const calculateTaxesResponse = this.waitForCalculateTaxesResponse();
    await this.numberOfNightsInput.fill(nights);
    await this.numberOfNightsInput.press("Tab");
    await this.confirmUnavailableRoomDateChangeIfShown();
    if (!(await this.roomDropdown.innerText()).trim()) {
      await this.selectFirstRoomFromDropdown();
    }
    await expect(this.numberOfNightsInput).toHaveValue(nights);
    await calculateTaxesResponse;
    await expect(this.roomEditProgressBars).toHaveCount(0, { timeout: 15000 });
    await this.waitForRoomTotalToChange(previousRoomTotal);
  }

  // ***************** Room Selection - Room Type / Room *********************************

  async waitForRoomTypeOptionsToLoad(roomType: string): Promise<void> {
    await this.enableRoomEditRow();
    const editableRoomTypeDropdown = this.page.locator(
      "tr[approomedit] #roomTypeControl",
    );
    await expect(editableRoomTypeDropdown).toBeVisible({ timeout: 15000 });
    await expect(editableRoomTypeDropdown).toBeEnabled({ timeout: 15000 });
    await this.openDropdown(editableRoomTypeDropdown, "Room type");

    const roomTypeOption = this.page
      .locator(".cdk-overlay-pane:visible")
      .getByRole("option", { name: roomType, exact: true });
    await expect(roomTypeOption).toBeVisible({ timeout: 15000 });
  }

  async selectRoomType(roomType: string): Promise<void> {
    await this.waitForRoomTypeOptionsToLoad(roomType);
    await this.page
      .locator(".cdk-overlay-pane:visible")
      .getByRole("option", { name: roomType, exact: true })
      .click();
    const editableRoomTypeDropdown = this.page.locator(
      "tr[approomedit] #roomTypeControl",
    );
    await expect(editableRoomTypeDropdown).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(editableRoomTypeDropdown).toContainText(roomType);
  }

  async selectSecondRoomType(roomType: string): Promise<void> {
    await this.selectRoomType(roomType);
  }

  async waitForRoomTypesToLoad(): Promise<void> {
    await this.roomTypeDropdown.waitFor({ state: "visible", timeout: 15000 });
    const availableRoomType = this.page
      .locator(".cdk-overlay-pane:visible")
      .getByRole("option")
      .nth(1);

    await expect(async () => {
      if (
        (await this.roomTypeDropdown.getAttribute("aria-expanded")) ===
          "true" &&
        !(await availableRoomType.isVisible())
      ) {
        await this.page.keyboard.press("Escape");
        await expect(this.roomTypeDropdown).toHaveAttribute(
          "aria-expanded",
          "false",
        );
      }

      await this.openDropdown(this.roomTypeDropdown, "Room type");
      await expect(availableRoomType).toBeVisible({ timeout: 5000 });
    }).toPass({ timeout: 15000 });
  }

  async selectFirstAvailableRoomType(): Promise<void> {
    await this.waitForRoomTypesToLoad();
    const firstOption = this.page
      .locator(".cdk-overlay-pane:visible")
      .getByRole("option")
      .nth(1);
    await firstOption.click();
    await this.page.keyboard.press("Tab");
  }

  async selectFirstRoomFromDropdown(): Promise<void> {
    await this.enableRoomEditRow();
    await expect(this.roomDropdown).toBeVisible({ timeout: 15000 });
    await expect(this.roomDropdown).toBeEnabled({ timeout: 15000 });
    await this.openDropdown(this.roomDropdown, "Room");
    const firstOption = this.page
      .locator(".cdk-overlay-pane:visible")
      .getByRole("option")
      .first();
    await expect(firstOption).toBeVisible({ timeout: 15000 });

    const calculateTaxesResponse = this.waitForCalculateTaxesResponse();
    await firstOption.click();
    const overlayBackdrop = this.page.locator(
      ".cdk-overlay-transparent-backdrop.cdk-overlay-backdrop-showing",
    );
    await this.page.keyboard.press("Escape");
    await expect(this.roomDropdown).toHaveAttribute("aria-expanded", "false");
    await expect(overlayBackdrop).toBeHidden({ timeout: 10000 });
    await calculateTaxesResponse;
  }

  async selectReservationStatus(status: string): Promise<void> {
    await this.reservationStatusDropdown.click();
    const options = this.page
      .locator(".cdk-overlay-pane:visible")
      .getByRole("option");
    const availableStatuses = await options.allTextContents();
    const normalizedStatus = status.replace(/[\s-]/g, "").toLowerCase();
    const statusIndex = availableStatuses.findIndex(
      (option) => option.replace(/[\s-]/g, "").toLowerCase() === normalizedStatus,
    );

    if (statusIndex === -1) {
      throw new Error(
        `Reservation status '${status}' is unavailable. Available statuses: ${availableStatuses.map((option) => `'${option.trim()}'`).join(", ")}.`,
      );
    }

    await options.nth(statusIndex).click();
    await expect(this.reservationStatusDropdown).toContainText(
      new RegExp(status.replace(/[\s-]/g, "[\\s-]*"), "i"),
    );
  }

  async selectUnassignedRoomFromDropdown(): Promise<void> {
    await this.enableRoomEditRow();
    await expect(this.roomDropdown).toBeVisible({ timeout: 15000 });
    await expect(this.roomDropdown).toBeEnabled({ timeout: 15000 });
    await this.openDropdown(this.roomDropdown, "Room");
    const unassignedOption = this.page
      .locator(".cdk-overlay-pane:visible")
      .getByRole("option", { name: "Unassigned", exact: true });
    if (!(await unassignedOption.isVisible())) {
      await this.page.keyboard.press("Escape");
      throw new Error(
        'Application defect: the room dropdown does not contain the "Unassigned" option.',
      );
    }

    const calculateTaxesResponse = this.waitForCalculateTaxesResponse();
    await unassignedOption.click();
    await this.page.keyboard.press("Escape");
    await expect(this.roomDropdown).toHaveAttribute("aria-expanded", "false");
    await calculateTaxesResponse;
  }

  async selectRoomTypeWithUnassignedRoom(): Promise<void> {
    await this.waitForRoomTypesToLoad();
    const roomTypeOptions = this.page
      .locator(".cdk-overlay-pane:visible")
      .getByRole("option");
    const roomTypeNames = (await roomTypeOptions.allTextContents())
      .map((name) => name.trim())
      .filter(Boolean)
      .slice(1);
    await this.page.keyboard.press("Escape");

    for (const roomTypeName of roomTypeNames) {
      await this.selectRoomType(roomTypeName);
      try {
        await this.selectUnassignedRoomFromDropdown();
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!message.startsWith("Application defect:")) {
          throw error;
        }
      }
    }

    throw new Error(
      'Application defect: no available room type contains the "Unassigned" room option.',
    );
  }

  async selectAnotherAvailableRoomFromDropdown(): Promise<void> {
    await this.enableRoomEditRow();
    await this.openDropdown(this.roomDropdown, "Room");
    const anotherRoomOption = this.page
      .locator(".cdk-overlay-pane:visible")
      .getByRole("option")
      .nth(1);
    await expect(anotherRoomOption).toBeVisible({ timeout: 15000 });

    const calculateTaxesResponse = this.waitForCalculateTaxesResponse();
    await anotherRoomOption.click();
    await calculateTaxesResponse;
  }

  async selectSecondRoomFromDropdown(): Promise<void> {
    const secondOption = this.page.getByRole("option").nth(1);
    await secondOption.waitFor({ state: "visible" });

    const calculateTaxesResponse = this.waitForCalculateTaxesResponse();
    await secondOption.click();
    await this.page.keyboard.press("Tab");
    await calculateTaxesResponse;
  }

  async selectRoomByName(roomName: string): Promise<void> {
    await this.roomDropdown.waitFor({ state: "visible" });
    await this.roomDropdown.click();
    await this.roomDropdownOptions.first().waitFor({ state: "visible" });

    const options = await this.roomDropdownOptions.all();

    for (const option of options) {
      const text = (await option.textContent())?.trim() ?? "";

      if (text.startsWith(roomName)) {
        const calculateTaxesResponse = this.waitForCalculateTaxesResponse();
        await option.click();
        const overlayBackdrop = this.page.locator(
          ".cdk-overlay-transparent-backdrop.cdk-overlay-backdrop-showing",
        );
        await this.page.keyboard.press("Escape");
        await expect(this.roomDropdown).toHaveAttribute("aria-expanded", "false");
        await expect(overlayBackdrop).toBeHidden({ timeout: 10000 });
        await calculateTaxesResponse;
        return;
      }
    }

    throw new Error(`Room '${roomName}' was not available for selection.`);
  }

  async deleteRoomByRoomTypeName(roomTypeName: string): Promise<void> {
    await this.page
      .locator(
        `//td[normalize-space()='${roomTypeName}']/following-sibling::td//button[@mat-icon-button and .//mat-icon[normalize-space()='delete']]`,
      )
      .click();
  }

  async deleteRoomByRoomTypeNameIfPresent(
    roomTypeName: string,
  ): Promise<void> {
    const deleteButton = this.page.locator(
      `//td[normalize-space()='${roomTypeName}']/following-sibling::td//button[@mat-icon-button and .//mat-icon[normalize-space()='delete']]`,
    );

    if (await deleteButton.isVisible()) {
      await deleteButton.click({ timeout: 3000 }).catch(() => {
        // The individual-reservation deletion can remove the block while this
        // click is being actionability-checked.
      });
    }
  }

  async clickGroupReserveButton(): Promise<void> {
    await this.groupReserveButton.click();
  }

  async clickAddAnotherRoom(): Promise<void> {
    const roomTable = this.page.locator("table.rooms-regular-table");
    const committedRows = roomTable.locator("tr.ng-star-inserted");
    const previousRowCount = await committedRows.count();

    await this.addAnotherRoomButton.click();
    await expect(committedRows).toHaveCount(previousRowCount + 1, {
      timeout: 15000,
    });
    await expect(
      roomTable.locator("tr[approomedit] #roomTypeControl"),
    ).toBeVisible({ timeout: 15000 });
  }

  // ***************** Hourly *********************************

  async selectFirstHourlyRoom(): Promise<void> {
    await this.hourlyRoomDropdown.click();
    const firstOption = this.page
      .locator(".cdk-overlay-pane:visible")
      .getByRole("option")
      .first();
    await expect(firstOption).toBeVisible({ timeout: 15000 });
    await firstOption.click();
    await this.page.keyboard.press("Tab");
  }

  async selectStartTime(): Promise<void> {
    await this.startTimeDropdown.click();
    await this.firstStartTimeOption.click();
  }

  async enterHours(numberOfHours: string): Promise<void> {
    await this.hoursInput.fill(numberOfHours);
    await this.hoursInput.press("Tab");
  }

  // ***************** Package *********************************

  async chooseFirstPackage(): Promise<void> {
    await this.packageDropdown.click();
    await this.packageFirstOption.click();
  }

  async chooseFirstPackageRoom(): Promise<void> {
    if ((await this.packageRoomDropdown.innerText()).includes("No Rooms Available")) {
      throw new Error(
        "Application defect: the selected package has no rooms available.",
      );
    }
    const firstOption = this.page
      .locator(".cdk-overlay-pane:visible")
      .getByRole("option")
      .first();
    try {
      await expect(async () => {
        await this.openDropdown(this.packageRoomDropdown, "Package room");
        await expect(firstOption).toBeVisible({ timeout: 3000 });
      }).toPass({ timeout: 15000 });
    } catch {
      throw new Error(
        "Application defect: the selected package has no rooms available.",
      );
    }
    await firstOption.click();
    await this.page.keyboard.press("Escape");
  }

  async clickPackageAddRoomButton(): Promise<void> {
    await this.packageAddRoomButton.click();
  }

  // ***************** Guest Counts *********************************

  async enterNumberOfAdults(count: string): Promise<void> {
    await this.enableRoomEditRow();
    await this.adultsInput.fill(count);
    await this.adultsInput.press("Tab");
    await expect(this.roomEditProgressBars).toHaveCount(0, { timeout: 15000 });
  }

  async enterNumberOfChildren(count: string): Promise<void> {
    await this.childrenInput.fill(count);
  }

  // ***************** Guest Info - Regular *********************************

  async enterGuestInfo(email = ConfigManager.testData.emailAddress): Promise<void> {
    await this.enterGuestAutocompleteField(
      this.firstNameInput,
      TestDataGenerator.firstName(),
    );
    await this.enterGuestAutocompleteField(
      this.lastNameInput,
      TestDataGenerator.lastName(),
    );
    await this.enterGuestField(this.addressInput, TestDataGenerator.address());
    await this.enterGuestField(this.cityInput, TestDataGenerator.city());
    await this.enterGuestField(this.stateInput, TestDataGenerator.state());
    await this.enterGuestField(this.countryInput, TestDataGenerator.country());
    await this.enterGuestField(this.zipInput, TestDataGenerator.zipCode());
    await this.enterGuestField(this.mobileInput, TestDataGenerator.phoneNumber());
    await this.enterGuestAutocompleteField(
      this.emailInput,
      email,
    );
  }

  private async enterGuestField(input: Locator, value: string): Promise<void> {
    await input.fill(value);
    await input.press("Tab");
    await this.page.keyboard.press("Escape");
  }

  private async enterGuestAutocompleteField(
    input: Locator,
    value: string,
  ): Promise<void> {
    await input.clear();
    await input.pressSequentially(value, { delay: 50 });
    await input.press("Tab");
    await this.page.keyboard.press("Escape");
  }

  async saveGuestInfoAndVerify(
    paymentMethod: string = ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
  ): Promise<void> {
    await this.enterGuestInfo();
    await this.enterPaymentMethod(paymentMethod);

    await this.clickSaveButton();
    await this.verifyAlertMessage(AlertMessages.RESERVATION_SAVED_SUCCESS);
  }

  // ***************** Guest Info - Group *********************************

  async enterGroupName(): Promise<void> {
    await this.groupNameInput.fill(TestDataGenerator.groupName());
  }

  async enterGroupNameValue(groupName: string): Promise<void> {
    await this.groupNameInput.fill(groupName);
  }

  async enterGroupReserveGuestInfo(): Promise<void> {
    await this.groupFirstNameInput.fill(TestDataGenerator.firstName());
    await this.groupLastNameInput.fill(TestDataGenerator.lastName());
    await this.groupAddressInput.fill(TestDataGenerator.address());
    await this.groupCityInput.fill(TestDataGenerator.city());
    await this.groupStateInput.fill(TestDataGenerator.state());
    await this.groupCountryInput.fill(TestDataGenerator.country());
    await this.groupZipInput.fill(TestDataGenerator.zipCode());
    await this.groupMobileInput.fill(TestDataGenerator.phoneNumber());
    await this.groupEmailInput.fill(ConfigManager.testData.emailAddress);
  }

  async enterGroupReserveGuestDetails(guest: {
    firstName: string;
    lastName: string;
  }): Promise<void> {
    await this.groupFirstNameInput.fill(guest.firstName);
    await this.groupLastNameInput.fill(guest.lastName);
    await this.groupAddressInput.fill(TestDataGenerator.address());
    await this.groupCityInput.fill(TestDataGenerator.city());
    await this.groupStateInput.fill(TestDataGenerator.state());
    await this.groupCountryInput.fill(TestDataGenerator.country());
    await this.groupZipInput.fill(TestDataGenerator.zipCode());
    await this.groupMobileInput.fill(TestDataGenerator.phoneNumber());
    await this.groupEmailInput.fill(ConfigManager.testData.emailAddress);
  }

  async enterGuestDetails(guest: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    zip?: string;
  }): Promise<void> {
    await this.firstNameInput.fill(guest.firstName);
    await this.lastNameInput.fill(guest.lastName);
    await this.emailInput.fill(guest.email);
    await this.mobileInput.fill(guest.phone ?? TestDataGenerator.phoneNumber());
    await this.addressInput.fill(guest.address ?? TestDataGenerator.address());
    await this.cityInput.fill(guest.city ?? TestDataGenerator.city());
    await this.stateInput.fill(guest.state ?? TestDataGenerator.state());
    await this.countryInput.fill(guest.country ?? TestDataGenerator.country());
    await this.zipInput.fill(guest.zip ?? TestDataGenerator.zipCode());
    await this.zipInput.press("Tab");
    await this.page.keyboard.press("Escape");
  }

  async removeGuest(): Promise<void> {
    await this.removeGuestButton.click();
  }

  async selectExistingGuest(firstName: string): Promise<void> {
    await this.firstNameInput.fill(firstName);
    const guestOption = this.page
      .locator(".cdk-overlay-pane:visible")
      .getByRole("option", { name: new RegExp(firstName, "i") })
      .first();
    await expect(guestOption).toBeVisible();
    await guestOption.click();
  }

  async verifyGuestDetails(guest: {
    firstName: string;
    lastName: string;
    email: string;
  }): Promise<void> {
    await expect(this.firstNameInput).toHaveValue(guest.firstName);
    await expect(this.lastNameInput).toHaveValue(guest.lastName);
    await expect(this.emailInput).toHaveValue(guest.email);
  }

  async enterContactDetails(guest: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  }): Promise<void> {
    await this.firstNameInput.fill(guest.firstName);
    await this.lastNameInput.fill(guest.lastName);
    await this.emailInput.fill(guest.email);
    await this.mobileInput.fill(guest.phone);
  }

  async selectZipCodeSuggestion(zipCode: string): Promise<void> {
    await this.zipInput.clear();
    await this.zipInput.pressSequentially(zipCode, { delay: 150 });
    const suggestion = this.zipSuggestionOptions.filter({ hasText: zipCode }).first();
    try {
      await expect(suggestion).toBeVisible({ timeout: 15000 });
    } catch {
      throw new Error(
        `Application defect: valid ZIP '${zipCode}' did not produce an autocomplete suggestion.`,
      );
    }
    await suggestion.click();
  }

  async verifyZipLocation(location: {
    zipCode: string;
    city: string;
    state: string;
    country: string;
  }): Promise<void> {
    await expect(this.zipInput).toHaveValue(location.zipCode);
    await expect(this.cityInput).toHaveValue(location.city);
    await expect(this.stateInput).toHaveValue(location.state);
    await expect(this.countryInput).toHaveValue(location.country);
  }

  async enterLocationDetails(location: {
    city: string;
    state: string;
    country: string;
  }): Promise<void> {
    await this.cityInput.fill(location.city);
    await this.stateInput.fill(location.state);
    await this.countryInput.fill(location.country);
  }

  async verifyLocationDetails(location: {
    city: string;
    state: string;
    country: string;
  }): Promise<void> {
    await expect(this.cityInput).toHaveValue(location.city);
    await expect(this.stateInput).toHaveValue(location.state);
    await expect(this.countryInput).toHaveValue(location.country);
  }

  async verifyContactDetails(guest: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  }): Promise<void> {
    await expect(this.firstNameInput).toHaveValue(guest.firstName);
    await expect(this.lastNameInput).toHaveValue(guest.lastName);
    await expect(this.emailInput).toHaveValue(guest.email);
    await expect(this.mobileInput).toHaveValue(guest.phone);
  }

  async enterInvalidZipCode(zipCode: string): Promise<void> {
    await this.zipInput.clear();
    await this.zipInput.pressSequentially(zipCode);
  }

  async verifyNoZipRecordsFound(): Promise<void> {
    await expect(this.noZipRecordsMessage).toBeVisible({ timeout: 15000 });
  }

  async verifyEmailIsRequired(): Promise<void> {
    await expect(this.emailInput).toHaveAttribute("aria-invalid", "true");
  }

  async clickSaveWithInvalidGuestData(): Promise<void> {
    // Trigger Angular's blur validation before submitting the reservation.
    await this.emailInput.press("Tab");
    await this.saveButton.click();
  }

  async saveGroupReservationAndVerify(): Promise<void> {
    await this.enterGroupName();
    await this.enterGroupReserveGuestInfo();
    await this.enterPaymentMethod(ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH);
    await this.clickGroupSaveButton();
    await this.verifyAlertMessage(AlertMessages.RESERVATION_SAVED_SUCCESS);
  }

  async enterGroupMemberGuestInfo(): Promise<void> {
    await this.enterGroupMemberGuestDetails({
      firstName: TestDataGenerator.firstName(),
      lastName: TestDataGenerator.lastName(),
      email: ConfigManager.testData.emailAddress,
    });
  }

  async enterGroupMemberGuestDetails(guest: {
    firstName: string;
    lastName: string;
    email: string;
  }): Promise<void> {
    const memberDialog = this.page.getByRole("dialog").last();
    await memberDialog
      .locator("input[formcontrolname='firstName']")
      .fill(guest.firstName);
    await memberDialog
      .locator("input[formcontrolname='lastName']")
      .fill(guest.lastName);
    await memberDialog
      .locator("input[formcontrolname='address']")
      .fill(TestDataGenerator.address());
    await memberDialog
      .locator("input[formcontrolname='city']")
      .fill(TestDataGenerator.city());
    await memberDialog
      .locator("input[formcontrolname='state']")
      .fill(TestDataGenerator.state());
    await memberDialog
      .locator("input[formcontrolname='country']")
      .fill(TestDataGenerator.country());
    await memberDialog
      .locator("input[formcontrolname='zip']")
      .fill(TestDataGenerator.zipCode());
    await memberDialog
      .locator("input[formcontrolname='phone']")
      .fill(TestDataGenerator.phoneNumber());
    await memberDialog
      .locator("input[formcontrolname='email']")
      .fill(guest.email);
  }

  async enterGroupMemberPaymentMethod(paymentName: string): Promise<void> {
    await this.page
      .getByRole("dialog")
      .last()
      .getByRole("combobox", { name: "Account Code", exact: true })
      .fill(paymentName);
  }

  async clickGroupMemberSaveButton(): Promise<void> {
    const memberDialog = this.page.getByRole("dialog").last();
    const savedAlert = this.alertMessage
      .filter({ hasText: AlertMessages.RESERVATION_SAVED_SUCCESS })
      .last();
    const alertAppeared = savedAlert.waitFor({
      state: "visible",
      timeout: 15_000,
    });
    await memberDialog.getByRole("button", { name: "Save", exact: true }).click();
    await alertAppeared;
    this.lastAlertMessage = (await savedAlert.textContent())?.trim() ?? "";
  }

  // ***************** Payment Info *********************************

  async enterPaymentMethod(paymentName: string): Promise<void> {
    // The payment-method list is populated asynchronously after the reservation
    // form opens. Do not allow a save until its input is ready to accept a value.
    await expect(this.paymentMethodInput).toBeVisible({ timeout: 120_000 });
    await expect(this.paymentMethodInput).toBeEnabled({ timeout: 120_000 });
    await this.paymentMethodInput.fill(paymentName);
    await expect(this.paymentMethodInput).toHaveValue(
      new RegExp(`\\(${this.escapeRegExp(paymentName)}\\)\\s*$`),
      {
        timeout: 120_000,
      },
    );
    await this.paymentMethodInput.press("Tab");
    await expect(this.paymentMethodInput).not.toBeFocused();
    await expect(this.paymentMethodInput).toHaveValue(
      new RegExp(`\\(${this.escapeRegExp(paymentName)}\\)\\s*$`),
    );
  }

  // ***************** Notes *********************************

  async enterNotes(notesText: string): Promise<void> {
    await this.notesTextbox.fill(notesText);
    await expect(this.notesTextbox).toHaveValue(notesText);
    await this.notesTextbox.press("Tab");
    await expect(this.notesTextbox).not.toBeFocused();
  }

  // ***************** Discount *********************************

  async addDiscount(
    discountName: string,
    discountAmount: string,
  ): Promise<void> {
    await this.bookingSummaryDiscount
      .filter({ hasText: "0.00" })
      .waitFor({ state: "visible" });
    await this.bookingSummaryAddDiscountButton.click();
    await this.discountDropdown.click();
    await this.page
      .locator(
        `//span[@class='mat-option-text' and normalize-space(text())='${discountName}']`,
      )
      .click();
    await this.discountRateInput.fill(discountAmount);
    await expect(this.discountAmountProgressBar).toBeHidden({ timeout: 15000 });
    await this.discountApplyButton.click();
    await expect(this.bookingSummaryProgressBar).toBeHidden({ timeout: 15000 });
    await expect(this.bookingSummaryDiscount).not.toHaveText("0.00", {
      timeout: 15000,
    });
  }

  async removeDiscount(): Promise<void> {
    const availableButtons = await this.page
      .locator("app-discounts button")
      .allTextContents();
    if (!(await this.discountRemoveButton.isVisible())) {
      throw new Error(
        `Cannot remove the reservation discount: no delete control was found in the discount panel. Available discount-panel buttons: ${availableButtons.map((button) => `'${button.trim()}'`).join(", ") || "none"}.`,
      );
    }
    await this.discountRemoveButton.click();
    await expect(this.bookingSummaryDiscount).toContainText("0.00", {
      timeout: 15000,
    });
  }

  async clickEditRoomRate(): Promise<void> {
    await this.roomTotalEditButton.click();
    await expect(this.rateEditPopup).toBeVisible({ timeout: 15000 });
  }

  async enterEditedRoomRate(amount: string): Promise<void> {
    await this.rateEditPopupAmountInput.fill(amount);
  }

  async clickSaveEditedRoomRate(): Promise<void> {
    await this.rateEditPopupSaveButton.click();
    await expect(this.rateEditPopup).toBeHidden({ timeout: 15000 });
  }

  // ***************** Footer Actions *********************************

  async clickSaveButton(): Promise<void> {
    // A visible success snackbar from a preceding action would otherwise make
    // the waiter below resolve before this save request has completed.
    await this.waitForAlertMessageToClose();
    await expect(this.paymentMethodInput).toHaveValue(/\(\d+\)\s*$/, {
      timeout: 120_000,
    });

    const savedAlert = this.alertMessage
      .filter({ hasText: AlertMessages.RESERVATION_SAVED_SUCCESS })
      .last();
    const alertAppeared = savedAlert.waitFor({
      state: "visible",
      timeout: 15000,
    });
    await expect(this.saveButton).toBeEnabled();
    await this.saveButton.click();
    await alertAppeared;
    this.lastAlertMessage = (await savedAlert.textContent())?.trim() ?? "";
  }

  async clickGroupSaveButton(): Promise<void> {
    await this.groupSaveButton.click();
  }

  async clickDeleteButton(): Promise<void> {
    this.page.once("dialog", async (dialog) => {
      await dialog.accept();
    });
    await this.deleteButton.click();
  }

  async deleteSharedGuestReservations(): Promise<void> {
    await this.deleteCurrentReservationAndWait();

    if (await this.reservationDialog.isVisible()) {
      await this.deleteCurrentReservationAndWait();
    }
  }

  async clickGroupIndividualDeleteButton(): Promise<void> {
    const deletedAlert = this.alertMessage
      .filter({ hasText: AlertMessages.RESERVATION_DELETE_SUCCESS })
      .last();
    const deletionCompleted = Promise.race([
      deletedAlert
        .waitFor({ state: "visible", timeout: 15000 })
        .then(() => "alert" as const)
        .catch((error: unknown) => {
          if (this.page.isClosed()) return "closed" as const;
          throw error;
        }),
      this.page.waitForEvent("close").then(() => "closed" as const),
    ]);
    const confirmation = this.page
      .waitForEvent("dialog")
      .then(async (dialog) => dialog.accept());

    await Promise.all([
      confirmation,
      this.groupIndividualDeleteButton.click(),
    ]);
    const completion = await deletionCompleted;
    if (completion === "alert" && !this.page.isClosed()) {
      this.lastAlertMessage = AlertMessages.RESERVATION_DELETE_SUCCESS;
    }
  }

  async deleteGroupReservationBlockAndGroup(): Promise<void> {
    const roomTypeName = await this.getRoomTypeName();
    await this.clickGroupIndividualDeleteButton();
    await this.deleteRoomByRoomTypeNameIfPresent(roomTypeName);

    // Removing the final block can delete the empty group and close the dialog.
    // If the group remains open, delete the group explicitly.
    if (await this.reservationDialog.isVisible()) {
      await this.clickDeleteButton();
    }
  }

  private async deleteCurrentReservationAndWait(): Promise<void> {
    const deletedAlert = this.alertMessage
      .filter({ hasText: AlertMessages.RESERVATION_DELETE_SUCCESS })
      .last();
    const deletionCompleted = Promise.race([
      deletedAlert
        .waitFor({ state: "visible", timeout: 15_000 })
        .then(() => "alert" as const)
        .catch((error: unknown) => {
          if (this.page.isClosed()) return "closed" as const;
          throw error;
        }),
      this.page.waitForEvent("close").then(() => "closed" as const),
    ]);
    const confirmation = this.page
      .waitForEvent("dialog")
      .then(async (dialog) => dialog.accept());

    await Promise.all([confirmation, this.deleteButton.click()]);
    const completion = await deletionCompleted;
    if (completion === "alert" && !this.page.isClosed()) {
      this.lastAlertMessage = AlertMessages.RESERVATION_DELETE_SUCCESS;
    }
  }

  async clickCancelButton(): Promise<void> {
    await this.cancelButton.click();
  }

  async clickCancelReservation(): Promise<void> {
    await this.cancelReservationDialogButton.waitFor({ state: "visible" });

    // Clicking the modal action opens a native browser confirmation. Register
    // the handler first so Playwright cannot miss it or leave the click blocked.
    const confirmation = this.page
      .waitForEvent("dialog")
      .then(async (dialog) => {
        await dialog.accept();
      });

    await Promise.all([
      confirmation,
      this.cancelReservationDialogButton.click(),
    ]);
  }

  async clickRestoreReservation(): Promise<void> {
    await this.restoreReservationButton.waitFor({ state: "visible" });

    const confirmation = this.page
      .waitForEvent("dialog")
      .then(async (dialog) => {
        await dialog.accept();
      });

    await Promise.all([confirmation, this.restoreReservationButton.click()]);
  }

  async clickCloseButton(): Promise<void> {
    const activeDialogCloseButton = this.page
      .getByRole("dialog")
      .last()
      .getByRole("button", { name: "Close", exact: true });
    if (await activeDialogCloseButton.isVisible()) {
      await activeDialogCloseButton.click();
      return;
    }
    await this.closeButton.click();
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // ***************** Rule Override *********************************

  async enterRuleOverridePassword(password: string): Promise<void> {
    await this.ruleOverridePasswordInput.fill(password);
  }

  async clickRuleOverrideConfirmButton(): Promise<void> {
    await this.ruleOverrideConfirmButton.click();
    await this.page.keyboard.press("Tab");
  }

  async clickRuleOverrideCancelButton(): Promise<void> {
    await this.ruleOverrideCancelButton.click();
    await this.page.keyboard.press("Tab");
  }

  // ***************** Overlap Popup *********************************

  async clickOverlapYes(): Promise<void> {
    await this.overlapYesButton.click();
  }

  async clickOverlapNo(): Promise<void> {
    await this.overlapNoButton.click();
  }

  async clickSharedRoomEditWarningNo(): Promise<void> {
    await this.sharedRoomEditWarningNoButton.click();
  }

  async clickSharedRoomEditWarningYes(): Promise<void> {
    await this.sharedRoomEditWarningYesButton.click();
  }

  // ********************************************************************
  // ***************** Assertions ***************************************
  // ********************************************************************

  async verifyReservationSaved(): Promise<void> {
    await this.verifyAlertMessage("Saved successfully");
    const resNum = (await this.reservationNumber.textContent())?.trim() ?? "";

    if (!resNum || resNum === "0") {
      throw new Error(
        `Expected a valid reservation number but got: '${resNum}'`,
      );
    }
  }

  async verifyReservationNumber(expectedNumber: string): Promise<void> {
    const actual = (await this.reservationNumber.textContent())?.trim() ?? "";

    if (actual !== expectedNumber) {
      throw new Error(
        `Expected reservation number '${expectedNumber}' but got '${actual}'`,
      );
    }
  }

  async verifyAlertMessage(expectedMessage: string): Promise<void> {
    if (this.lastAlertMessage.includes(expectedMessage)) {
      return;
    }

    await expect(this.alertMessage.last()).toContainText(expectedMessage, {
      timeout: 15000,
    });
  }

  async waitForAlertMessageToClose(): Promise<void> {
    await expect(this.alertMessage.last()).toBeHidden({ timeout: 15000 });
  }

  async verifyRuleOverridePopupDisplayed(): Promise<void> {
    await this.ruleOverridePopup.waitFor({ state: "visible" });
  }

  async verifyCancellationChargePopupDisplayed(): Promise<void> {
    await this.cancellationChargePopup.waitFor({ state: "visible" });
  }

  async verifyOverlapAlertMessage(expectedAlert: string): Promise<void> {
    const actual = (await this.overlapPopupText.textContent())?.trim() ?? "";

    if (actual !== expectedAlert) {
      throw new Error(
        `Expected overlap alert '${expectedAlert}' but got '${actual}'`,
      );
    }
  }

  async verifySharedRoomEditWarningMessage(
    expectedMessage: string,
  ): Promise<void> {
    await this.sharedRoomEditWarningText.waitFor({ state: "visible" });
    const actual =
      (await this.sharedRoomEditWarningText.textContent())?.trim() ?? "";

    if (!actual.includes(expectedMessage)) {
      throw new Error(
        `Expected shared room edit warning '${expectedMessage}' but got '${actual}'`,
      );
    }
  }

  // ***************** Assertions - Room Selection *********************************

  async verifyNightsCount(expectedNights: string): Promise<void> {
    const rawText = await this.page
      .locator("//span[contains(text(),'Nights')]")
      .textContent();
    const actual = (rawText ?? "").replace(/\D+/g, "");

    if (actual !== expectedNights) {
      throw new Error(
        `Expected nights count '${expectedNights}' but got '${actual}'`,
      );
    }
  }

  async verifyArrivalDate(expectedDate: string): Promise<void> {
    await expect(this.arrivalDateInput).toBeVisible();
    const actualDate = await this.arrivalDateInput.inputValue();
    const normalize = (date: string): string => {
      const [month, day, year] = date.split("/");
      return `${Number(month)}/${Number(day)}/${year}`;
    };
    expect(normalize(actualDate)).toBe(normalize(expectedDate));
  }

  async verifyDepartureDate(expectedDate: string): Promise<void> {
    const actual = await this.departureDateInput.inputValue();

    if (actual !== expectedDate) {
      throw new Error(
        `Expected departure date '${expectedDate}' but got '${actual}'`,
      );
    }
  }

  async verifyNumberOfNights(expectedNights: string): Promise<void> {
    const actual = await this.numberOfNightsInput.inputValue();

    if (actual !== expectedNights) {
      throw new Error(
        `Expected number of nights '${expectedNights}' but got '${actual}'`,
      );
    }
  }

  async verifyRoomTypeDisplayed(expectedRoomType: string): Promise<void> {
    const actual =
      (await this.roomTypeDropdownText.textContent())?.trim() ?? "";

    if (actual !== expectedRoomType) {
      throw new Error(
        `Expected room type '${expectedRoomType}' but got '${actual}'`,
      );
    }
  }

  async verifyRoomNameDisplayed(expectedRoomName: string): Promise<void> {
    await expect(
      this.page
        .locator('[role="dialog"]:visible')
        .last()
        .getByRole("cell", { name: expectedRoomName, exact: true }),
    ).toBeVisible();
  }

  async verifyRoomNameNotDisplayed(expectedRoomName: string): Promise<void> {
    await this.page
      .locator(
        `//tr[@class='ng-star-inserted']//td[normalize-space(text()) = '${expectedRoomName}']`,
      )
      .waitFor({ state: "hidden" });
  }

  async verifyRoomNameWarningDisplayed(): Promise<void> {
    await this.scrollToReservationHeader();
    await this.roomNameWarning.waitFor({ state: "visible" });
  }

  async verifyUnitTotal(expectedTotal: string): Promise<void> {
    await this.unitTotalCell.scrollIntoViewIfNeeded();
    await this.unitTotalCell.waitFor({ state: "visible" });
    const raw = (await this.unitTotalCell.textContent()) ?? "";
    const actual = raw.replace(/[,\s]*edit\s*/g, "").trim();

    if (actual !== expectedTotal) {
      throw new Error(
        `Expected unit total '${expectedTotal}' but got '${actual}'`,
      );
    }
  }

  async verifyRoomTotal(expectedTotal: string): Promise<void> {
    await this.roomTotalCell.scrollIntoViewIfNeeded();
    await this.roomTotalCell.waitFor({ state: "visible" });
    const raw = (await this.roomTotalCell.textContent()) ?? "";
    const actual = raw.replace(/[,\s]*edit\s*/g, "").trim();

    if (actual !== expectedTotal) {
      throw new Error(
        `Expected room total '${expectedTotal}' but got '${actual}'`,
      );
    }
  }

  async verifyRatePopupRoomTotal(expectedTotal: string): Promise<void> {
    await this.roomTotalEditButton.click();
    const raw = (await this.rateEditPopupRoomTotal.textContent()) ?? "";
    const actual = raw.replace(/,/g, "").trim();

    if (actual !== expectedTotal) {
      throw new Error(
        `Expected rate popup room total '${expectedTotal}' but got '${actual}'`,
      );
    }
  }

  async verifyAddAnotherRoomNotVisible(): Promise<void> {
    await expect(this.addAnotherRoomButton).not.toBeVisible();
  }

  // ***************** Assertions - Booking Summary *********************************

  async verifyBookingSummaryRoomTotal(expected: string): Promise<void> {
    await this.verifyLocatorText(
      this.bookingSummaryRoomTotal,
      expected,
      "Room Total",
    );
  }

  async verifyBookingSummaryEPC(expected: string): Promise<void> {
    await this.verifyLocatorText(
      this.bookingSummaryEPC,
      expected,
      "Extra Person Charge",
    );
  }

  async verifyBookingSummaryDiscount(expected: string): Promise<void> {
    await this.verifyLocatorText(
      this.bookingSummaryDiscount,
      expected,
      "Discount",
    );
  }

  async verifyBookingSummaryTax(expected: string): Promise<void> {
    await this.verifyLocatorText(this.bookingSummaryTax, expected, "Tax");
  }

  async verifyBookingSummaryMisc(expected: string): Promise<void> {
    await this.verifyLocatorText(
      this.bookingSummaryMisc,
      expected,
      "Miscellaneous",
    );
  }

  async verifyBookingSummaryMiscNotDisplayed(): Promise<void> {
    await this.verifyLocatorText(
      this.bookingSummaryMisc,
      "0.00",
      "Miscellaneous",
    );
  }

  async verifyBookingSummaryPostTaxTotal(expected: string): Promise<void> {
    await this.verifyLocatorText(
      this.bookingSummaryPostTaxTotal,
      expected,
      "Post Tax Total",
    );
  }

  async verifyBookingSummaryAmountPaid(expected: string): Promise<void> {
    await this.verifyLocatorText(
      this.bookingSummaryPaid,
      expected,
      "Amount Paid",
    );
  }

  async verifyBookingSummaryAmountDue(expected: string): Promise<void> {
    await this.verifyLocatorText(
      this.bookingSummaryAmountDue,
      expected,
      "Amount Due",
    );
  }

  // ***************** Assertions - Notes *********************************

  async verifyNotes(expectedText: string): Promise<void> {
    const actual = await this.notesTextbox.inputValue();

    if (actual !== expectedText) {
      throw new Error(`Expected notes '${expectedText}' but got '${actual}'`);
    }
  }

  // ***************** Assertions - Billing *********************************

  async verifyBillingRoomQuantity(
    roomName: string,
    expectedNights: string,
  ): Promise<void> {
    const actual = await this.page
      .locator(`(//span[contains(text(),'${roomName}')]//following::td)[1]`)
      .textContent();

    if ((actual ?? "").trim() !== expectedNights) {
      throw new Error(
        `Expected billing room quantity '${expectedNights}' but got '${actual}'`,
      );
    }
  }

  // ***************** Getters *********************************

  async getReservationNumber(): Promise<string> {
    const reservationNumber =
      (await this.reservationNumber.textContent())?.trim() ?? "";

    if (
      reservationNumber &&
      reservationNumber !== "0" &&
      !this.createdReservationNumbers.includes(reservationNumber)
    ) {
      this.createdReservationNumbers.push(reservationNumber);
    }

    return reservationNumber;
  }

  async getGroupReservationNumber(): Promise<string> {
    const header = (await this.groupReservationHeader.textContent())?.trim() ?? "";
    const match = header.match(/Group:\s*#(\d+)/);

    if (!match) {
      throw new Error(`Could not parse group reservation number from '${header}'`);
    }

    return match[1];
  }

  async getArrivalDate(): Promise<string> {
    return await this.arrivalDateInput.inputValue();
  }

  async getNumberOfNights(): Promise<string> {
    return await this.numberOfNightsInput.inputValue();
  }

  async getDepartureDate(): Promise<string> {
    return await this.departureDateInput.inputValue();
  }

  async getRoomTypeName(): Promise<string> {
    return (await this.roomTypeName.textContent())?.trim() ?? "";
  }

  async getSelectedRoomName(): Promise<string> {
    return (
      await this.roomDropdown.locator(".mat-select-min-line").innerText()
    ).trim();
  }

  async getReservationRoomNameByRoomType(
    roomTypeName: string,
  ): Promise<string> {
    return (
      (
        await this.page
          .locator(
            `//tr[@class='ng-star-inserted']//td[normalize-space(text())='${roomTypeName}']/following-sibling::td[1]`,
          )
          .textContent()
      )?.trim() ?? ""
    );
  }

  async getReservationRoomNamesByRoomType(
    roomTypeName: string,
  ): Promise<string[]> {
    const roomNames = this.page.locator(
      `//tr[@class='ng-star-inserted']//td[normalize-space(text())='${roomTypeName}']/following-sibling::td[1]`,
    );
    await expect(roomNames).toHaveCount(2);
    return (await roomNames.allTextContents()).map((roomName) => roomName.trim());
  }

  // ***************** Database Actions *********************************

  async dbGetAvailableRooms(
    roomTypeName: string,
    startDate: string,
    endDate: string,
  ): Promise<string[]> {
    return this.reservationDatabaseHelper.getAvailableRooms(
      roomTypeName,
      startDate,
      endDate,
    );
  }

  async dbGetGSTInvoiceNumber(confirmNumber: string): Promise<string | null> {
    return this.reservationDatabaseHelper.getGSTInvoiceNumber(confirmNumber);
  }

  // ***************** Private Helpers *********************************

  private async enableRoomEditRow(maxRetries: number = 3): Promise<void> {
    const roomTable = this.reservationDialog.locator("table.rooms-regular-table");
    const editRowLocator = roomTable.locator("tr[approomedit]");

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const isPresent = (await editRowLocator.count()) > 0;

      if (isPresent) {
        return;
      }

      const row = roomTable.locator("tr.ng-star-inserted").last();
      const cells = row.locator("td");
      const cellCount = await cells.count();
      const editableCellIndex = cellCount >= 12 ? 1 : 7;
      await cells.nth(editableCellIndex).click();

      try {
        await expect(editRowLocator).toBeAttached({ timeout: 2000 });
        return;
      } catch {
        // Retry when the first click only focuses the row.
      }
    }

    const isPresent = (await editRowLocator.count()) > 0;

    if (!isPresent) {
      throw new Error(
        `Failed to enable room edit row after ${maxRetries} attempts`,
      );
    }
  }

  private async openDropdown(
    dropdown: Locator,
    dropdownName: string,
  ): Promise<void> {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if ((await dropdown.getAttribute("aria-expanded")) === "true") {
        return;
      }

      await dropdown.click();

      try {
        await expect(dropdown).toHaveAttribute("aria-expanded", "true", {
          timeout: 5000,
        });
        return;
      } catch {
        if (attempt === maxAttempts) {
          throw new Error(
            `${dropdownName} dropdown did not open after ${maxAttempts} attempts`,
          );
        }
      }
    }
  }

  private async verifyLocatorText(
    locator: Locator,
    expected: string,
    fieldName: string,
  ): Promise<void> {
    await expect(
      locator,
      `Reservation booking summary did not display ${fieldName} as ${expected}.`,
    ).toHaveText(
      expected,
      { timeout: 15000 },
    );
  }

  private async waitForCalculateTaxesResponse(): Promise<void> {
    const response = await this.page.waitForResponse(
      (candidate) =>
        candidate.request().method() === "POST" &&
        candidate.url().toLowerCase().includes("calculatetaxes"),
      { timeout: 15000 },
    );

    await response.finished();

    if (response.status() !== 200) {
      throw new Error(
        `CalculateTaxes failed with HTTP ${response.status()} ${response.statusText()}`,
      );
    }
  }

  private async waitForRoomTotalToChange(
    previousRoomTotal: string,
  ): Promise<void> {
    await expect(this.bookingSummaryProgressBar).toBeHidden({ timeout: 15000 });
    await expect
      .poll(
        async () =>
          (await this.roomTotalCell.textContent())?.trim() ?? "",
        {
          message: "Room total should finish recalculating",
          timeout: 15000,
        },
      )
      .not.toBe(previousRoomTotal);
  }
}
