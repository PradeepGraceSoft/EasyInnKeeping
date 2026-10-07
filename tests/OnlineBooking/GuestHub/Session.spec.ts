import { test } from "../../../src/fixtures/sso.fixture";
import { GmailHelper } from "../../../src/utils/GmailHelper";
import { GuestDatabaseHelper } from "../../../src/utils/DBHelper/GuestDatabaseHelper";
import { OnlineBookingPage } from "../../../src/pages/OnlineBookingPage";
import { GuestHubPage } from "../../../src/pages/GuestHubPage";
import { ReservationApi } from "../../../src/api/ReservationApi";

type GuestHubReservation = {
  email: string;
  confirmationNumber: string;
};

const reservationsToDelete = new Map<string, string[]>();
test.describe("Guest Hub - 12-hour session management", () => {
  test.setTimeout(420_000);
  test.describe.configure({ mode: "parallel" });

  test.beforeAll(async ({ guestDb }) => {
    if (!(await guestDb.isGuestHubEnabled())) {
      throw new Error(
        "Guest Hub must be enabled for property 5652 before running the session tests.",
      );
    }
    if (!(await guestDb.isSelfCheckInEnabled())) {
      throw new Error(
        "Self check-in must be enabled for property 5652 before running the session tests.",
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

  test("creates a session that remains active for up to 12 hours after OTP authentication", async ({
    guestHubPage,
    guestDb,
    onlineBookingPage,
    reservationApi,
  }) => {
    let testFailed = false;
    try {
      const reservation = await createGuestHubReservation(
        onlineBookingPage,
        guestDb,
      );
      await loginGuestHub(guestHubPage, guestDb, reservation);

      const requestDate = await guestDb.getGuestHubOtpRequestDate(
        reservation.confirmationNumber,
      );
      if (
        requestDate.getTime() <= Date.now() - 12 * 60 * 60 * 1000 ||
        requestDate.getTime() > Date.now()
      ) {
        throw new Error(
          "The Guest Hub session did not record an OTP request time within the active 12-hour session window.",
        );
      }
      await guestHubPage.verifyGuestHubAccessGranted(
        reservation.confirmationNumber,
      );
    } catch (error) {
      testFailed = true;
      throw error;
    } finally {
      if (!testFailed) {
        await deleteTestReservations(reservationApi, test.info().testId);
      }
    }
  });

  test("Verify if valid session can able to access all the pages", async ({
    guestHubPage,
    guestDb,
    onlineBookingPage,
    reservationApi,
  }) => {
    let testFailed = false;
    try {
      if (!(await guestDb.areGuestHubPaymentOptionsEnabled())) {
        await guestDb.enableGuestHubPaymentOptions();
        if (!(await guestDb.areGuestHubPaymentOptionsEnabled())) {
          throw new Error(
            "Could not enable Pay Amount Due, Pay Other Amount, and Purchase Cart Items before testing Guest Hub access.",
          );
        }
      }
      const reservation = await createGuestHubReservation(
        onlineBookingPage,
        guestDb,
      );
      await loginGuestHub(guestHubPage, guestDb, reservation);
      await guestHubPage.clickSelfCheckIn();
      await guestHubPage.open(await guestDb.getGuestHubUrlKey());
      await guestHubPage.clickPayAmountDue();
      await guestHubPage.open(await guestDb.getGuestHubUrlKey());
      await guestHubPage.clickPayOtherAmount();
      await guestHubPage.open(await guestDb.getGuestHubUrlKey());
      await guestHubPage.clickPurchaseCartItems();
      await guestHubPage.open(await guestDb.getGuestHubUrlKey());
      await guestHubPage.clickLogout();
      await guestHubPage.verifyLoginPageVisible();
    } catch (error) {
      testFailed = true;
      throw error;
    } finally {
      if (!testFailed)
        await deleteTestReservations(reservationApi, test.info().testId);
    }
  });

  test("Accessing pages after expired session after 12 hours should displays a timeout message, and redirects to login", async ({
    guestHubPage,
    guestDb,
    onlineBookingPage,
    reservationApi,
  }) => {
    let testFailed = false;
    try {
      const reservation = await createGuestHubReservation(
        onlineBookingPage,
        guestDb,
      );
      await loginGuestHub(guestHubPage, guestDb, reservation);

      await guestHubPage.expireGuestHubToken();
      await guestHubPage.clickSelfCheckIn();
      await guestHubPage.verifySessionTimeoutMessage();
      await guestHubPage.verifyLoginPageVisible();

      await loginGuestHub(guestHubPage, guestDb, reservation);
      await guestHubPage.expireGuestHubToken();
      await guestHubPage.clickPayAmountDue();
      await guestHubPage.verifySessionTimeoutMessage();
      await guestHubPage.verifyLoginPageVisible();

      await loginGuestHub(guestHubPage, guestDb, reservation);
      await guestHubPage.expireGuestHubToken();
      await guestHubPage.clickPayOtherAmount();
      await guestHubPage.verifySessionTimeoutMessage();
      await guestHubPage.verifyLoginPageVisible();

      await loginGuestHub(guestHubPage, guestDb, reservation);
      await guestHubPage.expireGuestHubToken();
      await guestHubPage.clickPurchaseCartItems();
      await guestHubPage.verifySessionTimeoutMessage();
      await guestHubPage.verifyLoginPageVisible();
    } catch (error) {
      testFailed = true;
      throw error;
    } finally {
      if (!testFailed)
        await deleteTestReservations(reservationApi, test.info().testId);
    }
  });

  test("Should prevent access to protected pages after logout", async ({
    guestHubPage,
    guestDb,
    onlineBookingPage,
    reservationApi,
  }) => {
    let testFailed = false;
    try {
      const reservation = await createGuestHubReservation(
        onlineBookingPage,
        guestDb,
      );
      await loginGuestHub(guestHubPage, guestDb, reservation);

      await guestHubPage.clickLogout();
      await guestHubPage.verifyLoginPageVisible();

      const protectedPaths = [
        "register/A3399A5652A1857A/A1456A1498A5466A/CartShopA2466A",
        "register/A3399A5652A1857A/A1456A1498A5466A/CheckInA2466A",
        "register/A3399A5652A1857A/A1456A1498A5466A",
        "register/A3399A5652A1857A/A1456A1498A5466A/OnlineDepositA2466A",
      ];

      for (const protectedPath of protectedPaths) {
        await guestHubPage.openProtectedPath(protectedPath);
        await guestHubPage.verifySessionTimeoutMessage();
        await guestHubPage.verifyLoginPageVisible();
      }
    } catch (error) {
      testFailed = true;
      throw error;
    } finally {
      if (!testFailed)
        await deleteTestReservations(reservationApi, test.info().testId);
    }
  });

  test("Should enforce session expiration across Guest Hub pages", async ({
    guestHubPage,
    guestDb,
    onlineBookingPage,
    reservationApi,
  }) => {
    let testFailed = false;
    try {
      const reservation = await createGuestHubReservation(
        onlineBookingPage,
        guestDb,
      );
      await loginGuestHub(guestHubPage, guestDb, reservation);

      const protectedPaths = [
        "register/A3399A5652A1857A/A1456A1498A5466A/CartShopA2466A",
        "register/A3399A5652A1857A/A1456A1498A5466A/CheckInA2466A",
        "register/A3399A5652A1857A/A1456A1498A5466A",
        "register/A3399A5652A1857A/A1456A1498A5466A/OnlineDepositA2466A",
      ];

      for (const protectedPath of protectedPaths) {
        await guestHubPage.openProtectedPath(protectedPath);
        await guestHubPage.verifyGuestHubAccessGranted(
          reservation.confirmationNumber,
        );
      }
    } catch (error) {
      testFailed = true;
      throw error;
    } finally {
      if (!testFailed)
        await deleteTestReservations(reservationApi, test.info().testId);
    }
  });

  test("requires the email and OTP authentication flow again after session expiration", async ({
    guestHubPage,
    guestDb,
    onlineBookingPage,
    reservationApi,
  }) => {
    let testFailed = false;
    try {
      const reservation = await createGuestHubReservation(
        onlineBookingPage,
        guestDb,
      );
      await loginGuestHub(guestHubPage, guestDb, reservation);

      await guestHubPage.expireGuestHubToken();
      await guestHubPage.clickSelfCheckIn();
      await guestHubPage.verifySessionTimeoutMessage();
      await guestHubPage.verifyLoginPageVisible();

      await authenticateGuestHub(guestHubPage, guestDb, reservation);
      await guestHubPage.verifyGuestHubAccessGranted(
        reservation.confirmationNumber,
      );
    } catch (error) {
      testFailed = true;
      throw error;
    } finally {
      if (!testFailed)
        await deleteTestReservations(reservationApi, test.info().testId);
    }
  });
});

async function createGuestHubReservation(
  onlineBookingPage: OnlineBookingPage,
  guestDb: GuestDatabaseHelper,
): Promise<GuestHubReservation> {
  const email = GmailHelper.createUniqueRecipient("guest-hub-session");
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
  test.info().annotations.push({
    type: "reservation",
    description: confirmationNumber,
  });
  testReservations.push(confirmationNumber);
  const guestId = await guestDb.getGuestId(confirmationNumber);
  await guestDb.resetGuestHubOtpState(guestId);
  return { email, confirmationNumber };
}

async function deleteTestReservations(
  reservationApi: ReservationApi,
  testId: string,
): Promise<void> {
  for (const confirmationNumber of reservationsToDelete.get(testId) ?? []) {
    await reservationApi.deleteReservation(confirmationNumber);
  }
  reservationsToDelete.delete(testId);
}

async function loginGuestHub(
  guestHubPage: GuestHubPage,
  guestDb: GuestDatabaseHelper,
  reservation: GuestHubReservation,
): Promise<void> {
  await authenticateGuestHub(guestHubPage, guestDb, reservation);
  await guestHubPage.verifyGuestHubAccessGranted(
    reservation.confirmationNumber,
  );
}

async function authenticateGuestHub(
  guestHubPage: GuestHubPage,
  guestDb: GuestDatabaseHelper,
  reservation: GuestHubReservation,
): Promise<void> {
  await guestHubPage.open(await guestDb.getGuestHubUrlKey());
  await guestHubPage.enterBookingNumber(reservation.confirmationNumber);
  await guestHubPage.enterRegisteredEmail(reservation.email);
  await guestHubPage.clickValidateGuest();
  await guestHubPage.verifyOtpInputVisible();
  const otp = await guestDb.getGuestHubOtp(reservation.confirmationNumber);
  await guestHubPage.enterOtp(otp);
  await guestHubPage.clickVerifyOtp();
}
