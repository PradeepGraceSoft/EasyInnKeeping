import { test, expect } from "../../../src/fixtures/pms.fixture";
import { ConstNames } from "../../../src/constants/ConstNames";
import { AlertMessages } from "../../../src/constants/AlertMessages";
import type { FindReservationPage } from "../../../src/pages/FindReservationPage";
import type { ReservationPage } from "../../../src/pages/ReservationPage";
import type { CalendarPage } from "../../../src/pages/CalendarPage";
import type { LayoutPage } from "../../../src/pages/LayoutPage";
import type { ReservationDatabaseHelper } from "../../../src/utils/DBHelper/ReservationDatabaseHelper";
import type { SetupDatabaseHelper } from "../../../src/utils/DBHelper/SetupDatabaseHelper";
import { TestDataGenerator } from "../../../src/utils/TestDataGenerator";

test.describe("Dashboard room count metrics", () => {
  // ==================== Arrival ====================

  test("Verify Tomorrow Arrivals after switching day", async ({
    dashboardPage,
    reservationDbHelper,
    layoutPage,
    findReservationPage,
    reservationPage,
    reservationApi,
  }) => {
    test.setTimeout(120_000); // Includes conditional reservation creation and cleanup.
    const tomorrowDate = await reservationDbHelper.getCurrentDate(1);
    let createdReservationNumber: string | undefined;
    let failed = false;

    try {
      await test.step("Open Dashboard, capture Today Arrivals, and switch to Tomorrow", async () => {
        await dashboardPage.open();
        await dashboardPage.verifyTodaySelectedByDefault();
        const todayCount = await dashboardPage.getTodayArrivalsCount();
        await dashboardPage.selectTomorrow();
        const tomorrowCount = await dashboardPage.getTodayArrivalsCount();
      });

      if ((await reservationDbHelper.getArrivalsCount(tomorrowDate)) === 0) {
        await test.step(
          "Create a reservation arriving tomorrow when none exist",
          async () => {
            await layoutPage.clickReservationListIcon();
            await findReservationPage.chooseReservationTypeRegular();
            await findReservationPage.addNewReservation();
            const [year, month, day] = tomorrowDate.split("-");
            const arrivalDate = `${Number(month)}/${Number(day)}/${year}`;
            await reservationPage.enterArrivalDateBeforeRoomSelection(
              arrivalDate,
            );
            await reservationPage.selectRoomType(
              ConstNames.ROOMTYPE_NAME_REGULAR_ROOM,
            );
            await reservationPage.selectFirstRoomFromDropdown();
            await reservationPage.enterGuestInfo(TestDataGenerator.email());
            await reservationPage.enterPaymentMethod(
              ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
            );
            await reservationPage.verifyArrivalDate(arrivalDate);
            await reservationPage.clickSaveButton();
            createdReservationNumber =
              await reservationPage.getReservationNumber();
            await reservationPage.verifyAlertMessage(
              AlertMessages.RESERVATION_SAVED_SUCCESS,
            );
            await reservationPage.clickCloseButton();
          },
          { timeout: 60_000 },
        );
        await dashboardPage.open();
        await dashboardPage.verifyTodaySelectedByDefault();
        await dashboardPage.selectTomorrow();
      }

      await test.step("Validate the arrivals tile against tomorrow's non-cancelled reservations", async () => {
        await dashboardPage.verifyTomorrowArrivalsCount(tomorrowDate);
      });
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      if (createdReservationNumber && !failed) {
        await reservationApi.deleteReservation(createdReservationNumber);
      }
    }
  });

  test("Verify cancelled reservations are excluded from Today Arrivals", async ({
    dashboardPage,
    reservationDbHelper,
    layoutPage,
    findReservationPage,
    reservationPage,
    reservationApi,
  }) => {
    // Budget includes creating two reservations, cancelling one, and cleanup.
    test.setTimeout(150_000);
    const selectedDate = await reservationDbHelper.getCurrentDate();
    const [year, month, day] = selectedDate.split("-");
    const arrivalDate = `${Number(month)}/${Number(day)}/${year}`;
    const confirmationNumbers: string[] = [];
    let failed = false;

    try {
      for (const status of ["Active", "Cancelled"] as const) {
        await test.step(
          `Create a ${status} reservation arriving today`,
          async () => {
            await findReservationPage.chooseReservationTypeRegular();
            await findReservationPage.addNewReservation();
            await reservationPage.enterArrivalDateBeforeRoomSelection(
              arrivalDate,
            );
            await reservationPage.selectRoomType(
              ConstNames.ROOMTYPE_NAME_REGULAR_ROOM,
            );
            await reservationPage.selectFirstRoomFromDropdown();
            await reservationPage.enterGuestInfo(TestDataGenerator.email());
            await reservationPage.enterPaymentMethod(
              ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
            );
            await reservationPage.verifyArrivalDate(arrivalDate);
            await reservationPage.clickSaveButton();
            const confirmationNumber =
              await reservationPage.getReservationNumber();
            confirmationNumbers.push(confirmationNumber);
            await reservationPage.verifyAlertMessage(
              AlertMessages.RESERVATION_SAVED_SUCCESS,
            );

            if (status === "Cancelled") {
              await reservationPage.clickCancelButton();
              await reservationPage.verifyCancellationChargePopupDisplayed();
              await reservationPage.clickCancelReservation();
              await reservationPage.verifyAlertMessage(
                AlertMessages.RESERVATION_CANCELLED_SUCCESS,
              );
            }
            await reservationPage.clickCloseButton();
          },
          { timeout: 60_000 },
        );
      }

      await test.step("Verify Today Arrivals excludes the cancelled reservation", async () => {
        await dashboardPage.open();
        await dashboardPage.verifyTodaySelectedByDefault();
        await dashboardPage.verifyCancelledReservationsExcluded(
          selectedDate,
          confirmationNumbers[0],
          confirmationNumbers[1],
        );
      });
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      if (!failed) {
        for (const confirmationNumber of confirmationNumbers) {
          await reservationApi.deleteReservation(confirmationNumber);
        }
      }
    }
  });

  test("Verify Today Arrivals count", async ({
    dashboardPage,
    reservationDbHelper,
    layoutPage,
    findReservationPage,
    reservationPage,
    reservationApi,
  }) => {
    const selectedDate = await reservationDbHelper.getCurrentDate();
    let createdReservationNumber: string | undefined;
    let failed = false;

    try {
      await test.step("Navigate to Dashboard and verify Today is selected by default", async () => {
        await dashboardPage.open();
        await dashboardPage.verifyTodaySelectedByDefault();
      });

      const initialArrivalsCount = await dashboardPage.getTodayArrivalsCount();
      if (initialArrivalsCount === 0) {
        await test.step(
          "Create a reservation arriving today when the Dashboard shows zero arrivals",
          async () => {
            await layoutPage.clickReservationListIcon();
            await findReservationPage.chooseReservationTypeRegular();
            await findReservationPage.addNewReservation();
            const [year, month, day] = selectedDate.split("-");
            const arrivalDate = `${Number(month)}/${Number(day)}/${year}`;
            await reservationPage.enterArrivalDateBeforeRoomSelection(
              arrivalDate,
            );
            await reservationPage.selectRoomType(
              ConstNames.ROOMTYPE_NAME_REGULAR_ROOM,
            );
            await reservationPage.selectFirstRoomFromDropdown();
            await reservationPage.enterGuestInfo(TestDataGenerator.email());
            await reservationPage.enterPaymentMethod(
              ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
            );
            await reservationPage.clickSaveButton();
            createdReservationNumber =
              await reservationPage.getReservationNumber();
            await reservationPage.verifyAlertMessage(
              AlertMessages.RESERVATION_SAVED_SUCCESS,
            );
            await reservationPage.verifyArrivalDate(arrivalDate);
            await reservationPage.clickCloseButton();
          },
          { timeout: 60_000 },
        );

        await test.step("Reopen Dashboard to load the newly created arrival", async () => {
          await dashboardPage.open();
          await dashboardPage.verifyTodaySelectedByDefault();
        });
      }

      await test.step("Compare Today Arrivals with non-cancelled database reservations", async () => {
        await dashboardPage.verifyTodayArrivalsCount(selectedDate);
      });
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      if (createdReservationNumber && !failed) {
        await reservationApi.deleteReservation(createdReservationNumber);
      }
    }
  });
  // ==================== Departure ====================

  for (const day of ["Today", "Tomorrow"] as const) {
    test(
      day === "Today"
        ? "Verify Today Departures count"
        : "Verify Tomorrow Departures after switching day",
      async ({
        dashboardPage,
        reservationDbHelper,
        layoutPage,
        findReservationPage,
        reservationPage,
        reservationApi,
      }) => {
        test.setTimeout(120_000); // Includes conditional reservation creation and cleanup.
        const departureDate = await reservationDbHelper.getCurrentDate(
          day === "Today" ? 0 : 1,
        );
        const createdReservations: string[] = [];
        let failed = false;
        try {
          await dashboardPage.open();
          await dashboardPage.verifyTodaySelectedByDefault();
          const todayCount = await dashboardPage.getTodayDeparturesCount();

          if (day === "Tomorrow") {
            await dashboardPage.selectTomorrow();
            const tomorrowCount = await dashboardPage.getTodayDeparturesCount();
          }
          const needsReservation =
            day === "Today"
              ? todayCount === 0
              : (await reservationDbHelper.getDeparturesCount(
                  departureDate,
                )) === 0;
          if (needsReservation) {
            await test.step(
              `Create a reservation departing ${day.toLowerCase()}`,
              async () => {
                await layoutPage.clickReservationListIcon();
                trackCreatedReservation(await reservationPage.createDepartureReservation(findReservationPage, departureDate), createdReservations);
                await dashboardPage.verifyDepartureReservation(
                  createdReservations[0],
                  departureDate,
                );
                await reservationPage.clickCloseButton();
              },
              { timeout: 60_000 },
            );
            await dashboardPage.open();
            await dashboardPage.verifyTodaySelectedByDefault();
            if (day === "Tomorrow") await dashboardPage.selectTomorrow();
          }
          await test.step(`Validate ${day} departures against non-cancelled database reservations`, async () => {
            await dashboardPage.verifyDeparturesCount(departureDate, day);
          });
        } catch (error) {
          failed = true;
          throw error;
        } finally {
          if (!failed) {
            for (const confirmationNumber of createdReservations) {
              await reservationApi.deleteReservation(confirmationNumber);
            }
          }
        }
      },
    );
  }

  test("Verify cancelled reservations are excluded from Today Departures", async ({
    dashboardPage,
    reservationDbHelper,
    findReservationPage,
    reservationPage,
    reservationApi,
  }) => {
    test.setTimeout(150_000); // Create two departures, cancel one, validate and clean up.
    const departureDate = await reservationDbHelper.getCurrentDate();
    const createdReservations: string[] = [];
    let failed = false;
    try {
      for (const status of ["Active", "Cancelled"] as const) {
        await test.step(
          `Create a ${status} reservation departing today`,
          async () => {
            trackCreatedReservation(await reservationPage.createDepartureReservation(findReservationPage, departureDate), createdReservations);
            if (status === "Cancelled") {
              await reservationPage.clickCancelButton();
              await reservationPage.verifyCancellationChargePopupDisplayed();
              await reservationPage.clickCancelReservation();
              await reservationPage.verifyAlertMessage(
                AlertMessages.RESERVATION_CANCELLED_SUCCESS,
              );
            }
            await reservationPage.clickCloseButton();
          },
          { timeout: 60_000 },
        );
      }
      await test.step("Verify Today Departures excludes the cancelled reservation", async () => {
        await dashboardPage.open();
        await dashboardPage.verifyTodaySelectedByDefault();
        await dashboardPage.verifyCancelledDeparturesExcluded(
          departureDate,
          createdReservations[0],
          createdReservations[1],
        );
      });
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      if (!failed) {
        for (const confirmationNumber of createdReservations) {
          await reservationApi.deleteReservation(confirmationNumber);
        }
      }
    }
  });

  // ==================== Stayover ====================

  for (const day of ["Today", "Tomorrow"] as const) {
    test(
      day === "Today"
        ? "Verify Today Stayover count"
        : "Verify Tomorrow Stayover after switching day",
      async ({
        dashboardPage,
        reservationDbHelper,
        layoutPage,
        findReservationPage,
        reservationPage,
        reservationApi,
      }) => {
        test.setTimeout(120_000); // Includes conditional reservation setup and cleanup.
        const selectedDate = await reservationDbHelper.getCurrentDate(
          day === "Today" ? 0 : 1,
        );
        const createdReservations: string[] = [];
        let failed = false;
        try {
          await test.step("Open Dashboard and capture Today's stayover count", async () => {
            await dashboardPage.open();
            await dashboardPage.verifyTodaySelectedByDefault();
          });
          const todayCount = await dashboardPage.getStayoverCount();
          if (day === "Tomorrow") {
            await dashboardPage.selectTomorrow();
            const tomorrowCount = await dashboardPage.getStayoverCount();
          }
          const needsReservation =
            day === "Today"
              ? todayCount === 0
              : (
                  await reservationDbHelper.getStayoverReservations(
                    selectedDate,
                  )
                ).length === 0;
          if (needsReservation) {
            await test.step(
              `Create a qualifying stayover for ${day}`,
              async () => {
                await layoutPage.clickReservationListIcon();
                trackCreatedReservation(await reservationPage.createStayoverReservation(findReservationPage, selectedDate, -1, 1), createdReservations);
                await dashboardPage.verifyStayoverReservation(
                  createdReservations[0],
                  selectedDate,
                );
                await reservationPage.clickCloseButton();
              },
              { timeout: 60_000 },
            );
            await dashboardPage.open();
            await dashboardPage.verifyTodaySelectedByDefault();
            if (day === "Tomorrow") await dashboardPage.selectTomorrow();
          }
          await test.step(`Compare ${day} Total Stayover with the database`, async () => {
            await dashboardPage.verifyStayoverCount(selectedDate, day);
          });
        } catch (error) {
          failed = true;
          throw error;
        } finally {
          if (!failed) {
            for (const confirmation of createdReservations)
              await reservationApi.deleteReservation(confirmation);
          }
        }
      },
    );
  }

  for (const scenario of [
    {
      reason: "Cancelled",
      title: "Verify cancelled reservations are excluded from Today Stayover",
      arrivalOffset: -1,
      departureOffset: 1,
    },
    {
      reason: "Arrival today",
      title:
        "Verify reservations arriving today are excluded from Today Stayover",
      arrivalOffset: 0,
      departureOffset: 1,
    },
    {
      reason: "Departure today",
      title:
        "Verify reservations departing today are excluded from Today Stayover",
      arrivalOffset: -1,
      departureOffset: 0,
    },
  ] as const) {
    test(
      scenario.title,
      async ({
        dashboardPage,
        reservationDbHelper,
        findReservationPage,
        reservationPage,
        reservationApi,
      }) => {
        test.setTimeout(150_000); // Two reservations, optional cancellation, validation and cleanup.
        const selectedDate = await reservationDbHelper.getCurrentDate();
        const createdReservations: string[] = [];
        let failed = false;
        try {
          await test.step(
            "Create an active reservation spanning today",
            async () => {
              trackCreatedReservation(await reservationPage.createStayoverReservation(findReservationPage, selectedDate, -1, 1), createdReservations);
              await reservationPage.clickCloseButton();
            },
            { timeout: 60_000 },
          );
          await test.step(
            `Create the excluded reservation: ${scenario.reason}`,
            async () => {
              trackCreatedReservation(await reservationPage.createStayoverReservation(findReservationPage, selectedDate, scenario.arrivalOffset, scenario.departureOffset), createdReservations);
              if (scenario.reason === "Cancelled") {
                await reservationPage.clickCancelButton();
                await reservationPage.verifyCancellationChargePopupDisplayed();
                await reservationPage.clickCancelReservation();
                await reservationPage.verifyAlertMessage(
                  AlertMessages.RESERVATION_CANCELLED_SUCCESS,
                );
              }
              await reservationPage.clickCloseButton();
            },
            { timeout: 60_000 },
          );
          await test.step("Verify the reservation is excluded from Today Total Stayover", async () => {
            await dashboardPage.open();
            await dashboardPage.verifyTodaySelectedByDefault();
            await dashboardPage.verifyStayoverExclusion(
              selectedDate,
              createdReservations[0],
              createdReservations[1],
              scenario.reason,
            );
          });
        } catch (error) {
          failed = true;
          throw error;
        } finally {
          if (!failed) {
            for (const confirmation of createdReservations)
              await reservationApi.deleteReservation(confirmation);
          }
        }
      },
    );
  }

  // ================ Blocked ===========================

  test("Verify Today Blocked room count", async ({
    dashboardPage,
    reservationDbHelper,
    setupDb,
    layoutPage,
    calendarPage,
  }) => {
    test.setTimeout(120_000);
    const offset = 0;
    const selectedDate = await reservationDbHelper.getCurrentDate(offset);
    const endDate = await reservationDbHelper.getCurrentDate(offset + 1);
    const roomNames = await reservationDbHelper.getRoomNames();
    // Choose an available room so an existing reservation or block is not changed.
    const availableRooms = await setupDb.getAvailableCalendarRooms(
      selectedDate,
      endDate,
      1,
    );
    const room = availableRooms.find((candidate) =>
      roomNames.includes(candidate.name),
    );
    if (!room)
      throw new Error(
        `No available property room was found for ${selectedDate}.`,
      );

    const openSelectedDay = async () => {
      await dashboardPage.open();
      await dashboardPage.verifyTodaySelectedByDefault();
      await dashboardPage.verifyDataLoaded();
      expect(
        await reservationDbHelper.getCurrentDate(offset),
        "The server date changed during the Blocked comparison; rerun for a single date.",
      ).toBe(selectedDate);
    };

    await test.step(
      `Capture the Today Blocked KPI before blocking a room`,
      openSelectedDay,
    );
    const initialCount = await dashboardPage.getBlockedCount();
    let blocked = false;
    try {
      await test.step(`Block ${room.name} on ${selectedDate} using the calendar`, async () => {
        await layoutPage.clickCalendarIcon();
        await calendarPage.selectCalendarGrouping("Room Name");
        await calendarPage.searchRoom(room.name);
        await calendarPage.blockRoom(room.name, selectedDate);
        blocked = true;
      });
      await test.step(`Verify Today Blocked increases by one`, async () => {
        await openSelectedDay();
        await dashboardPage.verifyBlockedCount(initialCount + 1);
      });
    } finally {
      if (blocked) {
        await test.step(`Unblock ${room.name} and restore the original count`, async () => {
          await layoutPage.clickCalendarIcon();
          await calendarPage.selectCalendarGrouping("Room Name");
          await calendarPage.searchRoom(room.name);
          await calendarPage.unblockRoom(room.name, selectedDate);
          await openSelectedDay();
          await dashboardPage.verifyBlockedCount(initialCount);
        });
      }
    }
  });

  test("Verify Tomorrow Blocked room count", async ({
    dashboardPage,
    reservationDbHelper,
    setupDb,
    layoutPage,
    calendarPage,
  }) => {
    test.setTimeout(120_000);
    const offset = 1;
    const selectedDate = await reservationDbHelper.getCurrentDate(offset);
    const endDate = await reservationDbHelper.getCurrentDate(offset + 1);
    const roomNames = await reservationDbHelper.getRoomNames();
    // Choose an available room so an existing reservation or block is not changed.
    const availableRooms = await setupDb.getAvailableCalendarRooms(
      selectedDate,
      endDate,
      1,
    );
    const room = availableRooms.find((candidate) =>
      roomNames.includes(candidate.name),
    );
    if (!room)
      throw new Error(
        `No available property room was found for ${selectedDate}.`,
      );

    const openSelectedDay = async () => {
      await dashboardPage.open();
      await dashboardPage.verifyTodaySelectedByDefault();
      await dashboardPage.selectTomorrow();
      await dashboardPage.verifyDataLoaded();
      expect(
        await reservationDbHelper.getCurrentDate(offset),
        "The server date changed during the Blocked comparison; rerun for a single date.",
      ).toBe(selectedDate);
    };

    await test.step(
      `Capture the Tomorrow Blocked KPI before blocking a room`,
      openSelectedDay,
    );
    const initialCount = await dashboardPage.getBlockedCount();
    let blocked = false;
    try {
      await test.step(`Block ${room.name} on ${selectedDate} using the calendar`, async () => {
        await layoutPage.clickCalendarIcon();
        await calendarPage.selectCalendarGrouping("Room Name");
        await calendarPage.searchRoom(room.name);
        await calendarPage.blockRoom(room.name, selectedDate);
        blocked = true;
      });
      await test.step(`Verify Tomorrow Blocked increases by one`, async () => {
        await openSelectedDay();
        await dashboardPage.verifyBlockedCount(initialCount + 1);
      });
    } finally {
      if (blocked) {
        await test.step(`Unblock ${room.name} and restore the original count`, async () => {
          await layoutPage.clickCalendarIcon();
          await calendarPage.selectCalendarGrouping("Room Name");
          await calendarPage.searchRoom(room.name);
          await calendarPage.unblockRoom(room.name, selectedDate);
          await openSelectedDay();
          await dashboardPage.verifyBlockedCount(initialCount);
        });
      }
    }
  });

  test("Verify Blocked count after unblocking a room", async ({
    dashboardPage,
    reservationDbHelper,
    setupDb,
    layoutPage,
    calendarPage,
  }) => {
    test.setTimeout(150_000);
    const selectedDate = await reservationDbHelper.getCurrentDate(0);
    const endDate = await reservationDbHelper.getCurrentDate(1);
    const rooms = (
      await setupDb.getAvailableCalendarRooms(selectedDate, endDate, 1)
    ).slice(0, 1);
    const blockedRooms = new Set<string>();
    try {
      await test.step("Prepare one blocked room for Today", async () => {
        await layoutPage.clickCalendarIcon();
        await calendarPage.selectCalendarGrouping("Room Name");
        for (const room of rooms) {
          await calendarPage.searchRoom(room.name);
          await calendarPage.blockRoom(room.name, selectedDate);
          blockedRooms.add(room.name);
        }
      });
      await test.step("Capture Today Blocked and Vacant counts before unblocking", async () => {
        await dashboardPage.open();
        await dashboardPage.verifyTodaySelectedByDefault();
      });
      const beforeBlocked = await dashboardPage.getBlockedCount();
      const beforeVacant = await dashboardPage.getVacantCount();
      expect(
        beforeBlocked,
        "The baseline must include all rooms blocked by this test.",
      ).toBeGreaterThanOrEqual(rooms.length);
      await test.step("Unblock the prepared rooms in the calendar", async () => {
        await layoutPage.clickCalendarIcon();
        await calendarPage.selectCalendarGrouping("Room Name");
        for (const room of rooms) {
          await calendarPage.searchRoom(room.name);
          await calendarPage.unblockRoom(room.name, selectedDate);
          blockedRooms.delete(room.name);
        }
      });
      await test.step("Verify each unblocked room is available for the selected date", async () => {
        for (const room of rooms) {
          const availableIds = await setupDb.getAvailableRoomIds(
            room.roomType,
            selectedDate,
            endDate,
          );
          expect(
            availableIds,
            `${room.name} should be available after unblocking on ${selectedDate}.`,
          ).toContain(room.id);
        }
      });
      await test.step("Return to Today and verify Blocked decreases and Vacant increases by 1", async () => {
        await dashboardPage.open();
        await dashboardPage.verifyTodaySelectedByDefault();
        expect(
          await reservationDbHelper.getCurrentDate(0),
          "The server date changed during the unblock comparison; rerun for a single date.",
        ).toBe(selectedDate);
        await dashboardPage.verifyBlockedCount(beforeBlocked - rooms.length);
        await dashboardPage.verifyVacantCount(beforeVacant + rooms.length);
      });
    } finally {
      // Restore only blocks created by this test if setup or unblocking fails.
      if (blockedRooms.size > 0) {
        await layoutPage.clickCalendarIcon();
        await calendarPage.selectCalendarGrouping("Room Name");
        for (const roomName of blockedRooms) {
          await calendarPage.searchRoom(roomName);
          await calendarPage.unblockRoom(roomName, selectedDate);
        }
      }
    }
  });

  test("Verify Tomorrow count after unblocking a room", async ({
    dashboardPage,
    reservationDbHelper,
    setupDb,
    layoutPage,
    calendarPage,
  }) => {
    test.setTimeout(150_000);
    const selectedDate = await reservationDbHelper.getCurrentDate(1);
    const endDate = await reservationDbHelper.getCurrentDate(2);
    const rooms = (
      await setupDb.getAvailableCalendarRooms(selectedDate, endDate, 1)
    ).slice(0, 1);
    const blockedRooms = new Set<string>();
    try {
      await test.step("Prepare one blocked room for Tomorrow", async () => {
        await layoutPage.clickCalendarIcon();
        await calendarPage.selectCalendarGrouping("Room Name");
        for (const room of rooms) {
          await calendarPage.searchRoom(room.name);
          await calendarPage.blockRoom(room.name, selectedDate);
          blockedRooms.add(room.name);
        }
      });
      await test.step("Capture Tomorrow Blocked and Vacant counts before unblocking", async () => {
        await dashboardPage.open();
        await dashboardPage.verifyTodaySelectedByDefault();
        await dashboardPage.selectTomorrow();
      });
      const beforeBlocked = await dashboardPage.getBlockedCount();
      const beforeVacant = await dashboardPage.getVacantCount();
      expect(
        beforeBlocked,
        "The baseline must include all rooms blocked by this test.",
      ).toBeGreaterThanOrEqual(rooms.length);
      await test.step("Unblock the prepared rooms in the calendar", async () => {
        await layoutPage.clickCalendarIcon();
        await calendarPage.selectCalendarGrouping("Room Name");
        for (const room of rooms) {
          await calendarPage.searchRoom(room.name);
          await calendarPage.unblockRoom(room.name, selectedDate);
          blockedRooms.delete(room.name);
        }
      });
      await test.step("Verify each unblocked room is available for the selected date", async () => {
        for (const room of rooms) {
          const availableIds = await setupDb.getAvailableRoomIds(
            room.roomType,
            selectedDate,
            endDate,
          );
          expect(
            availableIds,
            `${room.name} should be available after unblocking on ${selectedDate}.`,
          ).toContain(room.id);
        }
      });
      await test.step("Return to Tomorrow and verify Blocked decreases and Vacant increases by 1", async () => {
        await dashboardPage.returnToTomorrowDashboard();
        expect(
          await reservationDbHelper.getCurrentDate(1),
          "The server date changed during the unblock comparison; rerun for a single date.",
        ).toBe(selectedDate);
        await dashboardPage.verifyBlockedCount(beforeBlocked - rooms.length);
        await dashboardPage.verifyVacantCount(beforeVacant + rooms.length);
      });
    } finally {
      // Restore only blocks created by this test if setup or unblocking fails.
      if (blockedRooms.size > 0) {
        await layoutPage.clickCalendarIcon();
        await calendarPage.selectCalendarGrouping("Room Name");
        for (const roomName of blockedRooms) {
          await calendarPage.searchRoom(roomName);
          await calendarPage.unblockRoom(roomName, selectedDate);
        }
      }
    }
  });

  test("Verify multiple rooms are unblocked", async ({
    dashboardPage,
    reservationDbHelper,
    setupDb,
    layoutPage,
    calendarPage,
  }) => {
    test.setTimeout(150_000);
    const selectedDate = await reservationDbHelper.getCurrentDate(0);
    const endDate = await reservationDbHelper.getCurrentDate(1);
    const rooms = (
      await setupDb.getAvailableCalendarRooms(selectedDate, endDate, 2)
    ).slice(0, 2);
    const blockedRooms = new Set<string>();
    try {
      await test.step("Prepare two blocked rooms for Today", async () => {
        await layoutPage.clickCalendarIcon();
        await calendarPage.selectCalendarGrouping("Room Name");
        for (const room of rooms) {
          await calendarPage.searchRoom(room.name);
          await calendarPage.blockRoom(room.name, selectedDate);
          blockedRooms.add(room.name);
        }
      });
      await test.step("Capture Today Blocked and Vacant counts before unblocking", async () => {
        await dashboardPage.open();
        await dashboardPage.verifyTodaySelectedByDefault();
      });
      const beforeBlocked = await dashboardPage.getBlockedCount();
      const beforeVacant = await dashboardPage.getVacantCount();
      expect(
        beforeBlocked,
        "The baseline must include all rooms blocked by this test.",
      ).toBeGreaterThanOrEqual(rooms.length);
      await test.step("Unblock the prepared rooms in the calendar", async () => {
        await layoutPage.clickCalendarIcon();
        await calendarPage.selectCalendarGrouping("Room Name");
        for (const room of rooms) {
          await calendarPage.searchRoom(room.name);
          await calendarPage.unblockRoom(room.name, selectedDate);
          blockedRooms.delete(room.name);
        }
      });
      await test.step("Verify each unblocked room is available for the selected date", async () => {
        for (const room of rooms) {
          const availableIds = await setupDb.getAvailableRoomIds(
            room.roomType,
            selectedDate,
            endDate,
          );
          expect(
            availableIds,
            `${room.name} should be available after unblocking on ${selectedDate}.`,
          ).toContain(room.id);
        }
      });
      await test.step("Return to Today and verify Blocked decreases and Vacant increases by 2", async () => {
        await dashboardPage.open();
        await dashboardPage.verifyTodaySelectedByDefault();
        expect(
          await reservationDbHelper.getCurrentDate(0),
          "The server date changed during the unblock comparison; rerun for a single date.",
        ).toBe(selectedDate);
        await dashboardPage.verifyBlockedCount(beforeBlocked - rooms.length);
        await dashboardPage.verifyVacantCount(beforeVacant + rooms.length);
      });
    } finally {
      // Restore only blocks created by this test if setup or unblocking fails.
      if (blockedRooms.size > 0) {
        await layoutPage.clickCalendarIcon();
        await calendarPage.selectCalendarGrouping("Room Name");
        for (const roomName of blockedRooms) {
          await calendarPage.searchRoom(roomName);
          await calendarPage.unblockRoom(roomName, selectedDate);
        }
      }
    }
  });
});

// ===== Total Occupied ======

test("Verify Total Occupied count for Today", async ({
  dashboardPage,
  reservationDbHelper,
  layoutPage,
  findReservationPage,
  reservationPage,
  reservationApi,
}) => {
  test.setTimeout(180_000);
  const selectedDate = await reservationDbHelper.getCurrentDate();
  const createdReservations: string[] = [];
  let failed = false;
  try {
    await test.step("Open Dashboard and verify Today is selected", async () => {
      await dashboardPage.openForDay("Today");
    });

    if ((await reservationDbHelper.getArrivalsCount(selectedDate)) === 0) {
      await test.step(
        "Create an arrival for today because none exist",
        async () => {
          await layoutPage.clickReservationListIcon();
          trackCreatedReservation(await reservationPage.createArrivalReservation(findReservationPage, selectedDate), createdReservations);
          await reservationPage.clickCloseButton();
        },
        { timeout: 60_000 },
      );
    }
    if (
      (await reservationDbHelper.getStayoverReservations(selectedDate))
        .length === 0
    ) {
      await test.step(
        "Create a stayover for today because none exist",
        async () => {
          await layoutPage.clickReservationListIcon();
          trackCreatedReservation(await reservationPage.createStayoverReservation(findReservationPage, selectedDate, -1, 1), createdReservations);
          await reservationPage.clickCloseButton();
        },
        { timeout: 60_000 },
      );
    }

    await test.step("Verify arrivals and stayovers exist for today", async () => {
      expect(
        await reservationDbHelper.getArrivalsCount(selectedDate),
        "Today should have an arrival.",
      ).toBeGreaterThan(0);
      expect(
        (await reservationDbHelper.getStayoverReservations(selectedDate))
          .length,
        "Today should have a stayover.",
      ).toBeGreaterThan(0);
    });

    await test.step("Compare Dashboard Total Occupied with occupied database rooms", async () => {
      await dashboardPage.openForDay("Today");
      const expectedCount =
        await reservationDbHelper.getOccupiedRoomCount(selectedDate);
      expect(
        await reservationDbHelper.getCurrentDate(),
        "The server date changed during the Total Occupied comparison; rerun for a single date.",
      ).toBe(selectedDate);
      await dashboardPage.verifyTotalOccupiedCount(expectedCount);
    });
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    if (!failed) {
      for (const confirmationNumber of createdReservations) {
        await reservationApi.deleteReservation(confirmationNumber);
      }
    }
  }
});

test("Verify Total Occupied count for Tomorrow", async ({
  dashboardPage,
  reservationDbHelper,
  layoutPage,
  findReservationPage,
  reservationPage,
  reservationApi,
}) => {
  test.setTimeout(180_000);
  const selectedDate = await reservationDbHelper.getCurrentDate(1);
  const createdReservations: string[] = [];
  let failed = false;
  try {
    await test.step("Open Dashboard and select Tomorrow", async () => {
      await dashboardPage.openForDay("Tomorrow");
    });

    if ((await reservationDbHelper.getArrivalsCount(selectedDate)) === 0) {
      await test.step("Create an arrival for tomorrow because none exist", async () => {
        await layoutPage.clickReservationListIcon();
        trackCreatedReservation(await reservationPage.createArrivalReservation(findReservationPage, selectedDate), createdReservations);
        await reservationPage.clickCloseButton();
      }, { timeout: 60_000 });
    }
    if ((await reservationDbHelper.getStayoverReservations(selectedDate)).length === 0) {
      await test.step("Create a stayover for tomorrow because none exist", async () => {
        await layoutPage.clickReservationListIcon();
        trackCreatedReservation(await reservationPage.createStayoverReservation(findReservationPage, selectedDate, -1, 1), createdReservations);
        await reservationPage.clickCloseButton();
      }, { timeout: 60_000 });
    }

    await test.step("Verify arrivals and stayovers exist for tomorrow", async () => {
      expect(await reservationDbHelper.getArrivalsCount(selectedDate), "Tomorrow should have an arrival.").toBeGreaterThan(0);
      expect((await reservationDbHelper.getStayoverReservations(selectedDate)).length,
        "Tomorrow should have a stayover.",
      ).toBeGreaterThan(0);
    });

    await test.step("Compare Tomorrow Total Occupied with occupied database rooms", async () => {
      await dashboardPage.openForDay("Tomorrow");
      const expectedCount = await reservationDbHelper.getOccupiedRoomCount(selectedDate);
      expect(await reservationDbHelper.getCurrentDate(1),
        "The server date changed during the Tomorrow Total Occupied comparison; rerun for a single date.",
      ).toBe(selectedDate);
      await dashboardPage.verifyTotalOccupiedCount(expectedCount);
    });
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    if (!failed) {
      for (const confirmationNumber of createdReservations) {
        await reservationApi.deleteReservation(confirmationNumber);
      }
    }
  }
});

test("Verify Total Occupied does not include a departure room", async ({
  dashboardPage,
  reservationDbHelper,
  layoutPage,
  findReservationPage,
  reservationPage,
  reservationApi,
}) => {
  test.setTimeout(120_000);
  const selectedDate = await reservationDbHelper.getCurrentDate();
  const createdReservations: string[] = [];
  let failed = false;
  try {
    await test.step("Open Dashboard and verify Today is selected", async () => {
      await dashboardPage.openForDay("Today");
    });

    if ((await reservationDbHelper.getDeparturesCount(selectedDate)) === 0) {
      await test.step("Create a departure for today because none exist", async () => {
        await layoutPage.clickReservationListIcon();
        trackCreatedReservation(
          await reservationPage.createDepartureReservation(findReservationPage, selectedDate),
          createdReservations,
        );
        await reservationPage.clickCloseButton();
      }, { timeout: 60_000 });
    }

    await test.step("Verify a departure exists for today", async () => {
      expect(await reservationDbHelper.getDeparturesCount(selectedDate),
        "Today should have a departure for this exclusion check.",
      ).toBeGreaterThan(0);
    });

    await test.step("Verify Total Occupied excludes rooms departing today", async () => {
      await dashboardPage.openForDay("Today");
      const expectedOccupiedRooms = await reservationDbHelper.getOccupiedRoomCount(selectedDate);
      expect(await reservationDbHelper.getCurrentDate(),
        "The server date changed during the departure exclusion comparison; rerun for a single date.",
      ).toBe(selectedDate);
      await dashboardPage.verifyTotalOccupiedCount(expectedOccupiedRooms);
    });
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    if (!failed) {
      for (const confirmationNumber of createdReservations) {
        await reservationApi.deleteReservation(confirmationNumber);
      }
    }
  }
});

// ======= Vacant =======

test("Verify Vacant count includes active rooms only", async ({
  dashboardPage,
  reservationDbHelper,
  setupDb,
}) => {
  test.setTimeout(90_000);
  const selectedDate = await reservationDbHelper.getCurrentDate();
  const endDate = await reservationDbHelper.getCurrentDate(1);

  await dashboardPage.openForDay("Today");
  const originalVacantCount = await dashboardPage.getVacantCount();
  const [room] = await setupDb.getAvailableCalendarRooms(selectedDate, endDate, 1);
  if (!room) throw new Error(`No active vacant room was found for ${selectedDate}.`);

  let roomDeactivated = false;
  try {
    await test.step(`Mark active vacant room ${room.name} as inactive`, async () => {
      await setupDb.setUnitActiveInactive(room.roomType, room.name, "No");
      roomDeactivated = true;
      await dashboardPage.refreshToday();
      await dashboardPage.verifyVacantCount(originalVacantCount - 1);
    });
  } finally {
    if (roomDeactivated) {
      await test.step(`Restore ${room.name} to active and the original Vacant count`, async () => {
        await setupDb.setUnitActiveInactive(room.roomType, room.name, "Yes");
        await dashboardPage.refreshToday();
        await dashboardPage.verifyVacantCount(originalVacantCount);
      });
    }
  }
});

test("Verify Today Vacant count with arrival, stayover, blocked, and active rooms", async ({
  dashboardPage, reservationDbHelper, setupDb, layoutPage, calendarPage,
  findReservationPage, reservationPage, reservationApi,
}) => {
  await verifyVacantCountWithArrivalStayoverAndBlockedRoom(
    "Today", { dashboardPage, reservationDbHelper, setupDb, layoutPage,
      calendarPage, findReservationPage, reservationPage, reservationApi },
  );
});

test("Verify Tomorrow Vacant count with arrival, stayover, blocked, and active rooms", async ({
  dashboardPage, reservationDbHelper, setupDb, layoutPage, calendarPage,
  findReservationPage, reservationPage, reservationApi,
}) => {
  await verifyVacantCountWithArrivalStayoverAndBlockedRoom(
    "Tomorrow", { dashboardPage, reservationDbHelper, setupDb, layoutPage,
      calendarPage, findReservationPage, reservationPage, reservationApi },
  );
});

test("Verify Today Vacant count excludes a departure room", async ({
  dashboardPage, reservationDbHelper, setupDb, layoutPage,
  findReservationPage, reservationPage, reservationApi,
}) => {
  test.setTimeout(120_000);
  const selectedDate = await reservationDbHelper.getCurrentDate();
  const endDate = await reservationDbHelper.getCurrentDate(1);
  const createdReservations: string[] = [];
  let failed = false;
  try {
    await dashboardPage.openForDay("Today");
    if (await reservationDbHelper.getDeparturesCount(selectedDate) === 0) {
      await layoutPage.clickReservationListIcon();
      trackCreatedReservation(
        await reservationPage.createDepartureReservation(findReservationPage, selectedDate),
        createdReservations,
      );
      await reservationPage.clickCloseButton();
    }
    expect(await reservationDbHelper.getDeparturesCount(selectedDate),
      "Today should have a departure for this Vacant count check.",
    ).toBeGreaterThan(0);

    await dashboardPage.openForDay("Today");
    const expectedCount = await setupDb.getAvailableActiveRoomCount(selectedDate, endDate);
    await dashboardPage.verifyVacantCount(expectedCount);
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    if (!failed) {
      for (const confirmationNumber of createdReservations) {
        await reservationApi.deleteReservation(confirmationNumber);
      }
    }
  }
});

// ==================== Test helpers ====================
type VacantMetricFixtures = {
  dashboardPage: import("../../../src/pages/DashboardPage").DashboardPage;
  reservationDbHelper: ReservationDatabaseHelper;
  setupDb: SetupDatabaseHelper;
  layoutPage: LayoutPage;
  calendarPage: CalendarPage;
  findReservationPage: FindReservationPage;
  reservationPage: ReservationPage;
  reservationApi: import("../../../src/api/ReservationApi").ReservationApi;
};

async function verifyVacantCountWithArrivalStayoverAndBlockedRoom(
  day: "Today" | "Tomorrow",
  fixtures: VacantMetricFixtures,
): Promise<void> {
  const {
    dashboardPage, reservationDbHelper, setupDb, layoutPage, calendarPage,
    findReservationPage, reservationPage, reservationApi,
  } = fixtures;
  test.setTimeout(150_000);
  const offset = day === "Today" ? 0 : 1;
  const selectedDate = await reservationDbHelper.getCurrentDate(offset);
  const endDate = await reservationDbHelper.getCurrentDate(offset + 1);
  const createdReservations: string[] = [];
  let blockedRoom: { name: string; roomType: string } | undefined;
  let failed = false;

  try {
    await dashboardPage.openForDay(day);
    if (await reservationDbHelper.getArrivalsCount(selectedDate) === 0) {
      await layoutPage.clickReservationListIcon();
      trackCreatedReservation(
        await reservationPage.createArrivalReservation(findReservationPage, selectedDate),
        createdReservations,
      );
      await reservationPage.clickCloseButton();
    }
    if ((await reservationDbHelper.getStayoverReservations(selectedDate)).length === 0) {
      await layoutPage.clickReservationListIcon();
      trackCreatedReservation(
        await reservationPage.createStayoverReservation(findReservationPage, selectedDate, -1, 1),
        createdReservations,
      );
      await reservationPage.clickCloseButton();
    }

    const [room] = await setupDb.getAvailableCalendarRooms(selectedDate, endDate, 1);
    if (!room) throw new Error(`No active vacant room was found to block for ${selectedDate}.`);
    await layoutPage.clickCalendarIcon();
    await calendarPage.selectCalendarGrouping("Room Name");
    await calendarPage.searchRoom(room.name);
    await calendarPage.blockRoom(room.name, selectedDate);
    blockedRoom = room;

    await dashboardPage.openForDay(day);
    expect(await reservationDbHelper.getArrivalsCount(selectedDate), `${day} should have an arrival.`)
      .toBeGreaterThan(0);
    expect((await reservationDbHelper.getStayoverReservations(selectedDate)).length,
      `${day} should have a stayover.`,
    ).toBeGreaterThan(0);
    const expectedVacant = await setupDb.getAvailableActiveRoomCount(selectedDate, endDate);
    await dashboardPage.verifyVacantCount(expectedVacant);
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    if (blockedRoom) {
      await layoutPage.clickCalendarIcon();
      await calendarPage.selectCalendarGrouping("Room Name");
      await calendarPage.searchRoom(blockedRoom.name);
      await calendarPage.unblockRoom(blockedRoom.name, selectedDate);
    }
    if (!failed) {
      for (const confirmationNumber of createdReservations) {
        await reservationApi.deleteReservation(confirmationNumber);
      }
    }
  }
}

function trackCreatedReservation(confirmationNumber: string, createdReservations: string[]): void {
  createdReservations.push(confirmationNumber);
}
