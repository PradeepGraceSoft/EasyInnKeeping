import { test } from "../../src/fixtures/sso.fixture";
import {
  CompleteCustomerData,
  CustomerData,
  CustomerPage,
} from "../../src/pages/CRM/CustomerPage";
import { TestDataGenerator } from "../../src/utils/TestDataGenerator";
import { ConfigManager } from "../../src/utils/ConfigManager";
import { DateUtils } from "../../src/utils/DateUtils";
import { GmailHelper } from "../../src/utils/GmailHelper";

test.describe.configure({ mode: "parallel" });

test("Verify an unsubscribed customer shows the unsubscribed icon in the customer list", async ({
  crmLoginPage,
  crmLeftMenuPage,
  customerPage,
}) => {
  test.slow();
  const credentials = ConfigManager.testData;
  const customer = {
    firstName: TestDataGenerator.firstName(),
    lastName: TestDataGenerator.lastName(),
    email: GmailHelper.createUniqueRecipient("customer-unsubscribed-icon"),
  };

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );
  await crmLeftMenuPage.clickCustomerIcon();
  await createCustomer(customerPage, customer);
  await customerPage.unsubscribeCustomer(customer.email);
  await customerPage.verifyUnsubscribedIcon(customer.email);
});

test("Create a Customer with all mandatory fields", async ({
  crmLoginPage,
  crmLeftMenuPage,
  customerPage,
}) => {
  const credentials = ConfigManager.testData;

  const firstName = TestDataGenerator.firstName();
  const lastName = TestDataGenerator.lastName();
  const customer: CustomerData = {
    firstName,
    lastName,
    email: GmailHelper.createUniqueRecipient(`customer-${firstName}-${lastName}`),
    phone: TestDataGenerator.phoneNumber(),
    company: TestDataGenerator.companyName(),
    address: TestDataGenerator.address(),
    city: TestDataGenerator.city(),
    state: TestDataGenerator.state(),
    postalCode: TestDataGenerator.zipCode(),
    country: TestDataGenerator.country(),
    notes: TestDataGenerator.notes(),
  };

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );

  await crmLeftMenuPage.clickCustomerIcon();
  await createCustomer(customerPage, customer, {
    selectFirstAvailableOptions: true,
  });
});

test("user can modify a CRM customer", async ({
  crmLoginPage,
  crmLeftMenuPage,
  customerPage,
}) => {
  // This workflow creates a full customer, then edits and verifies it.
  test.slow();
  const credentials = ConfigManager.testData;

  const firstName = TestDataGenerator.firstName();
  const lastName = TestDataGenerator.lastName();
  const customer: CustomerData = {
    firstName,
    lastName,
    email: GmailHelper.createUniqueRecipient(`customer-${firstName}-${lastName}`),
    phone: TestDataGenerator.phoneNumber(),
    company: TestDataGenerator.companyName(),
    address: TestDataGenerator.address(),
    city: TestDataGenerator.city(),
    state: TestDataGenerator.state(),
    postalCode: TestDataGenerator.zipCode(),
    country: TestDataGenerator.country(),
    notes: TestDataGenerator.notes(),
  };
  const updatedFirstName = TestDataGenerator.firstName();

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );

  await crmLeftMenuPage.clickCustomerIcon();
  await createCustomer(customerPage, customer, {
    selectFirstAvailableOptions: true,
  });

  await customerPage.clickEditCustomer(customer.firstName, customer.lastName);
  await customerPage.enterFirstName(updatedFirstName);
  await customerPage.enterEmail(
    GmailHelper.createUniqueRecipient(`customer-${updatedFirstName}-${customer.lastName}`),
  );
  await customerPage.clickSaveCustomer();
  await customerPage.verifyCustomerUpdated(updatedFirstName, customer.lastName);
});

test("user can delete a CRM customer", async ({
  crmLoginPage,
  crmLeftMenuPage,
  customerPage,
}) => {
  const credentials = ConfigManager.testData;

  const firstName = TestDataGenerator.firstName();
  const lastName = TestDataGenerator.lastName();
  const customer: CustomerData = {
    firstName,
    lastName,
    email: GmailHelper.createUniqueRecipient(`customer-${firstName}-${lastName}`),
    phone: TestDataGenerator.phoneNumber(),
    company: TestDataGenerator.companyName(),
    address: TestDataGenerator.address(),
    city: TestDataGenerator.city(),
    state: TestDataGenerator.state(),
    postalCode: TestDataGenerator.zipCode(),
    country: TestDataGenerator.country(),
    notes: TestDataGenerator.notes(),
  };

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );

  await crmLeftMenuPage.clickCustomerIcon();
  await createCustomer(customerPage, customer, {
    selectFirstAvailableOptions: true,
  });

  await customerPage.clickDeleteCustomer(customer.firstName, customer.lastName);
  await customerPage.clickConfirmDelete();
  await customerPage.verifyCustomerDeleted();
});

test("prevent customer creation when mandatory fields are missing", async ({
  crmLoginPage,
  crmLeftMenuPage,
  customerPage,
}) => {
  const credentials = ConfigManager.testData;
  const firstName = TestDataGenerator.firstName();
  const lastName = TestDataGenerator.lastName();

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );

  await crmLeftMenuPage.clickCustomerIcon();
  await customerPage.clickAddCustomer();

  await customerPage.enterFirstName(firstName);
  await customerPage.enterLastName(lastName);
  await customerPage.clickSaveCustomer();
  await customerPage.verifyCustomerEmailValidationError();

  await customerPage.enterEmail("mandatory-fields@example.com");
  await customerPage.enterFirstName("");
  await customerPage.clickSaveCustomer();
  await customerPage.verifyMandatoryFieldError("First Name");

  await customerPage.enterFirstName(firstName);
  await customerPage.enterLastName("");
  await customerPage.clickSaveCustomer();
  await customerPage.verifyMandatoryFieldError("Last Name");
});

test("validate customer email address", async ({
  crmLoginPage,
  crmLeftMenuPage,
  customerPage,
}) => {
  const credentials = ConfigManager.testData;

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );

  await crmLeftMenuPage.clickCustomerIcon();
  await customerPage.clickAddCustomer();
  await customerPage.enterFirstName(TestDataGenerator.firstName());
  await customerPage.enterLastName(TestDataGenerator.lastName());
  await customerPage.enterEmail("invalid-email");
  await customerPage.clickSaveCustomer();
  await customerPage.verifyCustomerEmailValidationError();
});

test("prevent customer creation with a duplicate email address", async ({
  crmLoginPage,
  crmLeftMenuPage,
  customerPage,
  crmCustomerDbHelper,
}) => {
  const credentials = ConfigManager.testData;
  const companyId = Number(credentials.crmCompanyId);
  if (!Number.isInteger(companyId) || companyId <= 0) {
    throw new Error("CRMCompanyID is missing or invalid for the active property");
  }

  const email = ConfigManager.gmail.email;
  if (await crmCustomerDbHelper.customerExistsByEmail(companyId, email)) {
    await crmCustomerDbHelper.deleteCustomerByEmail(companyId, email);
  }

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );
  await crmLeftMenuPage.clickCustomerIcon();

  await createCustomer(customerPage, {
    firstName: TestDataGenerator.firstName(),
    lastName: TestDataGenerator.lastName(),
    email,
  });

  await customerPage.clickAddCustomer();
  await customerPage.enterFirstName(TestDataGenerator.firstName());
  await customerPage.enterLastName(TestDataGenerator.lastName());
  await customerPage.enterEmail(email);
  await customerPage.clickSaveCustomer();
  await customerPage.verifyDuplicateCustomerEmailError();
});

test("verify all customer fields are saved with the entered data", async ({
  crmLoginPage,
  crmLeftMenuPage,
  customerPage,
}) => {
  test.slow();
  const credentials = ConfigManager.testData;

  const firstName = TestDataGenerator.firstName();
  const lastName = TestDataGenerator.lastName();
  const customer: CompleteCustomerData = {
    firstName,
    lastName,
    email: GmailHelper.createUniqueRecipient(`customer-${firstName}-${lastName}`),
    phone: TestDataGenerator.phoneNumber(),
    company: TestDataGenerator.companyName(),
    address: TestDataGenerator.address(),
    city: TestDataGenerator.city(),
    state: TestDataGenerator.state(),
    postalCode: TestDataGenerator.zipCode(),
    country: TestDataGenerator.country(),
    notes: TestDataGenerator.notes(),
    secondFirstName: TestDataGenerator.firstName(),
    secondLastName: TestDataGenerator.lastName(),
    secondAddress: TestDataGenerator.address(),
    workPhone: TestDataGenerator.phoneNumber(),
    mobilePhone: TestDataGenerator.phoneNumber(),
    fax: TestDataGenerator.phoneNumber(),
    guestType: "VIP",
    visitType: "Business",
    vehicleMake: "Toyota",
    vehicleModel: "Camry",
    birthDate1: "1990-01-15",
    birthDate2: "1992-06-20",
    anniversary: "2020-02-10",
    license: "LIC-123456",
    jobTitle: "Manager",
    custom1: "Custom value 1",
    custom2: "Custom value 2",
    custom3: "Custom value 3",
    custom4: "Custom value 4",
    custom5: "Custom value 5",
    custom6: "Custom value 6",
    doNotAllowNewReservation: true,
    customerStatus: "Active",
    assignStaff: credentials.loginName,
    callBackDate: "2026-08-15",
    callBackComments: "Follow up with the customer",
  };

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );

  await crmLeftMenuPage.clickCustomerIcon();
  await customerPage.clickAddCustomer();
  await customerPage.enterFirstName(customer.firstName);
  await customerPage.enterLastName(customer.lastName);
  await customerPage.enterEmail(customer.email);
  await customerPage.enterPhone(customer.phone);
  await customerPage.enterCompany(customer.company);
  await customerPage.enterAddress(customer.address);
  await customerPage.enterCity(customer.city);
  await customerPage.enterState(customer.state);
  await customerPage.enterPostalCode(customer.postalCode);
  await customerPage.enterCountry(customer.country);
  await customerPage.enterNotes(customer.notes);
  await customerPage.enterSecondFirstName(customer.secondFirstName);
  await customerPage.enterSecondLastName(customer.secondLastName);
  await customerPage.enterSecondAddress(customer.secondAddress);
  await customerPage.enterWorkPhone(customer.workPhone);
  await customerPage.enterMobilePhone(customer.mobilePhone);
  await customerPage.enterFax(customer.fax);
  await customerPage.enterGuestType(customer.guestType);
  await customerPage.enterVisitType(customer.visitType);
  await customerPage.enterVehicleMake(customer.vehicleMake);
  await customerPage.enterVehicleModel(customer.vehicleModel);
  await customerPage.enterBirthDate1(customer.birthDate1);
  await customerPage.enterBirthDate2(customer.birthDate2);
  await customerPage.enterAnniversary(customer.anniversary);
  await customerPage.enterLicense(customer.license);
  await customerPage.enterJobTitle(customer.jobTitle);
  await customerPage.enterCustom1(customer.custom1);
  await customerPage.enterCustom2(customer.custom2);
  await customerPage.enterCustom3(customer.custom3);
  await customerPage.enterCustom4(customer.custom4);
  await customerPage.enterCustom5(customer.custom5);
  await customerPage.enterCustom6(customer.custom6);
  await customerPage.checkDoNotAllowNewReservation();
  await customerPage.selectCustomerStatus(customer.customerStatus);
  await customerPage.selectAssignStaff(customer.assignStaff);
  await customerPage.enterCallBackDate(customer.callBackDate);
  await customerPage.enterCallBackComments(customer.callBackComments);
  await customerPage.clickSaveCustomer();
  await customerPage.verifyCustomerSaved();

  await customerPage.clickEditCustomer(customer.firstName, customer.lastName);
  await customerPage.verifyCompleteCustomerDetails(customer);
});

test("search customer by first name, last name, email, address and submission date", async ({
  crmLoginPage,
  crmLeftMenuPage,
  customerPage,
}) => {
  test.slow();
  const credentials = ConfigManager.testData;

  const firstName = TestDataGenerator.firstName();
  const lastName = TestDataGenerator.lastName();
  const customer: CustomerData = {
    firstName,
    lastName,
    email: GmailHelper.createUniqueRecipient(`customer-${firstName}-${lastName}`),
    phone: TestDataGenerator.phoneNumber(),
    company: TestDataGenerator.companyName(),
    address: TestDataGenerator.address(),
    city: TestDataGenerator.city(),
    state: TestDataGenerator.state(),
    postalCode: TestDataGenerator.zipCode(),
    country: TestDataGenerator.country(),
    notes: TestDataGenerator.notes(),
  };

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );

  await crmLeftMenuPage.clickCustomerIcon();
  await createCustomer(customerPage, customer, {
    selectFirstAvailableOptions: true,
  });

  const submissionDate = toSubmissionDate(DateUtils.addDaysYYYYMMDD(0));
  const keywords = [
    customer.firstName,
    customer.lastName,
    customer.email,
    customer.address,
    submissionDate,
  ];

  for (const keyword of keywords) {
    await customerPage.enterSearchKeyword(keyword);
    await customerPage.verifyCustomerSearchResults(
      keyword,
      customer.firstName,
      customer.lastName,
    );
    await customerPage.clearSearchKeyword();
    await customerPage.verifyCustomerVisible(customer.firstName, customer.lastName);
  }
});

test("Filter Customers by Callback Date", async ({
  crmLoginPage,
  crmLeftMenuPage,
  customerPage,
}) => {
  const credentials = ConfigManager.testData;
  const firstName = TestDataGenerator.firstName();
  const lastName = TestDataGenerator.lastName();
  const email = GmailHelper.createUniqueRecipient(`customer-${firstName}-${lastName}`);
  const callbackDate = DateUtils.addDaysYYYYMMDD(1);

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );

  await crmLeftMenuPage.clickCustomerIcon();
  await createCustomer(
    customerPage,
    {
      firstName,
      lastName,
      email,
    },
    { callBackDate: callbackDate, selectFirstAvailableOptions: true },
  );

  await customerPage.clickFilterButton();
  await customerPage.selectCallBackDateCustomRange(
    new Date(`${callbackDate}T00:00:00`),
  );
  await customerPage.selectFilterType("Email Address");
  await customerPage.enterFilterValue(email);
  await customerPage.clickApplyFilters();
  await customerPage.verifySingleFilteredCustomer(
    firstName,
    lastName,
  );
});

test("Filter Customers by Assigned Staff", async ({
  crmLoginPage,
  crmLeftMenuPage,
  customerPage,
}) => {
  const credentials = ConfigManager.testData;
  const firstName = TestDataGenerator.firstName();
  const lastName = TestDataGenerator.lastName();
  const email = GmailHelper.createUniqueRecipient(`customer-${firstName}-${lastName}`);
  const assignedStaff = credentials.loginName;

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );

  await crmLeftMenuPage.clickCustomerIcon();
  await createCustomer(
    customerPage,
    {
      firstName,
      lastName,
      email,
    },
    { assignedStaff },
  );

  await customerPage.clickFilterButton();
  await customerPage.selectAssignedStaffFilter(assignedStaff);
  await customerPage.selectFilterType("Email Address");
  await customerPage.enterFilterValue(email);
  await customerPage.clickApplyFilters();
  await customerPage.verifySingleFilteredCustomer(
    firstName,
    lastName,
  );
});

test("Filter Customers by Status", async ({
  crmLoginPage,
  crmLeftMenuPage,
  customerPage,
  crmCustomerDbHelper,
}) => {
  test.slow();

  const credentials = ConfigManager.testData;
  const companyId = Number(credentials.crmCompanyId);
  if (!Number.isInteger(companyId)) {
    throw new Error(
      "CRMCompanyID is missing or invalid for the active property",
    );
  }

  const firstName = TestDataGenerator.firstName();
  const lastName = TestDataGenerator.lastName();
  const statuses = [
    "Dead",
    "Active",
    "Waiting",
    "Hot",
    "Customer",
    "OnBoarding",
    "In Free Trail",
    "Demo Completed",
    "Qualified",
    "PreQualify",
    "Customer Success Completed",
  ];

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );

  await crmLeftMenuPage.clickCustomerIcon();
  const email = GmailHelper.createUniqueRecipient(`customer-${firstName}-${lastName}`);
  await createCustomer(customerPage, {
    firstName,
    lastName,
    email,
  });

  await customerPage.clickFilterButton();

  for (const status of statuses) {
    await crmCustomerDbHelper.updateCustomerStatus(companyId, email, status);
    await customerPage.selectStatusFilter(status);
    await customerPage.selectFilterType("Email Address");
    await customerPage.enterFilterValue(email);
    await customerPage.clickApplyFilters();
    await customerPage.verifySingleFilteredCustomer(
      firstName,
      lastName,
    );
    await customerPage.clickResetFilters();
  }
});

test("filter customers by start and end date", async ({
  crmLoginPage,
  crmLeftMenuPage,
  customerPage,
  crmCustomerDbHelper,
}) => {
  test.slow();
  const credentials = ConfigManager.testData;
  const companyId = Number(credentials.crmCompanyId);
  if (!Number.isInteger(companyId)) {
    throw new Error(
      "CRMCompanyID is missing or invalid for the active property",
    );
  }

  const firstName = TestDataGenerator.firstName();
  const lastName = TestDataGenerator.lastName();
  const customer: CustomerData = {
    firstName,
    lastName,
    email: GmailHelper.createUniqueRecipient(`customer-${firstName}-${lastName}`),
    phone: TestDataGenerator.phoneNumber(),
    company: TestDataGenerator.companyName(),
    address: TestDataGenerator.address(),
    city: TestDataGenerator.city(),
    state: TestDataGenerator.state(),
    postalCode: TestDataGenerator.zipCode(),
    country: TestDataGenerator.country(),
    notes: TestDataGenerator.notes(),
  };

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );

  await crmLeftMenuPage.clickCustomerIcon();
  await createCustomer(customerPage, customer);

  await customerPage.verifyCustomerVisible(
    customer.firstName,
    customer.lastName,
  );
  await customerPage.clickFilterButton();

  const today = new Date();
  const filterCases = [
    { preset: "Today", date: DateUtils.addDaysYYYYMMDD(0) },
    { preset: "Yesterday", date: DateUtils.addDaysYYYYMMDD(-1) },
    { preset: "Last 7 Days", date: DateUtils.addDaysYYYYMMDD(-3) },
    { preset: "Last 30 Days", date: DateUtils.addDaysYYYYMMDD(-15) },
    {
      preset: "This Month",
      date: DateUtils.addDaysYYYYMMDD(1 - today.getDate()),
    },
  ];

  for (const filterCase of filterCases) {
    await crmCustomerDbHelper.updateCustomerCreatedOn(
      companyId,
      customer.email,
      filterCase.date,
    );
    await customerPage.selectCreatedDatePreset(filterCase.preset);
    await customerPage.selectFilterType("Email Address");
    await customerPage.enterFilterValue(customer.email);
    await customerPage.clickApplyFilters();
    await customerPage.verifyCustomerVisible(
      customer.firstName,
      customer.lastName,
    );
    await customerPage.clickResetFilters();
  }

  const customStartDate = new Date(today);
  customStartDate.setDate(today.getDate() - 1);
  const customDate = DateUtils.addDaysYYYYMMDD(-1);
  await crmCustomerDbHelper.updateCustomerCreatedOn(
    companyId,
    customer.email,
    customDate,
  );
  await customerPage.selectCreatedDateCustomRange(customStartDate, today);
  await customerPage.selectFilterType("Email Address");
  await customerPage.enterFilterValue(customer.email);
  await customerPage.clickApplyFilters();
  await customerPage.verifyCustomerVisible(
    customer.firstName,
    customer.lastName,
  );
  await customerPage.clickResetFilters();
});

test("Apply multiple Customer filters together", async ({
  crmLoginPage,
  crmLeftMenuPage,
  customerPage,
  crmCustomerDbHelper,
}) => {
  test.slow();

  const credentials = ConfigManager.testData;
  const companyId = Number(credentials.crmCompanyId);
  if (!Number.isInteger(companyId)) {
    throw new Error(
      "CRMCompanyID is missing or invalid for the active property",
    );
  }

  const firstName = TestDataGenerator.firstName();
  const lastName = TestDataGenerator.lastName();
  const email = GmailHelper.createUniqueRecipient(`customer-${firstName}-${lastName}`);
  const assignedStaff = credentials.loginName;
  const status = "Active";
  const today = DateUtils.addDaysYYYYMMDD(0);
  const todayDate = new Date(`${today}T00:00:00`);

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );

  await crmLeftMenuPage.clickCustomerIcon();
  await createCustomer(
    customerPage,
    { firstName, lastName, email },
    { assignedStaff, callBackDate: today },
  );

  await crmCustomerDbHelper.updateCustomerCreatedOn(companyId, email, today);
  await crmCustomerDbHelper.updateCustomerStatus(companyId, email, status);

  await customerPage.clickFilterButton();

  await customerPage.selectCreatedDatePreset("Today");
  await customerPage.selectCallBackDateCustomRange(todayDate);
  await customerPage.selectFilterType("Email Address");
  await customerPage.enterFilterValue(email);
  await customerPage.clickApplyFilters();
  await customerPage.verifySingleFilteredCustomer(
    firstName,
    lastName,
  );
  await customerPage.clickResetFilters();

  await customerPage.selectStatusFilter(status);
  await customerPage.selectAssignedStaffFilter(assignedStaff);
  await customerPage.selectFilterType("Email Address");
  await customerPage.enterFilterValue(email);
  await customerPage.clickApplyFilters();
  await customerPage.verifySingleFilteredCustomer(
    firstName,
    lastName,
  );
  await customerPage.clickResetFilters();

  await customerPage.selectCreatedDatePreset("Today");
  await customerPage.selectCallBackDateCustomRange(todayDate);
  await customerPage.selectStatusFilter(status);
  await customerPage.selectAssignedStaffFilter(assignedStaff);
  await customerPage.selectFilterType("Email Address");
  await customerPage.enterFilterValue(email);
  await customerPage.clickApplyFilters();
  await customerPage.verifySingleFilteredCustomer(
    firstName,
    lastName,
  );
});

test("Create a Customer with a newly added custom field and filter in customer list page", async ({
  crmLoginPage,
  crmLeftMenuPage,
  customerPage,
}) => {
  const credentials = ConfigManager.testData;
  const firstName = TestDataGenerator.firstName();
  const lastName = TestDataGenerator.lastName();
  const customizedFieldValue = `Custom-${firstName}-${lastName}`;

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );

  await crmLeftMenuPage.clickCustomerIcon();
  await createCustomer(
    customerPage,
    {
      firstName,
      lastName,
      email: GmailHelper.createUniqueRecipient(`customer-${firstName}-${lastName}`),
    },
    { customizedField: customizedFieldValue },
  );

  await customerPage.clickFilterButton();
  await customerPage.selectFilterType("Customer Customized Field");
  await customerPage.enterFilterValue(customizedFieldValue);
  await customerPage.clickApplyFilters();
  await customerPage.verifySingleFilteredCustomer(
    firstName,
    lastName,
  );
});

test("Verify bulk emails are successfully delivered to valid Customer email addresses", async ({
  crmLoginPage,
  crmLeftMenuPage,
  customerPage,
  responsePage,
  crmCustomerDbHelper,
}) => {
  test.slow();
  const credentials = ConfigManager.testData;
  const customers = [{
    firstName: TestDataGenerator.firstName(),
    lastName: TestDataGenerator.lastName(),
    email: "tester1gracesoft@gmail.com",
  }];

  const companyId = 1030;
  if (await crmCustomerDbHelper.customerExistsByEmail(companyId, customers[0].email)) {
    await crmCustomerDbHelper.deleteCustomerByEmail(companyId, customers[0].email);
  }

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );
  await crmLeftMenuPage.clickCustomerIcon();

  for (const customer of customers) {
    await createCustomer(customerPage, customer);
  }

  for (const customer of customers) {
    await customerPage.selectCustomer(customer.firstName, customer.lastName);
  }

  // The CRM grid can refresh after selection; an idempotent second pass keeps
  // every intended recipient selected immediately before opening Bulk Email.
  for (const customer of customers) {
    await customerPage.selectCustomer(customer.firstName, customer.lastName);
  }

  await customerPage.clickBulkEmail();
  await responsePage.verifyDisplayed();
  await responsePage.verifyToCount(customers.length);
  await responsePage.selectFirstAvailableTemplate();
  await responsePage.enterCallBackDate(DateUtils.addDaysYYYYMMDD(1));
  const sentAfter = new Date();
  await responsePage.clickSendEmail();
  await responsePage.verifyEmailSentSuccessfully();

  for (const customer of customers) {
    await GmailHelper.verifyEmailReceived(customer.email, sentAfter);
  }
});

test("Verify response by email for a Customer is sent, received, and tracked in Activity", async ({
  crmLoginPage, crmLeftMenuPage, customerPage, responsePage,
}) => {
  test.setTimeout(210000);
  const credentials = ConfigManager.testData;
  const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  // A unique Gmail alias avoids duplicate customer emails while delivering to the configured inbox.
  const recipient = ConfigManager.gmail.email.replace(/@/, `+customer-response-${uniqueId}@`);
  const customer = {
    firstName: TestDataGenerator.firstName(),
    lastName: TestDataGenerator.lastName(),
    email: recipient,
  };
  const subject = `Automation Customer Response ${uniqueId}`;
  await crmLoginPage.loginToCRM(
    credentials.propertyShortName, credentials.loginName, credentials.password,
  );
  await crmLeftMenuPage.clickCustomerIcon();
  await createCustomer(customerPage, customer);
  await customerPage.clickResponse(customer.firstName, customer.lastName);
  await responsePage.verifyInboxDisplayed();
  await responsePage.selectFirstAvailableTemplate();
  await responsePage.enterCallBackDate(DateUtils.addDaysYYYYMMDD(1));
  await responsePage.enterSubject(subject);
  const sentAfter = new Date();
  await responsePage.sendInboxEmail();
  await crmLeftMenuPage.clickCustomerIcon();
  await customerPage.verifyResponseCount(customer.firstName, customer.lastName, 1);
  await customerPage.clickResponseCount(customer.firstName, customer.lastName);
  await responsePage.verifyInboxDisplayed();
  await responsePage.verifyEmailActivity(subject, credentials.loginName);
  await GmailHelper.verifyEmailReceived(recipient, sentAfter, 120_000, subject);
});

type CustomerCreationOptions = {
  selectFirstAvailableOptions?: boolean;
  assignedStaff?: string;
  callBackDate?: string;
  customizedField?: string;
};

async function createCustomer(
  customerPage: CustomerPage,
  customer: Pick<CustomerData, "firstName" | "lastName" | "email"> &
    Partial<CustomerData>,
  options: CustomerCreationOptions = {},
): Promise<void> {
  await customerPage.clickAddCustomer();
  await customerPage.enterFirstName(customer.firstName);
  await customerPage.enterLastName(customer.lastName);
  await customerPage.enterEmail(customer.email);

  if (customer.phone) await customerPage.enterPhone(customer.phone);
  if (customer.company) await customerPage.enterCompany(customer.company);
  if (customer.address) await customerPage.enterAddress(customer.address);
  if (customer.city) await customerPage.enterCity(customer.city);
  if (customer.state) await customerPage.enterState(customer.state);
  if (customer.postalCode)
    await customerPage.enterPostalCode(customer.postalCode);
  if (customer.country) await customerPage.enterCountry(customer.country);
  if (customer.notes) await customerPage.enterNotes(customer.notes);
  if (options.assignedStaff) {
    await customerPage.selectAssignStaff(options.assignedStaff);
  }
  if (options.callBackDate) {
    await customerPage.enterCallBackDate(options.callBackDate);
  }
  if (options.customizedField) {
    await customerPage.enterCustomizedField(options.customizedField);
  }
  if (options.selectFirstAvailableOptions) {
    await customerPage.selectFirstAvailableCustomerStatus();
    await customerPage.selectFirstAvailableAssignedStaff();
  }

  await customerPage.clickSaveCustomer();
  await customerPage.verifyCustomerSaved();
}

function toSubmissionDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${month}/${day}/${year}`;
}
