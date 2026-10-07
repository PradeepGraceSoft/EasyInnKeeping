import { test, expect } from "../../../src/fixtures/pms.fixture";

test.describe("Dashboard Housekeeping chart", () => {
  test.afterEach(async ({}, testInfo) => {
    // Dashboard navigation adds shared KPI evidence on every visit.
    testInfo.annotations = testInfo.annotations.filter(
      ({ type }) => type === "Housekeeping",
    );
  });

  test("Verify Housekeeping chart displays the total room count", async ({
    dashboardPage,
    reservationDbHelper,
  }) => {
    const selectedDate = await reservationDbHelper.getDashboardBusinessDate();
    const expectedRoomCount = await test.step(
      "Get the selected property's total room count",
      async () => {
        const count = await reservationDbHelper.getDashboardTotalRoomCount(selectedDate);
        expect(
          count,
          "The selected property should have a valid total room count.",
        ).toBeGreaterThan(0);
        return count;
      },
    );

    // Keep the report annotation focused on the Housekeeping room-count evidence.
    test.info().annotations = [
      {
        type: "Housekeeping",
        description: `Housekeeping displays "Of ${expectedRoomCount.toLocaleString()} total rooms".`,
      },
    ];

    await test.step("Verify the Housekeeping chart subtitle", async () => {
      await dashboardPage.open();
      await dashboardPage.verifyHousekeepingTotalRoomCount(expectedRoomCount);
    });
  });

  test("HK-02: Change a room's Housekeeping Status to Vacant", async ({
    dashboardPage,
    housekeepingPage,
    layoutPage,
  }) => {
    test.info().annotations = [];
    await test.step("Capture the current Housekeeping chart counts", async () => {
      await dashboardPage.open();
    });
    const vacantBefore = await dashboardPage.getHousekeepingStatusCount("Vacant");

    await test.step("Change a non-Vacant room to Vacant", async () => {
      await layoutPage.clickHousekeepingIcon();
      const existingVacantRoom = await housekeepingPage.findRoomWithStatus("Vacant");
      const room = existingVacantRoom ?? await housekeepingPage.selectRoomWithNonVacantStatus();
      const statusChanged = room.status.toLowerCase() !== "vacant";
      test.info().annotations.push({
        type: "Housekeeping",
        description: statusChanged
          ? `Room "${room.roomName}" changes from "${room.status}" to "Vacant"; expected Vacant count: ${vacantBefore} → ${vacantBefore + 1}.`
          : `Room "${room.roomName}" is already "Vacant"; expected Vacant count remains ${vacantBefore}.`,
      });
      if (statusChanged) await housekeepingPage.changeRoomStatus(room.roomName, "Vacant");
      await housekeepingPage.verifyRoomStatus(room.roomName, "Vacant");

      await dashboardPage.open();
      const expectedVacant = statusChanged ? vacantBefore + 1 : vacantBefore;
      try {
        await dashboardPage.verifyHousekeepingStatusCount("Vacant", expectedVacant);
      } finally {
        const actualVacant = await dashboardPage.getHousekeepingStatusCount("Vacant")
          .catch(() => "unavailable");
        test.info().annotations = [{
          type: "Housekeeping",
          description: `Room "${room.roomName}": ${room.status} -> Vacant (${statusChanged ? "status changed" : "already Vacant; unchanged"}). Vacant before: ${vacantBefore}; expected now: ${expectedVacant}; actual now: ${actualVacant}.`,
        }];
      }
    });
  });
});
