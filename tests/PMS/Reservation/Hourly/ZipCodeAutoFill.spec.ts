import { test } from "../../../../src/fixtures/sso.fixture";
import { verifyZipCodeAutoFill } from "../zipCodeAutoFill.workflow";

test.describe.configure({ timeout: 90_000 });

test("ZipCodeAutoFill works for Hourly reservations @ZipCodeAutoFill", async ({
  ssoLoginPage, reservationPage, findReservationPage, reservationDbHelper,
}) => {
  await verifyZipCodeAutoFill("Hourly", { ssoLoginPage, reservationPage, findReservationPage, reservationDbHelper });
});
