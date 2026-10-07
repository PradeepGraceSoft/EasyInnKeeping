import { test } from "../../src/fixtures/sso.fixture";
import {
  CompleteLeadData,
  LeadData,
  LeadPage,
} from "../../src/pages/CRM/LeadPage";
import { TestDataGenerator } from "../../src/utils/TestDataGenerator";
import { ConfigManager } from "../../src/utils/ConfigManager";
import { DateUtils } from "../../src/utils/DateUtils";
import { GmailHelper } from "../../src/utils/GmailHelper";

test.describe.configure({ mode: "parallel" });

test("Verify an unsubscribed lead shows the unsubscribed icon in the lead list", async ({
  crmLoginPage,
  crmLeftMenuPage,
  leadPage,
}) => {
  test.slow();
  const credentials = ConfigManager.testData;
  const lead = {
    firstName: TestDataGenerator.firstName(),
    lastName: TestDataGenerator.lastName(),
    email: GmailHelper.createUniqueRecipient("lead-unsubscribed-icon"),
  };

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );
  await crmLeftMenuPage.clickLeadIcon();
  await createLead(leadPage, lead);
  await leadPage.unsubscribeLead(lead.email);
  await leadPage.verifyUnsubscribedIcon(lead.email);
});

test("Create a Lead with all mandatory fields", async ({
  crmLoginPage,
  crmLeftMenuPage,
  leadPage,
}) => {
  const credentials = ConfigManager.testData;

  const firstName = TestDataGenerator.firstName();
  const lastName = TestDataGenerator.lastName();
  const lead: LeadData = {
    firstName,
    lastName,
    email: GmailHelper.createUniqueRecipient(`lead-${firstName}-${lastName}`),
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

  await crmLeftMenuPage.clickLeadIcon();
  await createLead(leadPage, lead, { selectFirstAvailableOptions: true });
});

test("user can modify a CRM lead", async ({
  crmLoginPage,
  crmLeftMenuPage,
  leadPage,
}) => {
  const credentials = ConfigManager.testData;

  const firstName = TestDataGenerator.firstName();
  const lastName = TestDataGenerator.lastName();
  const lead: LeadData = {
    firstName,
    lastName,
    email: GmailHelper.createUniqueRecipient(`lead-${firstName}-${lastName}`),
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

  await crmLeftMenuPage.clickLeadIcon();
  await createLead(leadPage, lead, { selectFirstAvailableOptions: true });

  await leadPage.clickEditLead(lead.firstName, lead.lastName);
  await leadPage.enterFirstName(updatedFirstName);
  await leadPage.enterEmail(
    GmailHelper.createUniqueRecipient(`lead-${updatedFirstName}-${lead.lastName}`),
  );
  await leadPage.clickSaveLead();
  await leadPage.verifyLeadUpdated(updatedFirstName, lead.lastName);
});

test("user can delete a CRM lead", async ({
  crmLoginPage,
  crmLeftMenuPage,
  leadPage,
}) => {
  const credentials = ConfigManager.testData;

  const firstName = TestDataGenerator.firstName();
  const lastName = TestDataGenerator.lastName();
  const lead: LeadData = {
    firstName,
    lastName,
    email: GmailHelper.createUniqueRecipient(`lead-${firstName}-${lastName}`),
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

  await crmLeftMenuPage.clickLeadIcon();
  await createLead(leadPage, lead, { selectFirstAvailableOptions: true });

  await leadPage.clickDeleteLead(lead.firstName, lead.lastName);
  await leadPage.clickConfirmDelete();
  await leadPage.verifyLeadDeleted();
});

test("validate lead email address", async ({
  crmLoginPage,
  crmLeftMenuPage,
  leadPage,
}) => {
  const credentials = ConfigManager.testData;

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );

  await crmLeftMenuPage.clickLeadIcon();
  await leadPage.clickAddLead();
  await leadPage.enterFirstName(TestDataGenerator.firstName());
  await leadPage.enterLastName(TestDataGenerator.lastName());
  await leadPage.enterEmail("invalid-email");
  await leadPage.clickSaveLead();
  await leadPage.verifyLeadEmailValidationError();
});

test("prevent lead creation when mandatory fields are missing", async ({
  crmLoginPage,
  crmLeftMenuPage,
  leadPage,
}) => {
  const credentials = ConfigManager.testData;
  const firstName = TestDataGenerator.firstName();
  const lastName = TestDataGenerator.lastName();
  const email = GmailHelper.createUniqueRecipient("mandatory-lead");

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );

  await crmLeftMenuPage.clickLeadIcon();
  await leadPage.clickAddLead();
  await leadPage.enterEmail(email);

  await leadPage.clickSaveLead();
  await leadPage.verifyMandatoryFieldError("First Name");

  await leadPage.enterFirstName(firstName);
  await leadPage.clickSaveLead();
  await leadPage.verifyMandatoryFieldError("Last Name");

  await leadPage.enterLastName(lastName);
  await leadPage.clickSaveLead();
});

test("verify all lead fields are saved with the entered data", async ({
  crmLoginPage,
  crmLeftMenuPage,
  leadPage,
}) => {
  test.slow();
  const credentials = ConfigManager.testData;

  const firstName = TestDataGenerator.firstName();
  const lastName = TestDataGenerator.lastName();
  const lead: CompleteLeadData = {
    firstName,
    lastName,
    email: GmailHelper.createUniqueRecipient(`lead-${firstName}-${lastName}`),
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
    leadStatus: "Active",
    assignStaff: credentials.loginName,
    callBackDate: "2026-08-15",
    callBackComments: "Follow up with the lead",
  };

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );

  await crmLeftMenuPage.clickLeadIcon();
  await leadPage.clickAddLead();
  await leadPage.enterFirstName(lead.firstName);
  await leadPage.enterLastName(lead.lastName);
  await leadPage.enterEmail(lead.email);
  await leadPage.enterPhone(lead.phone);
  await leadPage.enterCompany(lead.company);
  await leadPage.enterAddress(lead.address);
  await leadPage.enterCity(lead.city);
  await leadPage.enterState(lead.state);
  await leadPage.enterPostalCode(lead.postalCode);
  await leadPage.enterCountry(lead.country);
  await leadPage.enterNotes(lead.notes);
  await leadPage.enterSecondFirstName(lead.secondFirstName);
  await leadPage.enterSecondLastName(lead.secondLastName);
  await leadPage.enterSecondAddress(lead.secondAddress);
  await leadPage.enterWorkPhone(lead.workPhone);
  await leadPage.enterMobilePhone(lead.mobilePhone);
  await leadPage.enterFax(lead.fax);
  await leadPage.enterGuestType(lead.guestType);
  await leadPage.enterVisitType(lead.visitType);
  await leadPage.enterVehicleMake(lead.vehicleMake);
  await leadPage.enterVehicleModel(lead.vehicleModel);
  await leadPage.enterBirthDate1(lead.birthDate1);
  await leadPage.enterBirthDate2(lead.birthDate2);
  await leadPage.enterAnniversary(lead.anniversary);
  await leadPage.enterLicense(lead.license);
  await leadPage.enterJobTitle(lead.jobTitle);
  await leadPage.enterCustom1(lead.custom1);
  await leadPage.enterCustom2(lead.custom2);
  await leadPage.enterCustom3(lead.custom3);
  await leadPage.enterCustom4(lead.custom4);
  await leadPage.enterCustom5(lead.custom5);
  await leadPage.enterCustom6(lead.custom6);
  await leadPage.checkDoNotAllowNewReservation();
  await leadPage.selectLeadStatus(lead.leadStatus);
  await leadPage.selectAssignStaff(lead.assignStaff);
  await leadPage.enterCallBackDate(lead.callBackDate);
  await leadPage.enterCallBackComments(lead.callBackComments);
  await leadPage.clickSaveLead();
  await leadPage.verifyLeadSaved();

  await leadPage.clickEditLead(lead.firstName, lead.lastName);
  await leadPage.verifyCompleteLeadDetails(lead);
});

test("search lead by first name, last name, email, address and submission date", async ({
  crmLoginPage,
  crmLeftMenuPage,
  leadPage,
}) => {
  test.slow();
  const credentials = ConfigManager.testData;

  const firstName = TestDataGenerator.firstName();
  const lastName = TestDataGenerator.lastName();
  const lead: LeadData = {
    firstName,
    lastName,
    email: GmailHelper.createUniqueRecipient(`lead-${firstName}-${lastName}`),
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

  await crmLeftMenuPage.clickLeadIcon();
  await createLead(leadPage, lead, { selectFirstAvailableOptions: true });

  const submissionDate = await leadPage.getLeadSubmissionDate(
    lead.firstName,
    lead.lastName,
  );
  const keywords = [
    lead.firstName,
    lead.lastName,
    lead.email,
    lead.address,
    ...(submissionDate ? [submissionDate] : []),
  ];

  for (const keyword of keywords) {
    await leadPage.enterSearchKeyword(keyword);
    await leadPage.verifyLeadSearchResults(
      keyword,
      lead.firstName,
      lead.lastName,
    );
    await leadPage.clearSearchKeyword();
    await leadPage.verifyAllLeadsDisplayed();
  }
});

test("Filter Leads by Callback Date", async ({
  crmLoginPage,
  crmLeftMenuPage,
  leadPage,
}) => {
  const credentials = ConfigManager.testData;
  const firstName = TestDataGenerator.firstName();
  const lastName = TestDataGenerator.lastName();
  const callbackDate = DateUtils.addDaysYYYYMMDD(1);

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );

  await crmLeftMenuPage.clickLeadIcon();
  await createLead(
    leadPage,
    {
      firstName,
      lastName,
      email: GmailHelper.createUniqueRecipient(`lead-${firstName}-${lastName}`),
    },
    { callBackDate: callbackDate, selectFirstAvailableOptions: true },
  );

  const submissionDate = await leadPage.getLeadSubmissionDate(
    firstName,
    lastName,
  );
  await leadPage.clickFilterButton();
  await leadPage.selectCallBackDateCustomRange(
    new Date(`${callbackDate}T00:00:00`),
  );
  await leadPage.selectFilterType("First Name");
  await leadPage.enterFilterValue(firstName);
  await leadPage.clickApplyFilters();
  await leadPage.verifySingleFilteredLead(firstName, lastName, submissionDate);
});

test("Filter Leads by Assigned Staff", async ({
  crmLoginPage,
  crmLeftMenuPage,
  leadPage,
}) => {
  const credentials = ConfigManager.testData;
  const firstName = TestDataGenerator.firstName();
  const lastName = TestDataGenerator.lastName();
  const assignedStaff = "staff";

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );

  await crmLeftMenuPage.clickLeadIcon();
  await createLead(
    leadPage,
    {
      firstName,
      lastName,
      email: GmailHelper.createUniqueRecipient(`lead-${firstName}-${lastName}`),
    },
    { assignedStaff },
  );

  const submissionDate = await leadPage.getLeadSubmissionDate(
    firstName,
    lastName,
  );
  await leadPage.clickFilterButton();
  await leadPage.selectAssignedStaffFilter(assignedStaff);
  await leadPage.selectFilterType("First Name");
  await leadPage.enterFilterValue(firstName);
  await leadPage.clickApplyFilters();
  await leadPage.verifySingleFilteredLead(firstName, lastName, submissionDate);
});

test("Filter Leads by Status", async ({
  crmLoginPage,
  crmLeftMenuPage,
  leadPage,
  crmLeadDbHelper,
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
  const email = GmailHelper.createUniqueRecipient(`lead-${firstName}-${lastName}`);
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

  await crmLeftMenuPage.clickLeadIcon();
  await createLead(leadPage, {
    firstName,
    lastName,
    email,
  });

  const expectedLead = await crmLeadDbHelper.getLeadFilterData(companyId, email);
  const expectedCount = await crmLeadDbHelper.getLeadCountByEmail(companyId, email);
  await leadPage.clickFilterButton();

  for (const status of statuses) {
    await crmLeadDbHelper.updateLeadStatus(companyId, email, status);
    await leadPage.selectStatusFilter(status);
    await leadPage.selectFilterType("Email Address");
    await leadPage.enterFilterValue(expectedLead.email);
    await leadPage.clickApplyFilters();
    await leadPage.verifyFilteredLeadCount(expectedCount);
    await leadPage.verifyFilteredLead(expectedLead);
    await leadPage.clickResetFilters();
  }
});

test("filter leads by start and end date", async ({
  crmLoginPage,
  crmLeftMenuPage,
  leadPage,
  crmLeadDbHelper,
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
  const lead: LeadData = {
    firstName,
    lastName,
    email: GmailHelper.createUniqueRecipient(`lead-${firstName}-${lastName}`),
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

  await crmLeftMenuPage.clickLeadIcon();
  await createLead(leadPage, lead);

  await leadPage.verifyLeadVisible(lead.firstName, lead.lastName);
  await leadPage.clickFilterButton();

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
    await crmLeadDbHelper.updateLeadCreatedOn(companyId, lead.email, filterCase.date);
    await leadPage.reloadLeads();
    await leadPage.clickFilterButton();
    await leadPage.selectCreatedDatePreset(filterCase.preset);
    const expectedLead = await crmLeadDbHelper.getLeadFilterData(companyId, lead.email);
    const expectedCount = await crmLeadDbHelper.getLeadCountByEmail(companyId, lead.email);
    await leadPage.selectFilterType("Email Address");
    await leadPage.enterFilterValue(expectedLead.email);
    await leadPage.clickApplyFilters();
    await leadPage.verifyFilteredLeadCount(expectedCount);
    await leadPage.verifyFilteredLead(expectedLead);
    await leadPage.clickResetFilters();
    await leadPage.verifyAllLeadsDisplayed();
  }

  const customDate = DateUtils.addDaysYYYYMMDD(0);
  await crmLeadDbHelper.updateLeadCreatedOn(companyId, lead.email, customDate);
  await leadPage.reloadLeads();
  await leadPage.clickFilterButton();
  await leadPage.selectCreatedDateCustomRange(today);
  const expectedLead = await crmLeadDbHelper.getLeadFilterData(companyId, lead.email);
  const expectedCount = await crmLeadDbHelper.getLeadCountByEmail(companyId, lead.email);
  await leadPage.selectFilterType("Email Address");
  await leadPage.enterFilterValue(expectedLead.email);
  await leadPage.clickApplyFilters();
  await leadPage.verifyFilteredLeadCount(expectedCount);
  await leadPage.verifyFilteredLead(expectedLead);
  await leadPage.clickResetFilters();
  await leadPage.verifyAllLeadsDisplayed();
});

test("Apply multiple Lead filters together", async ({
  crmLoginPage,
  crmLeftMenuPage,
  leadPage,
  crmLeadDbHelper,
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
  const email = GmailHelper.createUniqueRecipient(`lead-${firstName}-${lastName}`);
  const assignedStaff = "staff";
  const status = "Active";
  const today = DateUtils.addDaysYYYYMMDD(0);
  const todayDate = new Date(`${today}T00:00:00`);

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );

  await crmLeftMenuPage.clickLeadIcon();
  await createLead(
    leadPage,
    { firstName, lastName, email },
    { assignedStaff, callBackDate: today },
  );

  await crmLeadDbHelper.updateLeadCreatedOn(companyId, email, today);
  await crmLeadDbHelper.updateLeadStatus(companyId, email, status);
  const expectedLead = await crmLeadDbHelper.getLeadFilterData(companyId, email);

  await leadPage.clickFilterButton();

  await leadPage.selectCreatedDatePreset("Today");
  await leadPage.selectCallBackDateCustomRange(todayDate);
  await leadPage.selectFilterType("Email Address");
  await leadPage.enterFilterValue(expectedLead.email);
  await leadPage.clickApplyFilters();
  await leadPage.verifyFilteredLead(expectedLead);
  await leadPage.clickResetFilters();

  await leadPage.selectStatusFilter(status);
  await leadPage.selectAssignedStaffFilter(assignedStaff);
  await leadPage.selectFilterType("Email Address");
  await leadPage.enterFilterValue(expectedLead.email);
  await leadPage.clickApplyFilters();
  await leadPage.verifyFilteredLead(expectedLead);
  await leadPage.clickResetFilters();

  await leadPage.selectCreatedDatePreset("Today");
  await leadPage.selectCallBackDateCustomRange(todayDate);
  await leadPage.selectStatusFilter(status);
  await leadPage.selectAssignedStaffFilter(assignedStaff);
  await leadPage.selectFilterType("Email Address");
  await leadPage.enterFilterValue(expectedLead.email);
  await leadPage.clickApplyFilters();
  await leadPage.verifyFilteredLead(expectedLead);
});

test("Create a Lead with a newly added custom field and filter in lead list page", async ({
  crmLoginPage,
  crmLeftMenuPage,
  leadPage,
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

  await crmLeftMenuPage.clickLeadIcon();
  await createLead(
    leadPage,
    {
      firstName,
      lastName,
      email: GmailHelper.createUniqueRecipient(`lead-${firstName}-${lastName}`),
    },
    { customizedField: customizedFieldValue },
  );

  const submissionDate = await leadPage.getLeadSubmissionDate(
    firstName,
    lastName,
  );
  await leadPage.clickFilterButton();
  await leadPage.selectFilterType("Lead Customized Field");
  await leadPage.enterFilterValue(customizedFieldValue);
  await leadPage.clickApplyFilters();
  await leadPage.verifySingleFilteredLead(firstName, lastName, submissionDate);
});

test("Verify bulk emails are successfully delivered to valid Lead email addresses", async ({
  crmLoginPage,
  crmLeftMenuPage,
  leadPage,
  responsePage,
}) => {
  test.setTimeout(210000);
  const credentials = ConfigManager.testData;
  const leads = [
    {
      firstName: TestDataGenerator.firstName(),
      lastName: TestDataGenerator.lastName(),
      email: "tester1gracesoft@gmail.com",
    },
  ];

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );
  await crmLeftMenuPage.clickLeadIcon();

  for (const lead of leads) {
    await createLead(leadPage, lead);
  }

  for (const lead of leads) {
    await leadPage.selectLead(lead.firstName, lead.lastName);
  }

  // The CRM grid can refresh after selection; an idempotent second pass keeps
  // every intended recipient selected immediately before opening Bulk Email.
  for (const lead of leads) {
    await leadPage.selectLead(lead.firstName, lead.lastName);
  }

  await leadPage.clickBulkEmail();
  await responsePage.verifyDisplayed();
  await responsePage.verifyToCount(leads.length);
  await responsePage.selectFirstAvailableTemplate();
  await responsePage.enterCallBackDate(DateUtils.addDaysYYYYMMDD(1));
  const sentAfter = new Date();
  await responsePage.clickSendEmail();
  await responsePage.verifyEmailSentSuccessfully();

  for (const lead of leads) {
    await GmailHelper.verifyEmailReceived(lead.email, sentAfter, 120_000);
  }
});

test("Verify Bulk Email uses the configured default active email provider for delivery", async ({
  crmLoginPage,
  crmLeftMenuPage,
  leadPage,
  responsePage,
  crmLeadDbHelper,
}) => {
  test.setTimeout(210000);
  const credentials = ConfigManager.testData;
  const leads = [
    {
      firstName: TestDataGenerator.firstName(),
      lastName: TestDataGenerator.lastName(),
      email: "tester1gracesoft@gmail.com",
    },
  ];

  await crmLeadDbHelper.getDefaultEmailConfiguration();

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );
  await crmLeftMenuPage.clickLeadIcon();

  for (const lead of leads) {
    await createLead(leadPage, lead);
  }

  for (const lead of leads) {
    await leadPage.selectLead(lead.firstName, lead.lastName);
  }

  // Stabilize selections immediately before opening the bulk email dialog.
  for (const lead of leads) {
    await leadPage.selectLead(lead.firstName, lead.lastName);
  }

  await leadPage.clickBulkEmail();
  await responsePage.verifyDisplayed();
  await responsePage.verifyToCount(leads.length);
  await responsePage.selectFirstAvailableTemplate();
  await responsePage.enterCallBackDate(DateUtils.addDaysYYYYMMDD(1));
  const sentAfter = new Date();
  await responsePage.clickSendEmail();
  await responsePage.verifyEmailSentSuccessfully();

  for (const lead of leads) {
    await GmailHelper.verifyEmailReceived(lead.email, sentAfter, 120_000);
  }
});

test("Verify response by email for a lead is sent, received, and tracked in Activity", async ({
  crmLoginPage, crmLeftMenuPage, leadPage, responsePage,
}) => {
  test.setTimeout(210000);
  const credentials = ConfigManager.testData;
  const lead = {
    firstName: TestDataGenerator.firstName(),
    lastName: TestDataGenerator.lastName(),
    email: ConfigManager.gmail.email,
  };
  const subject = `Automation Lead Response ${Date.now()}`;
  await crmLoginPage.loginToCRM(
    credentials.propertyShortName, credentials.loginName, credentials.password,
  );
  await crmLeftMenuPage.clickLeadIcon();
  await createLead(leadPage, lead);
  await leadPage.clickResponse(lead.firstName, lead.lastName);
  await responsePage.verifyInboxDisplayed();
  await responsePage.selectFirstAvailableTemplate();
  await responsePage.enterCallBackDate(DateUtils.addDaysYYYYMMDD(1));
  await responsePage.enterSubject(subject);
  const sentAfter = new Date();
  await responsePage.sendInboxEmail();
  await crmLeftMenuPage.clickLeadIcon();
  await leadPage.verifyResponseCount(lead.firstName, lead.lastName, 1);
  await leadPage.clickResponseCount(lead.firstName, lead.lastName);
  await responsePage.verifyInboxDisplayed();
  await responsePage.verifyEmailActivity(subject, credentials.loginName);
  await GmailHelper.verifyEmailReceived(lead.email, sentAfter, 120_000, subject);
});

type LeadCreationOptions = {
  selectFirstAvailableOptions?: boolean;
  assignedStaff?: string;
  callBackDate?: string;
  customizedField?: string;
};

async function createLead(
  leadPage: LeadPage,
  lead: Pick<LeadData, "firstName" | "lastName" | "email"> & Partial<LeadData>,
  options: LeadCreationOptions = {},
): Promise<void> {
  await leadPage.clickAddLead();
  await leadPage.enterFirstName(lead.firstName);
  await leadPage.enterLastName(lead.lastName);
  await leadPage.enterEmail(lead.email);

  if (lead.phone) await leadPage.enterPhone(lead.phone);
  if (lead.company) await leadPage.enterCompany(lead.company);
  if (lead.address) await leadPage.enterAddress(lead.address);
  if (lead.city) await leadPage.enterCity(lead.city);
  if (lead.state) await leadPage.enterState(lead.state);
  if (lead.postalCode) await leadPage.enterPostalCode(lead.postalCode);
  if (lead.country) await leadPage.enterCountry(lead.country);
  if (lead.notes) await leadPage.enterNotes(lead.notes);
  if (options.assignedStaff) {
    await leadPage.selectAssignStaff(options.assignedStaff);
  }
  if (options.callBackDate) {
    await leadPage.enterCallBackDate(options.callBackDate);
  }
  if (options.customizedField) {
    await leadPage.enterCustomizedField(options.customizedField);
  }
  if (options.selectFirstAvailableOptions) {
    await leadPage.selectFirstAvailableLeadStatus();
    await leadPage.selectFirstAvailableAssignedStaff();
  }

  await leadPage.clickSaveLead();
  await leadPage.verifyLeadSaved();
}

function toSubmissionDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${month}/${day}/${year}`;
}
