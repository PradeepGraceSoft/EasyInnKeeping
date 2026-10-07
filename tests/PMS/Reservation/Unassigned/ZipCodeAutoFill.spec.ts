import { test } from "../../../../src/fixtures/sso.fixture";
import { verifyZipCodeAutoFill } from "../zipCodeAutoFill.workflow";

test.describe.configure({ timeout: 90_000 });

test.afterEach(async ({ setupDb }) => {
  await setupDb.disableUnassignedRoomReservations();
  await setupDb.verifyUnassignedRoomReservationSettings(false);
});

test("ZipCodeAutoFill works for Unassigned reservations @ZipCodeAutoFill", async ({
  ssoLoginPage,
  reservationPage,
  findReservationPage,
  reservationDbHelper,
  setupDb,
}) => {
  // This must execute before verifyZipCodeAutoFill performs the property login,
  // because the application loads these settings during login.
  await setupDb.enableUnassignedRoomReservations();
  await setupDb.verifyUnassignedRoomReservationSettings(true);

  try {
    await verifyZipCodeAutoFill("Unassigned", {
      ssoLoginPage,
      reservationPage,
      findReservationPage,
      reservationDbHelper,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw error;
  }
});
