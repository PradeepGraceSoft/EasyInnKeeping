import { test } from "../../src/fixtures/sso.fixture";
import type {
  OnlineBookingPage,
  SelectedStayDates,
} from "../../src/pages/OnlineBookingPage";
import type { OnlineBookingTemplate } from "../../src/utils/DBHelper/OnlineBookingDatabaseHelper";
import type { OnlineBookingDatabaseHelper } from "../../src/utils/DBHelper/OnlineBookingDatabaseHelper";
import type {
  EwrCalendarView,
  SetupDatabaseHelper,
  SortableRoomType,
} from "../../src/utils/DBHelper/SetupDatabaseHelper";
import { Logger } from "../../src/utils/Logger";

test.describe("EWR Display Order", () => {
  test.setTimeout(90_000);

  test("Modern RoomType order on Check Availability, result, and All Rooms", async ({
    setupDb,
    onlineBookingDb,
    onlineBookingPage,
  }) => {
    await verifyDisplayOrder(
      { setupDb, onlineBookingDb, onlineBookingPage },
      "Modern",
      "RoomType",
    );
  });

  test("Modern RoomName order on Check Availability, result, and All Rooms", async ({
    setupDb,
    onlineBookingDb,
    onlineBookingPage,
  }) => {
    await verifyDisplayOrder(
      { setupDb, onlineBookingDb, onlineBookingPage },
      "Modern",
      "RoomName",
    );
  });

  test("Classic RoomType order on Check Availability, result, and All Rooms", async ({
    setupDb,
    onlineBookingDb,
    onlineBookingPage,
  }) => {
    await verifyDisplayOrder(
      { setupDb, onlineBookingDb, onlineBookingPage },
      "Classic",
      "RoomType",
    );
  });

  test("Classic RoomName order on Check Availability, result, and All Rooms", async ({
    setupDb,
    onlineBookingDb,
    onlineBookingPage,
  }) => {
    await verifyDisplayOrder(
      { setupDb, onlineBookingDb, onlineBookingPage },
      "Classic",
      "RoomName",
    );
  });

  test("V4 Classic duplicate/blank fallback on Check Availability, result, and All Rooms", async ({
    setupDb,
    onlineBookingDb,
    onlineBookingPage,
  }) => {
    await setupDb.trackSortOrderState();
    await configureEwr(setupDb, onlineBookingDb, "Classic", "RoomType");
    const roomTypes = (await setupDb.getSortableRoomTypes(true)).slice(0, 5);
    await setupDb.setRoomTypeDisplayOrders(
      roomTypes.map(({ id }, index) => ({
        id,
        displayOrder: index < 2 ? 1 : 0,
      })),
    );
    const expected = [
      ...roomTypes.slice(0, 2).sort(byName),
      ...roomTypes.slice(2).sort(byName),
    ].map(({ name }) => name);
    Logger.step("Configure EWR duplicate and blank fallback");
    Logger.info("Template=Classic, CalendarView=RoomType, DisplayOrder=1");
    Logger.info(
      `Database order values: ${roomTypes
        .map(({ name }, index) => `${name}=${index < 2 ? 1 : 0}`)
        .join(", ")}`,
    );

    await verifyOrderOnAllPages(
      { setupDb, onlineBookingPage },
      { rows: roomTypes, expectedNames: expected },
      "RoomType",
      "EWR Classic RoomType - duplicate/blank fallback",
    );
  });

  test("disabled Display Order fallback on Check Availability, result, and All Rooms", async ({
    setupDb,
    onlineBookingDb,
    onlineBookingPage,
  }) => {
    await setupDb.trackSortOrderState();
    await configureEwr(setupDb, onlineBookingDb, "Modern", "RoomType");
    await setupDb.setBEDisplayOrder(0);
    const roomTypes = (await setupDb.getSortableRoomTypes(true)).slice(0, 5);
    await setupDb.setRoomTypeDisplayOrders(toReverseOrders(roomTypes));
    Logger.step("Configure EWR disabled Display Order fallback");
    Logger.info("Template=Modern, CalendarView=RoomType, DisplayOrder=0");
    logConfiguredOrders(roomTypes, toReverseOrders(roomTypes));

    await verifyOrderOnAllPages(
      { setupDb, onlineBookingPage },
      {
        rows: roomTypes,
        expectedNames: [...roomTypes].sort(byName).map(({ name }) => name),
      },
      "RoomType",
      "EWR Modern RoomType - Display Order disabled",
    );
  });
});

type DisplayOrderFixtures = {
  setupDb: SetupDatabaseHelper;
  onlineBookingDb: OnlineBookingDatabaseHelper;
  onlineBookingPage: OnlineBookingPage;
};

async function verifyDisplayOrder(
  { setupDb, onlineBookingDb, onlineBookingPage }: DisplayOrderFixtures,
  template: OnlineBookingTemplate,
  view: EwrCalendarView,
): Promise<void> {
  await setupDb.trackSortOrderState();
  await configureEwr(setupDb, onlineBookingDb, template, view);
  Logger.step(`Configure EWR ${template} ${view}`);
  Logger.info(
    `Template=${template}, CalendarView=${view}, DisplayOrder=1, ShowAllRoom=1`,
  );
  const configured = await configureReverseDisplayOrder(setupDb, view);
  Logger.info(`Expected configured order: ${configured.expectedNames.join(" -> ")}`);

  await verifyOrderOnAllPages(
    { setupDb, onlineBookingPage },
    configured,
    view,
    `EWR ${template} ${view}`,
  );
}

async function verifyOrderOnAllPages(
  { setupDb, onlineBookingPage }: Pick<
    DisplayOrderFixtures,
    "setupDb" | "onlineBookingPage"
  >,
  configured: ConfiguredDisplayOrder,
  view: EwrCalendarView,
  checkpoint: string,
): Promise<void> {
  await onlineBookingPage.openHome();
  await onlineBookingPage.verifyAllRoomsLabelsInDisplayOrder(configured.expectedNames);
  await onlineBookingPage.clickCheckAvailability();
  await onlineBookingPage.verifyRoomLabelsInDisplayOrder(
    configured.expectedNames,
    `${checkpoint} Check Availability`,
  );
  await onlineBookingPage.openHome();
  await onlineBookingPage.selectNextAvailableStay();
  const stayDates = await onlineBookingPage.getSelectedStayDates();
  const expectedAvailableNames = await getExpectedAvailableNames(
    setupDb,
    configured,
    view,
    stayDates,
  );
  await onlineBookingPage.clickSearchButton();
  await onlineBookingPage.verifyRoomLabelsInDisplayOrder(
    expectedAvailableNames,
    `${checkpoint} result page`,
  );
}

type ConfiguredDisplayOrder = {
  rows: SortableRoomType[];
  expectedNames: string[];
  roomType?: string;
};

async function configureReverseDisplayOrder(
  setupDb: Parameters<typeof configureEwr>[0],
  view: EwrCalendarView,
): Promise<ConfiguredDisplayOrder> {
  if (view === "RoomType") {
    const rows = (await setupDb.getSortableRoomTypes(true)).slice(0, 5);
    const orders = toReverseOrders(rows);
    await setupDb.setRoomTypeDisplayOrders(orders);
    logConfiguredOrders(rows, orders);
    return {
      rows,
      expectedNames: [...rows].reverse().map(({ name }) => name),
    };
  }
  const roomType = await setupDb.getOnlineRoomTypeWithMostRooms();
  const rows = await setupDb.getSortableRooms(roomType, true);
  Logger.info(`Dynamically selected RoomName test group: ${roomType}`);
  const orders = toReverseOrders(rows);
  await setupDb.setRoomDisplayOrders(orders);
  logConfiguredOrders(rows, orders);
  return {
    rows,
    roomType,
    expectedNames: [...rows].reverse().map(({ name }) => name),
  };
}

async function getExpectedAvailableNames(
  setupDb: SetupDatabaseHelper,
  configured: ConfiguredDisplayOrder,
  view: EwrCalendarView,
  { startDate, endDate }: SelectedStayDates,
): Promise<string[]> {
  Logger.step(`Query availability for ${startDate} through ${endDate}`);
  if (view === "RoomName") {
    if (!configured.roomType) throw new Error("Configured RoomName room type is missing.");
    const availableIds = new Set(
      await setupDb.getAvailableRoomIds(configured.roomType, startDate, endDate),
    );
    Logger.info(
      `Available room IDs for ${configured.roomType}: ${[...availableIds].join(", ")}`,
    );
    const availableNames = configured.expectedNames.filter((name) => {
      const row = configured.rows.find((candidate) => candidate.name === name);
      return row ? availableIds.has(row.id) : false;
    });
    if (availableNames.length === 0) {
      throw new Error(`No configured ${configured.roomType} rooms are available for the selected stay.`);
    }
    Logger.info(`Expected available result order: ${availableNames.join(" -> ")}`);
    return availableNames;
  }

  const availableNames: string[] = [];
  for (const name of configured.expectedNames) {
    const availableIds = await setupDb.getAvailableRoomIds(name, startDate, endDate);
    Logger.info(`Available room IDs for ${name}: ${availableIds.join(", ")}`);
    if (availableIds.length > 0) availableNames.push(name);
  }
  if (availableNames.length === 0) {
    throw new Error("None of the configured Room Types is available for the selected stay.");
  }
  Logger.info(`Expected available result order: ${availableNames.join(" -> ")}`);
  return availableNames;
}

async function configureEwr(
  setupDb: SetupDatabaseHelper,
  onlineBookingDb: OnlineBookingDatabaseHelper,
  template: OnlineBookingTemplate,
  view: EwrCalendarView,
): Promise<void> {
  await onlineBookingDb.setTemplateType(template);
  await setupDb.setBEDisplayOrder(1);
  await setupDb.setEwrCalendarView(view);
  await setupDb.setShowAllRooms(1);
}

function toReverseOrders(rows: readonly SortableRoomType[]) {
  return [...rows]
    .reverse()
    .map(({ id }, index) => ({ id, displayOrder: index + 1 }));
}

function byName(a: SortableRoomType, b: SortableRoomType): number {
  return a.name.localeCompare(b.name, undefined, { numeric: true });
}

function logConfiguredOrders(
  rows: readonly SortableRoomType[],
  orders: ReadonlyArray<{ id: number; displayOrder: number | null }>,
): void {
  const orderById = new Map(
    orders.map(({ id, displayOrder }) => [id, displayOrder]),
  );
  Logger.info(
    `Database order values: ${rows
      .map(({ id, name }) => `${name}=${orderById.get(id) ?? "blank"}`)
      .join(", ")}`,
  );
}
