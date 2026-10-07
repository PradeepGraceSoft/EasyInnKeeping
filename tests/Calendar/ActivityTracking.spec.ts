import type { Page } from "@playwright/test";
import { AlertMessages } from "../../src/constants/AlertMessages";
import { ConstNames } from "../../src/constants/ConstNames";
import { test, expect } from "../../src/fixtures/sso.fixture";
import type { CalendarPage } from "../../src/pages/CalendarPage";
import { ReservationPage } from "../../src/pages/ReservationPage";
import { SSOUsers } from "../../src/test-data/SSOUsers";
import { ConfigManager } from "../../src/utils/ConfigManager";
import { DateUtils } from "../../src/utils/DateUtils";
import type {
  ActivityLogEntry,
  ReservationDatabaseHelper,
} from "../../src/utils/DBHelper/ReservationDatabaseHelper";
import type { AvailableCalendarRoom } from "../../src/utils/DBHelper/SetupDatabaseHelper";
import { TestDataGenerator } from "../../src/utils/TestDataGenerator";

const configurations = [
  { layout: "Monthly", grouping: "Room Name" },
  { layout: "Monthly", grouping: "Room Type" },
  { layout: "Weekly", grouping: "Room Name" },
  { layout: "Weekly", grouping: "Room Type" },
  { layout: "Detailed", grouping: "Room Name" },
  { layout: "Detailed", grouping: "Room Type" },
] as const;
const calendarDate = DateUtils.addDaysYYYYMMDD(0);
const departureDate = DateUtils.addDaysYYYYMMDD(1);

test.describe("Calendar activity tracking @test1 @property5806", () => {
  test.setTimeout(180_000);
  test.beforeEach(async ({ setupDb, ssoLoginPage, layoutPage }) => {
    await setupDb.enableCalendarDragAndDrop();
    await setupDb.displayCalendarReservationsByFirstName();
    await ssoLoginPage.loginAsPropertyUser();
    await layoutPage.clickCalendarIcon();
  });

  test("records reservation activity for User1", async ({
    page,
    calendarPage,
    layoutPage,
    reservationDbHelper,
    setupDb,
    ssoLoginPage,
  }) => {
    const user = SSOUsers.User1;
    await ssoLoginPage.clickLogoutButton();
    await ssoLoginPage.propertyLogin(
      user.propertyShortName,
      user.loginName,
      user.password,
    );
    await layoutPage.clickCalendarIcon();

    const [source] = await setupDb.getAvailableCalendarRooms(
      calendarDate,
      departureDate,
      1,
    );
    const reservation = await prepareReservation(
      { page, calendarPage, reservationDbHelper },
      configurations[0],
      source,
    );
    const startedAt = new Date();
    await calendarPage.changeReservationStatus(
      reservation.calendarText,
      "Confirmed",
    );
    await verifyReservationActivity(
      reservationDbHelper,
      reservation.confirmationNumber,
      startedAt,
      /status|confirmed/i,
      user.loginName,
    );
  });

  test.describe("Drag to another room in the same room type", () => {
    for (const config of configurations)
      test(
        configName(config),
        async ({ page, calendarPage, reservationDbHelper, setupDb }) => {
          const f = { page, calendarPage, reservationDbHelper, setupDb };
          const [source, target] = await f.setupDb.getAvailableCalendarRooms(
            calendarDate,
            departureDate,
            2,
          );
          const reservation = await prepareReservation(f, config, source);
          const startedAt = new Date();
          await f.calendarPage.dragReservationToRoom(
            reservation.calendarText,
            target.name,
            calendarDate,
          );
          await verifyMovedReservation(f, reservation, target, startedAt);
        },
      );
  });

  test.describe("Drag to a room in a different room type", () => {
    for (const config of configurations)
      test(
        configName(config),
        async ({ page, calendarPage, reservationDbHelper, setupDb }) => {
          const f = { page, calendarPage, reservationDbHelper, setupDb };
          const [source, target] =
            await f.setupDb.getAvailableCalendarRoomsAcrossTypes(
              calendarDate,
              departureDate,
            );
          const reservation = await prepareReservation(f, config, source);
          const startedAt = new Date();
          await f.calendarPage.dragReservationToRoom(
            reservation.calendarText,
            target.name,
            calendarDate,
          );
          await f.calendarPage.completeMoveWithRateChoice(
            "New Rate",
            reservation.calendarText,
            target.name,
          );
          await verifyMovedReservation(f, reservation, target, startedAt);
        },
      );
  });

  test.describe("Move and Place Here using the old rate", () => {
    for (const config of configurations)
      test(
        configName(config),
        async ({ page, calendarPage, reservationDbHelper, setupDb }) => {
          const f = { page, calendarPage, reservationDbHelper, setupDb };
          const [source, target] = await f.setupDb.getAvailableCalendarRooms(
            calendarDate,
            departureDate,
            2,
          );
          const reservation = await prepareReservation(f, config, source);
          const startedAt = new Date();
          await f.calendarPage.moveReservationAndPlaceHere(
            reservation.calendarText,
            target.name,
          );
          await f.calendarPage.selectMoveRate("Old Rate");
          await verifyMovedReservation(f, reservation, target, startedAt);
        },
      );
  });

  test.describe("Change reservation status", () => {
    for (const config of configurations)
      test(
        configName(config),
        async ({ page, calendarPage, reservationDbHelper, setupDb }) => {
          const f = { page, calendarPage, reservationDbHelper, setupDb };
          const [source] = await f.setupDb.getAvailableCalendarRooms(
            calendarDate,
            departureDate,
            1,
          );
          const reservation = await prepareReservation(f, config, source);
          const startedAt = new Date();
          await f.calendarPage.changeReservationStatus(
            reservation.calendarText,
            "Confirmed",
          );
          await verifyReservationActivity(
            f.reservationDbHelper,
            reservation.confirmationNumber,
            startedAt,
            /status|confirmed/i,
          );
        },
      );
  });

  test.describe("Extend reservation stay", () => {
    for (const config of configurations)
      test(
        configName(config),
        async ({ page, calendarPage, reservationDbHelper, setupDb }) => {
          const f = { page, calendarPage, reservationDbHelper, setupDb };
          const [source] = await f.setupDb.getAvailableCalendarRooms(
            calendarDate,
            departureDate,
            1,
          );
          const reservation = await prepareReservation(f, config, source);
          const startedAt = new Date();
          await f.calendarPage.extendReservationStay(
            reservation.calendarText,
            1,
          );
          await verifyReservationActivity(
            f.reservationDbHelper,
            reservation.confirmationNumber,
            startedAt,
            /extend|departure|stay|date/i,
          );
        },
      );
  });

  test.describe("Block and unblock an available room", () => {
    for (const config of configurations)
      test(
        configName(config),
        async ({ page, calendarPage, reservationDbHelper, setupDb }) => {
          const f = { page, calendarPage, reservationDbHelper, setupDb };
          const [reservationRoom, roomToBlock] =
            await f.setupDb.getAvailableCalendarRooms(
              calendarDate,
              departureDate,
              2,
            );
          await prepareReservation(f, config, reservationRoom);
          let startedAt = new Date();
          await f.calendarPage.blockRoom(roomToBlock.name, calendarDate);
          await verifyRoomActivity(f.reservationDbHelper, startedAt, /block/i);
          startedAt = new Date();
          await f.calendarPage.unblockRoom(roomToBlock.name, calendarDate);
          await verifyRoomActivity(
            f.reservationDbHelper,
            startedAt,
            /unblock/i,
          );
        },
      );
  });
});

test.describe("Calendar group booking activity @group", () => {
  test.setTimeout(180_000);

  test("creates a group block, reopens it, and tracks updates", async ({
    calendarPage,
    layoutPage,
    page,
    reservationDbHelper,
    setupDb,
    ssoLoginPage,
  }) => {
    const user = SSOUsers.User1;
    const groupName = TestDataGenerator.groupName();
    const groupGuest = {
      firstName: `CalendarGroup${Date.now()}`,
      lastName: TestDataGenerator.lastName(),
    };
    await ssoLoginPage.propertyLogin(
      user.propertyShortName,
      user.loginName,
      user.password,
    );
    await layoutPage.clickCalendarIcon();
    const [room] = await setupDb.getAvailableCalendarRooms(
      calendarDate,
      departureDate,
      1,
    );
    await calendarPage.clickRoomDateCell(room.name, calendarDate);
    const groupPopupPromise = page.waitForEvent("popup");
    await calendarPage.clickNewGroupBlock();
    const groupPopup = await groupPopupPromise;
    const groupReservationPage = new ReservationPage(
      groupPopup,
      reservationDbHelper,
    );
    await groupReservationPage.enterGroupNameValue(groupName);
    await groupReservationPage.enterGroupReserveGuestDetails(groupGuest);
    await groupReservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );

    let startedAt = new Date();
    await groupReservationPage.clickGroupSaveButton();
    await groupReservationPage.verifyAlertMessage(
      AlertMessages.RESERVATION_SAVED_SUCCESS,
    );
    const groupCode = await groupReservationPage.getGroupReservationNumber();
    expect(groupCode).toMatch(/^\d+$/);
    await verifyGroupActivity(
      reservationDbHelper,
      groupCode,
      startedAt,
      /^NEW RES$/i,
      user.loginName,
      /Group Booking.*New Reservation/i,
    );

    await groupPopup.close();
    await page.reload();
    await calendarPage.clickGroupBlockInRoom(groupGuest.firstName, room.name);
    const reopenedPopupPromise = page.waitForEvent("popup");
    await calendarPage.clickOpenGroupReservation();
    const reopenedPopup = await reopenedPopupPromise;
    const reopenedReservationPage = new ReservationPage(
      reopenedPopup,
      reservationDbHelper,
    );
    expect(await reopenedReservationPage.getGroupReservationNumber()).toBe(
      groupCode,
    );

    startedAt = new Date();
    await reopenedReservationPage.enterNumberOfNights("2");
    await reopenedReservationPage.selectAnotherAvailableRoomFromDropdown();
    await reopenedReservationPage.clickGroupSaveButton();
    await reopenedReservationPage.verifyAlertMessage(
      AlertMessages.RESERVATION_SAVED_SUCCESS,
    );
    await verifyGroupActivity(
      reservationDbHelper,
      groupCode,
      startedAt,
      /EDIT BOOKING/i,
      user.loginName,
      /New Room.*Room.*Deleted.*Stay Length/is,
    );

    await reopenedReservationPage.clickGroupIndividualDeleteButton();
  });
});

type CalendarConfiguration = (typeof configurations)[number];
type ActivityFixtures = {
  page: Page;
  calendarPage: CalendarPage;
  reservationDbHelper: ReservationDatabaseHelper;
};
type CreatedReservation = { confirmationNumber: string; calendarText: string };
function configName(config: CalendarConfiguration): string {
  return `${config.layout} / ${config.grouping}`;
}

async function prepareReservation(
  f: ActivityFixtures,
  config: CalendarConfiguration,
  room: AvailableCalendarRoom,
): Promise<CreatedReservation> {
  const reservation = await createCalendarReservation(
    f.page,
    f.calendarPage,
    f.reservationDbHelper,
    room,
  );
  await f.page.reload();
  await f.calendarPage.selectCalendarGrouping(config.grouping);
  await f.calendarPage.selectCalendarLayout(config.layout);
  return reservation;
}

async function createCalendarReservation(
  page: Page,
  calendarPage: CalendarPage,
  helper: ReservationDatabaseHelper,
  room: AvailableCalendarRoom,
): Promise<CreatedReservation> {
  const firstName = `Activity${Date.now()}`;
  const lastName = TestDataGenerator.lastName();
  const popupPromise = page.waitForEvent("popup");
  await calendarPage.clickHeaderNewReservation();
  const popup = await popupPromise;
  const reservationPage = new ReservationPage(popup, helper);
  await reservationPage.selectRoomType(room.roomType);
  await reservationPage.selectRoomByName(room.name);
  await reservationPage.enterGuestDetails({
    firstName,
    lastName,
    email: TestDataGenerator.email(firstName, lastName),
  });
  await popup.keyboard.press("Escape");
  await reservationPage.enterPaymentMethod(
    ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
  );
  await popup.keyboard.press("Escape");
  await reservationPage.clickSaveButton();
  const confirmationNumber = await reservationPage.getReservationNumber();
  expect(confirmationNumber).toMatch(/^\d+$/);
  await popup.close();
  return { confirmationNumber, calendarText: firstName };
}

async function deleteCalendarReservation(
  f: ActivityFixtures,
  reservationText: string,
  roomName: string,
): Promise<void> {
  await f.page.reload();
  await f.calendarPage.clickReservationInRoom(reservationText, roomName);
  const reservationPopup = await f.calendarPage.clickOpenReservation();
  const reservationPage = new ReservationPage(
    reservationPopup,
    f.reservationDbHelper,
  );
  try {
    await reservationPage.deleteCurrentReservationIfOpen();
  } finally {
    if (!reservationPopup.isClosed()) await reservationPopup.close();
    await f.page.bringToFront();
    await f.calendarPage.closeReservationSummaryIfOpen();
  }
}

async function verifyMovedReservation(
  f: ActivityFixtures,
  reservation: CreatedReservation,
  target: AvailableCalendarRoom,
  startedAt: Date,
): Promise<void> {
  await f.calendarPage.verifyReservationDisplayedInRoom(
    reservation.calendarText,
    target.name,
  );
  await verifyReservationActivity(
    f.reservationDbHelper,
    reservation.confirmationNumber,
    startedAt,
    /EDIT BOOKING|Room Name:/i,
  );
}

async function verifyReservationActivity(
  helper: ReservationDatabaseHelper,
  confirmationNumber: string,
  startedAt: Date,
  expected: RegExp,
  expectedStaffName?: string,
): Promise<void> {
  await verifyActivity(
    () => helper.getReservationActivity(confirmationNumber, startedAt),
    expected,
    startedAt,
    expectedStaffName,
  );
}

async function verifyRoomActivity(
  helper: ReservationDatabaseHelper,
  startedAt: Date,
  expected: RegExp,
): Promise<void> {
  await verifyActivity(
    () => helper.getRoomActivity(startedAt),
    expected,
    startedAt,
  );
}

async function verifyGroupActivity(
  helper: ReservationDatabaseHelper,
  groupCode: string,
  startedAt: Date,
  expectedActivity: RegExp,
  expectedStaffName: string,
  expectedDetails: RegExp,
): Promise<void> {
  await verifyActivity(
    () => helper.getGroupActivity(groupCode),
    expectedActivity,
    startedAt,
    expectedStaffName,
    expectedDetails,
  );
}

async function verifyActivity(
  readActivity: () => Promise<ActivityLogEntry[]>,
  expected: RegExp,
  startedAt: Date,
  staffName = ConfigManager.testData.loginName,
  expectedDetails?: RegExp,
): Promise<void> {
  let matchingEntry: ActivityLogEntry | undefined;
  const expectedStaffName = staffName.trim().toLowerCase();
  await expect
    .poll(
      async () => {
        matchingEntry = (await readActivity()).find(
          (entry) =>
            expected.test(
              expectedDetails
                ? entry.activity
                : `${entry.activity} ${entry.details}`,
            ) &&
            (!expectedDetails || expectedDetails.test(entry.details ?? "")) &&
            entry.staffName.trim().toLowerCase() === expectedStaffName,
        );
        return Boolean(matchingEntry);
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  expect(matchingEntry?.activity.trim()).toBeTruthy();
  expect(matchingEntry?.details.trim()).toBeTruthy();
  const createdAt = new Date(matchingEntry?.createdAt ?? Number.NaN);
  expect(createdAt.getTime()).not.toBeNaN();
  expect(Math.abs(createdAt.getTime() - startedAt.getTime())).toBeLessThan(
    24 * 60 * 60 * 1_000,
  );
}

test.describe("Verify that when a reservation is dragged from one room to another of the same room type on the calendar, the reservation is moved successfully and the room change is tracked in the activity history", () => {
  test.setTimeout(600_000);

  const historyTabConfigurations = [
    { layout: "Monthly", grouping: "Room Name" },
    { layout: "Weekly", grouping: "Room Name" },
    { layout: "Detailed", grouping: "Room Name" },
    { layout: "Monthly", grouping: "Room Type" },
    { layout: "Weekly", grouping: "Room Type" },
    { layout: "Detailed", grouping: "Room Type" },
  ] as const;

  test("records the drag-and-drop room move in the History tab", async ({
    page,
    calendarPage,
    findReservationPage,
    layoutPage,
    reservationDbHelper,
    setupDb,
    ssoLoginPage,
  }) => {
    await setupDb.enableCalendarDragAndDrop();
    await setupDb.displayCalendarReservationsByFirstName();
    await ssoLoginPage.loginAsPropertyUser();
    await layoutPage.clickCalendarIcon();

    for (const config of historyTabConfigurations) {
      await test.step(
        configName(config),
        async () => {
          const [source, target] = await setupDb.getAvailableCalendarRooms(
            calendarDate,
            departureDate,
            2,
          );
          const fixtures = { page, calendarPage, reservationDbHelper };
          const reservation = await prepareReservation(
            fixtures,
            config,
            source,
          );
          let reservationDeleted = false;
          let reservationRoom = source.name;

          try {
            await calendarPage.dragReservationToRoom(
              reservation.calendarText,
              target.name,
              calendarDate,
            );
            await page.reload();
            await calendarPage.selectCalendarGrouping(config.grouping);
            await calendarPage.selectCalendarLayout(config.layout);
            await calendarPage.verifyReservationDisplayedInRoom(
              reservation.calendarText,
              target.name,
            );
            reservationRoom = target.name;
            if (config.layout === "Detailed") {
              await layoutPage.clickReservationListIcon();
              await findReservationPage.openReservation(
                reservation.confirmationNumber,
              );
              const openedReservationPage = new ReservationPage(
                page,
                reservationDbHelper,
              );
              try {
                await openedReservationPage.verifyHistoryContains(
                  /EDIT BOOKING/i,
                );
              } catch (error) {
                test.info().annotations.push({ type: "cleanup-skipped" });
                throw error;
              } finally {
                if (!test.info().annotations.some(({ type }) => type === "cleanup-skipped")) {
                  await openedReservationPage.deleteCurrentReservationIfOpen();
                }
                reservationDeleted = true;
                await layoutPage.clickCalendarIcon();
              }
              return;
            }
            await calendarPage.clickReservationInRoom(
              reservation.calendarText,
              target.name,
            );
            const reservationPopup = await calendarPage.clickOpenReservation();
            const openedReservationPage = new ReservationPage(
              reservationPopup,
              reservationDbHelper,
            );
            try {
              await openedReservationPage.verifyHistoryContains(
                /EDIT BOOKING/i,
              );
            } catch (error) {
              test.info().annotations.push({ type: "cleanup-skipped" });
              throw error;
            } finally {
              if (!test.info().annotations.some(({ type }) => type === "cleanup-skipped")) {
                await openedReservationPage.deleteCurrentReservationIfOpen();
              }
              reservationDeleted = true;
              if (!reservationPopup.isClosed()) await reservationPopup.close();
              await page.bringToFront();
              await calendarPage.closeReservationSummaryIfOpen();
            }
          } finally {
            if (!reservationDeleted && !test.info().annotations.some(({ type }) => type === "cleanup-skipped")) {
              await deleteCalendarReservation(
                fixtures,
                reservation.calendarText,
                reservationRoom,
              );
            }
          }
        },
        { timeout: 90_000 },
      );
    }
  });
});

test.describe("Verify that when a reservation is dragged from one room to another of a different room type on the calendar, the reservation is moved successfully and the room change is tracked in the activity history", () => {
  test.setTimeout(600_000);

  const historyTabConfigurations = [
    { layout: "Monthly", grouping: "Room Name" },
    { layout: "Weekly", grouping: "Room Name" },
    { layout: "Detailed", grouping: "Room Name" },
    { layout: "Monthly", grouping: "Room Type" },
    { layout: "Weekly", grouping: "Room Type" },
    { layout: "Detailed", grouping: "Room Type" },
  ] as const;

  test("records the drag-and-drop room type change in the History tab", async ({
    page,
    calendarPage,
    findReservationPage,
    layoutPage,
    reservationDbHelper,
    setupDb,
    ssoLoginPage,
  }) => {
    await setupDb.enableCalendarDragAndDrop();
    await setupDb.displayCalendarReservationsByFirstName();
    await ssoLoginPage.loginAsPropertyUser();
    await layoutPage.clickCalendarIcon();

    for (const config of historyTabConfigurations) {
      await test.step(
        configName(config),
        async () => {
          const [source, target] =
            await setupDb.getAvailableCalendarRoomsAcrossTypes(
              calendarDate,
              departureDate,
            );
          const fixtures = { page, calendarPage, reservationDbHelper };
          const reservation = await prepareReservation(
            fixtures,
            config,
            source,
          );
          let reservationDeleted = false;
          let reservationRoom = source.name;

          try {
            await calendarPage.dragReservationToRoom(
              reservation.calendarText,
              target.name,
              calendarDate,
            );
            await calendarPage.completeMoveWithRateChoice(
              "New Rate",
              reservation.calendarText,
              target.name,
            );
            reservationRoom = target.name;
            await page.reload();
            await calendarPage.selectCalendarGrouping(config.grouping);
            await calendarPage.selectCalendarLayout(config.layout);
            await calendarPage.verifyReservationDisplayedInRoom(
              reservation.calendarText,
              target.name,
            );
            if (config.layout === "Detailed") {
              await layoutPage.clickReservationListIcon();
              await findReservationPage.openReservation(
                reservation.confirmationNumber,
              );
              const openedReservationPage = new ReservationPage(
                page,
                reservationDbHelper,
              );
              try {
                await openedReservationPage.verifyHistoryContainsRoomChange(
                  source.name,
                  target.name,
                );
              } catch (error) {
                test.info().annotations.push({ type: "cleanup-skipped" });
                throw error;
              } finally {
                if (!test.info().annotations.some(({ type }) => type === "cleanup-skipped")) {
                  await openedReservationPage.deleteCurrentReservationIfOpen();
                }
                reservationDeleted = true;
                await layoutPage.clickCalendarIcon();
              }
              return;
            }
            await calendarPage.clickReservationInRoom(
              reservation.calendarText,
              target.name,
            );
            const reservationPopup = await calendarPage.clickOpenReservation();
            const openedReservationPage = new ReservationPage(
              reservationPopup,
              reservationDbHelper,
            );
            try {
              await openedReservationPage.verifyHistoryContainsRoomChange(
                source.name,
                target.name,
              );
            } catch (error) {
              test.info().annotations.push({ type: "cleanup-skipped" });
              throw error;
            } finally {
              if (!test.info().annotations.some(({ type }) => type === "cleanup-skipped")) {
                await openedReservationPage.deleteCurrentReservationIfOpen();
              }
              reservationDeleted = true;
              if (!reservationPopup.isClosed()) await reservationPopup.close();
              await page.bringToFront();
              await calendarPage.closeReservationSummaryIfOpen();
            }
          } finally {
            if (!reservationDeleted && !test.info().annotations.some(({ type }) => type === "cleanup-skipped")) {
              await deleteCalendarReservation(
                fixtures,
                reservation.calendarText,
                reservationRoom,
              );
            }
          }
        },
        { timeout: 90_000 },
      );
    }
  });
});

test.describe("Verify that when a reservation is moved using Move and Place Here, the reservation is assigned to the selected room and the room change is tracked in the activity history", () => {
  test.setTimeout(600_000);

  test("moves the reservation through Move Here and records the selected room in History for every calendar view and type", async ({
    page,
    calendarPage,
    findReservationPage,
    layoutPage,
    reservationDbHelper,
    setupDb,
    ssoLoginPage,
  }) => {
    await setupDb.enableCalendarDragAndDrop();
    await setupDb.displayCalendarReservationsByFirstName();
    await ssoLoginPage.loginAsPropertyUser();
    await layoutPage.clickCalendarIcon();

    for (const config of configurations) {
      await test.step(configName(config), async () => {
        const [source, target] = await setupDb.getAvailableCalendarRooms(
          calendarDate,
          departureDate,
          2,
        );
        const fixtures = { page, calendarPage, reservationDbHelper };
        const reservation = await prepareReservation(fixtures, config, source);
        let reservationDeleted = false;
        let reservationRoom = source.name;

        try {
          await calendarPage.moveReservationAndPlaceHere(
            reservation.calendarText,
            target.name,
          );
          await calendarPage.selectMoveRate("Old Rate");
          reservationRoom = target.name;
          await page.reload();
          await calendarPage.selectCalendarGrouping(config.grouping);
          await calendarPage.selectCalendarLayout(config.layout);
          await calendarPage.verifyReservationDisplayedInRoom(
            reservation.calendarText,
            target.name,
          );

          if (config.layout === "Detailed") {
            await layoutPage.clickReservationListIcon();
            await findReservationPage.openReservation(
              reservation.confirmationNumber,
            );
            const openedReservationPage = new ReservationPage(
              page,
              reservationDbHelper,
            );
            try {
              await openedReservationPage.verifyHistoryContainsRoomChange(
                source.name,
                target.name,
              );
            } catch (error) {
              test.info().annotations.push({ type: "cleanup-skipped" });
              throw error;
            } finally {
              if (!test.info().annotations.some(({ type }) => type === "cleanup-skipped")) {
                await openedReservationPage.deleteCurrentReservationIfOpen();
              }
              reservationDeleted = true;
              await layoutPage.clickCalendarIcon();
            }
            return;
          }

          await calendarPage.clickReservationInRoom(
            reservation.calendarText,
            target.name,
          );
          const reservationPopup = await calendarPage.clickOpenReservation();
          const openedReservationPage = new ReservationPage(
            reservationPopup,
            reservationDbHelper,
          );
          try {
            await openedReservationPage.verifyHistoryContainsRoomChange(
              source.name,
              target.name,
            );
          } catch (error) {
            test.info().annotations.push({ type: "cleanup-skipped" });
            throw error;
          } finally {
            if (!test.info().annotations.some(({ type }) => type === "cleanup-skipped")) {
              await openedReservationPage.deleteCurrentReservationIfOpen();
            }
            reservationDeleted = true;
            if (!reservationPopup.isClosed()) await reservationPopup.close();
            await page.bringToFront();
            await calendarPage.closeReservationSummaryIfOpen();
          }
        } finally {
          if (!reservationDeleted && !test.info().annotations.some(({ type }) => type === "cleanup-skipped")) {
            await deleteCalendarReservation(
              fixtures,
              reservation.calendarText,
              reservationRoom,
            );
          }
        }
      }, { timeout: 90_000 });
    }
  });
});
