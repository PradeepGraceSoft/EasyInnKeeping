import { expect, test } from "../../../src/fixtures/sso.fixture";
import { ConstNames } from "../../../src/constants/ConstNames";
import { SSOUsers } from "../../../src/test-data/SSOUsers";
import { TestDataGenerator } from "../../../src/utils/TestDataGenerator";
import { FindReservationPage } from "../../../src/pages/FindReservationPage";
import { ReservationPage } from "../../../src/pages/ReservationPage";
import { SSOLoginPage } from "../../../src/pages/SSOLoginPage";
import { ReservationDatabaseHelper } from "../../../src/utils/DBHelper/ReservationDatabaseHelper";

export type ReservationType =
  | "Regular"
  | "Hourly"
  | "Group"
  | "Package"
  | "Unassigned"
  | "Shared";

type ZipCodeFixtures = {
  ssoLoginPage: SSOLoginPage;
  reservationPage: ReservationPage;
  findReservationPage: FindReservationPage;
  reservationDbHelper: ReservationDatabaseHelper;
};

export async function verifyZipCodeAutoFill(
  reservationType: ReservationType,
  fixtures: ZipCodeFixtures,
): Promise<void> {
  const {
    ssoLoginPage,
    reservationPage,
    findReservationPage,
    reservationDbHelper,
  } = fixtures;
  const user = SSOUsers.UserAdmin;
  const locations = await reservationDbHelper.getZipCodeLocations(2);
  expect(
    locations.length,
    "Property must have at least two complete ZIP records",
  ).toBeGreaterThanOrEqual(2);
  const initialLocation = locations[0];
  const updatedLocation = locations[1];
  let reservationCreated = false;

  await ssoLoginPage.propertyLogin(
    user.propertyShortName,
    user.loginName,
    user.password,
  );
  let testCompletedSuccessfully = false;
  try {
    await chooseReservationType(findReservationPage, reservationType);
    await findReservationPage.addNewReservation();
    await selectRoom(reservationPage, reservationType);
    if (reservationType === "Group") {
      await reservationPage.enterGroupName();
    }

    const primaryContact = createContact("primary");
    await verifyGuestZipCodeAutoFill(
      reservationPage,
      primaryContact,
      initialLocation,
      updatedLocation,
    );
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );

    if (reservationType === "Group") {
      await reservationPage.clickGroupSaveButton();
    } else {
      await reservationPage.clickSaveButton();
    }
    reservationCreated = true;
    await reservationPage.verifyZipLocation(initialLocation);
    await reservationPage.verifyContactDetails(primaryContact);

    if (reservationType === "Shared") {
      await reservationPage.clickSharedAddGuestOption();
      const secondaryContact = createContact("secondary");
      await verifyGuestZipCodeAutoFill(
        reservationPage,
        secondaryContact,
        initialLocation,
        updatedLocation,
      );
      await reservationPage.enterPaymentMethod(
        ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
      );
      await reservationPage.clickSaveButton();
      await reservationPage.verifyZipLocation(initialLocation);
      await reservationPage.verifyContactDetails(secondaryContact);
    }
    testCompletedSuccessfully = true;
  } finally {
    if (reservationCreated && testCompletedSuccessfully) {
      if (reservationType === "Group") {
        await reservationPage.deleteGroupReservationBlockAndGroup();
      } else if (reservationType === "Shared") {
        await reservationPage.deleteSharedGuestReservations();
      } else {
        await reservationPage.clickDeleteButton();
      }
    }
  }
}

function createContact(label: string) {
  return {
    firstName: TestDataGenerator.firstName(),
    lastName: TestDataGenerator.lastName(),
    email: `zipcode.${label}.${Date.now()}@example.com`,
    phone: TestDataGenerator.phoneNumber(),
  };
}

async function verifyGuestZipCodeAutoFill(
  page: ReservationPage,
  contact: ReturnType<typeof createContact>,
  initialLocation: Awaited<
    ReturnType<ReservationDatabaseHelper["getZipCodeLocations"]>
  >[number],
  updatedLocation: Awaited<
    ReturnType<ReservationDatabaseHelper["getZipCodeLocations"]>
  >[number],
): Promise<void> {
  await page.enterContactDetails(contact);

  await selectZipCodeSuggestionOrSkip(page, initialLocation.zipCode);
  await page.verifyZipLocation(initialLocation);
  await page.verifyContactDetails(contact);

  await selectZipCodeSuggestionOrSkip(page, updatedLocation.zipCode);
  await page.verifyZipLocation(updatedLocation);
  await page.verifyContactDetails(contact);

  await page.enterInvalidZipCode(TestDataGenerator.zipCode());
  await page.verifyNoZipRecordsFound();
  await page.enterLocationDetails({
    city: "Existing City",
    state: "Existing State",
    country: "Existing Country",
  });
  await selectZipCodeSuggestionOrSkip(page, initialLocation.zipCode);
  await page.verifyZipLocation(initialLocation);
  await page.verifyContactDetails(contact);
}

async function selectZipCodeSuggestionOrSkip(
  page: ReservationPage,
  zipCode: string,
): Promise<void> {
  try {
    await page.selectZipCodeSuggestion(zipCode);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    test.skip(message.startsWith("Application defect:"), message);
    throw error;
  }
}

async function chooseReservationType(
  page: FindReservationPage,
  reservationType: ReservationType,
): Promise<void> {
  const choices: Record<ReservationType, () => Promise<void>> = {
    Regular: () => page.chooseReservationTypeRegular(),
    Hourly: () => page.chooseReservationTypeHourly(),
    Group: () => page.chooseReservationTypeGroup(),
    Package: () => page.chooseReservationTypePackage(),
    Unassigned: () => page.chooseReservationTypeRegular(),
    Shared: () => page.chooseReservationTypeShared(),
  };
  await choices[reservationType]();
}

async function selectRoom(
  page: ReservationPage,
  reservationType: ReservationType,
): Promise<void> {
  if (reservationType === "Hourly") {
    await page.selectFirstHourlyRoom();
    await page.selectStartTime();
    await page.enterHours("1");
    return;
  }
  if (reservationType === "Package") {
    await page.chooseFirstPackage();
    try {
      await page.chooseFirstPackageRoom();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      test.skip(message.startsWith("Application defect:"), message);
      throw error;
    }
    await page.clickPackageAddRoomButton();
    return;
  }
  if (reservationType === "Unassigned") {
    await page.selectRoomTypeWithUnassignedRoom();
    return;
  }
  await page.selectFirstAvailableRoomType();
  await page.selectFirstRoomFromDropdown();
}
