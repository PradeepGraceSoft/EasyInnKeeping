import { test, expect } from "../../../src/fixtures/pms.fixture";
import { AlertMessages } from "../../../src/constants/AlertMessages";
import { ConstNames } from "../../../src/constants/ConstNames";

// ========== **Occupancy % of Sellable Rooms** ==========
test.describe("Dashboard performance metrics", () => {
  test("Validate Occupancy % of Sellable Rooms with existing Arrivals, Departures, Stayovers and Blocked rooms", async ({
    dashboardPage,
    reservationDbHelper,
    setupDb,
    layoutPage,
    findReservationPage,
    reservationPage,
    calendarPage,
    reservationApi,
  }) => {
    // Allows three conditional reservation creations, a room block, and cleanup.
    test.setTimeout(300_000);
    const selectedDate = await reservationDbHelper.getDashboardBusinessDate();
    const endDate = await reservationDbHelper.getDashboardBusinessDate(1);
    const createdReservations: string[] = [];
    let createdBlock: string | undefined;
    let failed = false;
    const trackReservation = (confirmationNumber: string): void => {
      createdReservations.push(confirmationNumber);
    };

    try {
      const totalRooms =
        await test.step("Get the property's total rooms from the database", async () => {
          const count =
            await reservationDbHelper.getDashboardTotalRoomCount(selectedDate);
          expect(
            count,
            "The property should have rooms available for the occupancy scenario.",
          ).toBeGreaterThan(0);
          return count;
        });

      await test.step(
        "Reuse an existing arrival or create one for the business date",
        async () => {
          const count = (
            await reservationDbHelper.getDashboardOccupancyRoomCounts(
              selectedDate,
            )
          ).arrivals;
          if (count === 0) {
            await layoutPage.clickReservationListIcon();
            await reservationPage.createArrivalReservation(
              findReservationPage,
              selectedDate,
              trackReservation,
            );
            await reservationPage.clickCloseButton();
          }
        },
        { timeout: 60_000 },
      );

      await test.step(
        "Reuse an existing departure or create one for the business date",
        async () => {
          const count =
            await reservationDbHelper.getDeparturesCount(selectedDate);
          if (count === 0) {
            await layoutPage.clickReservationListIcon();
            await reservationPage.createDepartureReservation(
              findReservationPage,
              selectedDate,
              trackReservation,
            );
            await reservationPage.clickCloseButton();
          }
        },
        { timeout: 60_000 },
      );

      await test.step(
        "Reuse an existing stayover or create one spanning the business date",
        async () => {
          const count = (
            await reservationDbHelper.getDashboardOccupancyRoomCounts(
              selectedDate,
            )
          ).stayovers;
          if (count === 0) {
            await layoutPage.clickReservationListIcon();
            await reservationPage.createStayoverReservation(
              findReservationPage,
              selectedDate,
              -1,
              1,
              trackReservation,
            );
            await reservationPage.clickCloseButton();
          }
        },
        { timeout: 60_000 },
      );

      await test.step(
        "Reuse an existing blocked room or block an available room",
        async () => {
          const count =
            await reservationDbHelper.getDashboardBlockedRoomCount(
              selectedDate,
            );
          if (count === 0) {
            const [room] = await setupDb.getAvailableCalendarRooms(
              selectedDate,
              endDate,
              1,
            );
            if (!room)
              throw new Error(
                `No available room was found to block on ${selectedDate}.`,
              );
            await layoutPage.clickCalendarIcon();
            await calendarPage.selectCalendarGrouping("Room Name");
            await calendarPage.searchRoom(room.name);
            await calendarPage.blockRoom(room.name, selectedDate);
            createdBlock = room.name;
          }
        },
        { timeout: 45_000 },
      );

      const expectedPercentage =
        await test.step("Re-query occupancy and blocked rooms and calculate sellable-room occupancy", async () => {
          const counts =
            await reservationDbHelper.getDashboardOccupancyRoomCounts(
              selectedDate,
            );
          const blockedRooms =
            await reservationDbHelper.getDashboardBlockedRoomCount(
              selectedDate,
            );
          expect(
            counts.arrivals,
            "The selected date should contain a qualifying arrival room.",
          ).toBeGreaterThan(0);
          const departures =
            await reservationDbHelper.getDeparturesCount(selectedDate);
          expect(
            departures,
            "The selected date should contain a departure.",
          ).toBeGreaterThan(0);
          expect(
            counts.stayovers,
            "The selected date should contain a qualifying stayover room.",
          ).toBeGreaterThan(0);
          expect(
            blockedRooms,
            "The selected date should contain a blocked room.",
          ).toBeGreaterThan(0);
          const occupiedRooms =
            counts.arrivals +
            counts.stayovers +
            counts.dayUse +
            counts.groupBlocks;
          const sellableRooms = totalRooms - blockedRooms;
          expect(
            sellableRooms,
            "This occupancy scenario requires at least one sellable room.",
          ).toBeGreaterThan(0);
          // SQL ROUND(..., 2) rounds positive percentages half-up; the UI displays two decimals.
          const percentage =
            Math.round((occupiedRooms * 10_000) / sellableRooms) / 100;
          return percentage;
        });

      await test.step("Compare Today Occupancy % of Sellable Rooms with the rounded database calculation", async () => {
        await dashboardPage.openTodayPerformanceMetrics();
        expect(
          await reservationDbHelper.getDashboardBusinessDate(),
          "The business date changed during the occupancy comparison; rerun for a single date.",
        ).toBe(selectedDate);
        await dashboardPage.verifySellableRoomsOccupancy(expectedPercentage);
      });
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      // Existing data is reused untouched. Preserve created reservations on failure.
      try {
        if (createdBlock) {
          await layoutPage.clickCalendarIcon();
          await calendarPage.selectCalendarGrouping("Room Name");
          await calendarPage.searchRoom(createdBlock);
          await calendarPage.unblockRoom(createdBlock, selectedDate);
        }
      } finally {
        if (!failed) {
          for (const confirmationNumber of createdReservations) {
            await reservationApi.deleteReservation(confirmationNumber);
          }
        }
      }
    }
  });

  test("Validate Occupancy % after unblocking a room", async ({
    dashboardPage,
    reservationDbHelper,
    setupDb,
    layoutPage,
    calendarPage,
  }) => {
    test.setTimeout(150_000);
    const selectedDate = await reservationDbHelper.getDashboardBusinessDate();
    const endDate = await reservationDbHelper.getDashboardBusinessDate(1);
    const totalRooms =
      await reservationDbHelper.getDashboardTotalRoomCount(selectedDate);
    let blockedRoom =
      await reservationDbHelper.getDashboardBlockedRoom(selectedDate);
    let temporaryBlockCreated = false;

    if (!blockedRoom) {
      const [room] = await setupDb.getAvailableCalendarRooms(
        selectedDate,
        endDate,
        1,
      );
      if (!room)
        throw new Error(
          `No available room was found to block and unblock on ${selectedDate}.`,
        );
      await layoutPage.clickCalendarIcon();
      await calendarPage.selectCalendarGrouping("Room Name");
      await calendarPage.searchRoom(room.name);
      await calendarPage.blockRoom(room.name, selectedDate);
      blockedRoom = { id: room.id, name: room.name };
      temporaryBlockCreated = true;
    } else {
    }

    let blockStillPresent = temporaryBlockCreated;
    try {
      const beforeBlockedRooms =
        await reservationDbHelper.getDashboardBlockedRoomCount(selectedDate);
      const beforeCounts =
        await reservationDbHelper.getDashboardOccupancyRoomCounts(selectedDate);
      const occupiedRooms =
        beforeCounts.arrivals +
        beforeCounts.stayovers +
        beforeCounts.dayUse +
        beforeCounts.groupBlocks;
      const beforeSellableRooms = totalRooms - beforeBlockedRooms;
      expect(
        beforeSellableRooms,
        "The selected date should have sellable rooms before unblocking.",
      ).toBeGreaterThan(0);
      const beforePercentage =
        Math.round((occupiedRooms * 10_000) / beforeSellableRooms) / 100;

      await test.step(`Unblock room ${blockedRoom.name} for ${selectedDate}`, async () => {
        await layoutPage.clickCalendarIcon();
        await calendarPage.selectCalendarGrouping("Room Name");
        await calendarPage.searchRoom(blockedRoom.name);
        await calendarPage.unblockRoom(blockedRoom.name, selectedDate);
        blockStillPresent = false;
      });

      const updatedBlockedRooms =
        await reservationDbHelper.getDashboardBlockedRoomCount(selectedDate);
      expect(
        updatedBlockedRooms,
        "Unblocking one room should reduce the dashboard blocked count by one.",
      ).toBe(beforeBlockedRooms - 1);
      const updatedCounts =
        await reservationDbHelper.getDashboardOccupancyRoomCounts(selectedDate);
      const updatedOccupiedRooms =
        updatedCounts.arrivals +
        updatedCounts.stayovers +
        updatedCounts.dayUse +
        updatedCounts.groupBlocks;
      expect(
        updatedOccupiedRooms,
        "Unblocking a maintenance-blocked room should not change occupied rooms.",
      ).toBe(occupiedRooms);
      const updatedSellableRooms = totalRooms - updatedBlockedRooms;
      expect(
        updatedSellableRooms,
        "The selected date should have sellable rooms after unblocking.",
      ).toBeGreaterThan(0);
      const expectedPercentage =
        Math.round((updatedOccupiedRooms * 10_000) / updatedSellableRooms) /
        100;

      await test.step("Compare the updated calculation with the Dashboard KPI", async () => {
        await dashboardPage.openTodayPerformanceMetrics();
        expect(
          await reservationDbHelper.getDashboardBusinessDate(),
          "The business date changed during the after-unblock occupancy comparison; rerun for a single date.",
        ).toBe(selectedDate);
        await dashboardPage.verifySellableRoomsOccupancy(expectedPercentage);
      });
    } finally {
      if (blockStillPresent && temporaryBlockCreated) {
        await layoutPage.clickCalendarIcon();
        await calendarPage.selectCalendarGrouping("Room Name");
        await calendarPage.searchRoom(blockedRoom.name);
        await calendarPage.unblockRoom(blockedRoom.name, selectedDate);
      }
    }
  });

  test("Validate Occupancy % after an occupied room becomes vacant", async ({
    dashboardPage,
    reservationDbHelper,
    layoutPage,
    findReservationPage,
    reservationPage,
    reservationApi,
  }) => {
    test.setTimeout(180_000);
    const selectedDate = await reservationDbHelper.getDashboardBusinessDate();
    const totalRooms =
      await reservationDbHelper.getDashboardTotalRoomCount(selectedDate);
    const blockedRooms =
      await reservationDbHelper.getDashboardBlockedRoomCount(selectedDate);
    let occupiedReservation =
      await reservationDbHelper.getDashboardOccupiedReservation(selectedDate);

    if (!occupiedReservation) {
      await test.step(
        `Create an arrival because ${selectedDate} has no occupied reservation`,
        async () => {
          await layoutPage.clickReservationListIcon();
          await reservationPage.createArrivalReservation(
            findReservationPage,
            selectedDate,
            (confirmationNumber) => {
            },
          );
          await reservationPage.clickCloseButton();
        },
        { timeout: 60_000 },
      );
      occupiedReservation =
        await reservationDbHelper.getDashboardOccupiedReservation(selectedDate);
    }

    expect(
      occupiedReservation,
      `An occupied arrival or stayover room should exist on ${selectedDate}.`,
    ).not.toBeNull();
    if (!occupiedReservation)
      throw new Error(
        `No occupied reservation was found on ${selectedDate}, including the arrival created for this scenario.`,
      );

    const beforeCounts =
      await reservationDbHelper.getDashboardOccupancyRoomCounts(selectedDate);
    const occupiedBefore =
      beforeCounts.arrivals +
      beforeCounts.stayovers +
      beforeCounts.dayUse +
      beforeCounts.groupBlocks;
    expect(
      occupiedBefore,
      "The selected date should have occupied rooms before deleting a reservation.",
    ).toBeGreaterThan(0);
    const beforeSellableRooms = totalRooms - blockedRooms;
    expect(
      beforeSellableRooms,
      "The selected date should have sellable rooms before deleting a reservation.",
    ).toBeGreaterThan(0);
    const beforePercentage =
      Math.round((occupiedBefore * 10_000) / beforeSellableRooms) / 100;

    await test.step(`Delete occupied reservation ${occupiedReservation.confirmationNumber}`, async () => {
      await reservationApi.deleteReservation(
        occupiedReservation.confirmationNumber,
      );
    });

    await expect
      .poll(
        async () => {
          const counts =
            await reservationDbHelper.getDashboardOccupancyRoomCounts(
              selectedDate,
            );
          return (
            counts.arrivals +
            counts.stayovers +
            counts.dayUse +
            counts.groupBlocks
          );
        },
        {
          message: `The deleted reservation should no longer contribute occupied rooms on ${selectedDate}.`,
          timeout: 20_000,
        },
      )
      .toBeLessThan(occupiedBefore);

    const afterCounts =
      await reservationDbHelper.getDashboardOccupancyRoomCounts(selectedDate);
    const occupiedAfter =
      afterCounts.arrivals +
      afterCounts.stayovers +
      afterCounts.dayUse +
      afterCounts.groupBlocks;
    const blockedRoomsAfter =
      await reservationDbHelper.getDashboardBlockedRoomCount(selectedDate);
    expect(
      blockedRoomsAfter,
      "Deleting an occupied reservation should not change blocked rooms.",
    ).toBe(blockedRooms);
    const sellableRoomsAfter = totalRooms - blockedRoomsAfter;
    expect(
      sellableRoomsAfter,
      "The selected date should retain sellable rooms after deletion.",
    ).toBeGreaterThan(0);
    const expectedPercentage =
      Math.round((occupiedAfter * 10_000) / sellableRoomsAfter) / 100;

    await test.step("Compare updated occupancy with the Dashboard KPI", async () => {
      await dashboardPage.openTodayPerformanceMetrics();
      expect(
        await reservationDbHelper.getDashboardBusinessDate(),
        "The business date changed during the after-deletion occupancy comparison; rerun for a single date.",
      ).toBe(selectedDate);
      await dashboardPage.verifySellableRoomsOccupancy(expectedPercentage);
    });
  });

  // ======== ADR ========
  test("Validate ADR with existing reserved rooms", async ({
    dashboardPage,
    reservationDbHelper,
    layoutPage,
    findReservationPage,
    reservationPage,
    reservationApi,
  }) => {
    test.setTimeout(180_000);
    const selectedDate = await reservationDbHelper.getDashboardBusinessDate();
    const totalRooms =
      await reservationDbHelper.getDashboardTotalRoomCount(selectedDate);
    expect(
      totalRooms,
      "The property should have rooms for the ADR comparison.",
    ).toBeGreaterThan(0);

    const createdReservations: string[] = [];
    let failed = false;
    const trackReservation = (confirmationNumber: string): void => {
      createdReservations.push(confirmationNumber);
    };

    try {
      let adrData = await reservationDbHelper.getDashboardAdrData(selectedDate);

      if (adrData.reservedRooms === 0) {
        await test.step(
          `Create an arrival because no ADR-eligible reservations exist on ${selectedDate}`,
          async () => {
            await layoutPage.clickReservationListIcon();
            await reservationPage.createArrivalReservation(
              findReservationPage,
              selectedDate,
              trackReservation,
            );
            await reservationPage.clickCloseButton();
          },
          { timeout: 60_000 },
        );
        adrData = await reservationDbHelper.getDashboardAdrData(selectedDate);
      }

      expect(
        adrData.reservedRooms,
        `Arrivals or stayovers should reserve rooms on ${selectedDate}.`,
      ).toBeGreaterThan(0);
      const expectedAdr =
        adrData.reservedRooms > 0
          ? Math.round((adrData.roomRevenue / adrData.reservedRooms) * 100) /
            100
          : 0;

      await test.step("Compare the database ADR calculation with the Dashboard KPI", async () => {
        await dashboardPage.openTodayPerformanceMetrics();
        expect(
          await reservationDbHelper.getDashboardBusinessDate(),
          "The business date changed during the ADR comparison; rerun for a single date.",
        ).toBe(selectedDate);
        await dashboardPage.verifyReservedRoomsAdr(expectedAdr);
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

  test("Validate ADR after adding a reservation", async ({
    dashboardPage,
    reservationDbHelper,
    setupDb,
    layoutPage,
    findReservationPage,
    reservationPage,
    reservationApi,
  }) => {
    test.setTimeout(180_000);
    const selectedDate = await reservationDbHelper.getDashboardBusinessDate();
    const nextDate = await reservationDbHelper.getDashboardBusinessDate(1);
    const initialData =
      await reservationDbHelper.getDashboardAdrData(selectedDate);
    const initialAdr =
      initialData.reservedRooms > 0
        ? Math.round(
            (initialData.roomRevenue / initialData.reservedRooms) * 100,
          ) / 100
        : 0;

    const [availableRoom] = await setupDb.getAvailableCalendarRooms(
      selectedDate,
      nextDate,
      1,
    );
    if (!availableRoom)
      throw new Error(
        `No available room was found for a new ADR reservation on ${selectedDate}.`,
      );

    let createdConfirmationNumber: string | undefined;
    let failed = false;
    try {
      await test.step(
        `Create an arrival in available room ${availableRoom.name}`,
        async () => {
          await layoutPage.clickReservationListIcon();
          createdConfirmationNumber =
            await reservationPage.createArrivalReservation(
              findReservationPage,
              selectedDate,
              (confirmationNumber) => {
                createdConfirmationNumber = confirmationNumber;
              },
              availableRoom,
            );
          await reservationPage.clickCloseButton();
        },
        { timeout: 60_000 },
      );

      await expect
        .poll(
          async () => reservationDbHelper.getDashboardAdrData(selectedDate),
          {
            message: `The new reservation should add its room and room revenue to the ADR database totals for ${selectedDate}.`,
            timeout: 20_000,
          },
        )
        .toMatchObject({
          reservedRooms: initialData.reservedRooms + 1,
        });

      const updatedData =
        await reservationDbHelper.getDashboardAdrData(selectedDate);
      expect(
        updatedData.roomRevenue,
        "The new reservation should contribute room revenue to ADR.",
      ).toBeGreaterThan(initialData.roomRevenue);
      expect(
        updatedData.arrivals,
        "The new reservation should add an arrival room to the ADR calculation.",
      ).toBe(initialData.arrivals + 1);
      const expectedAdr =
        Math.round(
          (updatedData.roomRevenue / updatedData.reservedRooms) * 100,
        ) / 100;

      await test.step("Compare the updated ADR with the Dashboard KPI", async () => {
        await dashboardPage.openTodayPerformanceMetrics();
        expect(
          await reservationDbHelper.getDashboardBusinessDate(),
          "The business date changed during the after-reservation ADR comparison; rerun for a single date.",
        ).toBe(selectedDate);
        await dashboardPage.verifyReservedRoomsAdr(expectedAdr);
      });
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      if (createdConfirmationNumber && !failed) {
        await reservationApi.deleteReservation(createdConfirmationNumber);
      }
    }
  });

  test("Validate ADR after modifying room revenue", async ({
    dashboardPage,
    reservationDbHelper,
    layoutPage,
    findReservationPage,
    reservationPage,
    reservationApi,
  }) => {
    test.setTimeout(180_000);
    const selectedDate = await reservationDbHelper.getDashboardBusinessDate();
    let reservation =
      await reservationDbHelper.getDashboardAdrReservation(selectedDate);
    let createdConfirmationNumber: string | undefined;

    if (!reservation) {
      await test.step(
        `Create an arrival because no ADR reservation exists on ${selectedDate}`,
        async () => {
          await layoutPage.clickReservationListIcon();
          await reservationPage.createArrivalReservation(
            findReservationPage,
            selectedDate,
            (confirmationNumber) => {
              createdConfirmationNumber = confirmationNumber;
            },
          );
          await reservationPage.clickCloseButton();
        },
        { timeout: 60_000 },
      );
      reservation =
        await reservationDbHelper.getDashboardAdrReservation(selectedDate);
    }

    expect(
      reservation,
      `An ADR-contributing one-room reservation should exist on ${selectedDate}, creating an arrival if needed.`,
    ).not.toBeNull();
    if (!reservation) {
      throw new Error(
        `No single-room arrival or stayover contributing to ADR was found on ${selectedDate}, including the arrival created for this scenario.`,
      );
    }

    const beforeData =
      await reservationDbHelper.getDashboardAdrData(selectedDate);
    expect(
      beforeData.reservedRooms,
      `ADR should have reserved rooms on ${selectedDate}.`,
    ).toBeGreaterThan(0);
    const beforeAdr =
      Math.round((beforeData.roomRevenue / beforeData.reservedRooms) * 100) /
      100;
    const updatedRoomRate = Number((reservation.roomRate + 10).toFixed(2));
    let rateUpdated = false;
    let failed = false;


    try {
      await test.step(`Increase the ADR reservation rate for ${reservation.roomName}`, async () => {
        await layoutPage.clickReservationListIcon();
        await findReservationPage.openReservation(
          reservation.confirmationNumber,
        );
        await reservationPage.clickEditRoomRate();
        await reservationPage.enterEditedRoomRate(updatedRoomRate.toFixed(2));
        await reservationPage.clickSaveEditedRoomRate();
        await reservationPage.clickSaveButton();
        rateUpdated = true;
        await reservationPage.clickCloseButton();
      });

      await expect
        .poll(
          async () =>
            (await reservationDbHelper.getDashboardAdrData(selectedDate))
              .roomRevenue,
          {
            message: `The saved room rate should increase ADR room revenue on ${selectedDate}.`,
            timeout: 20_000,
          },
        )
        .toBeGreaterThan(beforeData.roomRevenue);

      const updatedData =
        await reservationDbHelper.getDashboardAdrData(selectedDate);
      expect(
        updatedData.roomRevenue,
        "The modified rate should increase total room revenue.",
      ).toBeGreaterThan(beforeData.roomRevenue);
      expect(
        updatedData.reservedRooms,
        "Changing room revenue should not change the ADR reserved-room count.",
      ).toBe(beforeData.reservedRooms);
      const expectedAdr =
        Math.round(
          (updatedData.roomRevenue / updatedData.reservedRooms) * 100,
        ) / 100;

      await test.step("Refresh Dashboard and compare the updated ADR", async () => {
        await dashboardPage.openTodayPerformanceMetrics();
        expect(
          await reservationDbHelper.getDashboardBusinessDate(),
          "The business date changed during the room revenue ADR comparison; rerun for a single date.",
        ).toBe(selectedDate);
        await dashboardPage.verifyReservedRoomsAdr(expectedAdr);
      });
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      if (rateUpdated) {
        await layoutPage.clickReservationListIcon();
        await findReservationPage.openReservation(
          reservation.confirmationNumber,
        );
        await reservationPage.clickEditRoomRate();
        await reservationPage.enterEditedRoomRate(
          reservation.roomRate.toFixed(2),
        );
        await reservationPage.clickSaveEditedRoomRate();
        await reservationPage.clickSaveButton();
        await reservationPage.clickCloseButton();
      }
      if (createdConfirmationNumber && !failed) {
        await reservationApi.deleteReservation(createdConfirmationNumber);
      }
      if (failed) {
      }
    }
  });

  test("Validate ADR after cancelling a reservation", async ({
    dashboardPage,
    reservationDbHelper,
    layoutPage,
    findReservationPage,
    reservationPage,
  }) => {
    test.setTimeout(180_000);
    const selectedDate = await reservationDbHelper.getDashboardBusinessDate();
    let reservation =
      await reservationDbHelper.getDashboardAdrReservation(selectedDate);
    let createdConfirmationNumber: string | undefined;

    if (!reservation) {
      await test.step(
        `Create an arrival because no ADR reservation exists on ${selectedDate}`,
        async () => {
          await layoutPage.clickReservationListIcon();
          await reservationPage.createArrivalReservation(
            findReservationPage,
            selectedDate,
            (confirmationNumber) => {
              createdConfirmationNumber = confirmationNumber;
            },
          );
          await reservationPage.clickCloseButton();
        },
        { timeout: 60_000 },
      );
      reservation =
        await reservationDbHelper.getDashboardAdrReservation(selectedDate);
    }

    expect(
      reservation,
      `An ADR-contributing reservation should exist on ${selectedDate}, creating an arrival if needed.`,
    ).not.toBeNull();
    if (!reservation) {
      throw new Error(
        `No one-room arrival or stayover contributing to ADR was found on ${selectedDate}, including the arrival created for this scenario.`,
      );
    }

    const beforeData =
      await reservationDbHelper.getDashboardAdrData(selectedDate);
    expect(
      beforeData.reservedRooms,
      `ADR should have reserved rooms before cancelling on ${selectedDate}.`,
    ).toBeGreaterThan(0);
    const beforeAdr =
      Math.round((beforeData.roomRevenue / beforeData.reservedRooms) * 100) /
      100;

    await test.step(`Cancel ADR reservation ${reservation.confirmationNumber}`, async () => {
      await layoutPage.clickReservationListIcon();
      await findReservationPage.openReservation(reservation.confirmationNumber);
      await reservationPage.clickCancelButton();
      await reservationPage.verifyCancellationChargePopupDisplayed();
      await reservationPage.clickCancelReservation();
      await reservationPage.verifyAlertMessage(
        AlertMessages.RESERVATION_CANCELLED_SUCCESS,
      );
      await reservationPage.clickCloseButton();
    });

    await expect
      .poll(
        async () =>
          reservationDbHelper.getReservationStayDates(
            reservation.confirmationNumber,
          ),
        {
          message: `Reservation ${reservation.confirmationNumber} should be cancelled in the database.`,
          timeout: 20_000,
        },
      )
      .toMatchObject({ status: /^Cancelled$/i });

    const updatedData =
      await reservationDbHelper.getDashboardAdrData(selectedDate);
    expect(
      updatedData.reservedRooms,
      "Cancelling the selected one-room reservation should reduce the ADR reserved-room count by one.",
    ).toBe(beforeData.reservedRooms - 1);
    expect(
      updatedData.roomRevenue,
      "Cancelling the selected reservation should remove its room revenue from ADR.",
    ).toBeLessThan(beforeData.roomRevenue);
    const expectedAdr =
      updatedData.reservedRooms > 0
        ? Math.round(
            (updatedData.roomRevenue / updatedData.reservedRooms) * 100,
          ) / 100
        : 0;

    await test.step("Refresh Dashboard and compare the remaining-reservation ADR", async () => {
      await dashboardPage.openTodayPerformanceMetrics();
      expect(
        await reservationDbHelper.getDashboardBusinessDate(),
        "The business date changed during the after-cancellation ADR comparison; rerun for a single date.",
      ).toBe(selectedDate);
      await dashboardPage.verifyReservedRoomsAdr(expectedAdr);
    });
  });

  test("Validate ADR with room revenue from multiple reservations", async ({
    dashboardPage,
    reservationDbHelper,
    setupDb,
    layoutPage,
    findReservationPage,
    reservationPage,
    reservationApi,
  }) => {
    test.setTimeout(180_000);
    const selectedDate = await reservationDbHelper.getDashboardBusinessDate();
    const nextDate = await reservationDbHelper.getDashboardBusinessDate(1);
    const totalRooms =
      await reservationDbHelper.getDashboardTotalRoomCount(selectedDate);
    expect(
      totalRooms,
      "The property should have rooms for the multiple-reservation ADR check.",
    ).toBeGreaterThan(1);
    let adrData = await reservationDbHelper.getDashboardAdrData(selectedDate);
    const createdReservations: string[] = [];
    let failed = false;
    const trackReservation = (confirmationNumber: string): void => {
      createdReservations.push(confirmationNumber);
    };

    try {
      if (adrData.reservedRooms < 2) {
        const availableRooms = await setupDb.getAvailableCalendarRooms(
          selectedDate,
          nextDate,
          2 - adrData.reservedRooms,
        );
        for (const room of availableRooms) {
          await test.step(
            `Create only the missing ADR reservation for room ${room.name}`,
            async () => {
              await layoutPage.clickReservationListIcon();
              await reservationPage.createArrivalReservation(
                findReservationPage,
                selectedDate,
                trackReservation,
                room,
              );
              await reservationPage.clickCloseButton();
            },
            { timeout: 60_000 },
          );
        }
        adrData = await reservationDbHelper.getDashboardAdrData(selectedDate);
      }

      expect(
        adrData.reservedRooms,
        `At least two applicable reserved rooms should contribute to ADR on ${selectedDate}.`,
      ).toBeGreaterThanOrEqual(2);
      const expectedAdr =
        Math.round((adrData.roomRevenue / adrData.reservedRooms) * 100) / 100;

      await test.step("Compare combined room revenue ADR with the Dashboard KPI", async () => {
        await dashboardPage.openTodayPerformanceMetrics();
        expect(
          await reservationDbHelper.getDashboardBusinessDate(),
          "The business date changed during the multiple-reservation ADR comparison; rerun for a single date.",
        ).toBe(selectedDate);
        await dashboardPage.verifyReservedRoomsAdr(expectedAdr);
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

  test("Validate ADR excludes tax, charges, and discounts from non-room revenue", async ({
    dashboardPage,
    reservationDbHelper,
    setupDb,
    layoutPage,
    findReservationPage,
    reservationPage,
    billingPage,
    reservationApi,
  }) => {
    test.setTimeout(180_000);
    const selectedDate = await reservationDbHelper.getDashboardBusinessDate();
    const chargeCode = await setupDb.requireInventoryItemAccountCode(
      ConstNames.INVENTORY_CHARGES_CHARGE_ITEM,
    );
    const discountCode = await setupDb.requireInventoryItemAccountCode(
      ConstNames.DISCOUNT_FLAT_DISCOUNT,
    );
    await setupDb.setTaxAmount(ConstNames.TAX_NAME_LODGING, 5);
    await setupDb.setTaxExempt(ConstNames.TAX_NAME_LODGING, 0, 0);
    await setupDb.setTaxAppliedToLodging(ConstNames.TAX_NAME_LODGING, 1);
    await setupDb.setInventoryItemAmount(chargeCode, 25);
    let createdConfirmationNumber: string | undefined;
    let failed = false;
    try {
      await test.step(
        `Create a taxed arrival with a charge and discount on ${selectedDate}`,
        async () => {
          await layoutPage.clickReservationListIcon();
          createdConfirmationNumber =
            await reservationPage.createArrivalReservation(
              findReservationPage,
              selectedDate,
              (confirmationNumber) => {
                createdConfirmationNumber = confirmationNumber;
              },
            );
          await billingPage.clickBillingTab();
          await billingPage.enterChargesDiscountAccountCode(chargeCode);
          await billingPage.clickChargesDiscountSave();
          await reservationPage.verifyAlertMessage(
            AlertMessages.BILLING_SAVED_SUCCESS,
          );
          await billingPage.enterChargesDiscountAccountCode(discountCode);
          await billingPage.enterChargesDiscountAmountTextbox("1");
          await billingPage.clickChargesDiscountSave();
          await reservationPage.verifyAlertMessage(
            AlertMessages.BILLING_SAVED_SUCCESS,
          );
          await billingPage.verifyBillingItemDisplay(
            ConstNames.TAX_NAME_LODGING,
          );
          await billingPage.verifyBillingItemDisplay(
            ConstNames.INVENTORY_CHARGES_CHARGE_ITEM,
          );
          await billingPage.verifyBillingItemDisplay(
            ConstNames.DISCOUNT_FLAT_DISCOUNT,
          );
          await reservationPage.clickCloseButton();
        },
        { timeout: 60_000 },
      );

      const adrData =
        await reservationDbHelper.getDashboardAdrData(selectedDate);
      expect(
        adrData.reservedRooms,
        "The reservation's room should contribute to the ADR denominator.",
      ).toBeGreaterThan(0);
      expect(
        adrData.roomRevenue,
        "ADR room revenue should be calculated from room rates and extra-person room charges only.",
      ).toBeGreaterThan(0);
      const expectedAdr =
        Math.round((adrData.roomRevenue / adrData.reservedRooms) * 100) / 100;

      await test.step("Compare room-only ADR with the Dashboard KPI", async () => {
        await dashboardPage.openTodayPerformanceMetrics();
        expect(
          await reservationDbHelper.getDashboardBusinessDate(),
          "The business date changed during the non-room revenue ADR comparison; rerun for a single date.",
        ).toBe(selectedDate);
        await dashboardPage.verifyReservedRoomsAdr(expectedAdr);
      });
    } catch (error) {
      failed = true;
      throw error;
    } finally {
      if (createdConfirmationNumber && !failed) {
        await reservationApi.deleteReservation(createdConfirmationNumber);
      }
    }
  });

  // ========= Guest Count =========
  test("Verify Total Guests count after switching to Tomorrow", async ({
    dashboardPage,
    reservationDbHelper,
    layoutPage,
    findReservationPage,
    reservationPage,
    reservationApi,
  }) => {
    const selectedDate = await reservationDbHelper.getDashboardBusinessDate(1);
    let createdConfirmationNumber: string | undefined;

    try {
      await test.step("Open Dashboard with Today selected and wait for metrics to load", async () => {
        await dashboardPage.openTodayPerformanceMetrics();
      });

      const existingGuestCount = await reservationDbHelper.getDashboardTotalGuestCount(selectedDate);
      if (existingGuestCount === 0) {
        await test.step(`Create an arrival reservation for Tomorrow (${selectedDate})`, async () => {
          await layoutPage.clickReservationListIcon();
          createdConfirmationNumber = await reservationPage.createArrivalReservation(
            findReservationPage,
            selectedDate,
            confirmationNumber => {
              createdConfirmationNumber = confirmationNumber;
            },
          );
          await reservationPage.clickCloseButton();
        }, { timeout: 60_000 });
      } else {
      }

      await test.step("Switch to Tomorrow and wait for its metrics to load", async () => {
        await dashboardPage.selectTomorrowPerformanceMetrics();
      });

      const displayedCount = await test.step("Capture Total Guests with Tomorrow selected", async () => {
        return dashboardPage.getTotalGuestsCount();
      });

      const databaseCount = await test.step("Retrieve TotalGuest for Tomorrow's arrivals and stayovers", async () => {
        return reservationDbHelper.getDashboardTotalGuestCount(selectedDate);
      });

      await test.step("Compare Tomorrow Total Guests with the database count", async () => {
        expect(await reservationDbHelper.getDashboardBusinessDate(1),
          "The business date changed during the Tomorrow guest-count comparison; rerun for a single date.",
        ).toBe(selectedDate);
        expect(displayedCount,
          `Tomorrow Total Guests should match arrivals and stayovers from the database on ${selectedDate}.`,
        ).toBe(databaseCount);
      });
    } finally {
      if (createdConfirmationNumber) {
        await reservationApi.deleteReservation(createdConfirmationNumber);
      }
    }
  });

  test("Verify Total Guests count for Today", async ({
    dashboardPage,
    reservationDbHelper,
    layoutPage,
    findReservationPage,
    reservationPage,
    reservationApi,
  }) => {
    // The PMS fixture authenticates with the configured property's credentials.
    const selectedDate = await reservationDbHelper.getDashboardBusinessDate();

    let createdConfirmationNumber: string | undefined;
    try {
      await test.step("Navigate to Dashboard, verify Today is selected, and wait for metrics to load", async () => {
        await dashboardPage.openTodayPerformanceMetrics();
      });

      const existingGuestCount = await reservationDbHelper.getDashboardTotalGuestCount(selectedDate);
      if (existingGuestCount === 0) {
        await test.step(`Create an arrival reservation for Today (${selectedDate})`, async () => {
          await layoutPage.clickReservationListIcon();
          createdConfirmationNumber = await reservationPage.createArrivalReservation(
            findReservationPage,
            selectedDate,
            confirmationNumber => {
              createdConfirmationNumber = confirmationNumber;
            },
          );
          await reservationPage.clickCloseButton();
        }, { timeout: 60_000 });
        await dashboardPage.openTodayPerformanceMetrics();
      }

    const displayedCount =
      await test.step("Capture Total Guests displayed on the Dashboard", async () => {
        return dashboardPage.getTotalGuestsCount();
      });

    const databaseCount =
      await test.step("Retrieve TotalGuest for Today's arrivals and stayovers from the database", async () => {
        return reservationDbHelper.getDashboardTotalGuestCount(selectedDate);
      });

      await test.step("Compare Dashboard Total Guests with the database count", async () => {
      expect(
        await reservationDbHelper.getDashboardBusinessDate(),
        "The business date changed during the guest-count comparison; rerun for a single date.",
      ).toBe(selectedDate);
      expect(
        displayedCount,
        `Dashboard Total Guests should match TotalGuest from the database on ${selectedDate}.`,
      ).toBe(databaseCount);
      });
    } finally {
      if (createdConfirmationNumber) {
        await reservationApi.deleteReservation(createdConfirmationNumber);
      }
    }
  });

  test("Verify Total Guests count after returning from Tomorrow to Today", async ({
    dashboardPage,
  }) => {
    await test.step("Open Dashboard with Today selected and wait for metrics to load", async () => {
      await dashboardPage.openTodayPerformanceMetrics();
    });

    const initialTodayCount = await test.step("Capture the initial Today Total Guests value", async () => {
      return dashboardPage.getTotalGuestsCount();
    });

    await test.step("Switch to Tomorrow", async () => {
      await dashboardPage.selectTomorrowPerformanceMetrics();
    });

    await test.step("Switch back to Today and wait for dashboard data to reload", async () => {
      await dashboardPage.refreshToday();
    });

    const returnedTodayCount = await test.step("Capture Today Total Guests after returning", async () => {
      return dashboardPage.getTotalGuestsCount();
    });

    expect(returnedTodayCount,
      "Today Total Guests should remain unchanged after switching to Tomorrow and returning to Today.",
    ).toBe(initialTodayCount);
  });

  test("Verify Total Guests when there are no guests", async ({
    dashboardPage,
    reservationDbHelper,
  }) => {
    const selectedDate = await reservationDbHelper.getDashboardBusinessDate();
    const databaseGuestCount = await test.step("Prepare and verify zero applicable guests for Today", async () => {
      const count = await reservationDbHelper.getDashboardTotalGuestCount(selectedDate);
      expect(count, `Today must have no applicable guests for the zero-guest scenario on ${selectedDate}.`)
        .toBe(0);
      return count;
    });

    await test.step("Open Dashboard with Today selected", async () => {
      await dashboardPage.openTodayPerformanceMetrics();
    });

    const displayedCount = await test.step("Capture Today Total Guests", async () => {
      return dashboardPage.getTotalGuestsCount();
    });

    expect(databaseGuestCount).toBe(0);
    expect(displayedCount, "Total Guests should display zero when there are no applicable guests.")
      .toBe(0);
  });

  test("TC-DASH-GUEST-005: Verify Total Guests with multiple reservations", async ({
    dashboardPage, reservationDbHelper, layoutPage, findReservationPage, reservationPage, reservationApi,
  }) => {
    const date = await reservationDbHelper.getDashboardBusinessDate();
    const created: string[] = [];
    try {
      await dashboardPage.openTodayPerformanceMetrics();
      for (let i = 0; i < 2; i++) {
        await layoutPage.clickReservationListIcon();
        const confirmation = await reservationPage.createArrivalReservation(findReservationPage, date, n => created.push(n));
        if (!created.includes(confirmation)) created.push(confirmation);
        await reservationPage.clickCloseButton();
      }
      await dashboardPage.openTodayPerformanceMetrics();
      const expected = await reservationDbHelper.getDashboardTotalGuestCount(date);
      expect(await dashboardPage.getTotalGuestsCount()).toBe(expected);
    } finally { for (const n of created) await reservationApi.deleteReservation(n); }
  });

  test("TC-DASH-GUEST-008: Verify Total Guests after adding a new applicable reservation", async ({
    dashboardPage, reservationDbHelper, layoutPage, findReservationPage, reservationPage, reservationApi,
  }) => {
    const date = await reservationDbHelper.getDashboardBusinessDate();
    let created: string | undefined;
    try {
      await dashboardPage.openTodayPerformanceMetrics();
      await layoutPage.clickReservationListIcon();
      created = await reservationPage.createArrivalReservation(findReservationPage, date);
      await reservationPage.clickCloseButton();
      await dashboardPage.openTodayPerformanceMetrics();
      expect(await dashboardPage.getTotalGuestsCount()).toBe(await reservationDbHelper.getDashboardTotalGuestCount(date));
    } finally { if (created) await reservationApi.deleteReservation(created); }
  });

  test("TC-DASH-GUEST-009: Verify Total Guests after deleting an applicable reservation", async ({
    dashboardPage, reservationDbHelper, layoutPage, findReservationPage, reservationPage, reservationApi,
  }) => {
    const date = await reservationDbHelper.getDashboardBusinessDate();
    let created: string | undefined;
    try {
      await dashboardPage.openTodayPerformanceMetrics();
      await layoutPage.clickReservationListIcon();
      created = await reservationPage.createArrivalReservation(findReservationPage, date);
      await reservationPage.clickCloseButton();
      await reservationApi.deleteReservation(created);
      created = undefined;
      await dashboardPage.openTodayPerformanceMetrics();
      expect(await dashboardPage.getTotalGuestsCount()).toBe(await reservationDbHelper.getDashboardTotalGuestCount(date));
    } finally { if (created) await reservationApi.deleteReservation(created); }
  });
});
