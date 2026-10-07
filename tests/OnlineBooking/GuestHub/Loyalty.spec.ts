import { test, expect } from "../../../src/fixtures/sso.fixture";
import { OnlineBookingPage } from "../../../src/pages/OnlineBookingPage";
import { SSOUsers } from "../../../src/test-data/SSOUsers";

const LOYALTY_EMAIL = "tester1gracesoft@gmail.com";

test.describe("Guest Hub - Loyalty Rewards Widget", () => {
  test.setTimeout(420_000);

  test("LRW-001 displays the valid loyalty points balance and membership tier", async ({
    guestDb,
    guestHubPage,
    onlineBookingPage,
    reservationApi,
  }) => {
    let confirmationNumber = "";
    let testFailed = false;
    try {
      await guestDb.resetLoyaltyDataForGuest(LOYALTY_EMAIL);
      confirmationNumber = await createReservation(onlineBookingPage, LOYALTY_EMAIL, 3);
      test.info().annotations.push({ type: "reservation", description: confirmationNumber });
      const loyalty = await guestDb.getLoyaltyDataForReservation(confirmationNumber, LOYALTY_EMAIL);
      test.info().annotations.push({
        type: "loyalty",
        description: `${loyalty.points} Loyalty Points | ${loyalty.tier}`,
      });

      await guestHubPage.open(await guestDb.getGuestHubUrlKey());
      await guestHubPage.enterBookingNumber(confirmationNumber);
      await guestHubPage.enterRegisteredEmail(LOYALTY_EMAIL);
      await guestHubPage.clickValidateGuest();
      await guestHubPage.verifyOtpInputVisible();
      await guestHubPage.enterOtp(await guestDb.getGuestHubOtp(confirmationNumber));
      await guestHubPage.clickVerifyOtp();
      await guestHubPage.verifyGuestHubAccessGranted(confirmationNumber);
      await guestHubPage.verifyLoyaltyRewardsWidget(loyalty.points, loyalty.tier);
    } catch (error) {
      testFailed = true;
      throw error;
    } finally {
      if (!testFailed && confirmationNumber) {
        await reservationApi.deleteReservation(confirmationNumber);
      }
    }
  });

  test("verifies the loyalty tier progress bar and next-tier points", async ({
    guestDb,
    guestHubPage,
    onlineBookingPage,
    reservationApi,
  }) => {
    let confirmationNumber = "";
    let testFailed = false;
    try {
      await guestDb.resetLoyaltyDataForGuest(LOYALTY_EMAIL);
      confirmationNumber = await createReservation(onlineBookingPage, LOYALTY_EMAIL);
      test.info().annotations.push({ type: "reservation", description: confirmationNumber });
      const loyalty = await guestDb.getLoyaltyDataForReservation(confirmationNumber, LOYALTY_EMAIL);
      test.info().annotations.push({
        type: "loyalty",
        description: `${loyalty.points} Loyalty Points | ${loyalty.tier}`,
      });

      await guestHubPage.open(await guestDb.getGuestHubUrlKey());
      await guestHubPage.enterBookingNumber(confirmationNumber);
      await guestHubPage.enterRegisteredEmail(LOYALTY_EMAIL);
      await guestHubPage.clickValidateGuest();
      await guestHubPage.verifyOtpInputVisible();
      await guestHubPage.enterOtp(await guestDb.getGuestHubOtp(confirmationNumber));
      await guestHubPage.clickVerifyOtp();
      await guestHubPage.verifyGuestHubAccessGranted(confirmationNumber);
      const tiers = await guestDb.getLoyaltyTiers();
      const points = Number(loyalty.points);
      expect(Number.isFinite(points), "The guest must have a numeric points balance.").toBeTruthy();
      expect(tiers.filter(tier => points >= tier.minimumPoints && (tier.maximumPoints === null || points <= tier.maximumPoints)).map(tier => tier.name),
        "The guest's current tier must match the configured points range.").toEqual([loyalty.tier]);
      await guestHubPage.verifyLoyaltyTierProgressBar(loyalty.tier, points, tiers);
    } catch (error) {
      testFailed = true;
      throw error;
    } finally {
      if (!testFailed && confirmationNumber) {
        await reservationApi.deleteReservation(confirmationNumber);
      }
    }
  });

  test("verifies progress after the guest reaches the next loyalty tier", async ({
    guestDb,
    guestHubPage,
    onlineBookingPage,
    reservationApi,
  }) => {
    let confirmationNumber = "";
    let testFailed = false;
    try {
      await guestDb.resetLoyaltyDataForGuest(LOYALTY_EMAIL);
      confirmationNumber = await createReservation(onlineBookingPage, LOYALTY_EMAIL);
      test.info().annotations.push({ type: "reservation", description: confirmationNumber });

      const tiers = await guestDb.getLoyaltyTiers();
      const current = await guestDb.getLoyaltyDataForReservation(confirmationNumber, LOYALTY_EMAIL);
      const currentPoints = Number(current.points);
      const nextTier = tiers.find(tier => tier.minimumPoints > currentPoints);
      if (!nextTier) throw new Error("The loyalty test guest does not have a higher configured tier.");
      const followingTier = tiers.find(tier => tier.minimumPoints > nextTier.minimumPoints);
      if (!followingTier) throw new Error("A subsequent loyalty tier is required for this scenario.");

      const updated = await guestDb.getLoyaltyDataForReservation(confirmationNumber, LOYALTY_EMAIL);
      expect(updated.tier).toBe(nextTier.name);
      test.info().annotations.push({
        type: "loyalty",
        description: `${updated.points} Loyalty Points | ${updated.tier}`,
      });

      await guestHubPage.open(await guestDb.getGuestHubUrlKey());
      await guestHubPage.enterBookingNumber(confirmationNumber);
      await guestHubPage.enterRegisteredEmail(LOYALTY_EMAIL);
      await guestHubPage.clickValidateGuest();
      await guestHubPage.verifyOtpInputVisible();
      await guestHubPage.enterOtp(await guestDb.getGuestHubOtp(confirmationNumber));
      await guestHubPage.clickVerifyOtp();
      await guestHubPage.verifyGuestHubAccessGranted(confirmationNumber);
      await guestHubPage.verifyLoyaltyTierProgressBar(
        updated.tier,
        Number(updated.points),
        tiers,
        followingTier,
      );
    } catch (error) {
      testFailed = true;
      throw error;
    } finally {
      if (!testFailed && confirmationNumber) await reservationApi.deleteReservation(confirmationNumber);
    }
  });

  test("verifies the Platinum highest-tier loyalty progress", async ({
    guestDb,
    guestHubPage,
    onlineBookingPage,
    reservationApi,
  }) => {
    let confirmationNumber = "";
    let testFailed = false;
    try {
      await guestDb.resetLoyaltyDataForGuest(LOYALTY_EMAIL);
      confirmationNumber = await createReservation(onlineBookingPage, LOYALTY_EMAIL, 5);
      test.info().annotations.push({ type: "reservation", description: confirmationNumber });

      const tiers = await guestDb.getLoyaltyTiers();
      const platinum = tiers.find(tier => tier.name.toLowerCase() === "platinum");
      if (!platinum) throw new Error("The Platinum tier is required for the five-night loyalty scenario.");
      const loyalty = await guestDb.getLoyaltyDataForReservation(confirmationNumber, LOYALTY_EMAIL);
      expect(loyalty.tier).toBe(platinum.name);
      test.info().annotations.push({
        type: "loyalty",
        description: `${loyalty.points} Loyalty Points | ${loyalty.tier}`,
      });

      await guestHubPage.open(await guestDb.getGuestHubUrlKey());
      await guestHubPage.enterBookingNumber(confirmationNumber);
      await guestHubPage.enterRegisteredEmail(LOYALTY_EMAIL);
      await guestHubPage.clickValidateGuest();
      await guestHubPage.verifyOtpInputVisible();
      await guestHubPage.enterOtp(await guestDb.getGuestHubOtp(confirmationNumber));
      await guestHubPage.clickVerifyOtp();
      await guestHubPage.verifyGuestHubAccessGranted(confirmationNumber);
      await guestHubPage.verifyLoyaltyTierProgressBar(loyalty.tier, Number(loyalty.points), tiers);
    } catch (error) {
      testFailed = true;
      throw error;
    } finally {
      if (!testFailed && confirmationNumber) await reservationApi.deleteReservation(confirmationNumber);
    }
  });

  test("verifies loyalty points earned in the analytics chart", async ({
    guestDb,
    guestHubPage,
    onlineBookingPage,
    reservationApi,
  }) => {
    let confirmationNumber = "";
    let testFailed = false;
    try {
      await guestDb.resetLoyaltyDataForGuest(LOYALTY_EMAIL);
      await onlineBookingPage.openHome();
      await onlineBookingPage.selectNextAvailableStay(1);
      await onlineBookingPage.clickSearchButton();
      await onlineBookingPage.clickBookButtonAt(0);
      await onlineBookingPage.clickCompleteBookingButton();
      await onlineBookingPage.enterGuestDetailsFor({ firstName: "Grace", lastName: "Soft", email: LOYALTY_EMAIL });
      await onlineBookingPage.enterAuthorizeNetCardDetailsIfRequired();
      await onlineBookingPage.clickCompleteBookButton();
      confirmationNumber = await onlineBookingPage.getConfirmationNumber();
      const departureDate = await onlineBookingPage.getDepartureDate();
      test.info().annotations.push({ type: "reservation", description: confirmationNumber });

      const loyalty = await guestDb.getLoyaltyDataForReservation(confirmationNumber, LOYALTY_EMAIL);
      test.info().annotations.push({ type: "loyalty", description: `${loyalty.points} Loyalty Points | ${loyalty.tier}` });
      const expectedPoints = Number(loyalty.points);
      expect(Number.isFinite(expectedPoints), "The loyalty transaction points must be numeric.").toBeTruthy();

      await guestHubPage.open(await guestDb.getGuestHubUrlKey());
      await guestHubPage.enterBookingNumber(confirmationNumber);
      await guestHubPage.enterRegisteredEmail(LOYALTY_EMAIL);
      await guestHubPage.clickValidateGuest();
      await guestHubPage.verifyOtpInputVisible();
      await guestHubPage.enterOtp(await guestDb.getGuestHubOtp(confirmationNumber));
      await guestHubPage.clickVerifyOtp();
      await guestHubPage.verifyGuestHubAccessGranted(confirmationNumber);
      await guestHubPage.verifyLoyaltyAnalyticsPoints(departureDate, expectedPoints);
    } catch (error) {
      testFailed = true;
      throw error;
    } finally {
      if (!testFailed && confirmationNumber) await reservationApi.deleteReservation(confirmationNumber);
    }
  });

  test("verifies analytics data for the six completed months before the current month", async ({
    ssoLoginPage, reservationPage, findReservationPage, guestDb, guestHubPage, reservationApi,
  }) => {
    const reservations: string[] = [];
    const reservationArrivals: Array<{ confirmation: string; arrival: string }> = [];
    let testFailed = false;
    try {
      await ssoLoginPage.propertyLogin(SSOUsers.User1.propertyShortName, SSOUsers.User1.loginName, SSOUsers.User1.password);
      const today = new Date();
      const departureDates: string[] = [];
      for (let offset = 1; offset <= 6; offset += 1) {
        const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - offset, 15));
        const isoDate = date.toISOString().slice(0, 10);
        departureDates.push(isoDate);
        const confirmation = await reservationPage.createArrivalReservation(findReservationPage, isoDate, number => {
          reservations.push(number);
          reservationArrivals.push({ confirmation: number, arrival: isoDate });
          test.info().annotations.push({ type: "reservation", description: number });
        }, undefined, LOYALTY_EMAIL, offset);
        if (!reservations.includes(confirmation)) reservations.push(confirmation);
      }
      const expectedPoints: Record<string, number> = {};
      for (const reservation of reservationArrivals) {
        expectedPoints[reservation.arrival.slice(0, 7)] = (expectedPoints[reservation.arrival.slice(0, 7)] ?? 0) + await guestDb.getLoyaltyPointsForReservation(reservation.confirmation, LOYALTY_EMAIL);
      }
      test.info().annotations.push({ type: "loyalty", description: Object.entries(expectedPoints).map(([month, points]) => `${month}: ${points}`).join(" | ") });
      const latestReservation = reservations[reservations.length - 1];
      await guestHubPage.open(await guestDb.getGuestHubUrlKey());
      await guestHubPage.enterBookingNumber(latestReservation);
      await guestHubPage.enterRegisteredEmail(LOYALTY_EMAIL);
      await guestHubPage.clickValidateGuest();
      await guestHubPage.verifyOtpInputVisible();
      await guestHubPage.enterOtp(await guestDb.getGuestHubOtp(latestReservation));
      await guestHubPage.clickVerifyOtp();
      await guestHubPage.verifyGuestHubAccessGranted(latestReservation);
      await guestHubPage.verifyLoyaltyAnalyticsMonthlyPoints(expectedPoints);
    } catch (error) {
      testFailed = true;
      throw error;
    } finally {
      if (!testFailed) for (const confirmation of reservations) await reservationApi.deleteReservation(confirmation);
    }
  });
});

async function createReservation(
  onlineBookingPage: OnlineBookingPage,
  email: string,
  nights = 1,
): Promise<string> {
  await onlineBookingPage.openHome();
  await onlineBookingPage.selectNextAvailableStay(nights);
  await onlineBookingPage.clickSearchButton();
  await onlineBookingPage.clickBookButtonAt(0);
  await onlineBookingPage.clickCompleteBookingButton();
  await onlineBookingPage.enterGuestDetailsFor({ firstName: "Grace", lastName: "Soft", email });
  await onlineBookingPage.enterAuthorizeNetCardDetailsIfRequired();
  await onlineBookingPage.clickCompleteBookButton();
  const confirmationNumber = await onlineBookingPage.getConfirmationNumber();
  return confirmationNumber;
}
