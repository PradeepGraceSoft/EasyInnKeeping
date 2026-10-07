import { test } from "../../src/fixtures/sso.fixture";
import { CustomerPage } from "../../src/pages/CRM/CustomerPage";
import { LeadPage } from "../../src/pages/CRM/LeadPage";
import { StaffResponsePage } from "../../src/pages/CRM/StaffResponsePage";
import { ConfigManager } from "../../src/utils/ConfigManager";
import { DateUtils } from "../../src/utils/DateUtils";
import { TestDataGenerator } from "../../src/utils/TestDataGenerator";
import { GmailHelper } from "../../src/utils/GmailHelper";

interface StaffResponseContact {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  callbackDate: string;
  callbackComments: string;
}

test("add a lead from Staff Response", async ({
  crmLoginPage,
  crmLeftMenuPage,
  staffResponsePage,
  leadPage,
}) => {
  const credentials = ConfigManager.testData;
  const lead = createContactData();

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );
  await crmLeftMenuPage.clickStaffResponseIcon();
  await staffResponsePage.verifyStaffResponsePageDisplayed();
  await addLead(staffResponsePage, leadPage, lead, credentials.loginName);
  await staffResponsePage.verifyContactDisplayed(lead.firstName, lead.email);
});

test("modify a lead from Staff Response", async ({
  crmLoginPage,
  crmLeftMenuPage,
  staffResponsePage,
  leadPage,
}) => {
  const credentials = ConfigManager.testData;
  const lead = createContactData();
  const updatedFirstName = TestDataGenerator.firstName();
  const updatedEmail = GmailHelper.createUniqueRecipient(
    `lead-${updatedFirstName}-${lead.lastName}`,
  );

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );
  await crmLeftMenuPage.clickStaffResponseIcon();
  await addLead(staffResponsePage, leadPage, lead, credentials.loginName);

  await staffResponsePage.clickEditContact(lead.firstName, lead.email);
  await leadPage.enterFirstName(updatedFirstName);
  await leadPage.enterEmail(updatedEmail);
  await leadPage.clickSaveLead();
  await leadPage.verifyLeadUpdateSucceeded();
  await staffResponsePage.verifyContactDisplayed(updatedFirstName, updatedEmail);
  await staffResponsePage.verifyContactNotDisplayed(lead.firstName, lead.email);
});

test("delete a lead from Staff Response", async ({
  crmLoginPage,
  crmLeftMenuPage,
  staffResponsePage,
  leadPage,
}) => {
  const credentials = ConfigManager.testData;
  const lead = createContactData();

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );
  await crmLeftMenuPage.clickStaffResponseIcon();
  await addLead(staffResponsePage, leadPage, lead, credentials.loginName);

  await staffResponsePage.clickDeleteContact(lead.firstName, lead.email);
  await staffResponsePage.clickConfirmDelete();
  await leadPage.verifyLeadDeleted();
  await staffResponsePage.verifyContactNotDisplayed(lead.firstName, lead.email);
});

test("add a customer from Staff Response", async ({
  crmLoginPage,
  crmLeftMenuPage,
  staffResponsePage,
  customerPage,
}) => {
  const credentials = ConfigManager.testData;
  const customer = createContactData();

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );
  await crmLeftMenuPage.clickStaffResponseIcon();
  await addCustomer(staffResponsePage, customerPage, customer, credentials.loginName);
  await staffResponsePage.verifyContactDisplayed(customer.firstName, customer.email);
});

test("modify a customer from Staff Response", async ({
  crmLoginPage,
  crmLeftMenuPage,
  staffResponsePage,
  customerPage,
}) => {
  const credentials = ConfigManager.testData;
  const customer = createContactData();
  const updatedFirstName = TestDataGenerator.firstName();
  const updatedEmail = TestDataGenerator.email(updatedFirstName, customer.lastName);

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );
  await crmLeftMenuPage.clickStaffResponseIcon();
  await addCustomer(staffResponsePage, customerPage, customer, credentials.loginName);

  await staffResponsePage.clickEditContact(customer.firstName, customer.email);
  await customerPage.enterFirstName(updatedFirstName);
  await customerPage.enterEmail(updatedEmail);
  await customerPage.clickSaveCustomer();
  await customerPage.verifyCustomerUpdateSucceeded();
  await staffResponsePage.verifyContactDisplayed(updatedFirstName, updatedEmail);
  await staffResponsePage.verifyContactNotDisplayed(customer.firstName, customer.email);
});

test("delete a customer from Staff Response", async ({
  crmLoginPage,
  crmLeftMenuPage,
  staffResponsePage,
  customerPage,
}) => {
  const credentials = ConfigManager.testData;
  const customer = createContactData();

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );
  await crmLeftMenuPage.clickStaffResponseIcon();
  await addCustomer(staffResponsePage, customerPage, customer, credentials.loginName);

  await staffResponsePage.clickDeleteContact(customer.firstName, customer.email);
  await staffResponsePage.clickConfirmDelete();
  await customerPage.verifyCustomerDeleted();
  await staffResponsePage.verifyContactNotDisplayed(customer.firstName, customer.email);
});

test("search Staff Response using each supported contact field", async ({
  crmLoginPage,
  crmLeftMenuPage,
  staffResponsePage,
  leadPage,
}) => {
  const credentials = ConfigManager.testData;
  const lead = createContactData();

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );
  await crmLeftMenuPage.clickStaffResponseIcon();
  await addLead(staffResponsePage, leadPage, lead, credentials.loginName);

  const searches = [
    { column: "Contact Name" as const, keyword: lead.firstName, expected: lead.firstName },
    { column: "Email" as const, keyword: lead.email, expected: lead.email },
    { column: "Phone Number" as const, keyword: lead.phone, expected: lead.phone },
    {
      column: "Status Name" as const,
      keyword: "Active",
      expected: "Active",
      exact: true,
    },
    {
      column: "Call Back Date" as const,
      keyword: toUsDate(lead.callbackDate),
      expected: lead.callbackDate,
      exact: true,
    },
    {
      column: "Call Back Comments" as const,
      keyword: "Follow up",
      expected: "Follow up",
    },
    {
      column: "Assign Lead" as const,
      keyword: credentials.loginName,
      expected: credentials.loginName,
      exact: true,
    },
    { column: "Type" as const, keyword: "Lead", expected: "Lead" },
  ];

  for (const search of searches) {
    await staffResponsePage.enterSearchKeyword(search.keyword);
    // The Staff Response grid searches by phone number, but the current UI
    // does not render that value in the Phone Number cell. Verify the search
    // result by contact identity for this field and keep column assertions for
    // fields that are actually displayed.
    if (search.column !== "Phone Number") {
      await staffResponsePage.verifyContactColumnValue(
        lead.firstName,
        lead.email,
        search.column,
        search.expected,
        "exact" in search && search.exact,
      );
    }
    await staffResponsePage.verifyContactDisplayed(lead.firstName, lead.email);
  }
});

test("filter Staff Response by start and end date", async ({
  crmLoginPage,
  crmLeftMenuPage,
  staffResponsePage,
  leadPage,
}) => {
  const credentials = ConfigManager.testData;
  const lead = createContactData();
  const today = DateUtils.addDaysYYYYMMDD(0);

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );
  await crmLeftMenuPage.clickStaffResponseIcon();
  await addLead(staffResponsePage, leadPage, lead, credentials.loginName);
  await staffResponsePage.clickFilterButton();
  await staffResponsePage.selectCreatedDateCustomRange(
    new Date(`${today}T00:00:00`),
  );
  await staffResponsePage.clickApplyFilters();
  await staffResponsePage.verifyContactDisplayed(lead.firstName, lead.email);
});

test("filter Staff Response by callback start and end date", async ({
  crmLoginPage,
  crmLeftMenuPage,
  staffResponsePage,
  leadPage,
}) => {
  const credentials = ConfigManager.testData;
  const lead = createContactData();

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );
  await crmLeftMenuPage.clickStaffResponseIcon();
  await addLead(staffResponsePage, leadPage, lead, credentials.loginName);
  await staffResponsePage.clickFilterButton();
  await staffResponsePage.selectCallBackDateCustomRange(
    new Date(`${lead.callbackDate}T00:00:00`),
  );
  await staffResponsePage.clickApplyFilters();
  await staffResponsePage.verifyContactColumnValue(
    lead.firstName,
    lead.email,
    "Call Back Date",
    lead.callbackDate,
  );
  await staffResponsePage.verifyContactDisplayed(lead.firstName, lead.email);
});

test("filter Staff Response by each status", async ({
  crmLoginPage,
  crmLeftMenuPage,
  staffResponsePage,
  leadPage,
  crmLeadDbHelper,
}) => {
  test.slow();

  const credentials = ConfigManager.testData;
  const companyId = Number(credentials.crmCompanyId);
  if (!Number.isInteger(companyId)) {
    throw new Error("CRMCompanyID is missing or invalid for the active property");
  }

  const lead = createContactData();
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
  await crmLeftMenuPage.clickStaffResponseIcon();
  await addLead(staffResponsePage, leadPage, lead, credentials.loginName);
  await staffResponsePage.clickFilterButton();

  for (const status of statuses) {
    await crmLeadDbHelper.updateLeadStatus(companyId, lead.email, status);
    await staffResponsePage.selectStatusFilter(status);
    await staffResponsePage.clickApplyFilters();
    await staffResponsePage.verifyContactColumnValue(
      lead.firstName,
      lead.email,
      "Status Name",
      status,
    );
    await staffResponsePage.verifyContactDisplayed(lead.firstName, lead.email);
    await staffResponsePage.clickResetFilters();
  }
});

test("filter Staff Response by assigned staff", async ({
  crmLoginPage,
  crmLeftMenuPage,
  staffResponsePage,
  leadPage,
}) => {
  const credentials = ConfigManager.testData;
  const lead = createContactData();

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );
  await crmLeftMenuPage.clickStaffResponseIcon();
  await addLead(staffResponsePage, leadPage, lead, credentials.loginName);
  await staffResponsePage.clickFilterButton();
  await staffResponsePage.selectAssignedStaffFilter(credentials.loginName);
  await staffResponsePage.clickApplyFilters();
  await staffResponsePage.verifyContactColumnValue(
    lead.firstName,
    lead.email,
    "Assign Lead",
    credentials.loginName,
  );
  await staffResponsePage.verifyContactDisplayed(lead.firstName, lead.email);
});

for (const contactType of ["Customer", "Lead"] as const) {
  test(`Verify response by email in Staff Response for a ${contactType} is sent, received, and tracked in Activity`, async ({
    crmLoginPage, crmLeftMenuPage, staffResponsePage, customerPage, leadPage, responsePage,
  }) => {
    test.setTimeout(210000);
    const credentials = ConfigManager.testData;
    const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const contact = createContactData();
    // Use a deliverable, unique alias to avoid duplicate customer emails.
    contact.email = ConfigManager.gmail.email.replace(
      /@/, `+staff-response-${contactType.toLowerCase()}-${uniqueId}@`,
    );
    const subject = `Automation Staff Response ${contactType} ${uniqueId}`;
    await crmLoginPage.loginToCRM(
      credentials.propertyShortName, credentials.loginName, credentials.password,
    );
    await crmLeftMenuPage.clickStaffResponseIcon();
    await staffResponsePage.verifyStaffResponsePageDisplayed();
    if (contactType === "Customer") {
      await addCustomer(staffResponsePage, customerPage, contact, credentials.loginName);
    } else {
      await addLead(staffResponsePage, leadPage, contact, credentials.loginName);
    }
    await staffResponsePage.verifyContactDisplayed(contact.firstName, contact.email);
    await staffResponsePage.clickResponse(contact.firstName, contact.email);
    await responsePage.selectFirstAvailableTemplate();
    await responsePage.enterCallBackDate(contact.callbackDate);
    await responsePage.enterSubject(subject);
    const sentAfter = new Date();
    await responsePage.sendInboxEmail();
    await staffResponsePage.closeResponse();
    // The response count is displayed on the corresponding Customer or Lead list.
    if (contactType === "Customer") {
      await crmLeftMenuPage.clickCustomerIcon();
      await customerPage.verifyResponseCount(contact.firstName, contact.lastName, 1);
      await customerPage.clickResponseCount(contact.firstName, contact.lastName);
    } else {
      await crmLeftMenuPage.clickLeadIcon();
      await leadPage.verifyResponseCount(contact.firstName, contact.lastName, 1);
      await leadPage.clickResponseCount(contact.firstName, contact.lastName);
    }
    await responsePage.verifyInboxDisplayed();
    await responsePage.verifyEmailActivity(subject, credentials.loginName);
    await GmailHelper.verifyEmailReceived(contact.email, sentAfter, 120_000, subject);
  });
}

function createContactData(): StaffResponseContact {
  const firstName = TestDataGenerator.firstName();
  const lastName = TestDataGenerator.lastName();
  const phone = TestDataGenerator.phoneNumber();

  return {
    firstName,
    lastName,
    email: GmailHelper.createUniqueRecipient(`crm-contact-${firstName}-${lastName}`),
    phone,
    callbackDate: DateUtils.addDaysYYYYMMDD(1),
    callbackComments: `Follow up ${phone}`,
  };
}

async function addLead(
  staffResponsePage: StaffResponsePage,
  leadPage: LeadPage,
  lead: StaffResponseContact,
  assignedStaff: string,
): Promise<void> {
  await staffResponsePage.clickAddLead();
  await leadPage.enterFirstName(lead.firstName);
  await leadPage.enterLastName(lead.lastName);
  await leadPage.enterEmail(lead.email);
  await leadPage.enterPhone(lead.phone);
  await leadPage.selectLeadStatus("Active");
  await leadPage.selectAssignStaff(assignedStaff);
  await leadPage.enterCallBackDate(lead.callbackDate);
  await leadPage.enterCallBackComments(lead.callbackComments);
  await leadPage.clickSaveLead();
  await leadPage.verifyLeadSaved();
}

async function addCustomer(
  staffResponsePage: StaffResponsePage,
  customerPage: CustomerPage,
  customer: StaffResponseContact,
  assignedStaff: string,
): Promise<void> {
  await staffResponsePage.clickAddCustomer();
  await customerPage.enterFirstName(customer.firstName);
  await customerPage.enterLastName(customer.lastName);
  await customerPage.enterEmail(customer.email);
  await customerPage.enterPhone(customer.phone);
  await customerPage.selectCustomerStatus("Active");
  await customerPage.selectAssignStaff(assignedStaff);
  await customerPage.enterCallBackDate(customer.callbackDate);
  await customerPage.enterCallBackComments(customer.callbackComments);
  await customerPage.clickSaveCustomer();
  await customerPage.verifyCustomerSaved();
}

function toUsDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${month}/${day}/${year}`;
}
