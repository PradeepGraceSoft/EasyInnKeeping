import { Locator, Page, expect } from "@playwright/test";
import { BasePage } from "../utils/BasePage";
import { Logger } from "../utils/Logger";

export class CalendarPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // Header
  private readonly addReservation = this.page.getByRole("button", {
    name: "icon",
    description: "New Reservation",
  });

  // Popup
  private readonly popupNewReservationButton =
    this.page.getByText("New Reservation");

  private readonly popupGroupBlockButton =
    this.page.getByText("New Group Block");

  private readonly popupBlockButton = this.page.getByRole("button", {
    name: "Block",
    exact: true,
  });

  private readonly reservationSummaryDialog = this.page
    .getByRole("dialog")
    .filter({
      has: this.page.getByRole("button", { name: "Open", exact: true }),
    });

  private readonly rateChangeDialog = this.page.getByRole("dialog").filter({
    has: this.page.getByRole("heading", { name: "Rate Change", exact: true }),
  });

  private readonly blockDialog = this.page.getByRole("dialog").filter({
    hasText: /Block Rooms|Unblock Rooms/,
  });

  private readonly roomNameSearchBox =
    this.page.getByPlaceholder("Search Room");

  private readonly calendarViewDropdown = this.page.locator(
    "select.form-control.room-view",
  );

  // Daily Rate
  private readonly dailyRateSaveButton = this.page.getByRole("button", {
    name: "Save",
  });

  async searchRoom(roomName: string): Promise<void> {
    await this.roomNameSearchBox.fill(roomName);
  }

  async selectRoomByDate(date: string): Promise<void> {
    await this.page.locator(`//td[@date='${date}']`).first().click();
  }

  async clickNewReservation(): Promise<void> {
    await this.popupNewReservationButton.click();
  }

  async clickNewGroupBlock(): Promise<void> {
    await this.popupGroupBlockButton.click();
  }

  async clickGroupBlockInRoom(
    groupGuestName: string,
    roomName: string,
  ): Promise<void> {
    await this.getRoomRow(roomName)
      .getByText(groupGuestName, { exact: false })
      .click();
  }

  async clickOpenGroupReservation(): Promise<void> {
    const groupDialog = this.page.getByRole("dialog").filter({
      hasText: /Group Code:/i,
    });
    await groupDialog.getByRole("button", { name: "Open", exact: true }).click();
  }

  async selectCalendarView(view: string): Promise<void> {
    await this.calendarViewDropdown.selectOption({ label: view });
  }

  async clickHeaderNewReservation(): Promise<void> {
    await this.addReservation.click();
  }

  async dragReservationToRoom(
    reservationText: string,
    targetRoom: string,
    date: string,
  ): Promise<void> {
    const reservationTextLocator = this.page
      .getByText(reservationText, { exact: false })
      .first();
    const reservation = reservationTextLocator.locator(
      "xpath=ancestor-or-self::*[@draggable='true'][1]",
    );
    await reservation.scrollIntoViewIfNeeded();
    await expect(reservation).toBeVisible();
    const targetCell = this.getRoomRow(targetRoom).locator(
      `td[date='${date}']`,
    );
    await expect(
      targetCell,
      `${targetRoom} must have an empty cell on ${date}`,
    ).toBeVisible();
    await expect(targetCell).toBeEmpty();
    await reservation.dragTo(targetCell, { force: true });
    const moveConfirmation = this.page.getByText(
      /Are you sure to move the reservation/i,
    );
    const mouseDragCompleted = await moveConfirmation
      .waitFor({ state: "visible", timeout: 2_000 })
      .then(() => true)
      .catch(() => false);
    if (!mouseDragCompleted) {
      await this.dispatchHtmlDragAndDrop(reservation, targetCell);
    }
    await expect(moveConfirmation).toBeVisible({ timeout: 5_000 });
    await this.page.getByRole("button", { name: "Yes", exact: true }).click();
    await expect(moveConfirmation).toBeHidden();
  }

  async verifyReservationDisplayedInRoom(
    reservationText: string,
    roomName: string,
  ): Promise<void> {
    await expect
      .poll(
        async () =>
          this.getRoomRow(roomName)
            .getByText(reservationText, { exact: false })
            .isVisible(),
        { timeout: 15_000 },
      )
      .toBe(true);
  }

  async moveReservationAndPlaceHere(
    reservationText: string,
    targetRoom: string,
  ): Promise<void> {
    await this.page
      .getByText(reservationText, { exact: false })
      .first()
      .click();
    await this.page.getByRole("button", { name: /Move/i }).click();
    await this.verifyMoveReservationInstruction();
    await this.getRoomRow(targetRoom)
      .getByText(/Place Here/i)
      .click();
  }

  async clickMoveReservation(): Promise<void> {
    await expect(this.reservationSummaryDialog).toBeVisible({
      timeout: 15_000,
    });
    await this.reservationSummaryDialog
      .getByRole("button", { name: "Move", exact: true })
      .click();
  }

  async verifyMoveReservationInstruction(): Promise<void> {
    await expect(
      this.page.getByText(/move.*reservation|reservation.*move/i).last(),
    ).toBeVisible({ timeout: 15_000 });
  }

  async selectMoveRate(rateChoice: "Old Rate" | "New Rate"): Promise<void> {
    const buttonName =
      rateChoice === "Old Rate" ? "Use Old Rates" : "Use New Rates";
    await expect(this.rateChangeDialog).toBeVisible({ timeout: 15_000 });
    await this.rateChangeDialog
      .getByRole("button", { name: buttonName, exact: true })
      .click();
    await expect(this.rateChangeDialog).toBeHidden({ timeout: 15_000 });
  }

  async completeMoveWithRateChoice(
    rateChoice: "Old Rate" | "New Rate",
    reservationText: string,
    targetRoom: string,
  ): Promise<void> {
    const movedReservation = this.getRoomRow(targetRoom).getByText(
      reservationText,
      { exact: false },
    );
    await expect
      .poll(
        async () => {
          if (await this.rateChangeDialog.isVisible()) {
            return "rate-change";
          }
          return (await movedReservation.isVisible()) ? "moved" : "waiting";
        },
        {
          message:
            "Expected either the Rate Change dialog or the moved reservation in the target room.",
          timeout: 15_000,
        },
      )
      .toMatch(/^(rate-change|moved)$/);

    if (await this.rateChangeDialog.isVisible()) {
      await this.selectMoveRate(rateChoice);
    } else {
      await expect(movedReservation).toBeVisible();
    }
  }

  async changeReservationStatus(
    reservationText: string,
    status: string,
  ): Promise<void> {
    await this.page
      .getByText(reservationText, { exact: false })
      .first()
      .click();
    const reservationDialog = this.page.getByRole("dialog").filter({
      has: this.page.getByRole("heading", { name: "Reservation", exact: true }),
    });
    await reservationDialog.getByRole("combobox").click();
    await this.page.getByRole("option", { name: status, exact: true }).click();
  }

  async extendReservationStay(
    reservationText: string,
    nights: number,
  ): Promise<void> {
    if (!Number.isInteger(nights) || nights < 1) {
      throw new Error("Stay extension must be at least one night.");
    }
    const reservation = this.page
      .getByText(reservationText, { exact: false })
      .first();
    await reservation.click();
    const departure = this.page.getByRole("textbox", {
      name: /departure|check.?out/i,
    });
    const currentValue = await departure.inputValue();
    const currentDate = new Date(currentValue);
    if (Number.isNaN(currentDate.getTime())) {
      throw new Error(`Unable to parse departure date '${currentValue}'.`);
    }
    currentDate.setDate(currentDate.getDate() + nights);
    await departure.fill(currentDate.toLocaleDateString("en-US"));
    await this.page.getByRole("button", { name: /Save/i }).click();
  }

  async blockRoom(roomName: string, date: string): Promise<void> {
    await this.clickRoomDateCell(roomName, date);
    await this.popupBlockButton.click();
    await this.blockDialog
      .getByRole("button", { name: "Block", exact: true })
      .click();
    await expect(this.blockDialog).toBeHidden();
  }

  async unblockRoom(roomName: string, date: string): Promise<void> {
    await this.clickRoomDateCell(roomName, date);
    await this.blockDialog
      .getByRole("button", { name: "Unblock", exact: true })
      .click();
    await expect(this.blockDialog).toBeHidden();
  }

  async clickReservation(reservationText: string): Promise<void> {
    await this.page
      .getByText(reservationText, { exact: false })
      .first()
      .click();
  }

  async clickReservationInRoom(
    reservationText: string,
    roomName: string,
  ): Promise<void> {
    const reservation = this.getReservationInRoom(reservationText, roomName);
    await reservation.scrollIntoViewIfNeeded();
    await expect(reservation).toBeVisible();
    await reservation.click();
    await expect(this.reservationSummaryDialog).toBeVisible({
      timeout: 15_000,
    });
  }

  async clickOpenReservation(): Promise<Page> {
    await expect(this.reservationSummaryDialog).toBeVisible({
      timeout: 15_000,
    });
    const popupPromise = this.page.waitForEvent("popup");
    await this.reservationSummaryDialog
      .getByRole("button", { name: "Open", exact: true })
      .click();
    return popupPromise;
  }

  async closeReservationSummaryIfOpen(): Promise<void> {
    if (await this.reservationSummaryDialog.isVisible()) {
      await this.reservationSummaryDialog
        .getByRole("button", { name: "Close", exact: true })
        .click();
    }
  }

  async selectCalendarLayout(
    layout: "Monthly" | "Weekly" | "Detailed",
  ): Promise<void> {
    await this.selectOptionFromMatchingDropdown(layout);
    await this.page.waitForLoadState("domcontentloaded");
  }

  async selectCalendarGrouping(
    grouping: "Room Name" | "Room Type",
  ): Promise<void> {
    await this.page
      .getByRole("button", { name: grouping, exact: true })
      .click();
    await this.page.waitForLoadState("domcontentloaded");
  }

  async verifyLabelsInDisplayOrder(
    expectedNames: readonly string[],
    checkpoint = "PMS Calendar",
  ): Promise<void> {
    Logger.step(`Validate ${checkpoint}`);
    Logger.info(`Expected UI order: ${expectedNames.join(" -> ")}`);
    await expect.soft
      .poll(() => this.getVisibleCandidateOrder(expectedNames), {
        message: `Expected calendar order: ${expectedNames.join(", ")}`,
      })
      .toEqual(expectedNames);
    const actualNames = await this.getVisibleCandidateOrder(expectedNames);
    Logger.info(`Actual UI order: ${actualNames.join(" -> ")}`);
  }

  async editRate(rateId: string, date: string, amount: string): Promise<void> {
    const rateTextbox = this.page.locator(
      `//input[@rateid='${date}|${rateId}']`,
    );

    await rateTextbox.fill(amount);
  }

  async clickSave(): Promise<void> {
    await this.dailyRateSaveButton.click();
  }

  private async selectOptionFromMatchingDropdown(label: string): Promise<void> {
    const selects = this.page.locator("select");
    let matchingIndex = -1;
    await expect
      .poll(
        async () => {
          for (let index = 0; index < (await selects.count()); index += 1) {
            const labels = await selects
              .nth(index)
              .locator("option")
              .allTextContents();
            if (
              labels.some(
                (value) =>
                  value.trim().toLowerCase() === label.toLowerCase(),
              )
            ) {
              matchingIndex = index;
              return true;
            }
          }
          return false;
        },
        {
          message: `Calendar dropdown option '${label}' was not found.`,
          timeout: 15_000,
        },
      )
      .toBe(true);
    await selects.nth(matchingIndex).selectOption({ label });
  }

  private async getVisibleCandidateOrder(
    candidates: readonly string[],
  ): Promise<string[]> {
    return this.page
      .getByRole("table", { name: "table1" })
      .locator("tr > :first-child")
      .evaluateAll((cells, names) => {
        const wanted = new Set(
          (names as string[]).map((name) => name.trim()),
        );
        const matches: string[] = [];
        for (const cell of cells) {
          const elements = [cell, ...cell.querySelectorAll("*")];
          const match = elements.find((element) => {
            const text = (element.textContent ?? "")
              .replace(/\s+/g, " ")
              .trim();
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && wanted.has(text);
          });
          if (match) {
            matches.push(
              (match.textContent ?? "").replace(/\s+/g, " ").trim(),
            );
          }
        }
        return [...new Set(matches)];
      }, [...candidates]);
  }

  private getRoomRow(roomName: string): Locator {
    return this.page.getByRole("row").filter({
      has: this.page.getByRole("columnheader", {
        name: roomName,
        exact: true,
      }),
    });
  }

  private getReservationInRoom(
    reservationText: string,
    roomName: string,
  ): Locator {
    return this.getRoomRow(roomName)
      .getByText(reservationText, { exact: false })
      .first()
      .locator("xpath=ancestor-or-self::*[@draggable='true'][1]");
  }

  private async dispatchHtmlDragAndDrop(
    source: Locator,
    target: Locator,
  ): Promise<void> {
    const dataTransfer = await this.page.evaluateHandle(
      () => new DataTransfer(),
    );
    try {
      await source.dispatchEvent("dragstart", { dataTransfer });
      await target.dispatchEvent("dragenter", { dataTransfer });
      await target.dispatchEvent("dragover", { dataTransfer });
      await target.dispatchEvent("drop", { dataTransfer });
      await source.dispatchEvent("dragend", { dataTransfer });
    } finally {
      await dataTransfer.dispose();
    }
  }

  async clickRoomDateCell(
    roomName: string,
    date: string,
  ): Promise<void> {
    await this.getRoomRow(roomName).locator(`td[date='${date}']`).click();
  }
}
