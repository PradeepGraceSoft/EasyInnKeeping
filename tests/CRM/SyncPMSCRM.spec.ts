import { test, expect } from "../../src/fixtures/sso.fixture";
import { ConstNames } from "../../src/constants/ConstNames";
import { CustomerPage } from "../../src/pages/CRM/CustomerPage";
import { CRMLeftMenuPage } from "../../src/pages/CRM/CRMLeftMenuPage";
import { CRMLoginPage } from "../../src/pages/CRM/CRMLoginPage";
import { FindReservationPage } from "../../src/pages/FindReservationPage";
import { OnlineBookingPage } from "../../src/pages/OnlineBookingPage";
import { ReservationPage } from "../../src/pages/ReservationPage";
import { SSOLoginPage } from "../../src/pages/SSOLoginPage";
import { ConfigManager } from "../../src/utils/ConfigManager";
import { TestDataGenerator } from "../../src/utils/TestDataGenerator";
import { SetupDatabaseHelper } from "../../src/utils/DBHelper/SetupDatabaseHelper";

type Guest = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  zip: string;
};

test.describe("PMS, CRM, and EWR guest synchronization", () => {
  test.beforeEach(async ({ crmLeadDbHelper }) => {
    await crmLeadDbHelper.setGuestSynchronization(activePropertyId(), true);
    expect(
      await crmLeadDbHelper.getGuestSynchronizationState(activePropertyId()),
    ).toBe(true);
  });

  test.afterEach(async () => {
    ConfigManager.useProperty("D");
  });

  test("Verify guest data is successfully synchronized between PMS and CRM for an enabled property", async ({
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    const guest = newGuest("enabled");
    await createPmsReservation(
      ssoLoginPage,
      findReservationPage,
      reservationPage,
      guest,
    );

    await openCrmCustomers(crmLoginPage, crmLeftMenuPage);
    await verifySingleCrmCustomer(customerPage, guest);
  });

  test("Verify guest data from multiple properties is synchronized into the centralized CRM guest record", async ({
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
    crmLeadDbHelper,
  }) => {
    test.slow();
    const guest = newGuest("multi-property");
    await createPmsReservation(
      ssoLoginPage,
      findReservationPage,
      reservationPage,
      guest,
    );

    ConfigManager.useProperty("A");
    await crmLeadDbHelper.setGuestSynchronization(activePropertyId(), true);
    await ssoLoginPage.propertyLogin(
      ConfigManager.testData.propertyShortName,
      ConfigManager.testData.loginName,
      ConfigManager.testData.password,
    );
    await createPmsReservationFromOpenSession(
      findReservationPage,
      reservationPage,
      guest,
    );

    ConfigManager.useProperty("D");
    await openCrmCustomers(crmLoginPage, crmLeftMenuPage);
    await verifySingleCrmCustomer(customerPage, guest);
  });

  test("Verify guest information updated in PMS is reflected in the corresponding CRM record after synchronization", async ({
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    const guest = newGuest("pms-update");
    await createPmsReservation(
      ssoLoginPage,
      findReservationPage,
      reservationPage,
      guest,
    );
    const updated = {
      ...guest,
      firstName: `${guest.firstName}Updated`,
      phone: TestDataGenerator.phoneNumber(),
    };

    await reservationPage.enterGuestDetails(updated);
    await reservationPage.clickSaveButton();

    await openCrmCustomers(crmLoginPage, crmLeftMenuPage);
    await verifySingleCrmCustomer(customerPage, updated);
  });

  test("Verify guest information updated in CRM is handled according to the configured synchronization rules", async ({
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();
    const guest = newGuest("crm-update");
    const confirmation = await createPmsReservation(
      ssoLoginPage,
      findReservationPage,
      reservationPage,
      guest,
    );
    const updatedFirstName = `${guest.firstName}CRM`;

    await openCrmCustomers(crmLoginPage, crmLeftMenuPage);
    await customerPage.clickEditCustomer(guest.firstName, guest.lastName);
    await customerPage.enterFirstName(updatedFirstName);
    await customerPage.clickSaveCustomer();
    await customerPage.verifyCustomerUpdated(updatedFirstName, guest.lastName);

    await ssoLoginPage.propertyLogin(
      ConfigManager.testData.propertyShortName,
      ConfigManager.testData.loginName,
      ConfigManager.testData.password,
    );
    await findReservationPage.openReservation(confirmation);
    await reservationPage.verifyGuestDetails({
      ...guest,
      firstName: updatedFirstName,
    });
  });

  test("Verify duplicate guests across PMS, CRM, and EWR are identified and merged into a single customer record", async ({
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    onlineBookingPage,
    setupDb,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
    crmLeadDbHelper,
  }) => {
    test.slow();
    const guest = newGuest("merged");
    await createPmsReservation(
      ssoLoginPage,
      findReservationPage,
      reservationPage,
      guest,
    );
    ConfigManager.useProperty("C");
    await crmLeadDbHelper.setGuestSynchronization(activePropertyId(), true);
    await createEwrReservation(onlineBookingPage, setupDb, guest);

    ConfigManager.useProperty("D");
    await openCrmCustomers(crmLoginPage, crmLeftMenuPage);
    await verifySingleCrmCustomer(customerPage, guest);
  });

  test("Verify the latest guest information is retained across integrated PMS, CRM, and EWR records after duplicate merging", async ({
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    onlineBookingPage,
    setupDb,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
    crmLeadDbHelper,
  }) => {
    test.slow();
    const guest = newGuest("latest");
    const confirmation = await createPmsReservation(
      ssoLoginPage,
      findReservationPage,
      reservationPage,
      guest,
    );
    ConfigManager.useProperty("C");
    await crmLeadDbHelper.setGuestSynchronization(activePropertyId(), true);
    await createEwrReservation(onlineBookingPage, setupDb, guest);

    const latest = {
      ...guest,
      firstName: `${guest.firstName}Latest`,
      address: TestDataGenerator.address(),
    };
    ConfigManager.useProperty("D");
    await ssoLoginPage.propertyLogin(
      ConfigManager.testData.propertyShortName,
      ConfigManager.testData.loginName,
      ConfigManager.testData.password,
    );
    await findReservationPage.openReservation(confirmation);
    await reservationPage.enterGuestDetails(latest);
    await reservationPage.clickSaveButton();

    await openCrmCustomers(crmLoginPage, crmLeftMenuPage);
    await verifySingleCrmCustomer(customerPage, latest);
    await customerPage.clickEditCustomer(latest.firstName, latest.lastName);
    await expect
      .poll(async () => {
        try {
          await customerPage.verifySynchronizedGuestDetails({
            ...latest,
            postalCode: latest.zip,
          });
          return true;
        } catch {
          return false;
        }
      })
      .toBe(true);
  });

  test("Verify disabled property integrations do not create or update CRM guest records", async ({
    crmLeadDbHelper,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    const guest = newGuest("disabled");
    await crmLeadDbHelper.setGuestSynchronization(activePropertyId(), false);
    expect(
      await crmLeadDbHelper.getGuestSynchronizationState(activePropertyId()),
    ).toBe(false);

    await createPmsReservation(
      ssoLoginPage,
      findReservationPage,
      reservationPage,
      guest,
    );
    await openCrmCustomers(crmLoginPage, crmLeftMenuPage);
    await customerPage.enterSearchKeyword(guest.email);
    await customerPage.verifyCustomerNotVisible(
      guest.firstName,
      guest.lastName,
    );
  });

  test("Verify guest creation is prevented across integrated systems when the email address is missing", async ({
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    const guest = newGuest("missing-email");
    await loginToPms(ssoLoginPage);
    await findReservationPage.addNewReservation();
    await reservationPage.selectFirstAvailableRoomType();
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.enterGuestDetails({ ...guest, email: "" });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveWithInvalidGuestData();
    await reservationPage.verifyEmailIsRequired();

    await openCrmCustomers(crmLoginPage, crmLeftMenuPage);
    await customerPage.clickAddCustomer();
    await customerPage.enterFirstName(guest.firstName);
    await customerPage.enterLastName(guest.lastName);
    await customerPage.clickSaveCustomer();
    await customerPage.verifyMandatoryFieldError("Email Address");
  });

  test("Verify guest creation is prevented when a duplicate email exists across PMS, CRM, or EWR", async ({
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    crmLoginPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    const guest = newGuest("duplicate-email");
    await createPmsReservation(
      ssoLoginPage,
      findReservationPage,
      reservationPage,
      guest,
    );
    await openCrmCustomers(crmLoginPage, crmLeftMenuPage);
    await verifySingleCrmCustomer(customerPage, guest);

    await customerPage.clearSearchKeyword();
    await customerPage.clickAddCustomer();
    await customerPage.enterFirstName(`${guest.firstName}Duplicate`);
    await customerPage.enterLastName(guest.lastName);
    await customerPage.enterEmail(guest.email);
    await customerPage.clickSaveCustomer();
    await customerPage.verifyDuplicateCustomerEmailError();
  });
});

function activePropertyId(): number {
  const propertyId = Number(ConfigManager.testData.propertyId);
  if (!Number.isInteger(propertyId))
    throw new Error("Active PropertyID is invalid");
  return propertyId;
}

function newGuest(label: string): Guest {
  const firstName = TestDataGenerator.firstName().replace(/[^a-z]/gi, "");
  const lastName = TestDataGenerator.lastName().replace(/[^a-z]/gi, "");
  const emailLabel = label.replace(/[^a-z0-9]/gi, "").slice(0, 8);
  const uniqueId = Date.now().toString(36).slice(-6);
  return {
    firstName,
    lastName,
    email: `${emailLabel}.${uniqueId}@example.com`,
    phone: TestDataGenerator.phoneNumber(),
    address: TestDataGenerator.address(),
    city: TestDataGenerator.city(),
    state: TestDataGenerator.state(),
    country: TestDataGenerator.country(),
    zip: TestDataGenerator.zipCode(),
  };
}

async function loginToPms(ssoLoginPage: SSOLoginPage): Promise<void> {
  await ssoLoginPage.propertyLogin(
    ConfigManager.testData.propertyShortName,
    ConfigManager.testData.loginName,
    ConfigManager.testData.password,
  );
}

async function createPmsReservation(
  ssoLoginPage: SSOLoginPage,
  findReservationPage: FindReservationPage,
  reservationPage: ReservationPage,
  guest: Guest,
): Promise<string> {
  await loginToPms(ssoLoginPage);
  return createPmsReservationFromOpenSession(
    findReservationPage,
    reservationPage,
    guest,
  );
}

async function createPmsReservationFromOpenSession(
  findReservationPage: FindReservationPage,
  reservationPage: ReservationPage,
  guest: Guest,
): Promise<string> {
  await findReservationPage.addNewReservation();
  await reservationPage.selectFirstAvailableRoomType();
  await reservationPage.selectFirstRoomFromDropdown();
  await reservationPage.enterGuestDetails(guest);
  await reservationPage.enterPaymentMethod(
    ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
  );
  await reservationPage.clickSaveButton();
  return reservationPage.getReservationNumber();
}

async function openCrmCustomers(
  crmLoginPage: CRMLoginPage,
  crmLeftMenuPage: CRMLeftMenuPage,
): Promise<void> {
  await crmLoginPage.loginToCRM(
    ConfigManager.testData.propertyShortName,
    ConfigManager.testData.loginName,
    ConfigManager.testData.password,
  );
  await crmLeftMenuPage.clickCustomerIcon();
}

async function verifySingleCrmCustomer(
  customerPage: CustomerPage,
  guest: Guest,
): Promise<void> {
  await customerPage.verifySingleCustomerByEmail(
    guest.email,
    guest.firstName,
    guest.lastName,
  );
}

async function createEwrReservation(
  onlineBookingPage: OnlineBookingPage,
  setupDb: SetupDatabaseHelper,
  guest: Guest,
): Promise<string> {
  await setupDb.disableDepositForAllRates();
  await setupDb.setDepositType("No deposit");
  await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE, 100);
  await setupDb.assignRateToRoomType(
    ConstNames.ROOMTYPE_NAME_ONLINE_ROOM,
    ConstNames.RATES_NAME_REGULAR_RATE,
  );
  await setupDb.assignRateToUnitSetup(
    ConstNames.ROOMTYPE_NAME_ONLINE_ROOM,
    ConstNames.RATES_NAME_REGULAR_RATE,
  );
  await setupDb.activateAllRoomsOfType(ConstNames.ROOMTYPE_NAME_ONLINE_ROOM);
  await setupDb.setOnlineRoomByRoomType(
    ConstNames.ROOMTYPE_NAME_ONLINE_ROOM,
    1,
  );
  await onlineBookingPage.openHome();
  await onlineBookingPage.selectNextAvailableStay();
  await onlineBookingPage.clickSearchButton();
  await onlineBookingPage.clickFirstBookButton();
  await onlineBookingPage.clickCompleteBookingButton();
  await onlineBookingPage.enterGuestDetailsFor(guest);
  await onlineBookingPage.enterAuthorizeNetCardDetailsIfRequired();
  await onlineBookingPage.clickCompleteBookButton();
  return onlineBookingPage.getConfirmationNumber();
}
