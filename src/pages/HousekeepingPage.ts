import { expect, Locator, Page } from "@playwright/test";
import { BasePage } from "../utils/BasePage";

export type HousekeepingRoomStatus = {
  roomName: string;
  status: string;
};

export class HousekeepingPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ***************** Page Elements *********************************

  private readonly housekeepingHeading = this.page.getByRole("heading", {
    name: /^Housekeeping\s*:/,
  });
  private readonly housekeepingTable = this.page.locator("table").filter({
    has: this.page.getByText("Housekeeping Status", { exact: true }),
  });
  private readonly roomRows = this.housekeepingTable.locator("tbody tr");

  // ***************** Room status actions ****************************

  private roomNameIn(row: Locator): Locator {
    return this.columnCell(row, "Room Details");
  }

  private statusControlIn(row: Locator): Locator {
    return this.columnCell(row, "Housekeeping Status").getByRole("combobox");
  }

  private columnCell(row: Locator, heading: string): Locator {
    // Derive the cell position from its header, rather than assuming link markup
    // or selecting the first of the status and staff dropdowns.
    return row.locator(
      `xpath=./td[count(ancestor::table[1]//th[normalize-space(.)='${heading}']/preceding-sibling::th) + 1]`,
    );
  }

  private roomRow(roomName: string): Locator {
    return this.roomRows.filter({
      has: this.page.getByRole("cell", { name: roomName, exact: true }),
    });
  }

  async verifyLoaded(): Promise<void> {
    await expect(
      this.housekeepingHeading,
      "The Housekeeping page did not load its dated heading within 15 seconds.",
    ).toBeVisible({ timeout: 15_000 });
    await expect(
      this.housekeepingTable,
      "The Housekeeping page did not display the Housekeeping Status table within 15 seconds.",
    ).toBeVisible({ timeout: 15_000 });
  }

  async selectRoomWithNonVacantStatus(): Promise<HousekeepingRoomStatus> {
    await this.verifyLoaded();
    const rows = await this.roomRows.all();
    for (const row of rows) {
      const control = this.statusControlIn(row);
      if (!(await control.isVisible())) continue;
      const status = (await control.innerText()).trim();
      if (!status || /^select$/i.test(status) || /^vacant$/i.test(status)) continue;
      const roomName = (await this.roomNameIn(row).innerText()).trim();
      return { roomName, status };
    }
    throw new Error(
      "The Housekeeping page did not contain a room with a non-Vacant housekeeping status.",
    );
  }

  async findRoomWithStatus(statusToFind: string): Promise<HousekeepingRoomStatus | null> {
    await this.verifyLoaded();
    const rows = await this.roomRows.all();
    for (const row of rows) {
      const control = this.statusControlIn(row);
      if (!(await control.isVisible())) continue;
      const status = (await control.innerText()).trim();
      if (status.toLowerCase() !== statusToFind.toLowerCase()) continue;
      return {
        roomName: (await this.roomNameIn(row).innerText()).trim(),
        status,
      };
    }
    return null;
  }

  async changeRoomStatus(roomName: string, status: string): Promise<void> {
    const row = this.roomRow(roomName);
    await expect(row, `The Housekeeping room '${roomName}' was not displayed.`).toBeVisible();
    const control = this.statusControlIn(row);
    await control.click();
    const option = this.page.getByRole("option", { name: status, exact: true });
    await expect(option, `The Housekeeping status option '${status}' was not available.`).toBeVisible();
    await option.click();
    await expect(control).toContainText(status);
  }

  async verifyRoomStatus(roomName: string, status: string): Promise<void> {
    const row = this.roomRow(roomName);
    await expect(row).toBeVisible();
    await expect(this.statusControlIn(row)).toContainText(status);
  }
}
