import { Locator, Page, expect } from "@playwright/test";
import { BasePage } from "../../utils/BasePage";

export type CustomerData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  notes: string;
};

export type CompleteCustomerData = CustomerData & {
  secondFirstName: string;
  secondLastName: string;
  secondAddress: string;
  workPhone: string;
  mobilePhone: string;
  fax: string;
  guestType: string;
  visitType: string;
  vehicleMake: string;
  vehicleModel: string;
  birthDate1: string;
  birthDate2: string;
  anniversary: string;
  license: string;
  jobTitle: string;
  custom1: string;
  custom2: string;
  custom3: string;
  custom4: string;
  custom5: string;
  custom6: string;
  doNotAllowNewReservation: boolean;
  customerStatus: string;
  assignStaff: string;
  callBackDate: string;
  callBackComments: string;
};

export type ReservationHistoryDetails = {
  confirmationNumber: string;
  roomName: string;
  checkInDate: string;
  checkOutDate: string;
  stayLength: string;
  status: string;
  roomAmount: string;
  notes?: string;
};

export class CustomerPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ***************** Page Elements *********************************

  private readonly addCustomerButton: Locator = this.page.getByTitle(
    "Add Customer",
    {
      exact: true,
    },
  );

  private readonly bulkEmailButton: Locator = this.page.getByTitle(
    "BulkEmail",
    {
      exact: true,
    },
  );

  private readonly searchInput: Locator = this.page.getByRole("textbox", {
    name: "Search records",
    exact: true,
  });

  private readonly filterButton: Locator = this.page.getByTitle("Filter", {
    exact: true,
  });

  private readonly createdDateFilter: Locator = this.page
    .getByText(/^Start Date - End Date\s*$/)
    .locator("..")
    .locator("input");

  private readonly createdDateClearButton: Locator = this.createdDateFilter
    .locator("..")
    .locator(".clear-icon");

  private readonly callBackDateFilter: Locator = this.page
    .getByText(/^Call Back Start Date - End Date\s*$/i)
    .locator("..")
    .locator("input");

  private readonly assignedStaffFilter: Locator = this.page
    .getByText(/^Assigned Staff\s*$/)
    .locator("..")
    .locator("select");

  private readonly statusFilter: Locator = this.page
    .getByText(/^Status\s*$/)
    .locator("..")
    .locator("select");

  private readonly filterType: Locator = this.page.locator("#FilterType");
  private readonly filterValue: Locator = this.page.locator(
    "input[name='FilterValue']",
  );
  private readonly applyFiltersButton: Locator = this.page
    .locator(".filter-pad button")
    .filter({ has: this.page.locator(".fa-search") });
  private readonly resetFiltersButton: Locator = this.page
    .locator(".filter-pad a")
    .filter({ has: this.page.locator(".fa-refresh") });

  private readonly dialog: Locator = this.page.getByRole("dialog");
  private readonly submitButton: Locator = this.dialog.getByRole("button", {
    name: /save|update/i,
  });
  private readonly firstName: Locator =
    this.getInputByLabel(/^First Name\s*\*?$/);
  private readonly lastName: Locator =
    this.getInputByLabel(/^Last Name\s*\*?$/);
  private readonly email: Locator = this.getInputByLabel(
    /^Email Address\s*\*?$/,
  );
  private readonly city: Locator = this.getInputByLabel(/^City\s*$/);
  private readonly phone: Locator = this.getInputByLabel(/^Mobile Number\s*$/);
  private readonly address: Locator = this.getInputByLabel(/^Address\s*$/);
  private readonly state: Locator = this.getInputByLabel(/^State\s*$/);
  private readonly country: Locator = this.getInputByLabel(/^Country\s*$/);
  private readonly postalCode: Locator = this.getInputByLabel(/^Zip\s*$/);
  private readonly company: Locator = this.getInputByLabel(/^Company Code\s*$/);
  private readonly notes: Locator = this.getInputByLabel(
    /^Display Notes when creating reservation\s*$/,
  );
  private readonly secondFirstName: Locator =
    this.getInputByLabel(/^First Name 2\s*$/);
  private readonly secondLastName: Locator =
    this.getInputByLabel(/^Last Name 2\s*$/);
  private readonly secondAddress: Locator =
    this.getInputByLabel(/^Address 2\s*$/);
  private readonly workPhone: Locator = this.getInputByLabel(/^Work Phone\s*$/);
  private readonly mobilePhone: Locator =
    this.getInputByLabel(/^Cell\/Pager\s*$/);
  private readonly fax: Locator = this.getInputByLabel(/^Fax\s*$/);
  private readonly guestType: Locator = this.getInputByLabel(/^Guest Type\s*$/);
  private readonly visitType: Locator = this.getInputByLabel(/^Visit Type\s*$/);
  private readonly vehicleMake: Locator =
    this.getInputByLabel(/^Vehicle Make\s*$/);
  private readonly vehicleModel: Locator =
    this.getInputByLabel(/^Vehicle Model\s*$/);
  private readonly birthDate1: Locator =
    this.getInputByLabel(/^Birth Date 1\s*$/);
  private readonly birthDate2: Locator =
    this.getInputByLabel(/^Birth Date 2\s*$/);
  private readonly anniversary: Locator =
    this.getInputByLabel(/^Anniversary\s*$/);
  private readonly license: Locator = this.getInputByLabel(/^License\s*$/);
  private readonly jobTitle: Locator = this.getInputByLabel(/^Job Title\s*$/);
  private readonly custom1: Locator = this.getInputByLabel(/^Custom 1\s*$/);
  private readonly custom2: Locator = this.getInputByLabel(/^Custom 2\s*$/);
  private readonly custom3: Locator = this.getInputByLabel(/^Custom 3\s*$/);
  private readonly custom4: Locator = this.getInputByLabel(/^Custom 4\s*$/);
  private readonly custom5: Locator = this.getInputByLabel(/^Custom 5\s*$/);
  private readonly custom6: Locator = this.getInputByLabel(/^Custom 6\s*$/);
  private readonly customizedField: Locator = this.getInputByLabel(
    /^(?:Customer )?Customized Field\s*$/,
  );
  private readonly doNotAllowNewReservation: Locator =
    this.dialog.getByRole("checkbox");
  private readonly customerStatus: Locator =
    this.getSelectByLabel(/^Customer Status\s*$/);
  private readonly assignStaff: Locator =
    this.getSelectByLabel(/^Assign Staff\s*$/);
  private readonly callBackDate: Locator =
    this.getInputByLabel(/^Call Back Date\s*$/);
  private readonly callBackComments: Locator = this.getInputByLabel(
    /^Call Back Comments\s*$/,
  );

  private readonly customerCreatedMessage: Locator = this.page.getByText(
    /Customer Created Successfully/i,
  );

  private readonly customerUpdatedMessage: Locator = this.page.getByText(
    /Customer (?:Updated|Modified) Successfully/i,
  );

  private readonly customerDeletedMessage: Locator = this.page.getByText(
    /Customer Deleted Successfully/i,
  );

  private readonly guestStatisticsDialog: Locator = this.page
    .getByRole("dialog")
    .filter({
      has: this.page.getByRole("heading", {
        name: "Guest Statistics",
        exact: true,
      }),
    });

  // ***************** Sub Customer Elements *********************************

  private readonly subCustomerDialog: Locator = this.page
    .getByRole("dialog")
    .filter({
      has: this.page.getByRole("heading", {
        name: "Edit Customer",
        exact: true,
      }),
    });
  private readonly additionalGuestSectionButton: Locator =
    this.subCustomerDialog.getByRole("button", {
      name: /^Additional Guest\b/i,
    });
  private readonly linkExistingSubCustomerDialog: Locator = this.page
    .getByRole("dialog")
    .filter({ hasText: /Link Existing Sub-Customer/i });

  // ***************** Navigation *********************************

  async clickAddCustomer(): Promise<void> {
    await this.waitForSpinner();
    await this.addCustomerButton.click();
    await expect(this.firstName).toBeVisible();
  }

  async clickEditCustomer(firstName: string, lastName: string): Promise<void> {
    await this.waitForSpinner();
    await this.getCustomerRow(firstName, lastName)
      .getByTitle("Edit", { exact: true })
      .click();
    await expect(this.dialog).toBeVisible();
    await expect(this.firstName).toBeVisible();
    await expect(this.firstName).toHaveValue(firstName);
  }

  async clickDeleteCustomer(
    firstName: string,
    lastName: string,
  ): Promise<void> {
    await this.getCustomerRow(firstName, lastName)
      .getByTitle("Delete", { exact: true })
      .click();
  }

  async selectCustomer(firstName: string, lastName: string): Promise<void> {
    const checkbox = this.getCustomerRow(firstName, lastName).getByRole(
      "checkbox",
    );
    await checkbox.check();
    await expect(checkbox).toBeChecked();
  }

  async unsubscribeCustomer(email: string): Promise<void> {
    await this.enterSearchKeyword(email);
    const row = this.page.getByRole("row").filter({
      has: this.page.getByRole("cell", { name: email, exact: true }),
    });
    await expect(row).toBeVisible();
    await row.getByRole("button", {
      name: "Unsubscribe from emails",
      exact: true,
    }).click();
    const confirmation = this.page.getByRole("dialog").filter({
      has: this.page.getByRole("heading", { name: "Unsubscribe from emails", exact: true }),
    });
    await expect(confirmation).toBeVisible();
    await expect(confirmation.locator("p")).toHaveText(
      "Unsubscribe this contact from emails? Future emails to this contact will be skipped.",
    );
    await confirmation.getByRole("button", { name: "Unsubscribe", exact: true }).click();
    const successAlert = this.page.getByRole("alert").filter({ hasText: /unsubscrib/i });
    await expect(successAlert).toBeVisible();
    await expect(successAlert).toHaveText("Contact unsubscribed from emails.");
    await expect(confirmation).toBeHidden();
    await expect(this.page.locator("ngx-spinner")).toBeHidden();
  }

  async verifyUnsubscribedIcon(email: string): Promise<void> {
    const row = this.page.getByRole("row").filter({
      has: this.page.getByRole("cell", { name: email, exact: true }),
    });
    const wrapper = row.locator(".unsubscribe-action-wrapper");
    await expect(wrapper).toBeVisible();
    await expect(wrapper).toHaveAttribute("title", "UnSubscribed");
    const button = wrapper.getByRole("button", {
      name: "Already unsubscribed from emails",
      exact: true,
    });
    await expect(button).toBeVisible();
    await expect(button).toBeDisabled();
    await expect(button.locator("svg")).toBeVisible();
  }

  async clickBulkEmail(): Promise<void> {
    await this.bulkEmailButton.click();
  }

  async clickResponse(firstName: string, lastName: string): Promise<void> {
    await this.getCustomerRow(firstName, lastName)
      .getByTitle("Response", { exact: true }).click();
  }

  async verifyResponseCount(firstName: string, lastName: string, count: number): Promise<void> {
    await expect(this.getCustomerRow(firstName, lastName).locator("a.count-icon"))
      .toHaveText(String(count));
  }

  async clickResponseCount(firstName: string, lastName: string): Promise<void> {
    await this.getCustomerRow(firstName, lastName).locator("a.count-icon").click();
  }

  async clickConfirmDelete(): Promise<void> {
    await this.page
      .getByRole("dialog")
      .filter({
        has: this.page.getByRole("heading", { name: "Delete", exact: true }),
      })
      .getByRole("button", { name: "Yes", exact: true })
      .click();
  }

  async clickGuestStatistics(
    firstName: string,
    lastName: string,
  ): Promise<void> {
    await this.getCustomerRow(firstName, lastName)
      .getByTitle(/Guest statistics/i)
      .first()
      .click();
    await expect(this.guestStatisticsDialog).toBeVisible();
  }

  async clickCloseGuestStatistics(): Promise<void> {
    await this.guestStatisticsDialog
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await expect(this.guestStatisticsDialog).toBeHidden();
  }

  // ***************** Sub Customer Actions *********************************

  async clickAdditionalGuest(
    firstName: string,
    lastName: string,
  ): Promise<void> {
    const action = this.getAdditionalGuestAction(firstName, lastName);
    await expect(action).toBeVisible();
    await action.click();
    await expect(this.subCustomerDialog).toBeVisible();
    await this.additionalGuestSectionButton.click();
    await expect(
      this.subCustomerDialog.getByRole("button", { name: /Add Sub Customer/i }),
    ).toBeVisible();
  }

  async clickAddSubCustomer(): Promise<void> {
    await this.subCustomerDialog
      .getByRole("button", { name: /Add Sub Customer/i })
      .click();
    await expect(this.firstName).toBeVisible();
  }

  async clickLinkExistingGuest(): Promise<void> {
    await this.subCustomerDialog
      .getByRole("button", { name: /Link Existing Guest/i })
      .click();
    await expect(this.linkExistingSubCustomerDialog).toBeVisible();
  }

  async searchAndSelectExistingGuest(searchText: string): Promise<void> {
    const combobox = this.linkExistingSubCustomerDialog.getByRole("combobox");
    await combobox.click();
    await combobox.fill(searchText);
    await this.page
      .getByRole("option")
      .filter({ hasText: searchText })
      .first()
      .click();
  }

  async enterExistingGuestSearch(searchText: string): Promise<void> {
    const combobox = this.linkExistingSubCustomerDialog.getByRole("combobox");
    await combobox.click();
    await combobox.fill(searchText);
  }

  async clickConfirmLinkGuest(): Promise<void> {
    await this.linkExistingSubCustomerDialog
      .getByRole("button", { name: /Link Guest/i })
      .click();
    await expect(this.linkExistingSubCustomerDialog).toBeHidden();
    await this.waitForSpinner();
  }

  async clickEditSubCustomer(firstName: string, email: string): Promise<void> {
    await this.getSubCustomerCard(firstName, email)
      .locator("a, button")
      .nth(0)
      .click();
    await expect(this.firstName).toHaveValue(firstName);
  }

  async clickSetAsPrimary(firstName: string, email: string): Promise<void> {
    await this.getSubCustomerCard(firstName, email)
      .locator("a, button")
      .nth(2)
      .click();
  }

  async clickUnlinkSubCustomer(
    firstName: string,
    email: string,
  ): Promise<void> {
    await this.getSubCustomerCard(firstName, email)
      .locator("a, button")
      .nth(3)
      .click();
  }

  async clickConfirmRelationshipChange(): Promise<void> {
    const confirmation = this.getRelationshipConfirmation();
    await confirmation.getByRole("button", { name: /Yes|Confirm/i }).click();
    await expect(confirmation).toBeHidden();
  }

  async clickCloseSubCustomers(): Promise<void> {
    if (!(await this.subCustomerDialog.isVisible())) return;
    await this.subCustomerDialog
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    await expect(this.subCustomerDialog).toBeHidden();
  }

  async enterSearchKeyword(keyword: string): Promise<void> {
    await this.searchInput.fill(keyword);
    await this.searchInput.press("Tab");
  }

  async clearSearchKeyword(): Promise<void> {
    await this.searchInput.clear();
  }

  async clickFilterButton(): Promise<void> {
    await this.filterButton.click();
    await expect(this.createdDateFilter).toBeVisible();
  }

  async selectCreatedDatePreset(preset: string): Promise<void> {
    await this.createdDateFilter.click();
    const picker = this.page.locator(".daterangepicker:not(.hidden)");
    await picker.getByRole("button", { name: preset, exact: true }).click();
    await expect(picker).toBeHidden();
    await expect(this.createdDateFilter).not.toHaveValue("");
  }

  async selectCreatedDateCustomRange(
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    await this.selectCustomDateRange(
      this.createdDateFilter,
      startDate,
      endDate,
    );
  }

  async selectCallBackDateCustomRange(date: Date): Promise<void> {
    await this.selectCustomDateRange(this.callBackDateFilter, date, date);
  }

  async selectAssignedStaffFilter(value: string): Promise<void> {
    await this.assignedStaffFilter.selectOption({ label: value });
  }

  async selectStatusFilter(value: string): Promise<void> {
    await this.statusFilter.selectOption({ label: value });
  }

  async resetCreatedDateFilter(): Promise<void> {
    await this.createdDateClearButton.click();
    await expect(this.createdDateFilter).toHaveValue("");
  }

  async selectFilterType(value: string): Promise<void> {
    await this.filterType.selectOption({ label: value });
  }

  async enterFilterValue(value: string): Promise<void> {
    await this.filterValue.fill(value);
  }

  async clickApplyFilters(): Promise<void> {
    await this.applyFiltersButton.click();
  }

  async clickResetFilters(): Promise<void> {
    await this.resetFiltersButton.click();
    await expect(this.createdDateFilter).toHaveValue("");
    await expect(this.filterValue).toHaveValue("");
  }

  // ***************** Customer Entry *********************************

  async enterFirstName(value: string): Promise<void> {
    await this.fillVisible(this.firstName, value);
  }

  async enterLastName(value: string): Promise<void> {
    await this.fillVisible(this.lastName, value);
  }

  async enterEmail(value: string): Promise<void> {
    await this.fillVisible(this.email, value);
  }

  async enterPhone(value: string): Promise<void> {
    await this.fillVisible(this.phone, value);
  }

  async enterCompany(value: string): Promise<void> {
    await this.fillVisible(this.company, value);
  }

  async enterAddress(value: string): Promise<void> {
    await this.fillVisible(this.address, value);
  }

  async enterCity(value: string): Promise<void> {
    await this.fillVisible(this.city, value);
  }

  async enterState(value: string): Promise<void> {
    await this.fillVisible(this.state, value);
  }

  async enterPostalCode(value: string): Promise<void> {
    await this.fillVisible(this.postalCode, value);
  }

  async enterCountry(value: string): Promise<void> {
    await this.fillVisible(this.country, value);
  }

  async enterNotes(value: string): Promise<void> {
    await this.fillVisible(this.notes, value);
  }

  async enterSecondFirstName(value: string): Promise<void> {
    await this.fillVisible(this.secondFirstName, value);
  }
  async enterSecondLastName(value: string): Promise<void> {
    await this.fillVisible(this.secondLastName, value);
  }
  async enterSecondAddress(value: string): Promise<void> {
    await this.fillVisible(this.secondAddress, value);
  }
  async enterWorkPhone(value: string): Promise<void> {
    await this.fillVisible(this.workPhone, value);
  }
  async enterMobilePhone(value: string): Promise<void> {
    await this.fillVisible(this.mobilePhone, value);
  }
  async enterFax(value: string): Promise<void> {
    await this.fillVisible(this.fax, value);
  }
  async enterGuestType(value: string): Promise<void> {
    await this.fillVisible(this.guestType, value);
  }
  async enterVisitType(value: string): Promise<void> {
    await this.fillVisible(this.visitType, value);
  }
  async enterVehicleMake(value: string): Promise<void> {
    await this.fillVisible(this.vehicleMake, value);
  }
  async enterVehicleModel(value: string): Promise<void> {
    await this.fillVisible(this.vehicleModel, value);
  }
  async enterBirthDate1(value: string): Promise<void> {
    await this.fillVisible(this.birthDate1, value);
  }
  async enterBirthDate2(value: string): Promise<void> {
    await this.fillVisible(this.birthDate2, value);
  }
  async enterAnniversary(value: string): Promise<void> {
    await this.fillVisible(this.anniversary, value);
  }
  async enterLicense(value: string): Promise<void> {
    await this.fillVisible(this.license, value);
  }
  async enterJobTitle(value: string): Promise<void> {
    await this.fillVisible(this.jobTitle, value);
  }
  async enterCustom1(value: string): Promise<void> {
    await this.fillVisible(this.custom1, value);
  }
  async enterCustom2(value: string): Promise<void> {
    await this.fillVisible(this.custom2, value);
  }
  async enterCustom3(value: string): Promise<void> {
    await this.fillVisible(this.custom3, value);
  }
  async enterCustom4(value: string): Promise<void> {
    await this.fillVisible(this.custom4, value);
  }
  async enterCustom5(value: string): Promise<void> {
    await this.fillVisible(this.custom5, value);
  }
  async enterCustom6(value: string): Promise<void> {
    await this.fillVisible(this.custom6, value);
  }
  async enterCustomizedField(value: string): Promise<void> {
    await this.fillVisible(this.customizedField, value);
  }
  async checkDoNotAllowNewReservation(): Promise<void> {
    await this.ensureVisible(this.doNotAllowNewReservation);
    await this.doNotAllowNewReservation.check();
  }
  async selectCustomerStatus(value: string): Promise<void> {
    await this.selectVisible(this.customerStatus, { label: value });
  }
  async selectAssignStaff(value: string): Promise<void> {
    await this.selectVisible(this.assignStaff, { label: value });
  }
  async enterCallBackDate(value: string): Promise<void> {
    await this.fillVisible(this.callBackDate, value);
  }
  async enterCallBackComments(value: string): Promise<void> {
    await this.fillVisible(this.callBackComments, value);
  }

  async selectFirstAvailableCustomerStatus(): Promise<void> {
    await this.ensureVisible(this.customerStatus);
    await this.selectFirstAvailableOption(
      this.customerStatus,
      "customer status",
    );
  }

  async selectFirstAvailableAssignedStaff(): Promise<void> {
    await this.ensureVisible(this.assignStaff);
    await this.selectFirstAvailableOption(this.assignStaff, "assigned staff");
  }

  async clickSaveCustomer(): Promise<void> {
    await this.submitButton.click();
  }

  // ***************** Assertions *********************************

  async verifyCustomerSaved(): Promise<void> {
    await expect(this.customerCreatedMessage).toBeVisible();
  }

  async verifyCustomerUpdated(
    firstName: string,
    lastName: string,
  ): Promise<void> {
    await this.verifyCustomerUpdateSucceeded();
    await expect(this.getCustomerRow(firstName, lastName)).toBeVisible();
  }

  async verifyCustomerUpdateSucceeded(): Promise<void> {
    await expect(this.customerUpdatedMessage).toBeVisible();
  }

  async verifyCustomerDeleted(): Promise<void> {
    await expect(this.customerDeletedMessage).toBeVisible();
  }

  async verifyLoyaltyTier(
    tier: string,
    points: number,
    expectedBackgroundColor?: string,
  ): Promise<void> {
    const tierName = this.guestStatisticsDialog.getByText(tier, {
      exact: true,
    });
    const loyaltyCard = tierName.locator("../..");

    await expect(tierName).toBeVisible();
    await expect(loyaltyCard).toContainText(
      `${points.toLocaleString("en-US")} Loyalty Points`,
    );
    await expect(loyaltyCard).toContainText("♛");
    if (expectedBackgroundColor) {
      await expect(loyaltyCard).toHaveCSS(
        "background-color",
        expectedBackgroundColor,
      );
    }
  }

  async verifyTotalRevenue(expectedAmount: number): Promise<void> {
    const totalRevenueLabel =
      this.guestStatisticsDialog.getByText(/^Total Revenue$/i);
    const totalRevenueCard = totalRevenueLabel.locator("..");
    const totalRevenueValue = totalRevenueCard.locator("strong");

    await expect(totalRevenueLabel).toBeVisible();
    await expect(totalRevenueValue).toHaveText(expectedAmount.toFixed(2));
  }

  async verifySpendByStayChart(reservationAmounts: number[]): Promise<void> {
    const spendByStayLabel =
      this.guestStatisticsDialog.getByText(/^Spend By Stay$/i);
    const chart = this.guestStatisticsDialog.getByRole("img", {
      name: "Revenue over time chart",
      exact: true,
    });
    const spendByStaySection = chart.locator(
      "xpath=ancestor::*[.//*[normalize-space()='Spend By Stay']][1]",
    );
    const chartDataPoints = spendByStaySection.locator(".chart-hover-point");

    await expect(spendByStayLabel).toBeVisible();
    await expect(chart).toBeVisible();
    await expect(chartDataPoints).toHaveCount(reservationAmounts.length);

    const actualReservationAmounts = await chartDataPoints.evaluateAll(
      (dataPoints) =>
        dataPoints.map(
          (dataPoint) =>
            dataPoint.getAttribute("title")?.match(/Rate:\s*([\d.]+)/)?.[1] ??
            null,
        ),
    );

    expect(actualReservationAmounts).toEqual(
      reservationAmounts.map((amount) => amount.toFixed(2)),
    );
  }

  async verifyGuestNameAndEmail(
    firstName: string,
    lastName: string,
    email: string,
  ): Promise<void> {
    const fullName = `${firstName} ${lastName}`;
    const guestName = this.guestStatisticsDialog.getByRole("heading", {
      name: fullName,
      exact: true,
    });

    await expect(
      guestName,
      `Guest Statistics should display the full guest name "${fullName}".`,
    ).toHaveText(fullName);
    await expect(
      this.guestStatisticsDialog
        .getByRole("main")
        .getByText(email, { exact: true }),
      `Guest Statistics should display the email address "${email}".`,
    ).toBeVisible();
  }

  async verifyTotalDiscountedStays(expectedCount: number): Promise<void> {
    const totalDiscountedStaysLabel =
      this.guestStatisticsDialog.getByText(/^Discounted Stays$/i);
    const totalDiscountedStaysCard = totalDiscountedStaysLabel.locator("..");

    await expect(totalDiscountedStaysLabel).toBeVisible();
    await expect(totalDiscountedStaysCard).toContainText(String(expectedCount));
  }

  async verifyDiscountedStayTagInReservationHistory(): Promise<void> {
    const reservationHistoryLabel = this.guestStatisticsDialog.getByText(
      /^Reservation History$/i,
    );
    const discountedStayTag = this.guestStatisticsDialog
      .locator(
        "xpath=.//*[contains(., 'Discounted Stay') and not(contains(., 'Discounted Stays'))]",
      )
      .last();

    await expect(reservationHistoryLabel).toBeVisible();
    await expect(discountedStayTag).toBeVisible({ timeout: 15000 });
  }

  async verifyDiscountedStayTagIsNotInReservationHistory(): Promise<void> {
    const discountedStayTag = this.guestStatisticsDialog.locator(
      "xpath=.//*[contains(., 'Discounted Stay') and not(contains(., 'Discounted Stays'))]",
    );

    await expect(discountedStayTag).toHaveCount(0);
  }

  async verifyFavoriteRoom(roomName: string): Promise<void> {
    const favoriteRoomLabel =
      this.guestStatisticsDialog.getByText(/^Favorite Room$/i);

    await expect(favoriteRoomLabel).toBeVisible();
    await expect(favoriteRoomLabel.locator("..")).toContainText(roomName);
  }

  async verifyTotalStays(expectedCount: number): Promise<void> {
    const totalStaysLabel =
      this.guestStatisticsDialog.getByText(/^Total Stays$/i);

    await expect(totalStaysLabel).toBeVisible();
    await expect(totalStaysLabel.locator("..")).toContainText(
      String(expectedCount),
    );
  }

  async verifyPurchasedItem(itemName: string): Promise<void> {
    const favoriteItemsLabel =
      this.guestStatisticsDialog.getByText(/^Favorite Items$/i);

    await expect(favoriteItemsLabel).toBeVisible();
    await expect(favoriteItemsLabel.locator("..")).toContainText(itemName);
  }

  async verifyPurchasedItemIsNotDisplayed(itemName: string): Promise<void> {
    const favoriteItemsLabel =
      this.guestStatisticsDialog.getByText(/^Favorite Items$/i);

    await expect(favoriteItemsLabel).toBeVisible();
    await expect(favoriteItemsLabel.locator("..")).not.toContainText(itemName);
  }

  async verifyReservationHistory(
    reservation: ReservationHistoryDetails,
  ): Promise<void> {
    const reservationHistoryLabel = this.guestStatisticsDialog.getByText(
      /^Reservation History$/i,
    );

    await expect(reservationHistoryLabel).toBeVisible();
    await expect(this.guestStatisticsDialog).toContainText(
      `#${reservation.confirmationNumber}`,
    );
    await expect(this.guestStatisticsDialog).toContainText(
      reservation.roomName,
    );
    await expect(this.guestStatisticsDialog).toContainText(
      reservation.checkInDate,
    );
    await expect(this.guestStatisticsDialog).toContainText(
      reservation.checkOutDate,
    );
    await expect(this.guestStatisticsDialog).toContainText(
      reservation.stayLength,
    );
    await expect(this.guestStatisticsDialog).toContainText(reservation.status);
    await expect(this.guestStatisticsDialog).toContainText(
      reservation.roomAmount,
    );
    if (reservation.notes !== undefined) {
      await expect(this.guestStatisticsDialog).toContainText(
        `Notes - ${reservation.notes}`,
      );
    }
  }

  async verifyReservationHistoryNotesAreNotDisplayed(): Promise<void> {
    const reservationHistoryLabel = this.guestStatisticsDialog.getByText(
      /^Reservation History$/i,
    );
    await expect(reservationHistoryLabel).toBeVisible();
    await expect(this.guestStatisticsDialog).not.toContainText(/Notes\s*-/i);
  }

  async verifyReservationHistoryCount(expectedCount: number): Promise<void> {
    const reservationHistoryLabel = this.guestStatisticsDialog.getByText(
      /^Reservation History$/i,
    );

    await expect(reservationHistoryLabel).toBeVisible();
    await expect(this.guestStatisticsDialog).toContainText(
      `${expectedCount} records`,
    );
  }

  async verifyMandatoryFieldError(fieldName: string): Promise<void> {
    await expect(
      this.page.getByRole("alert").filter({
        hasText: new RegExp(
          `${this.escape(fieldName)} should not (?:be )?blank`,
          "i",
        ),
      }),
    ).toBeVisible();
    await expect(this.dialog).toBeVisible();
  }

  async verifyCustomerEmailValidationError(): Promise<void> {
    await expect(
      this.page.getByRole("alert").filter({
        hasText: /Please enter a valid email address for:\s*Email Address\./i,
      }),
    ).toBeVisible();
    await expect(this.dialog).toBeVisible();
  }

  async verifyDuplicateCustomerEmailError(): Promise<void> {
    await expect(
      this.page.getByRole("alert").filter({
        hasText: /Email already exists/i,
      }),
    ).toBeVisible();
    await expect(this.dialog).toBeVisible();
  }

  async verifyCustomerDetails(customer: CustomerData): Promise<void> {
    await expect(this.firstName).toHaveValue(customer.firstName);
    await expect(this.lastName).toHaveValue(customer.lastName);
    await expect(this.email).toHaveValue(customer.email);
    await expect(this.phone).toHaveValue(customer.phone);
    await expect(this.company).toHaveValue(customer.company);
    await expect(this.address).toHaveValue(customer.address);
    await expect(this.city).toHaveValue(customer.city);
    await expect(this.state).toHaveValue(customer.state);
    await expect(this.postalCode).toHaveValue(customer.postalCode);
    await expect(this.country).toHaveValue(customer.country);
    await expect(this.notes).toHaveValue(customer.notes);
  }

  async verifySynchronizedGuestDetails(guest: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  }): Promise<void> {
    await expect(this.firstName).toHaveValue(guest.firstName);
    await expect(this.lastName).toHaveValue(guest.lastName);
    await expect(this.email).toHaveValue(guest.email);
    if (guest.phone) await expect(this.phone).toHaveValue(guest.phone);
    if (guest.address) await expect(this.address).toHaveValue(guest.address);
    if (guest.city) await expect(this.city).toHaveValue(guest.city);
    if (guest.state) await expect(this.state).toHaveValue(guest.state);
    if (guest.country) await expect(this.country).toHaveValue(guest.country);
    if (guest.postalCode)
      await expect(this.postalCode).toHaveValue(guest.postalCode);
  }

  async verifyCompleteCustomerDetails(
    customer: CompleteCustomerData,
  ): Promise<void> {
    await this.verifyCustomerDetails(customer);
    await expect(this.secondFirstName).toHaveValue(customer.secondFirstName);
    await expect(this.secondLastName).toHaveValue(customer.secondLastName);
    await expect(this.secondAddress).toHaveValue(customer.secondAddress);
    await expect(this.workPhone).toHaveValue(customer.workPhone);
    await expect(this.mobilePhone).toHaveValue(customer.mobilePhone);
    await expect(this.fax).toHaveValue(customer.fax);
    await expect(this.guestType).toHaveValue(customer.guestType);
    await expect(this.visitType).toHaveValue(customer.visitType);
    await expect(this.vehicleMake).toHaveValue(customer.vehicleMake);
    await expect(this.vehicleModel).toHaveValue(customer.vehicleModel);
    await expect(this.birthDate1).toHaveValue(customer.birthDate1);
    await expect(this.birthDate2).toHaveValue(customer.birthDate2);
    await expect(this.anniversary).toHaveValue(customer.anniversary);
    await expect(this.license).toHaveValue(customer.license);
    await expect(this.jobTitle).toHaveValue(customer.jobTitle);
    await expect(this.custom1).toHaveValue(customer.custom1);
    await expect(this.custom2).toHaveValue(customer.custom2);
    await expect(this.custom3).toHaveValue(customer.custom3);
    await expect(this.custom4).toHaveValue(customer.custom4);
    await expect(this.custom5).toHaveValue(customer.custom5);
    await expect(this.custom6).toHaveValue(customer.custom6);
    await this.ensureVisible(this.doNotAllowNewReservation);
    await expect(this.doNotAllowNewReservation).toBeChecked({
      checked: customer.doNotAllowNewReservation,
    });
    await expect(this.customerStatus.locator("option:checked")).toHaveText(
      customer.customerStatus,
    );
    await expect(this.assignStaff.locator("option:checked")).toHaveText(
      customer.assignStaff,
    );
    await expect(this.callBackDate).toHaveValue(customer.callBackDate);
    await expect(this.callBackComments).toHaveValue(customer.callBackComments);
  }

  async verifyCustomerSearchResults(
    keyword: string,
    firstName: string,
    lastName: string,
  ): Promise<void> {
    await expect(this.searchInput).toHaveValue(keyword);
    await expect(this.getCustomerRow(firstName, lastName)).toBeVisible();
  }

  async getVisibleCustomerCount(): Promise<number> {
    return this.page.locator("tbody tr:visible").count();
  }

  async verifyAllCustomersDisplayed(expectedCount: number): Promise<void> {
    await expect(this.searchInput).toHaveValue("");
    await expect.poll(() => this.getVisibleCustomerCount()).toBe(expectedCount);
  }

  async verifyCustomerVisible(
    firstName: string,
    lastName: string,
  ): Promise<void> {
    await expect(this.getCustomerRow(firstName, lastName)).toBeVisible();
  }

  async verifyCustomerNotVisible(
    firstName: string,
    lastName: string,
  ): Promise<void> {
    await expect(this.getCustomerRow(firstName, lastName)).toHaveCount(0);
  }

  async verifySingleCustomerByEmail(
    email: string,
    firstName: string,
    lastName: string,
  ): Promise<void> {
    await this.enterSearchKeyword(email);
    await expect.poll(() => this.getVisibleCustomerCount()).toBe(1);
    await this.verifyCustomerVisible(firstName, lastName);
  }

  async verifySingleFilteredCustomer(
    firstName: string,
    lastName: string,
  ): Promise<void> {
    const customerRow = this.getCustomerRow(firstName, lastName);
    await expect(customerRow).toBeVisible();
    await expect(this.page.locator("tbody tr:visible")).toHaveCount(1);
  }

  async verifyAdditionalGuestIconVisible(
    firstName: string,
    lastName: string,
  ): Promise<void> {
    await expect(
      this.getAdditionalGuestAction(firstName, lastName),
    ).toBeVisible();
  }

  async verifySubCustomerDialog(
    primaryFirstName: string,
    primaryLastName: string,
  ): Promise<void> {
    await expect(this.subCustomerDialog).toContainText(
      new RegExp(
        `${this.escape(primaryFirstName)}\\s+${this.escape(primaryLastName)}`,
        "i",
      ),
    );
  }

  async verifyNoSubCustomers(): Promise<void> {
    await expect(this.subCustomerDialog).toContainText(
      /No sub-customers found/i,
    );
  }

  async verifySubCustomerDetails(customer: {
    firstName: string;
    lastName: string;
    email: string;
  }): Promise<void> {
    const card = this.getSubCustomerCard(customer.firstName, customer.email);
    await this.waitForSubCustomerCardDetail(
      card,
      "The Additional Guest list did not display the linked Sub Customer's name and email address within 5 seconds.",
    );
  }

  async verifySubCustomerNotDisplayed(
    firstName: string,
    email: string,
  ): Promise<void> {
    await expect(this.getSubCustomerCard(firstName, email)).toHaveCount(0);
  }

  async verifyLinkGuestSelection(searchText: string): Promise<void> {
    await expect(this.linkExistingSubCustomerDialog).toContainText(searchText);
  }

  async verifyExistingGuestNotAvailable(searchText: string): Promise<void> {
    await expect(
      this.page.getByRole("option").filter({ hasText: searchText }),
    ).toHaveCount(0);
  }

  async verifyCustomerIdentityFields(customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  }): Promise<void> {
    await expect(this.firstName).toHaveValue(customer.firstName);
    await expect(this.lastName).toHaveValue(customer.lastName);
    await expect(this.email).toHaveValue(customer.email);
    await expect(this.phone).toHaveValue(customer.phone);
  }

  async verifySubCustomerCount(expectedCount: number): Promise<void> {
    await expect(
      this.subCustomerDialog.locator(".sub-customer-card"),
    ).toHaveCount(expectedCount);
  }

  async verifyRelationshipConfirmation(customerName: string): Promise<void> {
    const confirmation = this.getRelationshipConfirmation();
    await expect(confirmation).toContainText(customerName);
    await expect(confirmation).toContainText(
      /Are you sure you want to (?:swap roles|unlink)/i,
    );
  }

  async verifyUnlinkConfirmation(customerName: string): Promise<void> {
    await expect(this.getRelationshipConfirmation()).toContainText(
      new RegExp(
        `Are you sure you want to unlink ${this.escape(customerName)}\\? This will eject them as a primary customer\\.`,
        "i",
      ),
    );
  }

  // ***************** Private Helpers *********************************

  private async selectCustomDateRange(
    dateFilter: Locator,
    startDate: Date,
    endDate: Date,
  ): Promise<void> {
    await dateFilter.click();
    const openPicker = this.page.locator(".daterangepicker:not(.hidden)");
    await openPicker
      .getByRole("button", { name: "Custom range", exact: true })
      .click();
    const calendar = openPicker.locator(".calendar.left");
    const monthHeader = calendar.locator("th.month");
    for (const date of [startDate, endDate]) {
      const targetMonth = date.getFullYear() * 12 + date.getMonth();
      for (let step = 0; step < 120; step++) {
        const heading = (await monthHeader.innerText()).trim();
        const displayedDate = new Date(`1 ${heading}`);
        if (Number.isNaN(displayedDate.getTime())) {
          throw new Error(`Cannot determine the customer filter calendar month from "${heading}".`);
        }
        const displayedMonth = displayedDate.getFullYear() * 12 + displayedDate.getMonth();
        if (displayedMonth === targetMonth) break;
        await calendar.locator(displayedMonth < targetMonth ? "th.next" : "th.prev").click();
        await expect(monthHeader).not.toHaveText(heading);
        if (step === 119) throw new Error("Customer filter calendar could not reach the requested month.");
      }
      await calendar.locator("td.available:not(.off)")
        .filter({ hasText: new RegExp(`^${date.getDate()}$`) }).click();
    }
    await openPicker.getByRole("button", { name: "Okay", exact: true }).click();
    await expect(openPicker).toBeHidden();
    const formatDate = (date: Date): string =>
      `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
    await expect(dateFilter).toHaveValue(`${formatDate(startDate)} - ${formatDate(endDate)}`);
  }

  private async waitForSpinner(): Promise<void> {
    await expect
      .poll(() => this.page.locator(".ngx-spinner-overlay:visible").count())
      .toBe(0);
  }

  private async selectFirstAvailableOption(
    select: Locator,
    fieldName: string,
  ): Promise<void> {
    const optionValue = await select
      .locator("option:not([disabled])")
      .evaluateAll(
        (options) =>
          options
            .map((option) => (option as HTMLOptionElement).value)
            .find((value) => value.trim() !== "") ?? "",
      );
    if (!optionValue) throw new Error(`No ${fieldName} option is available`);
    await select.selectOption(optionValue);
  }

  private async fillVisible(input: Locator, value: string): Promise<void> {
    await this.ensureVisible(input);
    await input.fill(value);
  }

  private async selectVisible(
    select: Locator,
    option: Parameters<Locator["selectOption"]>[0],
  ): Promise<void> {
    await this.ensureVisible(select);
    await select.selectOption(option);
  }

  private async ensureVisible(field: Locator): Promise<void> {
    if (await field.isVisible()) return;

    const sections = this.dialog.getByRole("navigation", {
      name: "Information sections",
    });
    const preferredSection = this.getInformationSection(field);
    if (preferredSection) {
      await sections
        .getByRole("button", { name: preferredSection, exact: true })
        .click();
      if (await field.isVisible()) return;
    }

    for (const section of [
      "General",
      "Personal",
      "Special",
      "Custom tab",
      "Details",
    ]) {
      if (section === preferredSection) continue;
      await sections
        .getByRole("button", { name: section, exact: true })
        .click();
      if (await field.isVisible()) return;
    }

    throw new Error(
      "Customer field is not available in any information section",
    );
  }

  private getInformationSection(field: Locator): string | undefined {
    if (
      [
        this.firstName,
        this.lastName,
        this.email,
        this.city,
        this.phone,
        this.address,
        this.state,
        this.country,
        this.postalCode,
        this.secondFirstName,
        this.secondLastName,
        this.secondAddress,
        this.workPhone,
        this.mobilePhone,
        this.fax,
      ].includes(field)
    )
      return "General";

    if (
      [
        this.company,
        this.guestType,
        this.visitType,
        this.vehicleMake,
        this.vehicleModel,
        this.birthDate1,
        this.birthDate2,
        this.anniversary,
        this.license,
        this.jobTitle,
      ].includes(field)
    )
      return "Personal";

    if (
      [
        this.custom1,
        this.custom2,
        this.custom3,
        this.custom4,
        this.custom5,
        this.custom6,
        this.doNotAllowNewReservation,
        this.notes,
      ].includes(field)
    )
      return "Special";

    if (field === this.customizedField) return "Custom tab";
    if (
      [
        this.customerStatus,
        this.assignStaff,
        this.callBackDate,
        this.callBackComments,
      ].includes(field)
    ) {
      return "Details";
    }
  }

  private getInputByLabel(label: RegExp): Locator {
    return this.dialog
      .getByText(label)
      .first()
      .locator("..")
      .locator("input, textarea")
      .first();
  }

  private getSelectByLabel(label: RegExp): Locator {
    return this.dialog
      .getByText(label)
      .first()
      .locator("..")
      .locator("select")
      .first();
  }

  private getCustomerRow(firstName: string, lastName: string): Locator {
    return this.page.getByRole("row").filter({
      hasText: new RegExp(
        `${this.escape(firstName)}.*${this.escape(lastName)}`,
        "i",
      ),
    });
  }

  private getAdditionalGuestAction(
    firstName: string,
    lastName: string,
  ): Locator {
    return this.getCustomerRow(firstName, lastName)
      .getByRole("cell")
      .last()
      .locator("a, button")
      .nth(2);
  }

  private getSubCustomerCard(firstName: string, email: string): Locator {
    return this.subCustomerDialog
      .locator(".sub-customer-card")
      .filter({
        hasText: new RegExp(
          `${this.escape(firstName)}.*${this.escape(email)}`,
          "i",
        ),
      });
  }

  private async verifySubCustomerCardDetail(
    card: Locator,
    detail: string | RegExp,
    fieldName: string,
  ): Promise<void> {
    const displayedDetail = card.filter({ hasText: detail });
    await this.waitForSubCustomerCardDetail(
      displayedDetail,
      `The Additional Guest list did not display the Sub Customer's ${fieldName} within 5 seconds.`,
    );
  }

  private async waitForSubCustomerCardDetail(
    locator: Locator,
    errorMessage: string,
  ): Promise<void> {
    try {
      await locator.waitFor({ state: "visible", timeout: 5_000 });
    } catch {
      throw new Error(errorMessage);
    }
  }

  private getRelationshipConfirmation(): Locator {
    return this.page
      .locator('[role="dialog"]:visible, .swal2-popup:visible')
      .filter({ hasText: /Are you sure|swap roles|unlink/i })
      .last();
  }

  private escape(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
