import { test } from "../../src/fixtures/sso.fixture";
import type { CalendarPage } from "../../src/pages/CalendarPage";
import type {
  SortableRoom,
  SortableRoomType,
} from "../../src/utils/DBHelper/SetupDatabaseHelper";
import { Logger } from "../../src/utils/Logger";

const layouts = ["Monthly", "Weekly", "Detailed"] as const;

test.describe("PMS Calendar sorting", () => {
  test.setTimeout(90_000);

  test.beforeEach(async ({ setupDb }) => {
    await setupDb.trackSortOrderState();
  });

  test("applies Room Type display order to every calendar layout", async ({
    setupDb,
    calendarPage,
    layoutPage,
    ssoLoginPage,
  }) => {
    const allRoomTypes = await setupDb.getSortableRoomTypes();
    const roomTypes = allRoomTypes.slice(0, 5);
    const expected = [...roomTypes].reverse();
    const orderedRoomTypes = [
      ...expected,
      ...allRoomTypes.filter(({ id }) => !roomTypes.some((row) => row.id === id)),
    ];
    const orders = toAscendingDisplayOrders(orderedRoomTypes);
    await setupDb.setRoomTypeDisplayOrders(orders);
    await setupDb.setPmsSortMode("DisplayOrder");
    logPmsSetup("Room Type", "DisplayOrder", roomTypes, orders);
    await ssoLoginPage.loginAsPropertyUser();
    await layoutPage.clickCalendarIcon();
    await calendarPage.selectCalendarGrouping("Room Type");

    await verifyOrderInAllLayouts(
      calendarPage,
      expected.map(({ name }) => name),
      "Room Type - DisplayOrder",
    );
  });

  test("applies Room display order to every calendar layout", async ({
    setupDb,
    calendarPage,
    layoutPage,
    ssoLoginPage,
  }) => {
    const allRooms = await setupDb.getSortableRooms();
    const rooms = await setupDb.getSortableRooms("RoomDisplayOrder");
    const expected = [...rooms].reverse();
    const orderedRooms = [
      ...expected,
      ...allRooms.filter(({ id }) => !rooms.some((row) => row.id === id)),
    ];
    const orders = toAscendingDisplayOrders(orderedRooms);
    await setupDb.setRoomDisplayOrders(orders);
    await setupDb.setPmsSortMode("DisplayOrder");
    logPmsSetup("Room Name", "DisplayOrder", rooms, orders);
    await ssoLoginPage.loginAsPropertyUser();
    await layoutPage.clickCalendarIcon();
    await calendarPage.selectCalendarGrouping("Room Name");

    await verifyOrderInAllLayouts(
      calendarPage,
      expected.map(({ name }) => name),
      "Room Name - DisplayOrder",
    );
  });

  test("falls back for duplicate or blank Room Type orders in every calendar layout", async ({
    setupDb,
    calendarPage,
    layoutPage,
    ssoLoginPage,
  }) => {
    const roomTypes = (await setupDb.getSortableRoomTypes()).slice(0, 5);
    const orders = roomTypes.map(({ id }, index) => ({
      id,
      displayOrder: index < 2 ? 1 : 0,
    }));
    await setupDb.setRoomTypeDisplayOrders(orders);
    await setupDb.setPmsSortMode("DisplayOrder");
    logPmsSetup("Room Type", "DisplayOrder duplicate/blank fallback", roomTypes, orders);
    await ssoLoginPage.loginAsPropertyUser();
    await layoutPage.clickCalendarIcon();
    await calendarPage.selectCalendarGrouping("Room Type");

    const duplicates = roomTypes.slice(0, 2).sort(byName);
    const blanks = roomTypes.slice(2).sort(byName);
    await verifyOrderInAllLayouts(
      calendarPage,
      [...duplicates, ...blanks].map(({ name }) => name),
      "Room Type - duplicate/blank fallback",
    );
  });

  for (const sortMode of ["UnitName", "UnitNo"] as const) {
    const groupingScope =
      sortMode === "UnitName" ? "both groupings" : "Room Name";
    test(`keeps ${sortMode} sorting for ${groupingScope} in every calendar layout`, async ({
      setupDb,
      calendarPage,
      layoutPage,
      ssoLoginPage,
    }) => {
      const rooms = await setupDb.getSortableRooms("RoomDisplayOrder");
      const expectedRooms = [...rooms].sort(
        sortMode === "UnitName" ? byName : byRoomNo,
      );
      await setupDb.setPmsSortMode(sortMode);
      Logger.step(`Configure PMS ${groupingScope} ${sortMode}`);
      Logger.info(`SortMode=${sortMode}; database display order is not used`);
      if (sortMode === "UnitNo") {
        Logger.info(
          `Expected RoomNo order: ${expectedRooms
            .map(({ roomNo, name }) => `${roomNo ?? "blank"}=${name}`)
            .join(" -> ")}`,
        );
      }
      await ssoLoginPage.loginAsPropertyUser();
      await layoutPage.clickCalendarIcon();
      await calendarPage.selectCalendarGrouping("Room Name");
      await verifyOrderInAllLayouts(
        calendarPage,
        expectedRooms.map(({ name }) => name),
        `Room Name - ${sortMode}`,
      );
      if (sortMode === "UnitName") {
        const expectedRoomTypes = [
          ...(await setupDb.getSortableRoomTypes()),
        ]
          .slice(0, 5)
          .sort(byName);
        await calendarPage.selectCalendarGrouping("Room Type");
        await verifyOrderInAllLayouts(
          calendarPage,
          expectedRoomTypes.map(({ name }) => name),
          "Room Type - UnitName alphabetical fallback",
        );
      }
    });
  }
});

async function verifyOrderInAllLayouts(
  calendarPage: CalendarPage,
  expectedNames: readonly string[],
  checkpoint: string,
): Promise<void> {
  for (const layout of layouts) {
    await calendarPage.selectCalendarLayout(layout);
    await calendarPage.verifyLabelsInDisplayOrder(
      expectedNames,
      `PMS ${layout} - ${checkpoint}`,
    );
  }
}

function toAscendingDisplayOrders(rows: readonly SortableRoomType[]) {
  return rows.map(({ id }, index) => ({
    id,
    displayOrder: index + 1,
  }));
}

function byName(a: SortableRoomType, b: SortableRoomType): number {
  return a.name.localeCompare(b.name, undefined, { numeric: true });
}

function byRoomNo(a: SortableRoom, b: SortableRoom): number {
  if (a.roomNo === null) return b.roomNo === null ? byName(a, b) : 1;
  if (b.roomNo === null) return -1;
  return (
    String(a.roomNo).localeCompare(String(b.roomNo), undefined, { numeric: true }) ||
    byName(a, b)
  );
}

function logPmsSetup(
  grouping: "Room Type" | "Room Name",
  sortMode: string,
  rows: readonly SortableRoomType[],
  orders: ReadonlyArray<{ id: number; displayOrder: number | null }>,
): void {
  const orderById = new Map(orders.map(({ id, displayOrder }) => [id, displayOrder]));
  Logger.step(`Configure PMS ${grouping}`);
  Logger.info(`SortMode=${sortMode}`);
  Logger.info(
    `Database order values: ${rows
      .map(({ id, name }) => `${name}=${orderById.get(id) ?? "blank"}`)
      .join(", ")}`,
  );
}
