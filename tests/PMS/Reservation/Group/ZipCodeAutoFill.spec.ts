import { test } from "../../../../src/fixtures/sso.fixture";
import { verifyZipCodeAutoFill } from "../zipCodeAutoFill.workflow";

test.describe.configure({ timeout: 90_000 });

test("ZipCodeAutoFill works for Group reservations @ZipCodeAutoFill", async ({
  ssoLoginPage, reservationPage, findReservationPage, reservationDbHelper,
}) => {
  await verifyZipCodeAutoFill("Group", { ssoLoginPage, reservationPage, findReservationPage, reservationDbHelper });
});
