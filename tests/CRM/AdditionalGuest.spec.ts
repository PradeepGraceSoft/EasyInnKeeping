import { test, expect } from "../../src/fixtures/sso.fixture";
import { CustomerPage } from "../../src/pages/CRM/CustomerPage";
import { ConfigManager } from "../../src/utils/ConfigManager";
import { TestDataGenerator } from "../../src/utils/TestDataGenerator";

type Guest = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

const additionalGuestStateTimeout = 5_000;

test.describe("Additional Guest - sub customer management", () => {
  test.beforeEach(
    async ({ crmCustomerDbHelper, crmLoginPage, crmLeftMenuPage }) => {
      test.setTimeout(90000);
      const propertyId = Number(ConfigManager.testData.propertyId);
      expect(Number.isInteger(propertyId)).toBe(true);
      await crmCustomerDbHelper.setAdditionalGuest(propertyId, true);
      await crmLoginPage.loginToCRM(
        ConfigManager.testData.propertyShortName,
        ConfigManager.testData.loginName,
        ConfigManager.testData.password,
      );
      await crmLeftMenuPage.clickCustomerIcon();
    },
  );

  test("Verify the Additional Guest icon opens an empty Sub Customer list for a customer with no associations", async ({
    customerPage,
  }) => {
    const primary = newGuest("empty");
    await createCustomer(customerPage, primary);

    await customerPage.verifyAdditionalGuestIconVisible(
      primary.firstName,
      primary.lastName,
    );
    await customerPage.clickAdditionalGuest(
      primary.firstName,
      primary.lastName,
    );
    await customerPage.verifySubCustomerDialog(
      primary.firstName,
      primary.lastName,
    );
    await customerPage.verifyNoSubCustomers();
  });

  test("Verify Add Sub Customer opens Customer Information and validates mandatory names and email format", async ({
    customerPage,
  }) => {
    const primary = newGuest("validation");
    await createCustomer(customerPage, primary);
    await customerPage.clickAdditionalGuest(
      primary.firstName,
      primary.lastName,
    );
    await customerPage.clickAddSubCustomer();

    await customerPage.clickSaveCustomer();
    await customerPage.verifyCustomerEmailValidationError();
    await customerPage.enterEmail("sub.guest@example.com");
    await customerPage.clickSaveCustomer();
    await customerPage.verifyMandatoryFieldError("First Name");
    await customerPage.enterFirstName("Sub");
    await customerPage.clickSaveCustomer();
    await customerPage.verifyMandatoryFieldError("Last Name");
    await customerPage.enterLastName("Guest");
    await customerPage.enterEmail("not-an-email");
    await customerPage.clickSaveCustomer();
    await customerPage.verifyCustomerEmailValidationError();
  });

  test("Verify a new Sub Customer is created, linked immediately, and displays independent profile details", async ({
    customerPage,
  }) => {
    const primary = newGuest("primary");
    const child = newGuest("created-child");
    await createCustomer(customerPage, primary);
    await customerPage.clickAdditionalGuest(
      primary.firstName,
      primary.lastName,
    );
    await customerPage.clickAddSubCustomer();
    await enterCustomer(customerPage, child);
    await customerPage.clickSaveCustomer();
    await customerPage.verifyCustomerSaved();
    await customerPage.verifySubCustomerDetails(child);
  });

  test("Verify duplicate detection prevents creating a Sub Customer with an existing email", async ({
    customerPage,
  }) => {
    const primary = newGuest("duplicate-primary");
    const existing = newGuest("duplicate-existing");
    await createCustomer(customerPage, primary);
    await createCustomer(customerPage, existing);
    await customerPage.clickAdditionalGuest(
      primary.firstName,
      primary.lastName,
    );
    await customerPage.clickAddSubCustomer();
    await enterCustomer(customerPage, {
      ...newGuest("duplicate"),
      email: existing.email,
    });
    await customerPage.clickSaveCustomer();
    await customerPage.verifyDuplicateCustomerEmailError();
  });

  test("Verify active existing Customers can be searched, selected, and linked without creating duplicates", async ({
    customerPage,
  }) => {
    const primary = newGuest("link-primary");
    const existing = newGuest("link-existing");
    await createCustomer(customerPage, primary);
    await createCustomer(customerPage, existing);
    const countBefore = await customerPage.getVisibleCustomerCount();

    await customerPage.clickAdditionalGuest(
      primary.firstName,
      primary.lastName,
    );
    await customerPage.clickLinkExistingGuest();
    await customerPage.searchAndSelectExistingGuest(existing.email);
    await customerPage.verifyLinkGuestSelection(existing.email);
    await customerPage.clickConfirmLinkGuest();
    await customerPage.verifySubCustomerDetails(existing);

    await customerPage.clickCloseSubCustomers();
    await customerPage.clearSearchKeyword();
    await expect
      .poll(() => customerPage.getVisibleCustomerCount(), {
        timeout: additionalGuestStateTimeout,
        message:
          "The Additional Guest relationship did not preserve the existing Customer records within 5 seconds.",
      })
      .toBe(countBefore);
  });

  test("Verify one Primary Customer can display multiple associated Sub Customers", async ({
    customerPage,
  }) => {
    const primary = newGuest("multi-primary");
    const children = [newGuest("multi-one"), newGuest("multi-two")];
    await createCustomer(customerPage, primary);
    for (const child of children) await createCustomer(customerPage, child);

    await customerPage.clickAdditionalGuest(
      primary.firstName,
      primary.lastName,
    );
    for (const child of children) {
      await customerPage.clickLinkExistingGuest();
      await customerPage.searchAndSelectExistingGuest(child.email);
      await customerPage.clickConfirmLinkGuest();
    }
    for (const child of children)
      await customerPage.verifySubCustomerDetails(child);
  });

  test("Verify Sub Customer Full Name, Email Address, and Phone Number are displayed correctly", async ({
    customerPage,
  }) => {
    const primary = newGuest("details-primary");
    const child = newGuest("details-child");
    await createAndLink(customerPage, primary, child);

    await customerPage.verifySubCustomerDetails(child);
    await customerPage.verifySubCustomerCount(1);
  });

  test("Verify only active Customers are available for linking", async ({
    customerPage,
    leadPage,
    crmLeftMenuPage,
  }) => {
    const primary = newGuest("active-primary");
    const lead = newGuest("inactive-child");
    await createCustomer(customerPage, primary);

    await crmLeftMenuPage.clickLeadIcon();
    await leadPage.clickAddLead();
    await leadPage.enterFirstName(lead.firstName);
    await leadPage.enterLastName(lead.lastName);
    await leadPage.enterEmail(lead.email);
    await leadPage.selectFirstAvailableLeadStatus();
    await leadPage.selectFirstAvailableAssignedStaff();
    await leadPage.clickSaveLead();
    await leadPage.verifyLeadSaved();

    await crmLeftMenuPage.clickCustomerIcon();

    await customerPage.clickAdditionalGuest(
      primary.firstName,
      primary.lastName,
    );
    await customerPage.clickLinkExistingGuest();
    await customerPage.enterExistingGuestSearch(lead.email);
    await customerPage.verifyExistingGuestNotAvailable(lead.email);
  });

  test("Verify the same Customer cannot be linked multiple times to the same Primary Customer", async ({
    customerPage,
  }) => {
    const primary = newGuest("repeat-primary");
    const child = newGuest("repeat-child");
    await createAndLink(customerPage, primary, child);

    await customerPage.clickLinkExistingGuest();
    await customerPage.enterExistingGuestSearch(child.email);
    await customerPage.verifyExistingGuestNotAvailable(child.email);
  });

  test("Verify a linked Customer retains independent profile information", async ({
    customerPage,
  }) => {
    const primary = newGuest("profile-primary");
    const child = newGuest("profile-child");
    await createAndLink(customerPage, primary, child);

    await customerPage.clickEditSubCustomer(child.firstName, child.email);
    await customerPage.verifyCustomerIdentityFields(child);
  });

  test("Verify an associated Sub Customer can be edited and updates remain visible in its profile", async ({
    customerPage,
  }) => {
    const primary = newGuest("edit-primary");
    const child = newGuest("edit-child");
    await createAndLink(customerPage, primary, child);
    const updatedFirstName = `${child.firstName}Updated`;

    await customerPage.clickEditSubCustomer(child.firstName, child.email);
    await customerPage.enterFirstName(updatedFirstName);
    await customerPage.clickSaveCustomer();
    await customerPage.verifyCustomerUpdated(updatedFirstName, child.lastName);
    await customerPage.verifySubCustomerDetails({
      ...child,
      firstName: updatedFirstName,
    });
  });

  test("Verify First Name and Last Name remain mandatory when editing a Sub Customer", async ({
    customerPage,
  }) => {
    const primary = newGuest("edit-required-primary");
    const child = newGuest("edit-required-child");
    await createAndLink(customerPage, primary, child);
    await customerPage.clickEditSubCustomer(child.firstName, child.email);

    await customerPage.enterFirstName("");
    await customerPage.clickSaveCustomer();
    await customerPage.verifyMandatoryFieldError("First Name");
    await customerPage.enterFirstName(child.firstName);
    await customerPage.enterLastName("");
    await customerPage.clickSaveCustomer();
    await customerPage.verifyMandatoryFieldError("Last Name");
  });

  test("Verify promoting a Sub Customer asks for confirmation and reassigns the previous Primary without duplicates", async ({
    customerPage,
  }) => {
    const primary = newGuest("swap-primary");
    const child = newGuest("swap-child");
    await createAndLink(customerPage, primary, child);

    await customerPage.clickSetAsPrimary(child.firstName, child.email);
    await customerPage.verifyRelationshipConfirmation(child.firstName);
    await customerPage.clickConfirmRelationshipChange();
    await customerPage.clickCloseSubCustomers();
    await customerPage.clickAdditionalGuest(child.firstName, child.lastName);
    await customerPage.verifySubCustomerDetails(primary);
  });

  test("Verify all existing Sub Customer associations are reassigned under the new Primary Customer", async ({
    customerPage,
  }) => {
    const primary = newGuest("reassign-primary");
    const promoted = newGuest("reassign-promoted");
    const sibling = newGuest("reassign-sibling");
    await createCustomer(customerPage, primary);
    await createCustomer(customerPage, promoted);
    await createCustomer(customerPage, sibling);
    await customerPage.clickAdditionalGuest(
      primary.firstName,
      primary.lastName,
    );
    for (const child of [promoted, sibling]) {
      await customerPage.clickLinkExistingGuest();
      await customerPage.searchAndSelectExistingGuest(child.email);
      await customerPage.clickConfirmLinkGuest();
    }

    await customerPage.clickSetAsPrimary(promoted.firstName, promoted.email);
    await customerPage.verifyRelationshipConfirmation(promoted.firstName);
    await customerPage.clickConfirmRelationshipChange();
    await customerPage.clickAdditionalGuest(
      promoted.firstName,
      promoted.lastName,
    );
    await customerPage.verifySubCustomerDetails(primary);
    await customerPage.verifySubCustomerDetails(sibling);
    await customerPage.verifySubCustomerCount(2);
  });

  test("Verify changing the Primary Customer does not create duplicate Customer records", async ({
    customerPage,
  }) => {
    const primary = newGuest("swap-count-primary");
    const child = newGuest("swap-count-child");
    await createAndLink(customerPage, primary, child);

    await customerPage.clickSetAsPrimary(child.firstName, child.email);
    await customerPage.clickConfirmRelationshipChange();
    await customerPage.enterSearchKeyword(child.email);
    await expect
      .poll(() => customerPage.getVisibleCustomerCount(), {
        timeout: additionalGuestStateTimeout,
        message:
          "The Additional Guest primary reassignment did not leave one Customer record for the promoted guest within 5 seconds.",
      })
      .toBe(1);
  });

  test("Verify unlink confirmation removes only the relationship and both Customer records remain active", async ({
    customerPage,
  }) => {
    const primary = newGuest("unlink-primary");
    const child = newGuest("unlink-child");
    await createAndLink(customerPage, primary, child);

    await customerPage.clickUnlinkSubCustomer(child.firstName, child.email);
    await customerPage.verifyUnlinkConfirmation(child.firstName);
    await customerPage.clickConfirmRelationshipChange();
    await customerPage.verifySubCustomerNotDisplayed(
      child.firstName,
      child.email,
    );
    await customerPage.clickCloseSubCustomers();
    await customerPage.clearSearchKeyword();
    await customerPage.enterSearchKeyword(child.email);
    await customerPage.verifyCustomerVisible(child.firstName, child.lastName);
  });

  test("Verify a Primary Customer with active reservations cannot be removed", async () => {
    test.fixme(
      true,
      "Known product defect (tracking ID required): active-reservation protection is not enforced consistently.",
    );
  });
  test("Verify an Additional Guest created from a PMS reservation creates and links the corresponding CRM Sub Customer", async () => {
    test.fixme(
      true,
      "Known product defect (tracking ID required): PMS Additional Guest synchronization is pending.",
    );
  });
  test("Verify associated Sub Customers can be selected during reservation creation", async () => {
    test.fixme(
      true,
      "Known product defect (tracking ID required): PMS Additional Guest synchronization is pending.",
    );
  });
  test("Verify a newly created Sub Customer is immediately available for reservation selection", async () => {
    test.fixme(
      true,
      "Known product defect (tracking ID required): PMS Additional Guest synchronization is pending.",
    );
  });
  test("Verify future reservations no longer list an unlinked guest under the Primary Customer", async () => {
    test.fixme(
      true,
      "Known product defect (tracking ID required): PMS Additional Guest synchronization is pending.",
    );
  });
  test("Verify the occupancy mismatch alert is displayed when room guest count differs from Primary and Sub Customers", async () => {
    test.fixme(
      true,
      "Automation gap (tracking ID required): Reservation Additional Guest controls are not implemented in ReservationPage.",
    );
  });
  test("Verify Sub Customer relationships synchronize consistently between CRM and PMS when integration is enabled", async () => {
    test.fixme(
      true,
      "Known product defect (tracking ID required): PMS Additional Guest synchronization is pending.",
    );
  });
  test("Verify Additional Guest synchronization does not occur when integration is disabled", async () => {
    test.fixme(
      true,
      "Known product defect (tracking ID required): PMS Additional Guest synchronization is pending.",
    );
  });
  test("Verify failed Additional Guest synchronizations are logged", async () => {
    test.fixme(
      true,
      "Automation gap (tracking ID required): synchronization log access is unavailable through the current APIs.",
    );
  });
  test("Verify Sub Customer profile changes are reflected consistently across CRM and PMS", async () => {
    test.fixme(
      true,
      "Known product defect (tracking ID required): PMS Additional Guest synchronization is pending.",
    );
  });
  test("Verify Primary and Sub Customer relationship changes are retained in audit history", async () => {
    test.fixme(
      true,
      "Known product defect (tracking ID required): relationship audit entries are not currently written.",
    );
  });
  test("Verify unlinking a Sub Customer preserves existing reservation history", async () => {
    test.fixme(
      true,
      "Known product defect (tracking ID required): relationship audit entries are not currently written.",
    );
  });
});

async function createAndLink(
  customerPage: CustomerPage,
  primary: Guest,
  child: Guest,
): Promise<void> {
  await createCustomer(customerPage, primary);
  await createCustomer(customerPage, child);
  await customerPage.clickAdditionalGuest(primary.firstName, primary.lastName);
  await customerPage.clickLinkExistingGuest();
  await customerPage.searchAndSelectExistingGuest(child.email);
  await customerPage.clickConfirmLinkGuest();
  await customerPage.verifySubCustomerDetails(child);
}

async function createCustomer(
  customerPage: CustomerPage,
  guest: Guest,
): Promise<void> {
  await customerPage.clickAddCustomer();
  await enterCustomer(customerPage, guest);
  await customerPage.clickSaveCustomer();
  await customerPage.verifyCustomerVisible(guest.firstName, guest.lastName);
}

async function enterCustomer(
  customerPage: CustomerPage,
  guest: Guest,
): Promise<void> {
  await customerPage.enterFirstName(guest.firstName);
  await customerPage.enterLastName(guest.lastName);
  await customerPage.enterEmail(guest.email);
  await customerPage.enterPhone(guest.phone);
}

function newGuest(label: string): Guest {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return {
    firstName: TestDataGenerator.firstName().replace(/[^a-z]/gi, ""),
    lastName: TestDataGenerator.lastName().replace(/[^a-z]/gi, ""),
    email: `${label}.${id}@example.com`,
    phone: TestDataGenerator.phoneNumber(),
  };
}
