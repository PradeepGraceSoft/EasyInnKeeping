import { test, expect } from "../../../src/fixtures/pms.fixture";
import { AlertMessages } from "../../../src/constants/AlertMessages";
import { ConstNames } from "../../../src/constants/ConstNames";

test.describe("Dashboard Revenue Summary", () => {
  test.describe.configure({ timeout: 180_000 });
  test("Verify Room Revenue non-exempt for the selected date", async ({
    dashboardPage,
    reservationDbHelper,
  }) => {
    // Keep this report focused on Revenue Summary evidence only.
    test.info().annotations = [];
    test.info().annotations.push({
      type: "Revenue Summary",
      description:
        "Verify non-exempt room revenue for the selected date, including arrivals and stayovers.",
    });
    for (const day of ["Today", "Tomorrow"] as const) {
      const selectedDate = await reservationDbHelper.getDashboardBusinessDate(day === "Tomorrow" ? 1 : 0);
      await test.step(`Open Dashboard with ${day} selected`, async () => {
        await dashboardPage.openForDay(day);
      });
      const expectedRevenue = await test.step(`Sum non-exempt RoomRate for ${day}`, () =>
        reservationDbHelper.getDashboardNonExemptRoomRevenue(selectedDate));
      await test.step(`Verify non-exempt revenue for ${day}`, async () => {
      expect(
        await reservationDbHelper.getDashboardBusinessDate(day === "Tomorrow" ? 1 : 0),
        "The business date changed during the revenue comparison; rerun for a single date.",
      ).toBe(selectedDate);
      await dashboardPage.verifyNonExemptRoomRevenue(expectedRevenue);
      test.info().annotations.push({
        type: "Revenue Summary",
        description: `Selected date ${selectedDate}; expected non-exempt room revenue $${expectedRevenue.toFixed(2)} matched the dashboard.`,
      });
      test.info().annotations = test
        .info()
        .annotations.filter(({ type }) => type === "Revenue Summary");
      });
    }
  });

  test("Verify Room Revenue exempt for the selected date", async ({
    dashboardPage,
    reservationDbHelper,
    findReservationPage,
    reservationPage,
    billingPage,
    reservationApi,
    layoutPage,
  }) => {
    test.info().annotations = [{
      type: "Revenue Summary",
      description: "RV-02: Verify tax-exempt room revenue for the selected date.",
    }];
    for (const day of ["Today", "Tomorrow"] as const) {
      const selectedDate = await reservationDbHelper.getDashboardBusinessDate(day === "Tomorrow" ? 1 : 0);
      let confirmation: string | undefined;
      try {
      await test.step(`Navigate to Reservations for ${day}`, async () => {
        await layoutPage.clickReservationListIcon();
      });
      await test.step("Create a reservation for the selected date", async () => {
        confirmation = await reservationPage.createArrivalReservation(findReservationPage, selectedDate);
      });
      await test.step("Mark the room charge tax exempt in Billing", async () => {
        await billingPage.clickBillingTab();
        await billingPage.selectLineItemTaxExemptCheckbox();
        await reservationPage.verifyAlertMessage(AlertMessages.BILLING_SAVED_SUCCESS);
        // Close the reservation dialog before navigating to the dashboard.
        await reservationPage.clickCloseButton();
      });
      const expectedRevenue = await reservationDbHelper.getDashboardExemptRoomRevenue(selectedDate);
      await dashboardPage.openForDay(day);
      await dashboardPage.verifyExemptRoomRevenue(expectedRevenue);
      test.info().annotations.push({
        type: "Revenue Summary",
        description: `Selected date ${selectedDate}; expected exempt room revenue $${expectedRevenue.toFixed(2)} matched the dashboard.`,
      });
      } finally {
        if (confirmation) await reservationApi.deleteReservation(confirmation);
        test.info().annotations = test.info().annotations.filter(({ type }) => type === "Revenue Summary");
      }
    }
  });

  test("Verify Total Room Revenue", async ({
    dashboardPage,
    reservationDbHelper,
    findReservationPage,
    reservationPage,
    reservationApi,
    layoutPage,
    billingPage,
  }) => {
    test.info().annotations = [{
      type: "Revenue Summary",
      description: "RV-03: Verify Total Room Revenue equals exempt plus non-exempt room revenue.",
    }];
    for (const day of ["Today", "Tomorrow"] as const) {
      const selectedDate = await reservationDbHelper.getDashboardBusinessDate(day === "Tomorrow" ? 1 : 0);
      const confirmations: string[] = [];
      try {
        let nonExempt = await reservationDbHelper.getDashboardNonExemptRoomRevenue(selectedDate);
        let exempt = await reservationDbHelper.getDashboardExemptRoomRevenue(selectedDate);
        if (nonExempt === 0 || exempt === 0) {
          await layoutPage.clickReservationListIcon();
          if (nonExempt === 0) {
            confirmations.push(await reservationPage.createArrivalReservation(findReservationPage, selectedDate));
            await reservationPage.clickCloseButton();
          }
          if (exempt === 0) {
            await layoutPage.clickReservationListIcon();
            confirmations.push(await reservationPage.createArrivalReservation(findReservationPage, selectedDate));
            await billingPage.clickBillingTab();
            await billingPage.selectLineItemTaxExemptCheckbox();
            await reservationPage.verifyAlertMessage(AlertMessages.BILLING_SAVED_SUCCESS);
            await reservationPage.clickCloseButton();
          }
        }
        const total = await reservationDbHelper.getDashboardTotalRoomRevenue(selectedDate);
        nonExempt = await reservationDbHelper.getDashboardNonExemptRoomRevenue(selectedDate);
        exempt = await reservationDbHelper.getDashboardExemptRoomRevenue(selectedDate);
        expect(total).toBe(Number((nonExempt + exempt).toFixed(2)));
        await dashboardPage.openForDay(day);
        await dashboardPage.verifyTotalRoomRevenue(total);
        test.info().annotations.push({
          type: "Revenue Summary",
          description: `${day} ${selectedDate}: total $${total.toFixed(2)} = non-exempt $${nonExempt.toFixed(2)} + exempt $${exempt.toFixed(2)}.`,
        });
      } finally {
        for (const confirmation of confirmations) await reservationApi.deleteReservation(confirmation);
        test.info().annotations = test.info().annotations.filter(({ type }) => type === "Revenue Summary");
      }
    }
  });
  test("Verify Other Revenue", async ({ dashboardPage, reservationDbHelper, findReservationPage, reservationPage, reservationApi, layoutPage, billingPage, setupDb }) => {
    test.info().annotations = [{ type: "Revenue Summary", description: "RV-04: Verify Other Revenue." }];
    for (const day of ["Today", "Tomorrow"] as const) {
      const date = await reservationDbHelper.getDashboardBusinessDate(day === "Tomorrow" ? 1 : 0);
      let confirmation: string | undefined;
      try {
        let expected = await reservationDbHelper.getDashboardOtherRevenue(date);
        if (expected === 0) {
          await layoutPage.clickReservationListIcon();
          confirmation = await reservationPage.createArrivalReservation(findReservationPage, date);
          await billingPage.clickBillingTab();
          const [year, month, dayOfMonth] = date.split("-");
          await billingPage.enterBillingInvoiceDate(`${Number(month)}/${Number(dayOfMonth)}/${year}`);
          await billingPage.enterChargesDiscountAccountCode(await setupDb.requireInventoryItemAccountCode(ConstNames.INVENTORY_CHARGES_CHARGE_ITEM));
          await billingPage.clickChargesDiscountSave();
          await reservationPage.verifyAlertMessage(AlertMessages.BILLING_SAVED_SUCCESS);
          await reservationPage.clickCloseButton();
          expected = await reservationDbHelper.getDashboardOtherRevenue(date);
        }
        await dashboardPage.openForDay(day);
        await dashboardPage.verifyOtherRevenue(expected);
        test.info().annotations.push({ type: "Revenue Summary", description: `${day} ${date}: Other Revenue $${expected.toFixed(2)} matched.` });
      } finally {
        if (confirmation) await reservationApi.deleteReservation(confirmation);
        test.info().annotations = test.info().annotations.filter(({ type }) => type === "Revenue Summary");
      }
    }
  });

  test("Verify Discount", async ({ dashboardPage, reservationDbHelper, findReservationPage, reservationPage, reservationApi, layoutPage, billingPage, setupDb }) => {
    test.info().annotations = [{ type: "Revenue Summary", description: "RV-05: Verify applicable discounts for the selected date." }];
    for (const day of ["Today", "Tomorrow"] as const) {
      const date = await reservationDbHelper.getDashboardBusinessDate(day === "Tomorrow" ? 1 : 0);
      let confirmation: string | undefined;
      try {
        let expectedDiscount = await reservationDbHelper.getDashboardDiscount(date);
        if (expectedDiscount === 0) {
          await layoutPage.clickReservationListIcon();
          confirmation = await reservationPage.createArrivalReservation(findReservationPage, date);
          await billingPage.clickBillingTab();
          const [year, month, dayOfMonth] = date.split("-");
          await billingPage.enterBillingInvoiceDate(`${Number(month)}/${Number(dayOfMonth)}/${year}`);
          const accountCode = await setupDb.requireInventoryItemAccountCode(ConstNames.DISCOUNT_FLAT_DISCOUNT);
          await billingPage.enterChargesDiscountAccountCode(accountCode);
          await billingPage.enterChargesDiscountAmountTextbox("20");
          await billingPage.clickChargesDiscountSave();
          await reservationPage.verifyAlertMessage(AlertMessages.BILLING_SAVED_SUCCESS);
          await reservationPage.clickCloseButton();
          expectedDiscount = await reservationDbHelper.getDashboardDiscount(date);
        }
        await dashboardPage.openForDay(day);
        await dashboardPage.verifyDiscount(expectedDiscount);
        test.info().annotations.push({ type: "Revenue Summary", description: `${day} ${date}: Discount $${expectedDiscount.toFixed(2)} matched.` });
      } finally {
        if (confirmation) await reservationApi.deleteReservation(confirmation);
        test.info().annotations = test.info().annotations.filter(({ type }) => type === "Revenue Summary");
      }
      test.info().annotations = test.info().annotations.filter(({ type }) => type === "Revenue Summary");
    }
  });

  test("RV-06 Verify Total Revenue calculation", async ({ dashboardPage, reservationDbHelper }) => {
    test.info().annotations = [{ type: "Revenue Summary", description: "RV-06: Verify Total Revenue = Total Room Revenue + Other Revenue - Discount." }];
    for (const day of ["Today", "Tomorrow"] as const) {
      const date = await reservationDbHelper.getDashboardBusinessDate(day === "Tomorrow" ? 1 : 0);
      const room = await reservationDbHelper.getDashboardTotalRoomRevenue(date);
      const other = await reservationDbHelper.getDashboardOtherRevenue(date);
      const discount = await reservationDbHelper.getDashboardDiscount(date);
      const expected = Number((room + other - discount).toFixed(2));
      await dashboardPage.openForDay(day);
      await dashboardPage.verifyTotalRevenue(expected);
      test.info().annotations.push({ type: "Revenue Summary", description: `${day} ${date}: ${room.toFixed(2)} + ${other.toFixed(2)} - (${discount.toFixed(2)}) = ${expected.toFixed(2)}.` });
      test.info().annotations = test.info().annotations.filter(({ type }) => type === "Revenue Summary");
    }
  });

  test("RV-16 Cancelled reservation has revenue", async ({ dashboardPage, reservationDbHelper, findReservationPage, reservationPage, reservationApi, layoutPage }) => {
    test.info().annotations = [{ type: "Revenue Summary", description: "RV-16: Cancelled reservation revenue is excluded." }];
    for (const day of ["Today", "Tomorrow"] as const) {
      const date = await reservationDbHelper.getDashboardBusinessDate(day === "Tomorrow" ? 1 : 0);
      let confirmation: string | undefined;
      try {
        await layoutPage.clickReservationListIcon();
        confirmation = await reservationPage.createArrivalReservation(findReservationPage, date);
        const beforeCancellation = await reservationDbHelper.getDashboardTotalRoomRevenue(date);
        await reservationPage.clickCancelReservation();
        await reservationPage.clickCloseButton();
        const afterCancellation = await reservationDbHelper.getDashboardTotalRoomRevenue(date);
        expect(afterCancellation).toBeLessThanOrEqual(beforeCancellation);
        await dashboardPage.openForDay(day);
        await dashboardPage.verifyTotalRoomRevenue(afterCancellation);
        test.info().annotations.push({ type: "Revenue Summary", description: `${day} ${date}: cancelled reservation revenue excluded; dashboard total room revenue is $${afterCancellation.toFixed(2)}.` });
      } finally {
        if (confirmation) await reservationApi.deleteReservation(confirmation);
        test.info().annotations = test.info().annotations.filter(({ type }) => type === "Revenue Summary");
      }
    }
  });
});
