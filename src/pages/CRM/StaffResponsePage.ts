import { Locator, Page, expect } from "@playwright/test";
import { BasePage } from "../../utils/BasePage";

export type StaffResponseSearchColumn =
  | "Contact Name"
  | "Email"
  | "Phone Number"
  | "Status Name"
  | "Call Back Date"
  | "Call Back Comments"
  | "Assign Lead"
  | "Type";

const SEARCH_COLUMN_INDEX: Record<StaffResponseSearchColumn, number> = {
  "Contact Name": 2,
  Email: 3,
  "Phone Number": 4,
  "Status Name": 6,
  "Call Back Date": 7,
  "Call Back Comments": 8,
  "Assign Lead": 9,
  Type: 10,
};

export class StaffResponsePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ***************** Page Elements *********************************

  private readonly pageHeading: Locator = this.page.getByRole("heading", {
    name: "Staff Response",
    exact: true,
  });
  private readonly manageHeading: Locator = this.page.getByText(
    "Manage Staff Response",
    { exact: true },
  );
  private readonly addLeadButton: Locator = this.page.getByText(
    /^\s*\+\s*Add Lead\s*$/i,
  );
  private readonly addCustomerButton: Locator = this.page.getByText(
    /^\s*\+\s*Add Customer\s*$/i,
  );
  private readonly searchInput: Locator = this.page.getByRole("textbox", {
    name: "Search records",
    exact: true,
  });
  private readonly filterButton: Locator = this.page.getByTitle("Filter", {
    exact: true,
  });
  private readonly createdDateFilter: Locator = this.page
    .locator(".filter-pad input")
    .nth(0);
  private readonly callBackDateFilter: Locator = this.page
    .locator(".filter-pad input")
    .nth(1);
  private readonly statusFilter: Locator = this.page.locator("#status");
  private readonly assignedStaffFilter: Locator = this.page
    .locator(".filter-pad select")
    .nth(1);
  private readonly applyFiltersButton: Locator = this.page
    .locator(".filter-pad button")
    .filter({ has: this.page.locator(".fa-search") })
    .or(this.page.getByRole("button", { name: /search/i }))
    .first();
  private readonly resetFiltersButton: Locator = this.page
    .locator(".filter-pad a, .filter-pad button")
    .filter({ has: this.page.locator(".fa-refresh") })
    .first();
  private readonly resultsTable: Locator = this.page
    .getByRole("table")
    .filter({
      has: this.page.getByRole("columnheader", { name: /Contact Name/i }),
    })
    .first();
  private readonly resultRows: Locator = this.resultsTable.locator("tbody tr");

  // ***************** Navigation *********************************

  async verifyStaffResponsePageDisplayed(): Promise<void> {
    await expect(this.pageHeading.or(this.manageHeading).first()).toBeVisible();
    await expect(this.addLeadButton).toBeVisible();
    await expect(this.addCustomerButton).toBeVisible();
    await expect(this.searchInput).toBeVisible();
  }

  async clickAddLead(): Promise<void> {
    await this.addLeadButton.click();
    await expect(this.page.getByRole("dialog")).toBeVisible();
  }

  async clickAddCustomer(): Promise<void> {
    await this.addCustomerButton.click();
    await expect(this.page.getByRole("dialog")).toBeVisible();
  }

  async clickEditContact(contactName: string, email: string): Promise<void> {
    await this.getContactRow(contactName, email)
      .getByTitle("Edit", { exact: true })
      .click();
    await expect(this.page.getByRole("dialog")).toBeVisible();
  }

  async clickDeleteContact(contactName: string, email: string): Promise<void> {
    await this.getContactRow(contactName, email)
      .getByTitle("Delete", { exact: true })
      .click();
  }

  async clickResponse(contactName: string, email: string): Promise<void> {
    await this.getContactRow(contactName, email)
      .getByTitle("Respond", { exact: true }).click();
    const dialog = this.page.getByRole("dialog", { name: "Add Staff Response", exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Email", exact: true }).click();
  }

  async closeResponse(): Promise<void> {
    const dialog = this.page.getByRole("dialog", { name: "Add Staff Response", exact: true });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toBeHidden();
  }

  async clickConfirmDelete(): Promise<void> {
    await this.page
      .getByRole("dialog")
      .filter({ has: this.page.getByRole("heading", { name: "Confirm", exact: true }) })
      .getByRole("button", { name: "Yes", exact: true })
      .click();
  }

  // ***************** Search and Filters *********************************

  async enterSearchKeyword(keyword: string): Promise<void> {
    await this.searchInput.clear();
    await this.searchInput.pressSequentially(keyword);
  }

  async clearSearchKeyword(): Promise<void> {
    await this.searchInput.clear();
  }

  async clickFilterButton(): Promise<void> {
    await this.filterButton.click();
    await expect(this.createdDateFilter).toBeVisible();
  }

  async selectStatusFilter(status: string): Promise<void> {
    await this.statusFilter.selectOption({ label: status });
  }

  async selectAssignedStaffFilter(staffName: string): Promise<void> {
    await this.assignedStaffFilter.selectOption({ label: staffName });
  }

  async selectCreatedDatePreset(preset: string): Promise<void> {
    await this.createdDateFilter.click();
    await this.page.getByRole("button", { name: preset, exact: true }).first().click();
  }

  async selectCreatedDateCustomRange(date: Date): Promise<void> {
    await this.selectCustomDateRange(this.createdDateFilter, date);
  }

  async selectCallBackDateCustomRange(date: Date): Promise<void> {
    await this.selectCustomDateRange(this.callBackDateFilter, date);
  }

  async clickApplyFilters(): Promise<void> {
    await this.applyFiltersButton.click();
  }

  async clickResetFilters(): Promise<void> {
    await this.resetFiltersButton.click();
    await expect(this.statusFilter).toHaveValue("");
  }

  // ***************** Verifications *********************************

  async verifyContactDisplayed(contactName: string, email: string): Promise<void> {
    const row = this.getContactRow(contactName, email);
    await expect(row).toHaveCount(1);
    await expect(row).toBeVisible();
    await expect(this.getContactIdentityCell(row, contactName)).toBeVisible();
    await expect(this.getContactIdentityCell(row, email)).toBeVisible();
  }

  async verifyContactNotDisplayed(contactName: string, email: string): Promise<void> {
    await expect(this.getContactRow(contactName, email)).toHaveCount(0);
  }

  async verifyContactColumnValue(
    contactName: string,
    email: string,
    column: StaffResponseSearchColumn,
    expectedCellText: string,
    exact = false,
  ): Promise<void> {
    const row = this.getContactRow(contactName, email);
    const columnIndex = SEARCH_COLUMN_INDEX[column];
    const normalizedExpectedText = this.normalizeCellText(expectedCellText);

    await expect.poll(async () => {
      if (await row.count() !== 1 || !await row.isVisible()) return false;

      if (column === "Email") {
        return (await this.getContactIdentityCell(row, expectedCellText).count()) === 1;
      }

      const cellText = await row.getByRole("cell").nth(columnIndex).innerText();
      const normalizedCellText = this.normalizeCellText(cellText);
      return exact
        ? normalizedCellText === normalizedExpectedText
        : normalizedCellText.includes(normalizedExpectedText);
    }, {
      message: `Expected Staff Response contact "${email}" to show "${expectedCellText}" in ${column}.`,
    }).toBe(true);
  }

  private getContactRow(contactName: string, email: string): Locator {
    return this.resultRows
      .filter({
        has: this.page.getByRole("cell", {
          name: new RegExp(`^${this.escapeForRegex(contactName)}$`, "i"),
        }),
      })
      .filter({
        has: this.page.getByRole("cell", {
          name: new RegExp(`^${this.escapeForRegex(email)}$`, "i"),
        }),
      });
  }

  private getContactIdentityCell(parent: Locator, value: string): Locator {
    return parent.getByRole("cell", {
      name: new RegExp(`^${this.escapeForRegex(value)}$`, "i"),
    });
  }

  private escapeForRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private normalizeCellText(value: string): string {
    const normalizedValue = value.trim().toLowerCase();
    const dateParts = normalizedValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return dateParts
      ? `${dateParts[3]}-${dateParts[1]}-${dateParts[2]}`
      : normalizedValue;
  }

  private async selectCustomDateRange(dateFilter: Locator, date: Date): Promise<void> {
    await dateFilter.click();
    const openPicker = this.page.locator(".daterangepicker:not(.hidden)").first();
    await openPicker.getByRole("button", { name: "Custom range", exact: true }).click();
    const day = String(date.getDate());
    const dateCell = openPicker
      .locator("td.available:not(.off)")
      .filter({ hasText: new RegExp(`^${day}$`) })
      .first();
    await dateCell.click();
    await dateCell.click();
    await openPicker.getByRole("button", { name: "Okay", exact: true }).click();
    await expect(openPicker).toBeHidden();
  }
}
