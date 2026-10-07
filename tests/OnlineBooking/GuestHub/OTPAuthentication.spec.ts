import { test } from "../../../src/fixtures/sso.fixture";
import { GmailHelper } from "../../../src/utils/GmailHelper";
import { GuestDatabaseHelper } from "../../../src/utils/DBHelper/GuestDatabaseHelper";
import { OnlineBookingPage } from "../../../src/pages/OnlineBookingPage";
import { GuestHubPage } from "../../../src/pages/GuestHubPage";

type GuestHubReservation = {
  email: string;
  confirmationNumber: string;
  guestId: number;
};

const reservationsToDelete = new Map<string, string[]>();
const GUEST_HUB_TEST_EMAIL = "tester1gracesoft@gmail.com";

test.describe("Guest Hub Login - OTP Authentication", () => {
  test.setTimeout(420_000);
  test.describe.configure({ mode: "parallel" });

  test.beforeAll(async ({ guestDb }) => {
    await guestDb.enableGuestHub();
    if (!(await guestDb.isGuestHubEnabled())) {
      throw new Error(
        "The Guest Hub test setup did not enable Guest Hub for property 5652 after the configuration update.",
      );
    }
    if (!(await guestDb.isSelfCheckInEnabled())) {
      throw new Error(
        "The Guest Hub test setup did not enable self check-in for property 5652 after the configuration update.",
      );
    }
  });

  test.beforeEach(async ({ guestDb }, testInfo) => {
    reservationsToDelete.set(testInfo.testId, []);
    if (!(await guestDb.isGuestHubEnabled())) {
      throw new Error(
        "The Guest Hub test environment did not enable Guest Hub before the test started.",
      );
    }
  });

  test.afterEach(async ({ reservationApi }, testInfo) => {
    for (const confirmationNumber of reservationsToDelete.get(
      testInfo.testId,
    ) ?? []) {
      await reservationApi.deleteReservation(confirmationNumber);
    }
    reservationsToDelete.delete(testInfo.testId);
  });

  test("validates a registered reservation email, generates an OTP, and sends it by email", async ({
    guestHubPage,
    guestDb,
    onlineBookingPage,
  }) => {
    const reservation = await createGuestHubReservation(
      onlineBookingPage,
      guestDb,
      GUEST_HUB_TEST_EMAIL,
    );
    const requestedAt = new Date();

    await guestHubPage.open(await guestDb.getGuestHubUrlKey());
    await guestHubPage.enterBookingNumber(reservation.confirmationNumber);
    await guestHubPage.enterRegisteredEmail(reservation.email);
    await guestHubPage.clickValidateGuest();
    await guestHubPage.verifyOtpInputVisible();
    const otp = await guestDb.getGuestHubOtp(reservation.confirmationNumber);

    await GmailHelper.verifyGuestHubOtpEmailReceived(
      reservation.email,
      otp,
      requestedAt,
    );
  });

  test("authenticates a guest with a valid OTP and opens the Guest Hub booking dashboard", async ({
    guestHubPage,
    guestDb,
    onlineBookingPage,
  }) => {
    const reservation = await createGuestHubReservation(
      onlineBookingPage,
      guestDb,
    );
    const otp = await requestOtp(guestHubPage, guestDb, reservation);

    await guestHubPage.enterOtp(otp);
    await guestHubPage.clickVerifyOtp();
    await guestHubPage.verifyGuestHubAccessGranted();
  });

  test("denies access when an invalid OTP is entered", async ({
    guestHubPage,
    guestDb,
    onlineBookingPage,
  }) => {
    const reservation = await createGuestHubReservation(
      onlineBookingPage,
      guestDb,
    );
    await requestOtp(guestHubPage, guestDb, reservation);

    await guestHubPage.enterOtp("000000");
    await guestHubPage.clickVerifyOtpExpectingAlert();
    await guestHubPage.verifyAccessDenied();
  });

  test("rejects a valid booking number paired with a different email address", async ({
    guestHubPage,
    guestDb,
    onlineBookingPage,
  }) => {
    const reservation = await createGuestHubReservation(
      onlineBookingPage,
      guestDb,
    );
    const differentEmail = "guest-hub-mismatch@example.com";

    await guestHubPage.open(await guestDb.getGuestHubUrlKey());
    await guestHubPage.enterBookingNumber(reservation.confirmationNumber);
    await guestHubPage.enterRegisteredEmail(differentEmail);
    await guestHubPage.clickValidateGuestExpectingAlert();
    await guestHubPage.verifyGuestValidationRejected();
  });

  test("rejects malformed numeric OTP values", async ({
    guestHubPage,
    guestDb,
    onlineBookingPage,
  }) => {
    const reservation = await createGuestHubReservation(
      onlineBookingPage,
      guestDb,
    );
    await requestOtp(guestHubPage, guestDb, reservation);

    for (const otp of ["12345", "1234567"]) {
      await guestHubPage.enterOtp(otp);
      await guestHubPage.clickVerifyOtpExpectingAlert();
      await guestHubPage.verifyAccessDenied();
    }
  });

  test("rejects an OTP after its 10-minute expiry", async ({
    guestHubPage,
    guestDb,
    onlineBookingPage,
  }) => {
    const expiryTestEmail = `guest-hub-otp-expiry-${test.info().workerIndex}-${Date.now()}@example.com`;
    const reservation = await createGuestHubReservation(
      onlineBookingPage,
      guestDb,
      expiryTestEmail,
    );
    const otp = await requestOtp(guestHubPage, guestDb, reservation);
    await guestDb.expireGuestHubOtp(reservation.confirmationNumber);

    await guestHubPage.enterOtp(otp);
    await guestHubPage.clickVerifyOtpExpectingAlert();
    await guestHubPage.verifyOtpAlertMessage(/^Invalid OTP\.$/i);
    await guestHubPage.verifyOtpInputVisible();
  });

  test("blocks OTP authentication after more than five failed attempts", async ({
    guestHubPage,
    guestDb,
    onlineBookingPage,
  }) => {
    const reservation = await createGuestHubReservation(
      onlineBookingPage,
      guestDb,
    );
    await requestOtp(guestHubPage, guestDb, reservation);

    for (let attempt = 0; attempt < 6; attempt += 1) {
      await guestHubPage.enterOtp("000000");
      await guestHubPage.clickVerifyOtpExpectingAlert();
    }
    await guestHubPage.verifyGuestLoginLocked();
  });

  test("allows a valid OTP before the failed-attempt lock threshold is reached", async ({
    guestHubPage,
    guestDb,
    onlineBookingPage,
  }) => {
    const preLockTestEmail = `guest-hub-pre-lock-${test.info().workerIndex}-${Date.now()}@example.com`;
    const reservation = await createGuestHubReservation(
      onlineBookingPage,
      guestDb,
      preLockTestEmail,
    );
    const otp = await requestOtp(guestHubPage, guestDb, reservation);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await guestHubPage.enterOtp("000000");
      await guestHubPage.clickVerifyOtpExpectingAlert();
      await guestHubPage.verifyAccessDenied();
    }
    await guestHubPage.enterOtp(otp);
    await guestHubPage.clickVerifyOtp();
    await guestHubPage.verifyGuestHubAccessGranted();
  });

  test("generates and emails a new OTP when the guest requests a resend", async ({
    guestHubPage,
    guestDb,
    onlineBookingPage,
  }) => {
    const reservation = await createGuestHubReservation(
      onlineBookingPage,
      guestDb,
    );
    const initialOtp = await requestOtp(guestHubPage, guestDb, reservation);

    await guestHubPage.clickResendOtp();
    await guestDb.getGuestHubOtp(reservation.confirmationNumber, initialOtp);
  });

  test("keeps resend unavailable during its cooldown", async ({
    guestHubPage,
    guestDb,
    onlineBookingPage,
  }) => {
    const reservation = await createGuestHubReservation(
      onlineBookingPage,
      guestDb,
    );
    await requestOtp(guestHubPage, guestDb, reservation);

    await guestHubPage.verifyResendOtpUnavailable();
  });

  test("prevents more than five OTP resend requests", async ({
    guestHubPage,
    guestDb,
    onlineBookingPage,
  }) => {
    const reservation = await createGuestHubReservation(
      onlineBookingPage,
      guestDb,
    );
    await requestOtp(guestHubPage, guestDb, reservation);

    for (let resend = 0; resend < 5; resend += 1) {
      await guestHubPage.clickResendOtp();
      await guestDb.setGuestHubOtpRequestDateToYesterday(
        reservation.confirmationNumber,
      );
    }
    await guestHubPage.clickResendOtpExpectingAlert();
    await guestHubPage.verifyOtpAlertMessage(
      /^Maximum OTP requests reached for today\.$/i,
    );
  });

  test("does not generate an OTP or allow login for an email without a reservation", async ({
    guestHubPage,
    guestDb,
  }) => {
    const email = "guest-hub-unregistered@example.com";
    await guestHubPage.open(await guestDb.getGuestHubUrlKey());
    await guestHubPage.enterBookingNumber("999999999");
    await guestHubPage.enterRegisteredEmail(email);
    await guestHubPage.clickValidateGuestExpectingAlert();

    await guestHubPage.verifyGuestValidationRejected();
  });

  test("validates the newly generated OTP and grants access", async ({
    guestHubPage,
    guestDb,
    onlineBookingPage,
  }) => {
    const reservation = await createGuestHubReservation(
      onlineBookingPage,
      guestDb,
    );
    const initialOtp = await requestOtp(guestHubPage, guestDb, reservation);
    await guestHubPage.clickResendOtp();
    const latestOtp = await guestDb.getGuestHubOtp(
      reservation.confirmationNumber,
      initialOtp,
    );

    await guestHubPage.enterOtp(latestOtp);
    await guestHubPage.clickVerifyOtp();
    await guestHubPage.verifyGuestHubAccessGranted();
  });

  test("refreshes OTP expiry after a resend", async ({
    guestHubPage,
    guestDb,
    onlineBookingPage,
  }) => {
    const reservation = await createGuestHubReservation(
      onlineBookingPage,
      guestDb,
    );
    const initialOtp = await requestOtp(guestHubPage, guestDb, reservation);
    await guestDb.expireGuestHubOtp(reservation.confirmationNumber);

    await guestHubPage.clickResendOtp();
    await guestDb.getGuestHubOtp(reservation.confirmationNumber, initialOtp);
    if (
      !(await guestDb.hasGuestHubOtpFutureExpiry(
        reservation.confirmationNumber,
      ))
    ) {
      throw new Error(
        "The Guest Hub OTP resend did not refresh the reservation OTP expiry to a future time.",
      );
    }
  });

  test("rejects a reused OTP after a new OTP is requested", async ({
    guestHubPage,
    guestDb,
    onlineBookingPage,
  }) => {
    const reservation = await createGuestHubReservation(
      onlineBookingPage,
      guestDb,
    );
    const oldOtp = await requestOtp(guestHubPage, guestDb, reservation);
    await guestHubPage.clickResendOtp();
    await guestHubPage.verifyOtpInputVisible();

    await guestHubPage.enterOtp(oldOtp);
    await guestHubPage.clickVerifyOtpExpectingAlert();
    await guestHubPage.verifyAccessDenied();
  });

  test("keeps OTPs isolated between reservations that share an email address", async ({
    guestHubPage,
    guestDb,
    onlineBookingPage,
  }) => {
    const email = GUEST_HUB_TEST_EMAIL;
    const firstReservation = await createGuestHubReservation(
      onlineBookingPage,
      guestDb,
      email,
    );
    const secondReservation = await createGuestHubReservation(
      onlineBookingPage,
      guestDb,
      email,
    );
    const firstOtp = await requestOtp(guestHubPage, guestDb, firstReservation);
    const secondOtp = await requestOtp(
      guestHubPage,
      guestDb,
      secondReservation,
    );

    await guestHubPage.enterOtp(firstOtp);
    await guestHubPage.clickVerifyOtpExpectingAlert();
    await guestHubPage.verifyAccessDenied();

    await guestHubPage.enterOtp(secondOtp);
    await guestHubPage.clickVerifyOtp();
    await guestHubPage.verifyGuestHubAccessGranted();
  });
});

async function createGuestHubReservation(
  onlineBookingPage: OnlineBookingPage,
  guestDb: GuestDatabaseHelper,
  email = `gh${test.info().parallelIndex}${Date.now()}@example.com`,
): Promise<GuestHubReservation> {
  const testReservations = reservationsToDelete.get(test.info().testId);
  if (!testReservations)
    throw new Error("Guest Hub reservation cleanup was not initialized.");
  const bookingOptionIndex =
    test.info().parallelIndex + testReservations.length;
  await onlineBookingPage.openHome();
  await onlineBookingPage.selectNextAvailableStay();
  await onlineBookingPage.clickSearchButton();
  await onlineBookingPage.clickBookButtonAt(bookingOptionIndex);
  await onlineBookingPage.clickCompleteBookingButton();
  await onlineBookingPage.enterGuestDetailsFor({
    firstName: "Guest",
    lastName: "Hub",
    email,
  });
  await onlineBookingPage.enterAuthorizeNetCardDetailsIfRequired();
  await onlineBookingPage.clickCompleteBookButton();
  const confirmationNumber = await onlineBookingPage.getConfirmationNumber();
  testReservations.push(confirmationNumber);
  const guestId = await guestDb.getGuestId(confirmationNumber);
  await guestDb.resetGuestHubOtpState(guestId);
  return { email, confirmationNumber, guestId };
}

async function requestOtp(
  guestHubPage: GuestHubPage,
  guestDb: GuestDatabaseHelper,
  reservation: GuestHubReservation,
): Promise<string> {
  const requestedAt = new Date();
  await guestHubPage.open(await guestDb.getGuestHubUrlKey());
  await guestHubPage.enterBookingNumber(reservation.confirmationNumber);
  await guestHubPage.enterRegisteredEmail(reservation.email);
  await guestHubPage.clickValidateGuest();
  await guestHubPage.verifyOtpInputVisible();
  const otp = await guestDb.getGuestHubOtp(reservation.confirmationNumber);
  return otp;
}
