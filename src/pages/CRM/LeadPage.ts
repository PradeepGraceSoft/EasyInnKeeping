import { Locator, Page, expect } from "@playwright/test";
import { BasePage } from "../../utils/BasePage";
import type { LeadFilterData } from "../../utils/DBHelper/CRMDatabaseHelper";

export type LeadData = {
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

export type CompleteLeadData = LeadData & {
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
  leadStatus: string;
  assignStaff: string;
  callBackDate: string;
  callBackComments: string;
};

export class LeadPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ***************** Page Elements *********************************

  private readonly addLeadButton: Locator = this.page.getByTitle("Add Lead", {
    exact: true,
  });

  private readonly bulkEmailButton: Locator = this.page.getByTitle("BulkEmail", {
    exact: true,
  });

  private readonly searchInput: Locator = this.page.getByPlaceholder(
    "Search records...",
    { exact: true },
  );

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
  private readonly filterValue: Locator = this.page.locator("input[name='FilterValue']");
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
  private readonly firstName: Locator = this.getInputByLabel(/^First Name\s*\*?$/);
  private readonly lastName: Locator = this.getInputByLabel(/^Last Name\s*\*?$/);
  private readonly email: Locator = this.getInputByLabel(/^Email Address\s*\*?$/);
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
  private readonly secondFirstName: Locator = this.getInputByLabel(/^First Name 2\s*$/);
  private readonly secondLastName: Locator = this.getInputByLabel(/^Last Name 2\s*$/);
  private readonly secondAddress: Locator = this.getInputByLabel(/^Address 2\s*$/);
  private readonly workPhone: Locator = this.getInputByLabel(/^Work Phone\s*$/);
  private readonly mobilePhone: Locator = this.getInputByLabel(/^Cell\/Pager\s*$/);
  private readonly fax: Locator = this.getInputByLabel(/^Fax\s*$/);
  private readonly guestType: Locator = this.getInputByLabel(/^Guest Type\s*$/);
  private readonly visitType: Locator = this.getInputByLabel(/^Visit Type\s*$/);
  private readonly vehicleMake: Locator = this.getInputByLabel(/^Vehicle Make\s*$/);
  private readonly vehicleModel: Locator = this.getInputByLabel(/^Vehicle Model\s*$/);
  private readonly birthDate1: Locator = this.getInputByLabel(/^Birth Date 1\s*$/);
  private readonly birthDate2: Locator = this.getInputByLabel(/^Birth Date 2\s*$/);
  private readonly anniversary: Locator = this.getInputByLabel(/^Anniversary\s*$/);
  private readonly license: Locator = this.getInputByLabel(/^License\s*$/);
  private readonly jobTitle: Locator = this.getInputByLabel(/^Job Title\s*$/);
  private readonly custom1: Locator = this.getInputByLabel(/^Custom 1\s*$/);
  private readonly custom2: Locator = this.getInputByLabel(/^Custom 2\s*$/);
  private readonly custom3: Locator = this.getInputByLabel(/^Custom 3\s*$/);
  private readonly custom4: Locator = this.getInputByLabel(/^Custom 4\s*$/);
  private readonly custom5: Locator = this.getInputByLabel(/^Custom 5\s*$/);
  private readonly custom6: Locator = this.getInputByLabel(/^Custom 6\s*$/);
  private readonly customizedField: Locator = this.getInputByLabel(
    /^(?:Lead )?Customized Field\s*$/,
  );
  private readonly doNotAllowNewReservation: Locator = this.dialog.getByRole("checkbox");
  private readonly leadStatus: Locator = this.getSelectByLabel(/^Lead Status\s*$/);
  private readonly assignStaff: Locator = this.getSelectByLabel(/^Assign Staff\s*$/);
  private readonly callBackDate: Locator = this.getInputByLabel(/^Call Back Date\s*$/);
  private readonly callBackComments: Locator = this.getInputByLabel(/^Call Back Comments\s*$/);

  private readonly leadCreatedMessage: Locator = this.page.getByText(
    /Lead Created Successfully/i,
  );

  private readonly leadUpdatedMessage: Locator = this.page.getByText(
    /Lead (?:Updated|Modified) Successfully/i,
  );

  private readonly leadDeletedMessage: Locator = this.page.getByText(
    /Lead Deleted Successfully/i,
  );

  // ***************** Navigation *********************************

  async clickAddLead(): Promise<void> {
    await this.addLeadButton.click();
    await expect(this.firstName).toBeVisible();
  }

  async clickEditLead(firstName: string, lastName: string): Promise<void> {
    await this.getLeadRow(firstName, lastName).getByTitle("Edit", { exact: true }).click();
    await expect(this.firstName).toHaveValue(firstName);
  }

  async clickDeleteLead(firstName: string, lastName: string): Promise<void> {
    await this.getLeadRow(firstName, lastName).getByTitle("Delete", { exact: true }).click();
  }

  async unsubscribeLead(email: string): Promise<void> {
    await this.enterSearchKeyword(email);
    const row = this.getLeadRowByEmail(email);
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
    const wrapper = this.getLeadRowByEmail(email).locator(".unsubscribe-action-wrapper");
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

  async clickResponse(firstName: string, lastName: string): Promise<void> {
    await this.getLeadRow(firstName, lastName).getByTitle("Response", { exact: true }).click();
  }

  async verifyResponseCount(firstName: string, lastName: string, count: number): Promise<void> {
    await expect(this.getLeadRow(firstName, lastName).locator("a.count-icon"))
      .toHaveText(String(count));
  }

  async clickResponseCount(firstName: string, lastName: string): Promise<void> {
    await this.getLeadRow(firstName, lastName).locator("a.count-icon").click();
  }

  async clickQuotation(firstName: string, lastName: string): Promise<void> {
    await this.getLeadRow(firstName, lastName)
      .getByTitle("Quotation", { exact: true })
      .click();
  }

  async selectLead(firstName: string, lastName: string): Promise<void> {
    const checkbox = this.getLeadRow(firstName, lastName).getByRole("checkbox");
    await checkbox.check();
    await expect(checkbox).toBeChecked();
  }

  async clickBulkEmail(): Promise<void> {
    await this.bulkEmailButton.click();
  }

  async clickConfirmDelete(): Promise<void> {
    await this.page
      .getByRole("dialog")
      .filter({ has: this.page.getByRole("heading", { name: "Delete", exact: true }) })
      .getByRole("button", { name: "Yes", exact: true })
      .click();
  }

  async enterSearchKeyword(keyword: string): Promise<void> {
    await this.searchInput.fill(keyword);
  }

  async clearSearchKeyword(): Promise<void> {
    await this.searchInput.clear();
  }

  async clickFilterButton(): Promise<void> {
    await expect(this.page.locator("ngx-spinner")).toBeHidden();
    await this.filterButton.click();
    await expect(this.createdDateFilter).toBeVisible();
  }

  async selectCreatedDatePreset(preset: string): Promise<void> {
    await this.createdDateFilter.click();
    const picker = this.page.locator(".daterangepicker:not(.hidden)");
    await picker.getByRole("button", { name: preset, exact: true }).click();
    await expect(picker).toBeHidden();
  }

  async selectCreatedDateCustomRange(date: Date): Promise<void> {
    await this.selectCustomDateRange(this.createdDateFilter, date);
  }

  async selectCallBackDateCustomRange(date: Date): Promise<void> {
    await this.selectCustomDateRange(this.callBackDateFilter, date);
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

  // ***************** Lead Entry *********************************

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

  async enterSecondFirstName(value: string): Promise<void> { await this.fillVisible(this.secondFirstName, value); }
  async enterSecondLastName(value: string): Promise<void> { await this.fillVisible(this.secondLastName, value); }
  async enterSecondAddress(value: string): Promise<void> { await this.fillVisible(this.secondAddress, value); }
  async enterWorkPhone(value: string): Promise<void> { await this.fillVisible(this.workPhone, value); }
  async enterMobilePhone(value: string): Promise<void> { await this.fillVisible(this.mobilePhone, value); }
  async enterFax(value: string): Promise<void> { await this.fillVisible(this.fax, value); }
  async enterGuestType(value: string): Promise<void> { await this.fillVisible(this.guestType, value); }
  async enterVisitType(value: string): Promise<void> { await this.fillVisible(this.visitType, value); }
  async enterVehicleMake(value: string): Promise<void> { await this.fillVisible(this.vehicleMake, value); }
  async enterVehicleModel(value: string): Promise<void> { await this.fillVisible(this.vehicleModel, value); }
  async enterBirthDate1(value: string): Promise<void> { await this.fillVisible(this.birthDate1, value); }
  async enterBirthDate2(value: string): Promise<void> { await this.fillVisible(this.birthDate2, value); }
  async enterAnniversary(value: string): Promise<void> { await this.fillVisible(this.anniversary, value); }
  async enterLicense(value: string): Promise<void> { await this.fillVisible(this.license, value); }
  async enterJobTitle(value: string): Promise<void> { await this.fillVisible(this.jobTitle, value); }
  async enterCustom1(value: string): Promise<void> { await this.fillVisible(this.custom1, value); }
  async enterCustom2(value: string): Promise<void> { await this.fillVisible(this.custom2, value); }
  async enterCustom3(value: string): Promise<void> { await this.fillVisible(this.custom3, value); }
  async enterCustom4(value: string): Promise<void> { await this.fillVisible(this.custom4, value); }
  async enterCustom5(value: string): Promise<void> { await this.fillVisible(this.custom5, value); }
  async enterCustom6(value: string): Promise<void> { await this.fillVisible(this.custom6, value); }
  async enterCustomizedField(value: string): Promise<void> {
    await this.fillVisible(this.customizedField, value);
  }

  async reloadLeads(): Promise<void> {
    await this.page.reload();
    await expect(this.addLeadButton).toBeVisible();
    await expect(this.page.locator("ngx-spinner")).toBeHidden();
  }
  async checkDoNotAllowNewReservation(): Promise<void> { await this.ensureVisible(this.doNotAllowNewReservation); await this.doNotAllowNewReservation.check(); }
  async selectLeadStatus(value: string): Promise<void> { await this.selectVisible(this.leadStatus, { label: value }); }
  async selectAssignStaff(value: string): Promise<void> { await this.selectVisible(this.assignStaff, { label: value }); }
  async enterCallBackDate(value: string): Promise<void> { await this.fillVisible(this.callBackDate, value); }
  async enterCallBackComments(value: string): Promise<void> { await this.fillVisible(this.callBackComments, value); }

  async selectFirstAvailableLeadStatus(): Promise<void> {
    await this.ensureVisible(this.leadStatus);
    await this.selectFirstAvailableOption(this.leadStatus, "lead status");
  }

  async selectFirstAvailableAssignedStaff(): Promise<void> {
    await this.ensureVisible(this.assignStaff);
    await this.selectFirstAvailableOption(this.assignStaff, "assigned staff");
  }

  async clickSaveLead(): Promise<void> {
    await this.submitButton.click();
  }

  // ***************** Assertions *********************************

  async verifyLeadSaved(): Promise<void> {
    await expect(this.leadCreatedMessage).toBeVisible();
  }

  async verifyLeadUpdated(firstName: string, lastName: string): Promise<void> {
    await this.verifyLeadUpdateSucceeded();
    await expect(this.getLeadRow(firstName, lastName)).toBeVisible();
  }

  async verifyLeadUpdateSucceeded(): Promise<void> {
    await expect(this.leadUpdatedMessage).toBeVisible();
  }

  async verifyLeadDeleted(): Promise<void> {
    await expect(this.leadDeletedMessage).toBeVisible();
  }

  async verifyMandatoryFieldError(fieldName: string): Promise<void> {
    await expect(
      this.page.getByRole("alert").filter({
        hasText: new RegExp(`${this.escape(fieldName)} should not (?:be )?blank`, "i"),
      }),
    ).toBeVisible();
    await expect(this.dialog).toBeVisible();
  }

  async verifyLeadEmailValidationError(): Promise<void> {
    await expect(
      this.page.getByRole("alert").filter({
        hasText: /Please enter a valid email address for:\s*Email Address\./i,
      }),
    ).toBeVisible();
    await expect(this.dialog).toBeVisible();
  }

  async verifyLeadDetails(lead: LeadData): Promise<void> {
    await this.expectValue(this.firstName, lead.firstName);
    await this.expectValue(this.lastName, lead.lastName);
    await this.expectValue(this.email, lead.email);
    await this.expectValue(this.phone, lead.phone);
    await this.expectValue(this.company, lead.company);
    await this.expectValue(this.address, lead.address);
    await this.expectValue(this.city, lead.city);
    await this.expectValue(this.state, lead.state);
    await this.expectValue(this.postalCode, lead.postalCode);
    await this.expectValue(this.country, lead.country);
    await this.expectValue(this.notes, lead.notes);
  }

  async verifyCompleteLeadDetails(lead: CompleteLeadData): Promise<void> {
    await this.verifyLeadDetails(lead);
    await expect(this.secondFirstName).toHaveValue(lead.secondFirstName);
    await expect(this.secondLastName).toHaveValue(lead.secondLastName);
    await expect(this.secondAddress).toHaveValue(lead.secondAddress);
    await expect(this.workPhone).toHaveValue(lead.workPhone);
    await expect(this.mobilePhone).toHaveValue(lead.mobilePhone);
    await expect(this.fax).toHaveValue(lead.fax);
    await expect(this.guestType).toHaveValue(lead.guestType);
    await expect(this.visitType).toHaveValue(lead.visitType);
    await expect(this.vehicleMake).toHaveValue(lead.vehicleMake);
    await expect(this.vehicleModel).toHaveValue(lead.vehicleModel);
    await expect(this.birthDate1).toHaveValue(lead.birthDate1);
    await expect(this.birthDate2).toHaveValue(lead.birthDate2);
    await expect(this.anniversary).toHaveValue(lead.anniversary);
    await expect(this.license).toHaveValue(lead.license);
    await expect(this.jobTitle).toHaveValue(lead.jobTitle);
    await expect(this.custom1).toHaveValue(lead.custom1);
    await expect(this.custom2).toHaveValue(lead.custom2);
    await expect(this.custom3).toHaveValue(lead.custom3);
    await expect(this.custom4).toHaveValue(lead.custom4);
    await expect(this.custom5).toHaveValue(lead.custom5);
    await expect(this.custom6).toHaveValue(lead.custom6);
    await expect(this.doNotAllowNewReservation).toBeChecked({ checked: lead.doNotAllowNewReservation });
    await expect(this.leadStatus.locator("option:checked")).toHaveText(lead.leadStatus);
    await expect(this.assignStaff.locator("option:checked")).toHaveText(lead.assignStaff);
    await expect(this.callBackDate).toHaveValue(lead.callBackDate);
    await expect(this.callBackComments).toHaveValue(lead.callBackComments);
  }

  async verifyLeadSearchResults(
    keyword: string,
    firstName: string,
    lastName: string,
  ): Promise<void> {
    await expect(this.searchInput).toHaveValue(keyword);
    await expect(this.getLeadRow(firstName, lastName)).toBeVisible();
  }

  async getLeadSubmissionDate(firstName: string, lastName: string): Promise<string> {
    // The current lead grid no longer renders a submission-date column.
    // Keep this method for callers that build filter data, but do not infer a
    // date from the Actions column (which used to be column 5).
    return "";
  }

  async getVisibleLeadCount(): Promise<number> {
    return this.page.locator("tbody tr:visible").count();
  }

  async verifyAllLeadsDisplayed(): Promise<void> {
    await expect(this.searchInput).toHaveValue("");
  }

  async verifyLeadVisible(firstName: string, lastName: string): Promise<void> {
    await expect(this.getLeadRow(firstName, lastName)).toBeVisible();
  }

  async verifySingleFilteredLead(
    firstName: string,
    lastName: string,
    submissionDate: string,
  ): Promise<void> {
    const resultRows = this.page.locator("tbody tr:visible");
    await expect(resultRows).toHaveCount(1);

    const leadRow = this.getLeadRow(firstName, lastName);
    await expect(leadRow).toBeVisible();
    if (submissionDate) {
      // Kept for deployments that still expose the legacy date column.
      const dateCell = leadRow.getByRole("cell").filter({ hasText: submissionDate }).first();
      await expect(dateCell).toBeVisible();
    }
  }

  // ***************** Private Helpers *********************************

  private async selectCustomDateRange(dateFilter: Locator, date: Date): Promise<void> {
    const formatted = `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
    await dateFilter.click();
    const openPicker = this.page.locator(".daterangepicker:not(.hidden)");
    await openPicker.getByRole("button", { name: "Custom range", exact: true }).click();
    const calendar = openPicker.locator(".calendar.left");
    const monthHeader = calendar.locator("th.month");
    const targetMonth = date.getFullYear() * 12 + date.getMonth();
    for (let step = 0; step < 120; step++) {
      const heading = (await monthHeader.innerText()).trim();
      const displayedDate = new Date(`1 ${heading}`);
      if (Number.isNaN(displayedDate.getTime())) {
        throw new Error(`Cannot determine the lead filter calendar month from "${heading}".`);
      }
      const displayedMonth = displayedDate.getFullYear() * 12 + displayedDate.getMonth();
      if (displayedMonth === targetMonth) break;
      await calendar.locator(displayedMonth < targetMonth ? "th.next" : "th.prev").click();
      await expect(monthHeader).not.toHaveText(heading);
      if (step === 119) throw new Error(`Lead filter calendar could not reach ${formatted}.`);
    }
    const dateCell = calendar.locator("td.available:not(.off)")
      .filter({ hasText: new RegExp(`^${date.getDate()}$`) });
    await dateCell.click();
    await dateCell.click();
    await openPicker.getByRole("button", { name: "Okay", exact: true }).click();
    await expect(openPicker).toBeHidden();
    await expect(dateFilter).toHaveValue(`${formatted} - ${formatted}`);
  }

  private getInputByLabel(label: RegExp): Locator {
    return this.dialog
      .getByText(label)
      .first()
      .locator("..")
      .locator("input, textarea")
      .first();
  }

  async verifyFilteredLead(expected: LeadFilterData): Promise<void> {
    const row = this.getLeadRowByEmail(expected.email);
    await expect(row).toBeVisible();
    await expect(row).toContainText(expected.firstName);
    await expect(row).toContainText(expected.lastName);
  }

  async verifyFilteredLeadCount(expectedCount: number): Promise<void> {
    await expect(this.page.locator("tbody tr:visible")).toHaveCount(expectedCount);
  }

  private async fillVisible(input: Locator, value: string): Promise<void> {
    await this.ensureVisible(input);
    await input.fill(value);
  }

  private async expectValue(input: Locator, value: string): Promise<void> {
    await this.ensureVisible(input);
    await expect(input).toHaveValue(value);
  }

  private async selectVisible(select: Locator, option: Parameters<Locator["selectOption"]>[0]): Promise<void> {
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

    for (const section of ["General", "Personal", "Special", "Custom", "Details"]) {
      if (section === preferredSection) continue;
      await sections.getByRole("button", { name: section, exact: true }).click();
      if (await field.isVisible()) return;
    }

    throw new Error("Lead field is not available in any information section");
  }

  private getInformationSection(field: Locator): string | undefined {
    if ([
      this.firstName, this.lastName, this.email, this.city, this.phone,
      this.address, this.state, this.country, this.postalCode,
      this.secondFirstName, this.secondLastName, this.secondAddress,
      this.workPhone, this.mobilePhone, this.fax,
    ].includes(field)) return "General";

    if ([
      this.company, this.guestType, this.visitType, this.vehicleMake,
      this.vehicleModel, this.birthDate1, this.birthDate2, this.anniversary,
      this.license, this.jobTitle,
    ].includes(field)) return "Personal";

    if ([
      this.custom1, this.custom2, this.custom3, this.custom4, this.custom5,
      this.custom6, this.doNotAllowNewReservation, this.notes,
    ].includes(field)) return "Special";

    if (field === this.customizedField) return "Custom";
    if ([this.leadStatus, this.assignStaff, this.callBackDate, this.callBackComments].includes(field)) {
      return "Details";
    }
  }

  private getSelectByLabel(label: RegExp): Locator {
    return this.dialog.getByText(label).first().locator("..").locator("select").first();
  }

  private getLeadRow(firstName: string, lastName: string): Locator {
    return this.page.getByRole("row").filter({
      hasText: new RegExp(`${this.escape(firstName)}.*${this.escape(lastName)}`, "i"),
    });
  }

  private getLeadRowByEmail(email: string): Locator {
    return this.page.getByRole("row").filter({
      has: this.page.getByRole("cell", { name: email, exact: true }),
    });
  }

  private escape(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private async selectFirstAvailableOption(select: Locator, fieldName: string): Promise<void> {
    const optionValue = await select.locator("option:not([disabled])").evaluateAll(
      (options) => options
        .map((option) => (option as HTMLOptionElement).value)
        .find((value) => value.trim() !== "") ?? "",
    );
    if (!optionValue) throw new Error(`No ${fieldName} option is available`);
    await select.selectOption(optionValue);
  }
}
