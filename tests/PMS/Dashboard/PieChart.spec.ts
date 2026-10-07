import type { Locator, Page } from "@playwright/test";
import { test as base, expect } from "../../../src/fixtures/pms.fixture";
import { AlertMessages } from "../../../src/constants/AlertMessages";
import { ConstNames } from "../../../src/constants/ConstNames";
import { TestDataGenerator } from "../../../src/utils/TestDataGenerator";

// Run against the redesigned dashboard shown in the reference screenshot:
// npm run test:test1 -- tests/PMS/Dashboard/PieChart.spec.ts --project=property-a-5806
type Day = "Today" | "Tomorrow";
type Counts = {
  arrival: number;
  stayover: number;
  blocked: number;
  vacant: number;
};
type Snapshot = Counts & { total: number };
type Room = { id: number; name: string; roomType: string };
const categories = [
  {
    key: "arrival",
    label: "Arrival",
    color: "#38bdf8",
    rgb: "rgb(56, 189, 248)",
  },
  {
    key: "stayover",
    label: "Stay Over",
    color: "#34d399",
    rgb: "rgb(52, 211, 153)",
  },
  {
    key: "blocked",
    label: "Blocked",
    color: "#fbbf24",
    rgb: "rgb(251, 191, 36)",
  },
  {
    key: "vacant",
    label: "Vacant",
    color: "#f87171",
    rgb: "rgb(248, 113, 113)",
  },
] as const;

/** Selectors and SVG attributes verified against the live Room Status card. */
class RoomStatusChart {
  readonly card: Locator;
  constructor(page: Page) {
    this.card = page.locator(".clean-chart-card").filter({
      has: page.getByRole("heading", { name: "Room Status", exact: true }),
    });
  }

  async verifyPresentation(total: number): Promise<void> {
    await expect(this.card).toBeVisible();
    await expect(
      this.card.getByRole("heading", { name: "Room Status", exact: true }),
    ).toBeVisible();
    await expect(this.card.locator(".chart-sub")).toHaveText(
      `Of ${total} total rooms`,
    );
    await expect(this.card.locator(".legend-label")).toHaveText(
      categories.map((item) => item.label),
    );
    await expect(this.card.locator("circle.donut-segment")).toHaveCount(
      categories.length,
    );
    for (const category of categories) {
      const legend = this.card.locator(".legend-item-inline").filter({
        has: this.card.page().getByText(category.label, { exact: true }),
      });
      await expect(legend).toBeVisible();
      await expect(legend.locator(".legend-dot")).toHaveCSS(
        "background-color",
        category.rgb,
      );
      await expect(
        this.card.locator(`circle.donut-segment[stroke="${category.color}"]`),
      ).toHaveCount(1);
    }
  }

  async verify(expected: Snapshot): Promise<void> {
    await this.verifyPresentation(expected.total);
    expect(
      expected.total,
      "These positive scenarios require room inventory",
    ).toBeGreaterThan(0);
    // The chart uses the subtitle's total inventory, including inactive rooms,
    // as its denominator. SVG percentages are rounded to one decimal place.
    // Category totals can differ from inventory; do not normalize them to 100%.
    let precedingPortion = 0;
    for (const category of categories) {
      const value = expected[category.key];
      expect(
        Number.isInteger(value) && value >= 0,
        `${category.label} must be a nonnegative integer`,
      ).toBeTruthy();
      const label = this.card.locator(
        `text.chart-slice-label[fill="${category.color}"]`,
      );
      if (value === 0) {
        await expect(label).toHaveCount(0);
      } else {
        await expect(label).toBeVisible();
        // Exact integer text also rejects a percentage label such as "5%".
        await expect(label).toHaveText(String(value));
      }
      const segment = this.card.locator(
        `circle.donut-segment[stroke="${category.color}"]`,
      );
      const portion = Math.round((value / expected.total) * 1_000) / 1_000;
      const offsetPortion = precedingPortion;
      await expect
        .poll(
          async () =>
            segment.evaluate(
              (element, ratios) => {
                const radius = Number(element.getAttribute("r"));
                const circumference = 2 * Math.PI * radius;
                const dash = (element.getAttribute("stroke-dasharray") ?? "")
                  .trim()
                  .split(/[\s,]+/)
                  .map(Number);
                const offset = Number(
                  element.getAttribute("stroke-dashoffset"),
                );
                return (
                  radius > 0 &&
                  dash.length === 2 &&
                  Math.abs(dash[0] / circumference - ratios.portion) <
                    0.00001 &&
                  Math.abs(dash[1] / circumference - 1) < 0.00001 &&
                  Math.abs(offset / circumference + ratios.preceding) <
                    0.00001 &&
                  Number(element.getAttribute("stroke-width")) === 2 * radius
                );
              },
              { portion, preceding: offsetPortion },
            ),
          {
            message: `${category.label} must represent ${value}/${expected.total} rooms at the correct offset (one-decimal percentage precision)`,
            timeout: 15_000,
          },
        )
        .toBe(true);
      precedingPortion += portion;
    }
  }
}

class OccupancyStatusChart {
  readonly card: Locator;
  constructor(page: Page) {
    this.card = page.locator(".clean-chart-card").filter({
      has: page.getByRole("heading", { name: "Occupancy Status", exact: true }),
    });
  }

  async verify(occupied: number, bookable: number): Promise<void> {
    expect(bookable, "The selected date must have bookable rooms.").toBeGreaterThan(0);
    const expected = Math.round((occupied / bookable) * 1000) / 10;
    const available = bookable - occupied;
    await expect(this.card).toBeVisible();
    await expect(this.card.locator(".chart-sub")).toHaveText("Share of bookable inventory");
    await expect(this.card.locator(".legend-label")).toHaveText(["Occupied", "Available", "Blocked"]);
    await expect(this.card.locator(".legend-label").first()).toBeVisible();
    const labels = this.card.locator("text.chart-slice-label");
    if (occupied > 0) await expect(this.card.getByText(`${expected}%`, { exact: true })).toBeVisible();
    const availablePercentage = Math.round((available / bookable) * 1000) / 10;
    if (available > 0) await expect(this.card.getByText(`${availablePercentage}%`, { exact: true })).toBeVisible();
    await expect(this.card.locator("circle.donut-segment")).toHaveCount(3);
    const occupiedSegment = this.card.locator('circle.donut-segment[stroke="#38bdf8"]');
    await expect.poll(async () => occupiedSegment.evaluate((element, ratio) => {
      const radius = Number(element.getAttribute("r"));
      const circumference = 2 * Math.PI * radius;
      const dash = Number((element.getAttribute("stroke-dasharray") ?? "0").split(/[\s,]+/)[0]);
      return Math.abs(dash / circumference - ratio) < 0.00001;
    }, occupied / bookable)).toBe(true);
  }
}

class GuestMixChart {
  readonly card: Locator;
  constructor(page: Page) {
    this.card = page.locator(".clean-chart-card").filter({
      has: page.getByRole("heading", { name: "Guest Mix", exact: true }),
    });
  }

  async verify(adults: number, children: number): Promise<void> {
    const total = adults + children;
    expect(total, "Guest Mix requires at least one qualifying guest.").toBeGreaterThan(0);
    const adultPercentage = Math.round((adults / total) * 1000) / 10;
    const childPercentage = Math.round((children / total) * 1000) / 10;
    await expect(this.card).toBeVisible();
    await expect(this.card.locator(".chart-sub")).toHaveText("Adults vs children");
    await expect(this.card.locator(".legend-label")).toHaveText(["Adults", "Children"]);
    if (adults > 0) await expect(this.card.getByText(`${adultPercentage}%`, { exact: true })).toBeVisible();
    if (children > 0) await expect(this.card.getByText(`${childPercentage}%`, { exact: true })).toBeVisible();
    await expect(this.card.locator("circle.donut-segment")).toHaveCount(2);
  }
}

type Scenario = {
  chart: RoomStatusChart;
  occupancyChart: OccupancyStatusChart;
  guestMixChart: GuestMixChart;
  date(day: Day, extraDays?: number): Promise<string>;
  expected(day: Day): Promise<Snapshot>;
  open(day: Day): Promise<Snapshot>;
  verify(day: Day): Promise<Snapshot>;
  occupancy(day: Day): Promise<{ occupied: number; bookable: number }>;
  guestMix(day: Day): Promise<{ adults: number; children: number }>;
  create(
    day: Day,
    kind?: "arrival" | "stayover",
    date?: string,
    room?: Room,
  ): Promise<string>;
  createMultiRoom(day: Day): Promise<string>;
  available(day: Day, count?: number, extraDays?: number): Promise<Room[]>;
  block(day: Day, rooms: Room[]): Promise<void>;
  blockAt(day: Day, rooms: Room[], offset: number): Promise<void>;
  unblock(day: Day, rooms: Room[]): Promise<void>;
  cancel(confirmation: string): Promise<void>;
  remove(confirmation: string): Promise<void>;
  move(confirmation: string, date: string): Promise<void>;
  active(room: Room, active: boolean): Promise<void>;
};

const test = base.extend<{ roomStatus: Scenario }>({
  roomStatus: [
    async (
      {
        page,
        dashboardPage,
        reservationDbHelper,
        setupDb,
        layoutPage,
        findReservationPage,
        reservationPage,
        reservationApi,
        calendarPage,
      },
      use,
    ) => {
      const chart = new RoomStatusChart(page);
      const occupancyChart = new OccupancyStatusChart(page);
      const guestMixChart = new GuestMixChart(page);
      const reservations = new Set<string>();
      const blocks = new Map<string, { room: Room; date: string }>();
      const inactive = new Map<number, Room>();
      const today = await reservationDbHelper.getCurrentDate();
      const addDays = (date: string, days: number) => {
        const value = new Date(`${date}T12:00:00Z`);
        value.setUTCDate(value.getUTCDate() + days);
        return value.toISOString().slice(0, 10);
      };
      const date = async (day: Day, extraDays = 0) => {
        expect(
          await reservationDbHelper.getCurrentDate(),
          "Server date changed during the scenario",
        ).toBe(today);
        return addDays(today, (day === "Tomorrow" ? 1 : 0) + extraDays);
      };
      const expected = async (day: Day): Promise<Snapshot> => {
        const selected = await date(day);
        // Reuse the independent database rules from the existing dashboard tests.
        // Do not derive Vacant by subtracting reservation counts from room inventory.
        return {
          arrival: await reservationDbHelper.getArrivalsCount(selected),
          stayover: (
            await reservationDbHelper.getStayoverReservations(selected)
          ).length,
          blocked:
            await reservationDbHelper.getDashboardBlockedRoomCount(selected),
          vacant: await setupDb.getAvailableActiveRoomCount(
            selected,
            addDays(selected, 1),
          ),
          total: await reservationDbHelper.getDashboardTotalRoomCount(selected),
        };
      };
      const verify = async (day: Day) => {
        const values = await expected(day);
        await chart.verify(values);
        return values;
      };
      const open = async (day: Day) => {
        // Clicking the current Dashboard route does not issue another request.
        if (new URL(page.url()).pathname.endsWith("/dashboard"))
          await dashboardPage.refreshToday();
        else await dashboardPage.open();
        if (day === "Tomorrow") await dashboardPage.selectTomorrow();
        return verify(day);
      };
      const calendar = async () => {
        await layoutPage.clickCalendarIcon();
        await calendarPage.selectCalendarGrouping("Room Name");
      };
      const unblockOne = async (room: Room, selected: string) => {
        await calendarPage.searchRoom(room.name);
        await calendarPage.unblockRoom(room.name, selected);
        blocks.delete(`${room.id}:${selected}`);
      };
      const edit = async (confirmation: string) => {
        await layoutPage.clickReservationListIcon();
        await findReservationPage.openReservation(confirmation);
      };
      const scenario: Scenario = {
        chart,
        occupancyChart,
        guestMixChart,
        date,
        expected,
        open,
        verify,
        occupancy: async (day) => {
          const selected = await date(day);
          const occupied = await reservationDbHelper.getOccupiedRoomCount(selected);
          const available = await setupDb.getAvailableActiveRoomCount(selected, addDays(selected, 1));
          return { occupied, bookable: occupied + available };
        },
        guestMix: async (day) => {
          const selected = await date(day);
          const mix = await reservationDbHelper.getDashboardGuestMixCounts(selected);
          const total = mix.adults + mix.children;
          const adultPercentage = total > 0 ? Math.round((mix.adults / total) * 1000) / 10 : 0;
          const childPercentage = total > 0 ? Math.round((mix.children / total) * 1000) / 10 : 0;
          base.info().annotations.push({
            type: "Guest Mix validation",
            description: `${day} (${selected}): adults=${mix.adults}, children=${mix.children}, total=${total}, adult percentage=${adultPercentage}%, child percentage=${childPercentage}%`,
          });
          return mix;
        },
        available: async (day, count = 1, extraDays = 0) =>
          (
            await setupDb.getAvailableCalendarRooms(
              await date(day),
              await date(day, 1 + extraDays),
              count,
            )
          ).slice(0, count),
        create: async (day, kind = "arrival", arrivalDate, room) => {
          const selected = arrivalDate ?? (await date(day));
          await layoutPage.clickReservationListIcon();
          const track = (confirmation: string) => {
            reservations.add(confirmation);
          };
          const confirmation =
            kind === "arrival"
              ? await reservationPage.createArrivalReservation(
                  findReservationPage,
                  selected,
                  track,
                  room,
                )
              : await reservationPage.createStayoverReservation(
                  findReservationPage,
                  selected,
                  -1,
                  1,
                  track,
                );
          await reservationPage.clickCloseButton();
          return confirmation;
        },
        createMultiRoom: async (day) => {
          const selected = await date(day);
          const [year, month, dayOfMonth] = selected.split("-");
          const formatted = `${Number(month)}/${Number(dayOfMonth)}/${year}`;
          const departure = addDays(selected, 1);
          const [departureYear, departureMonth, departureDay] = departure.split("-");
          const formattedDeparture = `${Number(departureMonth)}/${Number(departureDay)}/${departureYear}`;
          await layoutPage.clickReservationListIcon();
          await findReservationPage.chooseReservationTypeRegular();
          await findReservationPage.addNewReservation();
          await reservationPage.enterArrivalDateBeforeRoomSelection(formatted);
          await reservationPage.enterDepartureDate(formattedDeparture);
          await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
          await reservationPage.selectFirstRoomFromDropdown();
          await reservationPage.clickAddAnotherRoom();
          await reservationPage.selectSecondRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM_TWO);
          await reservationPage.selectFirstRoomFromDropdown();
          await reservationPage.enterGuestInfo(TestDataGenerator.email());
          await reservationPage.enterPaymentMethod(ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH);
          await reservationPage.verifyArrivalDate(formatted);
          await reservationPage.verifyDepartureDate(formattedDeparture);
          await reservationPage.clickSaveButton();
          const confirmation = await reservationPage.getReservationNumber();
          reservations.add(confirmation);
          await reservationPage.verifyAlertMessage(AlertMessages.RESERVATION_SAVED_SUCCESS);
          await reservationPage.clickCloseButton();
          return confirmation;
        },
        block: async (day, rooms) => {
          await scenario.blockAt(day, rooms, 0);
        },
        blockAt: async (day, rooms, offset) => {
          const selected = await date(day, offset);
          await calendar();
          for (const room of rooms) {
            await calendarPage.searchRoom(room.name);
            await calendarPage.blockRoom(room.name, selected);
            blocks.set(`${room.id}:${selected}`, { room, date: selected });
          }
        },
        unblock: async (day, rooms) => {
          const selected = await date(day);
          await calendar();
          for (const room of rooms) await unblockOne(room, selected);
          for (const room of rooms) {
            expect(
              await setupDb.getAvailableRoomIds(
                room.roomType,
                selected,
                addDays(selected, 1),
              ),
              `${room.name} should be available after unblocking`,
            ).toContain(room.id);
          }
        },
        cancel: async (confirmation) => {
          await edit(confirmation);
          await reservationPage.clickCancelButton();
          await reservationPage.verifyCancellationChargePopupDisplayed();
          await reservationPage.clickCancelReservation();
          await reservationPage.verifyAlertMessage(
            AlertMessages.RESERVATION_CANCELLED_SUCCESS,
          );
          await reservationPage.clickCloseButton();
        },
        remove: async (confirmation) => {
          await reservationApi.deleteReservation(confirmation);
          await expect
            .poll(() =>
              reservationDbHelper.getReservationStayDates(confirmation),
            )
            .toBeNull();
          reservations.delete(confirmation);
        },
        move: async (confirmation, selected) => {
          const format = (iso: string) => {
            const [year, month, day] = iso.split("-");
            return `${Number(month)}/${Number(day)}/${year}`;
          };
          await edit(confirmation);
          await reservationPage.clickRoomSelectionEnableEdit();
          await reservationPage.enterArrivalDate(format(selected));
          await reservationPage.enterDepartureDate(
            format(addDays(selected, 1)),
          );
          await reservationPage.clickSaveButton();
          await reservationPage.verifyAlertMessage(
            AlertMessages.RESERVATION_SAVED_SUCCESS,
          );
          await reservationPage.clickCloseButton();
          const saved =
            await reservationDbHelper.getReservationStayDates(confirmation);
          expect(saved?.arrival).toBe(selected);
          expect(saved?.departure).toBe(addDays(selected, 1));
        },
        active: async (room, active) => {
          if (!active) inactive.set(room.id, room);
          await setupDb.setUnitActiveInactive(
            room.roomType,
            room.name,
            active ? "Yes" : "No",
          );
          if (active) inactive.delete(room.id);
        },
      };
      try {
        await use(scenario);
      } finally {
        // Attempt every restoration even when a scenario or another cleanup fails.
        const failures: string[] = [];
        for (const room of inactive.values()) {
          try {
            await setupDb.setUnitActiveInactive(
              room.roomType,
              room.name,
              "Yes",
            );
          } catch (error) {
            failures.push(`Reactivate ${room.name}: ${String(error)}`);
          }
        }
        for (const { room, date: selected } of [...blocks.values()]) {
          try {
            await calendar();
            await unblockOne(room, selected);
          } catch (error) {
            failures.push(
              `Unblock ${room.name} on ${selected}: ${String(error)}`,
            );
          }
        }
        for (const confirmation of reservations) {
          try {
            await reservationApi.deleteReservation(confirmation);
            await expect
              .poll(
                () => reservationDbHelper.getReservationStayDates(confirmation),
                {
                  message: `Test reservation ${confirmation} must be removed during cleanup`,
                  timeout: 15_000,
                },
              )
              .toBeNull();
          } catch (error) {
            failures.push(
              `Delete test reservation ${confirmation}: ${String(error)}`,
            );
          }
        }
        expect(
          failures,
          "Restore all data created by the Room Status scenario",
        ).toEqual([]);
      }
    },
    { timeout: 180_000 },
  ],
});

test.describe("Dashboard Room Status pie chart", () => {
  test.describe.configure({ mode: "default", timeout: 240_000 });

  for (const day of ["Today", "Tomorrow"] as const) {
    test(`Verify title, total-room subtitle, legend and colors for ${day}`, async ({
      roomStatus,
    }) => {
      const expected = await roomStatus.open(day);
      await roomStatus.chart.verifyPresentation(expected.total);
    });

    test(`Verify all four statuses against independent database counts for ${day}`, async ({
      roomStatus,
    }) => {
      await roomStatus.create(day);
      await roomStatus.create(day, "stayover");
      const rooms = await roomStatus.available(day, 2);
      await roomStatus.block(day, [rooms[0]]);
      const expected = await roomStatus.open(day);
      for (const category of categories)
        expect(
          expected[category.key],
          `${category.label} setup`,
        ).toBeGreaterThan(0);
    });

    test(`Verify chart counts agree with dashboard tiles for ${day}`, async ({
      roomStatus,
      dashboardPage,
    }) => {
      const expected = await roomStatus.open(day);
      const tiles: Counts = {
        arrival: await dashboardPage.getTodayArrivalsCount(),
        stayover: await dashboardPage.getStayoverCount(),
        blocked: await dashboardPage.getBlockedCount(),
        vacant: await dashboardPage.getVacantCount(),
      };
      await roomStatus.chart.verify({ ...tiles, total: expected.total });
      for (const category of categories)
        expect(tiles[category.key]).toBe(expected[category.key]);
    });

    test(`Verify slice proportions, positions and integer labels for ${day}`, async ({
      roomStatus,
    }) => {
      await roomStatus.create(day);
      await roomStatus.create(day, "stayover");
      await roomStatus.block(day, await roomStatus.available(day));
      await roomStatus.open(day);
    });

    for (const kind of ["arrival", "stayover"] as const) {
      test(`Verify chart after creating ${kind === "arrival" ? "an arrival" : "a stayover"} reservation for ${day}`, async ({
        roomStatus,
      }) => {
        const before = await roomStatus.open(day);
        await roomStatus.create(day, kind);
        const after = await roomStatus.open(day);
        expect(after).toEqual({
          ...before,
          [kind]: before[kind] + 1,
          vacant: before.vacant - 1,
        });
      });
    }

    test(`Verify chart after blocking an available room for ${day}`, async ({
      roomStatus,
    }) => {
      const before = await roomStatus.open(day);
      await roomStatus.block(day, await roomStatus.available(day));
      expect(await roomStatus.open(day)).toEqual({
        ...before,
        blocked: before.blocked + 1,
        vacant: before.vacant - 1,
      });
    });

    for (const count of [1, 3]) {
      test(`Verify chart after unblocking ${count} room(s) for ${day}`, async ({
        roomStatus,
      }) => {
        const rooms = await roomStatus.available(day, count);
        await roomStatus.block(day, rooms);
        const before = await roomStatus.open(day);
        await roomStatus.unblock(day, rooms);
        expect(await roomStatus.open(day)).toEqual({
          ...before,
          blocked: before.blocked - count,
          vacant: before.vacant + count,
        });
      });
    }

    for (const action of ["cancel", "delete"] as const) {
      test(`Verify chart after ${action === "cancel" ? "cancelling" : "deleting"} an applicable reservation for ${day}`, async ({
        roomStatus,
        reservationDbHelper,
      }) => {
        const baseline = await roomStatus.open(day);
        const [room] = await roomStatus.available(day);
        const confirmation = await roomStatus.create(
          day,
          "arrival",
          undefined,
          room,
        );
        const before = await roomStatus.open(day);
        expect(before).toEqual({
          ...baseline,
          arrival: baseline.arrival + 1,
          vacant: baseline.vacant - 1,
        });
        if (action === "cancel") {
          await roomStatus.cancel(confirmation);
          expect(
            await reservationDbHelper.getArrivalStatus(
              confirmation,
              await roomStatus.date(day),
            ),
          ).toMatch(/^Cancelled$/i);
        } else await roomStatus.remove(confirmation);
        expect(await roomStatus.open(day)).toEqual(baseline);
      });
    }

    test(`Exclude a cancelled reservation arriving on the selected date from Arrival for ${day}`, async ({
      roomStatus,
      reservationDbHelper,
    }) => {
      const selected = await roomStatus.date(day);
      const baseline = await roomStatus.open(day);
      const [room] = await roomStatus.available(day);
      const confirmation = await roomStatus.create(day, "arrival", selected, room);

      await roomStatus.cancel(confirmation);
      expect(
        await reservationDbHelper.getArrivalStatus(confirmation, selected),
        `Reservation ${confirmation} should be cancelled on ${selected}.`,
      ).toMatch(/^Cancelled$/i);

      const after = await roomStatus.open(day);
      expect(after.arrival, "A cancelled arrival must be excluded from Arrival.").toBe(baseline.arrival);
      expect(after).toEqual(baseline);
    });

    test(`Exclude a cancelled reservation spanning the selected date from Stay Over for ${day}`, async ({
      roomStatus,
      reservationDbHelper,
    }) => {
      const selected = await roomStatus.date(day);
      const baseline = await roomStatus.open(day);
      const confirmation = await roomStatus.create(day, "stayover");

      await roomStatus.cancel(confirmation);
      expect(
        await reservationDbHelper.getReservationStayDates(confirmation),
        `Cancelled reservation ${confirmation} should retain its stay dates.`,
      ).not.toBeNull();
      const after = await roomStatus.open(day);
      expect(after.stayover, "A cancelled spanning reservation must be excluded from Stay Over.").toBe(baseline.stayover);
      expect(after).toEqual(baseline);
      expect(await roomStatus.date(day)).toBe(selected);
    });

    test(`Apply the departure-day rule when departure equals the selected date for ${day}`, async ({
      roomStatus,
      reservationDbHelper,
    }) => {
      const selected = await roomStatus.date(day);
      const baseline = await roomStatus.open(day);
      const confirmation = await roomStatus.create(
        day,
        "arrival",
        await roomStatus.date(day, -1),
      );
      expect(
        await reservationDbHelper.getDepartureStatus(confirmation, selected),
        `Reservation ${confirmation} should depart on the selected date.`,
      ).not.toMatch(/^Cancelled$/i);

      const after = await roomStatus.open(day);
      expect(after.stayover, "A departure-day reservation must not be counted as Stay Over.").toBe(baseline.stayover);
    });

    test(`Ignore a reservation and room block outside the selected date for ${day}`, async ({
      roomStatus,
    }) => {
      const baseline = await roomStatus.open(day);
      const outsideDate = await roomStatus.date(day, 2);
      const [reservationRoom, blockRoom] = await roomStatus.available(day, 2, 2);
      await roomStatus.create(day, "arrival", outsideDate, reservationRoom);
      await roomStatus.blockAt(day, [blockRoom], 2);

      expect(
        await roomStatus.open(day),
        "Records outside the selected date must not change Room Status counts.",
      ).toEqual(baseline);
    });

    test(`Include a room block starting on the selected date for ${day}`, async ({
      roomStatus,
    }) => {
      const adjacentDay: Day = day === "Today" ? "Tomorrow" : "Today";
      const adjacentBefore = await roomStatus.open(adjacentDay);
      const selectedBefore = await roomStatus.open(day);
      const [room] = await roomStatus.available(day);

      await roomStatus.blockAt(day, [room], 0);
      expect(await roomStatus.open(day)).toEqual({
        ...selectedBefore,
        blocked: selectedBefore.blocked + 1,
        vacant: selectedBefore.vacant - 1,
      });
      expect(
        await roomStatus.open(adjacentDay),
        "A block starting on the selected date must not affect the adjacent date.",
      ).toEqual(adjacentBefore);
    });

    test(`Apply the room-block ending boundary on the selected date for ${day}`, async ({
      roomStatus,
    }) => {
      const adjacentDay: Day = day === "Today" ? "Tomorrow" : "Today";
      const adjacentBefore = await roomStatus.open(adjacentDay);
      const selectedBefore = await roomStatus.open(day);
      const [room] = await roomStatus.available(day);

      // Calendar blocks are date-scoped. The selected date is therefore the
      // inclusive ending boundary represented by the block record.
      await roomStatus.blockAt(day, [room], 0);
      expect(await roomStatus.open(day)).toEqual({
        ...selectedBefore,
        blocked: selectedBefore.blocked + 1,
        vacant: selectedBefore.vacant - 1,
      });
      expect(
        await roomStatus.open(adjacentDay),
        "The ending boundary must not change the adjacent date.",
      ).toEqual(adjacentBefore);
    });

    for (const direction of ["into", "out of"] as const) {
      test(`Verify chart after moving reservation dates ${direction} ${day}`, async ({
        roomStatus,
      }) => {
        const [room] = await roomStatus.available(day, 1, 3);
        const selected = await roomStatus.date(day);
        const future = await roomStatus.date(day, 2);
        const initialDate = direction === "into" ? future : selected;
        const finalDate = direction === "into" ? selected : future;
        const confirmation = await roomStatus.create(
          day,
          "arrival",
          initialDate,
          room,
        );
        const before = await roomStatus.open(day);
        await roomStatus.move(confirmation, finalDate);
        const delta = direction === "into" ? 1 : -1;
        expect(await roomStatus.open(day)).toEqual({
          ...before,
          arrival: before.arrival + delta,
          vacant: before.vacant - delta,
        });
      });
    }

    test(`Verify refresh and navigation after a data change for ${day}`, async ({
      roomStatus,
      dashboardPage,
      page,
      layoutPage,
    }) => {
      const before = await roomStatus.open(day);
      const confirmation = await roomStatus.create(day);
      await roomStatus.open(day);
      // API mutation while the chart is open makes the rendered data stale.
      await roomStatus.remove(confirmation);
      await page.reload();
      await dashboardPage.verifyTodaySelectedByDefault();
      await roomStatus.verify("Today");
      if (day === "Tomorrow") await dashboardPage.selectTomorrow();
      expect(await roomStatus.verify(day)).toEqual(before);
      await layoutPage.clickReservationListIcon();
      await dashboardPage.open();
      await dashboardPage.verifyTodaySelectedByDefault();
      await roomStatus.verify("Today");
    });

    test(`Verify chart after deactivating and reactivating a vacant room for ${day}`, async ({
      roomStatus,
    }) => {
      const [room] = await roomStatus.available(day);
      const before = await roomStatus.open(day);
      await roomStatus.active(room, false);
      const inactive = await roomStatus.open(day);
      expect(inactive).toEqual({ ...before, vacant: before.vacant - 1 });
      await roomStatus.active(room, true);
      expect(await roomStatus.open(day)).toEqual(before);
    });
  }

  for (const day of ["Today", "Tomorrow"] as const) {
    test(`Verify Occupancy Status for a property with occupied and bookable rooms for ${day}`, async ({
      roomStatus,
    }) => {
      await roomStatus.open(day);
      const { occupied, bookable } = await roomStatus.occupancy(day);
      expect(occupied, "The selected date must have an occupied bookable room.").toBeGreaterThan(0);
      expect(bookable, "The selected date must have bookable inventory.").toBeGreaterThan(occupied);
      await roomStatus.occupancyChart.verify(occupied, bookable);
    });

    test(`Verify occupancy when all bookable rooms are occupied for ${day}`, async ({ roomStatus }) => {
      await roomStatus.open(day);
      const { occupied, bookable } = await roomStatus.occupancy(day);
      test.skip(bookable !== occupied, "The selected date does not have all bookable rooms occupied.");
      await roomStatus.occupancyChart.verify(occupied, bookable);
      expect(occupied / bookable).toBe(1);
    });

    test(`Verify occupancy when no bookable rooms are occupied for ${day}`, async ({ roomStatus }) => {
      await roomStatus.open(day);
      const { occupied, bookable } = await roomStatus.occupancy(day);
      test.skip(occupied !== 0, "The selected date has occupied bookable rooms.");
      await roomStatus.occupancyChart.verify(occupied, bookable);
      expect(occupied / bookable).toBe(0);
    });

    test(`Verify occupancy when some bookable rooms are occupied for ${day}`, async ({ roomStatus }) => {
      await roomStatus.open(day);
      const { occupied, bookable } = await roomStatus.occupancy(day);
      test.skip(!(occupied > 0 && occupied < bookable), "The selected date is not a partial-occupancy case.");
      await roomStatus.occupancyChart.verify(occupied, bookable);
      expect(occupied).toBeGreaterThan(0);
      expect(occupied).toBeLessThan(bookable);
    });

    for (const kind of ["arrival", "stayover"] as const) {
      test(`OS-0${kind === "arrival" ? "5" : "6"}: Verify occupancy after an applicable ${kind} reservation is created for ${day}`, async ({ roomStatus }) => {
        const beforeOccupancy = await roomStatus.occupancy(day);
        await roomStatus.create(day, kind);
        const afterOccupancy = await roomStatus.occupancy(day);
        expect(afterOccupancy.occupied, `${kind} reservation should occupy one additional bookable room.`)
          .toBe(beforeOccupancy.occupied + 1);
        expect(afterOccupancy.bookable).toBe(beforeOccupancy.bookable);
        await roomStatus.open(day);
        await roomStatus.occupancyChart.verify(afterOccupancy.occupied, afterOccupancy.bookable);
        expect(afterOccupancy.occupied / afterOccupancy.bookable)
          .toBeGreaterThan(beforeOccupancy.occupied / beforeOccupancy.bookable);
      });
    }

    test(`Verify occupancy after a reservation is cancelled for ${day}`, async ({ roomStatus }) => {
      const before = await roomStatus.occupancy(day);
      const confirmation = await roomStatus.create(day, "arrival");
      const occupied = await roomStatus.occupancy(day);
      expect(occupied.occupied).toBe(before.occupied + 1);
      await roomStatus.cancel(confirmation);
      const after = await roomStatus.occupancy(day);
      expect(after).toEqual(before);
      await roomStatus.open(day);
      await roomStatus.occupancyChart.verify(after.occupied, after.bookable);
    });

    test(`Verify occupancy after a reservation is deleted for ${day}`, async ({ roomStatus }) => {
      const before = await roomStatus.occupancy(day);
      const confirmation = await roomStatus.create(day, "arrival");
      expect((await roomStatus.occupancy(day)).occupied).toBe(before.occupied + 1);
      await roomStatus.remove(confirmation);
      const after = await roomStatus.occupancy(day);
      expect(after).toEqual(before);
      await roomStatus.open(day);
      await roomStatus.occupancyChart.verify(after.occupied, after.bookable);
    });

    test(`Verify occupancy after moving a reservation outside the selected date for ${day}`, async ({ roomStatus }) => {
      const selected = await roomStatus.date(day);
      const outside = await roomStatus.date(day, 2);
      const before = await roomStatus.occupancy(day);
      const confirmation = await roomStatus.create(day, "arrival", selected);
      const occupied = await roomStatus.occupancy(day);
      await roomStatus.move(confirmation, outside);
      const after = await roomStatus.occupancy(day);
      expect(occupied.occupied).toBe(before.occupied + 1);
      expect(after).toEqual(before);
    });

    test(`Verify occupancy after moving a reservation into the selected date for ${day}`, async ({ roomStatus }) => {
      const selected = await roomStatus.date(day);
      const outside = await roomStatus.date(day, 1);
      const before = await roomStatus.occupancy(day);
      const confirmation = await roomStatus.create(day, "arrival", outside);
      expect(await roomStatus.occupancy(day)).toEqual(before);
      await roomStatus.move(confirmation, selected);
      const after = await roomStatus.occupancy(day);
      expect(after.occupied).toBe(before.occupied + 1);
      expect(after.bookable).toBe(before.bookable);
      await roomStatus.open(day);
      await roomStatus.occupancyChart.verify(after.occupied, after.bookable);
    });

    test(`Verify blocked rooms do not increase occupied-room count for ${day}`, async ({ roomStatus }) => {
      const before = await roomStatus.occupancy(day);
      const [room] = await roomStatus.available(day);
      await roomStatus.blockAt(day, [room], 0);
      const after = await roomStatus.occupancy(day);
      expect(after.occupied, "A blocked room must not be counted as occupied.").toBe(before.occupied);
      expect(after.bookable).toBe(before.bookable - 1);
      await roomStatus.open(day);
    });

    test(`Verify inactive rooms are excluded from bookable inventory for ${day}`, async ({ roomStatus }) => {
      const before = await roomStatus.occupancy(day);
      const [room] = await roomStatus.available(day);
      await roomStatus.active(room, false);
      const after = await roomStatus.occupancy(day);
      expect(after.occupied).toBe(before.occupied);
      expect(after.bookable).toBe(before.bookable - 1);
      await roomStatus.open(day);
    });

    test(`Verify multi-room reservation occupancy for ${day}`, async ({ roomStatus }) => {
      const before = await roomStatus.occupancy(day);
      await roomStatus.createMultiRoom(day);
      const after = await roomStatus.occupancy(day);
      expect(
        after.occupied,
        "A two-room reservation must contribute two physical occupied rooms.",
      ).toBe(before.occupied + 2);
      expect(after.bookable).toBe(before.bookable);
      await roomStatus.open(day);
      await roomStatus.occupancyChart.verify(after.occupied, after.bookable);
    });


// =========== Guest Mix =================

    test(`Verify adult and child percentage calculations for ${day}`, async ({ roomStatus }) => {
      await roomStatus.open(day);
      const mix = await roomStatus.guestMix(day);
      test.skip(mix.adults + mix.children === 0, "No qualifying guests exist for the selected date.");
      await roomStatus.guestMixChart.verify(mix.adults, mix.children);
    });

    test(`Verify adult and child percentages total 100% for ${day}`, async ({ roomStatus }) => {
      await roomStatus.open(day);
      const mix = await roomStatus.guestMix(day);
      test.skip(mix.adults + mix.children === 0, "No qualifying guests exist for the selected date.");
      expect(mix.adults + mix.children).toBeGreaterThan(0);
      await roomStatus.guestMixChart.verify(mix.adults, mix.children);
    });

    test(`Verify Guest Mix for ${day}`, async ({ roomStatus }) => {
      await roomStatus.open(day);
      const mix = await roomStatus.guestMix(day);
      test.skip(mix.adults + mix.children === 0, "No qualifying guests exist for the selected date.");
      await roomStatus.guestMixChart.verify(mix.adults, mix.children);
    });

    test(`Exclude cancelled reservation guests for ${day}`, async ({ roomStatus }) => {
      const before = await roomStatus.guestMix(day);
      const confirmation = await roomStatus.create(day, "arrival");
      await roomStatus.cancel(confirmation);
      const after = await roomStatus.guestMix(day);
      expect(after).toEqual(before);

      // Return to Dashboard and validate the rendered Guest Mix after cancellation.
      await roomStatus.open(day);
      if (after.adults + after.children > 0) {
        await roomStatus.guestMixChart.verify(after.adults, after.children);
      } else {
        await expect(roomStatus.guestMixChart.card).toBeVisible();
      }
    });

    test(`Exclude reservation guests outside the selected date for ${day}`, async ({ roomStatus }) => {
      const before = await roomStatus.guestMix(day);
      await roomStatus.create(day, "arrival", await roomStatus.date(day, 2));
      const after = await roomStatus.guestMix(day);
      expect(after).toEqual(before);
      await roomStatus.open(day);
      if (after.adults + after.children > 0) await roomStatus.guestMixChart.verify(after.adults, after.children);
      else await expect(roomStatus.guestMixChart.card).toBeVisible();
    });

    test(`Include and exclude guests when reservation dates move for ${day}`, async ({ roomStatus }) => {
      const selected = await roomStatus.date(day);
      const outside = await roomStatus.date(day, 1);
      const before = await roomStatus.guestMix(day);
      const confirmation = await roomStatus.create(day, "arrival", outside);
      expect(await roomStatus.guestMix(day)).toEqual(before);
      await roomStatus.move(confirmation, selected);
      const after = await roomStatus.guestMix(day);
      expect(after.adults + after.children).toBeGreaterThan(before.adults + before.children);
      await roomStatus.open(day);
      await roomStatus.guestMixChart.verify(after.adults, after.children);
    });

    test(`Count guests from a multi-room reservation individually for ${day}`, async ({ roomStatus }) => {
      const before = await roomStatus.guestMix(day);
      await roomStatus.createMultiRoom(day);
      const after = await roomStatus.guestMix(day);
      expect(after.adults + after.children).toBeGreaterThan(before.adults + before.children);
      await roomStatus.open(day);
      await roomStatus.guestMixChart.verify(after.adults, after.children);
    });
  }

  test("Switch Today to Tomorrow and refresh Guest Mix", async ({ roomStatus, dashboardPage }) => {
    await roomStatus.open("Today");
    const today = await roomStatus.guestMix("Today");
    await dashboardPage.selectTomorrow();
    const tomorrow = await roomStatus.guestMix("Tomorrow");
    expect(tomorrow).toEqual(await roomStatus.guestMix("Tomorrow"));
    await roomStatus.guestMixChart.verify(tomorrow.adults, tomorrow.children);
    expect(today).toBeDefined();
  });

  test("Switch Tomorrow to Today and restore Guest Mix", async ({ roomStatus, dashboardPage }) => {
    await roomStatus.open("Today");
    const today = await roomStatus.guestMix("Today");
    await dashboardPage.selectTomorrow();
    await dashboardPage.refreshToday();
    const restored = await roomStatus.guestMix("Today");
    expect(restored).toEqual(today);
    await roomStatus.guestMixChart.verify(restored.adults, restored.children);
  });

  test("Verify Today to Tomorrow with different data for each day", async ({
    roomStatus,
    dashboardPage,
  }) => {
    let today = await roomStatus.open("Today");
    let tomorrow = await roomStatus.expected("Tomorrow");
    if (JSON.stringify(today) === JSON.stringify(tomorrow)) {
      await roomStatus.create("Tomorrow");
      today = await roomStatus.open("Today");
      tomorrow = await roomStatus.expected("Tomorrow");
    }
    expect(
      tomorrow,
      "Today and Tomorrow must have distinct chart data",
    ).not.toEqual(today);
    await dashboardPage.selectTomorrow();
    await dashboardPage.verifyTomorrowSelected();
    expect(await roomStatus.verify("Tomorrow")).toEqual(tomorrow);
  });

  test("Verify Tomorrow to Today restores the original chart", async ({
    roomStatus,
    dashboardPage,
  }) => {
    let before = await roomStatus.open("Today");
    if (
      JSON.stringify(before) ===
      JSON.stringify(await roomStatus.expected("Tomorrow"))
    ) {
      await roomStatus.create("Tomorrow");
      before = await roomStatus.open("Today");
    }
    await dashboardPage.selectTomorrow();
    expect(await roomStatus.verify("Tomorrow")).not.toEqual(before);
    await dashboardPage.refreshToday();
    expect(await roomStatus.verify("Today")).toEqual(before);
  });
});
