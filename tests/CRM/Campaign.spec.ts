import { expect, test } from "../../src/fixtures/sso.fixture";
import {
  CampaignAudience,
  CampaignOperator,
  CampaignPage,
} from "../../src/pages/CRM/CampaignPage";
import { CRMLeftMenuPage } from "../../src/pages/CRM/CRMLeftMenuPage";
import { CustomerPage } from "../../src/pages/CRM/CustomerPage";
import { LeadPage } from "../../src/pages/CRM/LeadPage";
import { ConfigManager } from "../../src/utils/ConfigManager";
import { GmailHelper } from "../../src/utils/GmailHelper";
import { TestDataGenerator } from "../../src/utils/TestDataGenerator";
import { AlertMessages } from "../../src/constants/AlertMessages";
import { ConstNames } from "../../src/constants/ConstNames";
import { SSOUsers } from "../../src/test-data/SSOUsers";
import { OutboundEmailConfigurations } from "../../src/utils/DBHelper/CRMDatabaseHelper";
import type {
  CampaignTextCriterion,
  LeadFieldTextOperator,
} from "../../src/utils/DBHelper/CRMDatabaseHelper";
import type { CRMLoginPage } from "../../src/pages/CRM/CRMLoginPage";
import type { FindReservationPage } from "../../src/pages/FindReservationPage";
import type { ReservationPage } from "../../src/pages/ReservationPage";
import type { SSOLoginPage } from "../../src/pages/SSOLoginPage";
import type { ReservationDatabaseHelper } from "../../src/utils/DBHelper/ReservationDatabaseHelper";

const CAMPAIGN_DELIVERY_EMAIL = "tester1gracesoft@gmail.com";

const LEAD_FIELD_NAMES: ReadonlyArray<string> = [
  "First Name",
  "Last Name",
  "Email Address",
  "City",
  "Cell/Pager",
  "Address",
  "State",
  "First Name 2",
  "Last Name 2",
  "Address 2",
  "Work Phone",
  "Mobile Number",
  "Fax",
  "Country",
  "Zip",
  "Guest Type",
  "Visit Type",
  "Vehicle Make",
  "Vehicle Model",
  "Birth Date 1",
  "Birth Date 2",
  "Anniversary",
  "License",
  "Company Code",
  "Job Title",
  "Custom 1",
  "Custom 2",
  "Custom 3",
  "Custom 4",
  "Custom 5",
  "Custom 6",
  "Do Not Allow New Reservation",
  "Display Notes when creating reservation",
  "Lead Customized Field",
];

const CUSTOMER_FIELD_NAMES: ReadonlyArray<string> = [
  "First Name",
  "Last Name",
  "Email Address",
  "City",
  "Cell/Pager",
  "Address",
  "State",
  "First Name 2",
  "Last Name 2",
  "Address 2",
  "Work Phone",
  "Mobile Number",
  "Fax",
  "Country",
  "Zip",
  "Guest Type",
  "Visit Type",
  "Vehicle Make",
  "Vehicle Model",
  "Birth Date 1",
  "Birth Date 2",
  "Anniversary",
  "License",
  "Company Code",
  "Job Title",
  "Custom 1",
  "Custom 2",
  "Custom 3",
  "Custom 4",
  "Custom 5",
  "Custom 6",
  "Do Not Allow New Reservation",
  "Display Notes when creating reservation",
  "Customer Customized Field",
];

const RESERVATION_FIELD_NAMES: ReadonlyArray<string> = [
  "Arrival Date",
  "Depature Date",
  "Room Name",
  "Room Type",
  "City",
  "Country",
  "State",
  "Reservation Total",
  "Stay Length",
  "Guest Type",
  "Visit Type",
  "Custom1",
  "Custom2",
  "Custom3",
  "Custom4",
  "Custom5",
  "Custom6",
  "Total Stays",
];

const RESERVATION_FIELD_TEST_ORDER: ReadonlyArray<string> = [
  "Guest Type",
  "Visit Type",
  "Custom1",
  "Custom2",
  "Custom3",
  "Custom4",
  "Custom5",
  "Custom6",
  ...RESERVATION_FIELD_NAMES.filter(
    (fieldName) =>
      ![
        "Guest Type",
        "Visit Type",
        "Custom1",
        "Custom2",
        "Custom3",
        "Custom4",
        "Custom5",
        "Custom6",
      ].includes(fieldName),
  ),
];

const DATE_LEAD_FIELD_NAMES = new Set([
  "Birth Date 1",
  "Birth Date 2",
  "Anniversary",
]);

const DATE_CUSTOMER_FIELD_NAMES = new Set([
  "Birth Date 1",
  "Birth Date 2",
  "Anniversary",
]);

const operatorScenarios: ReadonlyArray<{
  title: string;
  operator: CampaignOperator;
  value: string;
}> = [
  { title: "Equals", operator: "Equals", value: "Automation" },
  { title: "Not Equals", operator: "Not Equals", value: "NoMatchAutomation" },
  { title: "Contains", operator: "Contains", value: "a" },
  { title: "Starts with", operator: "Starts With", value: "A" },
  { title: "Ends with", operator: "Ends With", value: "n" },
  { title: "Greater than", operator: "Greater Than", value: "1" },
  { title: "Lesser than", operator: "Less Than", value: "999999" },
  {
    title: "Greater than or Equal",
    operator: "Greater Than Or Equal",
    value: "1",
  },
  {
    title: "Lesser than or Equal",
    operator: "Less Than Or Equal",
    value: "999999",
  },
];

test.describe("Campaign", () => {
  let seededReservationNumbers: string[] = [];

  test.beforeEach(async ({ crmLoginPage, crmLeftMenuPage, campaignPage }) => {
    seededReservationNumbers = [];
    const credentials = ConfigManager.testData;

    await crmLoginPage.loginToCRM(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await crmLeftMenuPage.clickEmailPromotion();
    await campaignPage.clickCampaigns();
    await campaignPage.clickAddCampaign();
  });

  test.afterEach(async ({ reservationApi }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) return;

    for (const confirmationNumber of seededReservationNumbers) {
      await reservationApi.deleteReservation(confirmationNumber);
    }
  });

  // ==================== Common Campaign Coverage ====================

  test("Verify a new Email Campaign can be created and received successfully", async ({
    campaignPage,
    crmLeadDbHelper,
    crmLeftMenuPage,
    crmCustomerDbHelper,
    customerPage,
  }) => {
    test.setTimeout(150_000);
    const campaignName = `Automation Campaign ${Date.now()}`;
    const recipient = CAMPAIGN_DELIVERY_EMAIL;

    const recipientCount =
      await crmCustomerDbHelper.getCustomerFieldRecipientCount(
        getCrmCompanyId(),
        "Email Address",
        "Equals",
        recipient,
      );
    if (recipientCount === 0) {
      await campaignPage.clickCloseCampaign();
      await crmLeftMenuPage.clickCustomerIcon();
      await createCustomer(customerPage, recipient);
      await openCampaign(crmLeftMenuPage, campaignPage);
    }

    await crmLeadDbHelper.activateEmailConfiguration(
      OutboundEmailConfigurations.SENDGRID_API,
    );
    await configureEmailFilter(campaignPage, "Customer", recipient);
    await expect(campaignPage.getEmailCount()).resolves.toBeGreaterThan(0);
    await campaignPage.enterCampaignName(campaignName);
    await campaignPage.enterSubject(
      `Automation Campaign Subject ${Date.now()}`,
    );
    await campaignPage.selectFirstAvailableTemplate();
    await campaignPage.clickCreateCampaign();
    await campaignPage.verifyCampaignCreated(campaignName);
    const sentAfter = new Date();
    await campaignPage.sendCampaignEmails();
    await GmailHelper.verifyEmailReceived(recipient, sentAfter);
  });

  test("Verift if the email count is empty then it should display an alert and should not allow to create the campaign", async ({
    campaignPage,
  }) => {
    const campaignName = `Empty Recipient Campaign ${Date.now()}`;
    const missingRecipient = GmailHelper.createUniqueRecipient(
      "campaign-empty-recipient",
    );
    await configureEmailFilter(campaignPage, "Customer", missingRecipient);
    await expect(campaignPage.getEmailCount()).resolves.toBe(0);
    await campaignPage.enterCampaignName(campaignName);
    await campaignPage.enterSubject("Empty recipient validation");
    await campaignPage.selectFirstAvailableTemplate();
    await campaignPage.clickCreateCampaignExpectingRecipientAlert();
    await campaignPage.verifyRecipientRequired(campaignName);
  });

  test("Verify a campaign cannot be sent without a template.", async ({
    campaignPage,
  }) => {
    const campaignName = `No Template Campaign ${Date.now()}`;
    await campaignPage.selectAudience("Lead");
    await campaignPage.selectFirstFieldName();
    await campaignPage.selectOperator("Contains");
    await campaignPage.enterFilterValue("a");
    await campaignPage.enterCampaignName(campaignName);
    await campaignPage.enterSubject("Template is required");
    await campaignPage.clickCreateCampaignExpectingValidation();
    await campaignPage.verifyTemplateRequired(campaignName);
  });

  test("Verify the campaign uses the configured default active email provider for delivery", async ({
    campaignPage,
    crmLeftMenuPage,
    leadPage,
    crmLeadDbHelper,
  }) => {
    test.setTimeout(150000);
    const provider = OutboundEmailConfigurations.SENDGRID_API;
    const recipient = CAMPAIGN_DELIVERY_EMAIL;

    await crmLeadDbHelper.activateEmailConfiguration(provider);
    await expect(
      crmLeadDbHelper.getEmailConfigurationState(provider),
    ).resolves.toEqual({
      isActive: true,
      isDefault: true,
    });
    const recipientCount = await crmLeadDbHelper.getLeadFieldRecipientCount(
      getCrmCompanyId(),
      "Email Address",
      "Equals",
      recipient,
    );
    if (recipientCount === 0) {
      await campaignPage.clickCloseCampaign();
      await crmLeftMenuPage.clickLeadIcon();
      await createLead(leadPage, recipient);
      await openCampaign(crmLeftMenuPage, campaignPage);
    }
    const sentAfter = await createAndSendCampaign(
      campaignPage,
      recipient,
      "Default Provider",
      "Lead",
    );
    await GmailHelper.verifyEmailReceived(recipient, sentAfter);
  });

  test("Verify emails are successfully delivered to valid campaign recipients", async ({
    campaignPage,
    crmLeftMenuPage,
    crmCustomerDbHelper,
    customerPage,
  }) => {
    test.setTimeout(150000);
    const recipient = CAMPAIGN_DELIVERY_EMAIL;

    const recipientCount =
      await crmCustomerDbHelper.getCustomerFieldRecipientCount(
        getCrmCompanyId(),
        "Email Address",
        "Equals",
        recipient,
      );
    if (recipientCount === 0) {
      await campaignPage.clickCloseCampaign();
      await crmLeftMenuPage.clickCustomerIcon();
      await createCustomer(customerPage, recipient);
      await openCampaign(crmLeftMenuPage, campaignPage);
    }
    const sentAfter = await createAndSendCampaign(
      campaignPage,
      recipient,
      "Delivery",
      "Customer",
    );
    await GmailHelper.verifyEmailReceived(recipient, sentAfter);
  });

  test("Verify Campaign list tracks Total Sent, Pending, Delivered, and Opened counts", async ({
    campaignPage,
    crmCampaignDbHelper,
    crmLeadDbHelper,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.setTimeout(150_000);
    const recipient = GmailHelper.createUniqueRecipient(
      "campaign-status-opened",
    );

    await crmLeadDbHelper.activateEmailConfiguration(
      OutboundEmailConfigurations.SENDGRID_API,
    );
    await campaignPage.clickCloseCampaign();
    await crmLeftMenuPage.clickCustomerIcon();
    await createCustomer(customerPage, recipient);
    await openCampaign(crmLeftMenuPage, campaignPage);
    const campaignName = await createCampaignForStatusTracking(
      campaignPage,
      recipient,
      "Status Opened",
    );

    await campaignPage.verifyCampaignDeliveryStatus(campaignName, {
      totalSent: 1,
      pending: 1,
      delivered: 0,
      failed: 0,
      opened: 0,
    });

    await campaignPage.sendCampaignEmails();
    await campaignPage.reloadCampaignList();
    await campaignPage.verifyCampaignDeliveryStatus(campaignName, {
      totalSent: 1,
      pending: 0,
      delivered: 1,
      failed: 0,
      opened: 0,
    });

    await crmCampaignDbHelper.markCampaignEmailsOpened(campaignName);
    await campaignPage.reloadCampaignList();
    await campaignPage.verifyCampaignDeliveryStatus(campaignName, {
      totalSent: 1,
      pending: 0,
      delivered: 1,
      failed: 0,
      opened: 1,
    });
  });

  test("Verify Campaign list displays one Failed email after a campaign send failure", async ({
    campaignPage,
    crmLeadDbHelper,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.setTimeout(150_000);
    const recipient = GmailHelper.createUniqueRecipient(
      "campaign-status-failed",
    );

    await crmLeadDbHelper.activateEmailConfiguration(
      OutboundEmailConfigurations.SENDGRID_API,
    );
    await campaignPage.clickCloseCampaign();
    await crmLeftMenuPage.clickCustomerIcon();
    await createCustomer(customerPage, recipient);
    await openCampaign(crmLeftMenuPage, campaignPage);
    const campaignName = await createCampaignForStatusTracking(
      campaignPage,
      recipient,
      "Status Failed",
    );

    await crmLeadDbHelper.deactivateEmailConfiguration(
      OutboundEmailConfigurations.SENDGRID_API,
    );
    await campaignPage.sendCampaignEmails();
    await campaignPage.reloadCampaignList();
    await campaignPage.verifyCampaignDeliveryStatus(campaignName, {
      totalSent: 1,
      pending: 0,
      delivered: 0,
      failed: 1,
      opened: 0,
    });
  });

  test("Verify changes to Lead or Customer data are reflected when the campaign audience is evaluated before sending", async ({
    campaignPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();
    const firstName = TestDataGenerator.firstName();
    const lastName = TestDataGenerator.lastName();
    const originalEmail = GmailHelper.createUniqueRecipient(
      "campaign-before-update",
    );
    const updatedEmail = GmailHelper.createUniqueRecipient(
      "campaign-after-update",
    );

    await campaignPage.clickCloseCampaign();
    await crmLeftMenuPage.clickCustomerIcon();
    await createCustomer(customerPage, originalEmail, firstName, lastName);
    await openCampaign(crmLeftMenuPage, campaignPage);
    await configureEmailFilter(campaignPage, "Customer", originalEmail);
    await expect(campaignPage.getEmailCount()).resolves.toBeGreaterThanOrEqual(
      1,
    );

    await campaignPage.clickCloseCampaign();
    await crmLeftMenuPage.clickCustomerIcon();
    await customerPage.clickEditCustomer(firstName, lastName);
    await customerPage.enterEmail(updatedEmail);
    await customerPage.clickSaveCustomer();
    await customerPage.verifyCustomerUpdated(firstName, lastName);
    await openCampaign(crmLeftMenuPage, campaignPage);

    await configureEmailFilter(campaignPage, "Customer", originalEmail);
    await expect(getEmailCountThenRefresh(campaignPage)).resolves.toBe(0);
    await configureEmailFilter(campaignPage, "Customer", updatedEmail);
    await expect(
      getEmailCountThenRefresh(campaignPage),
    ).resolves.toBeGreaterThanOrEqual(1);
  });

  // ==================== Lead Audience ====================

  test("Verify Lead audience displays its own Field Names in the dropdown", async ({
    campaignPage,
  }) => {
    await campaignPage.selectAudience("Lead");
    await campaignPage.verifyAudienceSelected("Lead");
    await campaignPage.verifyFieldNameOptions(LEAD_FIELD_NAMES);
  });

  test("Verify Select Template contains all Lead templates from the database", async ({
    campaignPage,
    crmEmailTemplateDbHelper,
  }) => {
    const templateNames =
      await crmEmailTemplateDbHelper.getCampaignTemplateNames(
        getCrmCompanyId(),
        "Lead",
      );
    expect(
      templateNames,
      "At least one Lead template is required in the database",
    ).not.toHaveLength(0);

    await campaignPage.selectAudience("Lead");
    await campaignPage.verifyTemplateNamesPresent(templateNames);
  });

  test("Verify Email Body shows only Lead and Company merge tags for the Lead audience", async ({
    campaignPage,
  }) => {
    await campaignPage.selectAudience("Lead");
    await campaignPage.addParagraphToEmailBody();
    await campaignPage.clickEmailBodyMergeTags();
    await campaignPage.verifyEmailBodyMergeTags("Lead");
  });

  test("Verify all Lead field names support text filter operators", async ({
    campaignPage,
    crmLeftMenuPage,
    leadPage,
    crmLeadDbHelper,
  }) => {
    test.setTimeout(1_200_000);
    const companyId = Number(ConfigManager.testData.crmCompanyId);
    if (!Number.isInteger(companyId) || companyId <= 0) {
      throw new Error(
        "CRMCompanyID is missing or invalid for the active property",
      );
    }

    const operators: ReadonlyArray<LeadFieldTextOperator> = [
      "Equals",
      "Not Equals",
      "Contains",
      "Starts With",
      "Ends With",
    ];

    for (const fieldName of LEAD_FIELD_NAMES) {
      await test.step(`Validate ${fieldName}`, async () => {
        let value = await crmLeadDbHelper.getLeadFieldSampleValue(
          companyId,
          fieldName,
        );
        if (value === null) {
          const seededValue = getLeadFieldSeedValue(fieldName);
          await campaignPage.clickCloseCampaign();
          await crmLeftMenuPage.clickLeadIcon();
          const leadEmail = await createLeadForField(
            leadPage,
            fieldName,
            seededValue,
          );
          if (fieldName !== "First Name" && fieldName !== "Email Address") {
            await crmLeadDbHelper.addLeadFieldValue(
              companyId,
              leadEmail,
              fieldName,
              seededValue,
            );
          }
          await openCampaign(crmLeftMenuPage, campaignPage);
          value = await crmLeadDbHelper.getLeadFieldSampleValue(
            companyId,
            fieldName,
          );
        }
        if (value === null) {
          throw new Error(
            `Lead field "${fieldName}" was not saved to the database`,
          );
        }

        const applicableOperators = DATE_LEAD_FIELD_NAMES.has(fieldName)
          ? operators.filter(
              (operator) => operator === "Equals" || operator === "Not Equals",
            )
          : operators;

        for (const operator of applicableOperators) {
          const filterValue = getLeadFieldFilterValue(operator, value);
          const expected = await crmLeadDbHelper.getLeadFieldRecipientCount(
            companyId,
            fieldName,
            operator,
            filterValue,
          );
          await campaignPage.selectAudience("Lead");
          await campaignPage.selectFieldName(fieldName);
          await campaignPage.selectOperator(operator);
          await campaignPage.enterFilterValue(filterValue);
          const actual = await getEmailCountThenRefresh(campaignPage);
          expect
            .soft(
              actual,
              `${operator} "${filterValue}" on ${fieldName} should return ${expected} recipient(s)`,
            )
            .toBe(expected);
        }
      });
    }
  });
  // ==================== Lead Multi-Condition Coverage ====================

  for (const condition of ["AND", "OR"] as const) {
    test(`Verify Lead Audience Filter with ${condition} conditions pulls the right recipient count`, async ({
      campaignPage,
      crmLeftMenuPage,
      leadPage,
      crmLeadDbHelper,
    }) => {
      const companyId = getCrmCompanyId();
      let sample = await crmLeadDbHelper.getLeadAudienceFilterSample(companyId);

      if (sample === null) {
        const lastName = getLeadFieldSeedValue("Last Name");
        await campaignPage.clickCloseCampaign();
        await crmLeftMenuPage.clickLeadIcon();
        const leadEmail = await createLeadForField(
          leadPage,
          "Last Name",
          lastName,
        );
        await crmLeadDbHelper.addLeadFieldValue(
          companyId,
          leadEmail,
          "Last Name",
          lastName,
        );
        await openCampaign(crmLeftMenuPage, campaignPage);
        sample = await crmLeadDbHelper.getLeadAudienceFilterSample(companyId);
      }
      if (sample === null) {
        throw new Error(
          "A CRM lead with valid First Name and Last Name fields is required",
        );
      }

      const criteria: ReadonlyArray<CampaignTextCriterion> = [
        {
          fieldName: "First Name",
          operator: "Equals",
          value: sample.firstName,
        },
        {
          fieldName: "Last Name",
          operator: "Equals",
          value: sample.lastName,
          condition,
        },
      ];
      const expected = await crmLeadDbHelper.getLeadAudienceRecipientCount(
        companyId,
        criteria,
      );
      await applyAudienceConditions(campaignPage, "Lead", criteria);

      await expect(getEmailCountThenRefresh(campaignPage)).resolves.toBe(
        expected,
      );
    });
  }

  test("Verify Lead Audience Filter with combined AND and OR conditions pulls the right recipient count", async ({
    campaignPage,
    crmLeftMenuPage,
    leadPage,
    crmLeadDbHelper,
  }) => {
    const companyId = getCrmCompanyId();
    let sample = await crmLeadDbHelper.getLeadAudienceFilterSample(companyId);

    if (sample === null) {
      const lastName = getLeadFieldSeedValue("Last Name");
      await campaignPage.clickCloseCampaign();
      await crmLeftMenuPage.clickLeadIcon();
      const leadEmail = await createLeadForField(
        leadPage,
        "Last Name",
        lastName,
      );
      await crmLeadDbHelper.addLeadFieldValue(
        companyId,
        leadEmail,
        "Last Name",
        lastName,
      );
      await openCampaign(crmLeftMenuPage, campaignPage);
      sample = await crmLeadDbHelper.getLeadAudienceFilterSample(companyId);
    }
    if (sample === null) {
      throw new Error(
        "A CRM lead with valid First Name, Last Name, and Email Address is required",
      );
    }

    const criteria: ReadonlyArray<CampaignTextCriterion> = [
      { fieldName: "First Name", operator: "Equals", value: sample.firstName },
      {
        fieldName: "Last Name",
        operator: "Equals",
        value: sample.lastName,
        condition: "AND",
      },
      {
        fieldName: "Email Address",
        operator: "Equals",
        value: sample.email,
        condition: "OR",
      },
    ];
    const expected = await crmLeadDbHelper.getLeadAudienceRecipientCount(
      companyId,
      criteria,
    );
    await applyAudienceConditions(campaignPage, "Lead", criteria);

    await expect(getEmailCountThenRefresh(campaignPage)).resolves.toBe(
      expected,
    );
  });

  test("Verify all Lead field names return the right count after replacing AND with OR", async ({
    campaignPage,
    crmLeftMenuPage,
    leadPage,
    crmLeadDbHelper,
  }) => {
    test.setTimeout(1_200_000);
    const companyId = getCrmCompanyId();

    for (const fieldName of LEAD_FIELD_NAMES) {
      await test.step(`Validate AND and OR combinations for ${fieldName}`, async () => {
        let sample = await crmLeadDbHelper.getLeadAudienceFieldSample(
          companyId,
          fieldName,
        );
        if (sample === null) {
          const seededValue = getLeadFieldSeedValue(fieldName);
          await campaignPage.clickCloseCampaign();
          await crmLeftMenuPage.clickLeadIcon();
          const leadEmail = await createLeadForField(
            leadPage,
            fieldName,
            seededValue,
          );
          if (fieldName !== "First Name" && fieldName !== "Email Address") {
            await crmLeadDbHelper.addLeadFieldValue(
              companyId,
              leadEmail,
              fieldName,
              seededValue,
            );
          }
          await openCampaign(crmLeftMenuPage, campaignPage);
          sample = await crmLeadDbHelper.getLeadAudienceFieldSample(
            companyId,
            fieldName,
          );
        }
        if (sample === null) {
          throw new Error(
            `Lead field "${fieldName}" was not saved to the database`,
          );
        }

        const anchor = getAudienceAnchorCriterion(fieldName, sample);
        const target: CampaignTextCriterion = {
          fieldName,
          operator: "Equals",
          value: sample.value,
          condition: "AND",
        };
        const andCriteria = [anchor, target] as const;
        const expectedAnd = await crmLeadDbHelper.getLeadAudienceRecipientCount(
          companyId,
          andCriteria,
        );
        await applyAudienceConditions(campaignPage, "Lead", andCriteria);
        await expect(getEmailCountThenRefresh(campaignPage)).resolves.toBe(
          expectedAnd,
        );

        const orTarget = { ...target, condition: "OR" } as const;
        const orCriteria = [anchor, orTarget] as const;
        const expectedOr = await crmLeadDbHelper.getLeadAudienceRecipientCount(
          companyId,
          orCriteria,
        );
        await applyAudienceConditions(campaignPage, "Lead", orCriteria);
        await expect(getEmailCountThenRefresh(campaignPage)).resolves.toBe(
          expectedOr,
        );
      });
    }
  });

  // ==================== Customer Audience ====================

  test("Verify Customer audience displays its own Field Names in the dropdown", async ({
    campaignPage,
  }) => {
    await campaignPage.selectAudience("Customer");
    await campaignPage.verifyAudienceSelected("Customer");
    await campaignPage.verifyFieldNameOptions(CUSTOMER_FIELD_NAMES);
  });

  test("Verify Select Template contains all Customer templates from the database", async ({
    campaignPage,
    crmEmailTemplateDbHelper,
  }) => {
    const templateNames =
      await crmEmailTemplateDbHelper.getCampaignTemplateNames(
        getCrmCompanyId(),
        "Customer",
      );
    expect(
      templateNames,
      "At least one Customer template is required in the database",
    ).not.toHaveLength(0);

    await campaignPage.selectAudience("Customer");
    await campaignPage.verifyTemplateNamesPresent(templateNames);
  });

  test("Verify Email Body shows only Customer and Company merge tags for the Customer audience", async ({
    campaignPage,
  }) => {
    await campaignPage.selectAudience("Customer");
    await campaignPage.addParagraphToEmailBody();
    await campaignPage.clickEmailBodyMergeTags();
    await campaignPage.verifyEmailBodyMergeTags("Customer");
  });

  test("Verify all Customer field names support text filter operators", async ({
    campaignPage,
    crmLeftMenuPage,
    customerPage,
    crmCustomerDbHelper,
  }) => {
    test.setTimeout(1_200_000);
    const companyId = Number(ConfigManager.testData.crmCompanyId);
    if (!Number.isInteger(companyId) || companyId <= 0) {
      throw new Error(
        "CRMCompanyID is missing or invalid for the active property",
      );
    }

    const operators: ReadonlyArray<LeadFieldTextOperator> = [
      "Equals",
      "Not Equals",
      "Contains",
      "Starts With",
      "Ends With",
    ];

    for (const fieldName of CUSTOMER_FIELD_NAMES) {
      await test.step(`Validate ${fieldName}`, async () => {
        let value = await crmCustomerDbHelper.getCustomerFieldSampleValue(
          companyId,
          fieldName,
        );
        if (value === null) {
          const seededValue = getCustomerFieldSeedValue(fieldName);
          await campaignPage.clickCloseCampaign();
          await crmLeftMenuPage.clickCustomerIcon();
          await createCustomerForField(customerPage, fieldName, seededValue);
          await openCampaign(crmLeftMenuPage, campaignPage);
          value = await crmCustomerDbHelper.getCustomerFieldSampleValue(
            companyId,
            fieldName,
          );
        }
        if (value === null) {
          throw new Error(
            `Customer field "${fieldName}" was not saved to the database`,
          );
        }
        const applicableOperators = DATE_CUSTOMER_FIELD_NAMES.has(fieldName)
          ? operators.filter(
              (operator) => operator === "Equals" || operator === "Not Equals",
            )
          : operators;

        for (const operator of applicableOperators) {
          const filterValue = getLeadFieldFilterValue(operator, value);
          const expected =
            await crmCustomerDbHelper.getCustomerFieldRecipientCount(
              companyId,
              fieldName,
              operator,
              filterValue,
            );
          await campaignPage.selectAudience("Customer");
          await campaignPage.selectFieldName(fieldName);
          await campaignPage.selectOperator(operator);
          await campaignPage.enterFilterValue(filterValue);
          const actual = await getEmailCountThenRefresh(campaignPage);
          expect
            .soft(
              actual,
              `${operator} "${filterValue}" on ${fieldName} should return ${expected} recipient(s)`,
            )
            .toBe(expected);
        }
      });
    }
  });

  // ==================== Customer Multi-Condition Coverage ====================
  for (const condition of ["AND", "OR"] as const) {
    test(`Verify Customer Audience Filter with ${condition} conditions pulls the right recipient count`, async ({
      campaignPage,
      crmLeftMenuPage,
      customerPage,
      crmCustomerDbHelper,
    }) => {
      const companyId = getCrmCompanyId();
      let sample =
        await crmCustomerDbHelper.getCustomerAudienceFilterSample(companyId);

      if (sample === null) {
        const lastName = getCustomerFieldSeedValue("Last Name");
        await campaignPage.clickCloseCampaign();
        await crmLeftMenuPage.clickCustomerIcon();
        await createCustomerForField(customerPage, "Last Name", lastName);
        await openCampaign(crmLeftMenuPage, campaignPage);
        sample =
          await crmCustomerDbHelper.getCustomerAudienceFilterSample(companyId);
      }
      if (sample === null) {
        throw new Error(
          "A CRM customer with valid First Name and Last Name fields is required",
        );
      }

      const criteria: ReadonlyArray<CampaignTextCriterion> = [
        {
          fieldName: "First Name",
          operator: "Equals",
          value: sample.firstName,
        },
        {
          fieldName: "Last Name",
          operator: "Equals",
          value: sample.lastName,
          condition,
        },
      ];
      const expected =
        await crmCustomerDbHelper.getCustomerAudienceRecipientCount(
          companyId,
          criteria,
        );
      await applyAudienceConditions(campaignPage, "Customer", criteria);

      await expect(getEmailCountThenRefresh(campaignPage)).resolves.toBe(
        expected,
      );
    });
  }

  test("Verify Customer Audience Filter with combined AND and OR conditions pulls the right recipient count", async ({
    campaignPage,
    crmLeftMenuPage,
    customerPage,
    crmCustomerDbHelper,
  }) => {
    const companyId = getCrmCompanyId();
    let sample =
      await crmCustomerDbHelper.getCustomerAudienceFilterSample(companyId);

    if (sample === null) {
      const lastName = getCustomerFieldSeedValue("Last Name");
      await campaignPage.clickCloseCampaign();
      await crmLeftMenuPage.clickCustomerIcon();
      await createCustomerForField(customerPage, "Last Name", lastName);
      await openCampaign(crmLeftMenuPage, campaignPage);
      sample =
        await crmCustomerDbHelper.getCustomerAudienceFilterSample(companyId);
    }
    if (sample === null) {
      throw new Error(
        "A CRM customer with valid First Name, Last Name, and Email Address is required",
      );
    }

    const criteria: ReadonlyArray<CampaignTextCriterion> = [
      { fieldName: "First Name", operator: "Equals", value: sample.firstName },
      {
        fieldName: "Last Name",
        operator: "Equals",
        value: sample.lastName,
        condition: "AND",
      },
      {
        fieldName: "Email Address",
        operator: "Equals",
        value: sample.email,
        condition: "OR",
      },
    ];
    const expected =
      await crmCustomerDbHelper.getCustomerAudienceRecipientCount(
        companyId,
        criteria,
      );
    await applyAudienceConditions(campaignPage, "Customer", criteria);

    await expect(getEmailCountThenRefresh(campaignPage)).resolves.toBe(
      expected,
    );
  });

  test("Verify all Customer field names return the right count after replacing AND with OR", async ({
    campaignPage,
    crmLeftMenuPage,
    customerPage,
    crmCustomerDbHelper,
  }) => {
    test.setTimeout(1_200_000);
    const companyId = getCrmCompanyId();

    for (const fieldName of CUSTOMER_FIELD_NAMES) {
      await test.step(`Validate AND and OR combinations for ${fieldName}`, async () => {
        let sample = await crmCustomerDbHelper.getCustomerAudienceFieldSample(
          companyId,
          fieldName,
        );
        if (sample === null) {
          const seededValue = getCustomerFieldSeedValue(fieldName);
          await campaignPage.clickCloseCampaign();
          await crmLeftMenuPage.clickCustomerIcon();
          await createCustomerForField(customerPage, fieldName, seededValue);
          await openCampaign(crmLeftMenuPage, campaignPage);
          sample = await crmCustomerDbHelper.getCustomerAudienceFieldSample(
            companyId,
            fieldName,
          );
        }
        if (sample === null) {
          throw new Error(
            `Customer field "${fieldName}" was not saved to the database`,
          );
        }

        const anchor = getAudienceAnchorCriterion(fieldName, sample);
        const target: CampaignTextCriterion = {
          fieldName,
          operator: "Equals",
          value: sample.value,
          condition: "AND",
        };
        const andCriteria = [anchor, target] as const;
        const expectedAnd =
          await crmCustomerDbHelper.getCustomerAudienceRecipientCount(
            companyId,
            andCriteria,
          );
        await applyAudienceConditions(campaignPage, "Customer", andCriteria);
        await expect(getEmailCountThenRefresh(campaignPage)).resolves.toBe(
          expectedAnd,
        );

        const orTarget = { ...target, condition: "OR" } as const;
        const orCriteria = [anchor, orTarget] as const;
        const expectedOr =
          await crmCustomerDbHelper.getCustomerAudienceRecipientCount(
            companyId,
            orCriteria,
          );
        await applyAudienceConditions(campaignPage, "Customer", orCriteria);
        await expect(getEmailCountThenRefresh(campaignPage)).resolves.toBe(
          expectedOr,
        );
      });
    }
  });
  // ==================== Reservation Audience ====================

  test("Verify Reservation audience displays its own Field Names in the dropdown", async ({
    campaignPage,
  }) => {
    await campaignPage.selectAudience("Reservation");
    await campaignPage.verifyAudienceSelected("Reservation");
    await campaignPage.verifyFieldNameOptions(RESERVATION_FIELD_NAMES);
  });

  test("Verify Select Template contains all Reservation templates from the database", async ({
    campaignPage,
    crmEmailTemplateDbHelper,
  }) => {
    const templateNames =
      await crmEmailTemplateDbHelper.getCampaignTemplateNames(
        getCrmCompanyId(),
        "Reservation",
      );
    expect(
      templateNames,
      "At least one Reservation template is required in the database",
    ).not.toHaveLength(0);

    await campaignPage.selectAudience("Reservation");
    await campaignPage.verifyTemplateNamesPresent(templateNames);
  });

  test("Verify Email Body shows only Reservation and Company merge tags for the Reservation audience", async ({
    campaignPage,
  }) => {
    test.setTimeout(90_000);
    await campaignPage.selectAudience("Reservation");
    await campaignPage.addParagraphToEmailBody();
    await campaignPage.clickEmailBodyMergeTags();
    await campaignPage.verifyEmailBodyMergeTags("Reservation");
  });

  test("Verify all Reservation field names pull the right PMS recipient count", async ({
    campaignPage,
    crmLoginPage,
    crmLeftMenuPage,
    findReservationPage,
    reservationDbHelper,
    reservationPage,
    ssoLoginPage,
  }) => {
    test.setTimeout(600_000);
    let missingFieldSeeded = false;

    for (const fieldName of RESERVATION_FIELD_TEST_ORDER) {
      await test.step(`Validate ${fieldName}`, async () => {
        let sample =
          await reservationDbHelper.getReservationCampaignFieldSample(
            fieldName,
          );
        if (sample === null && !missingFieldSeeded) {
          await seedMissingReservationAudienceData({
            campaignPage,
            crmLeftMenuPage,
            crmLoginPage,
            findReservationPage,
            reservationDbHelper,
            reservationPage,
            seededReservationNumbers,
            ssoLoginPage,
          });
          missingFieldSeeded = true;
          sample =
            await reservationDbHelper.getReservationCampaignFieldSample(
              fieldName,
            );
        }
        if (sample === null) {
          throw new Error(
            `Reservation campaign field "${fieldName}" has no PMS value after seeding`,
          );
        }

        const expected =
          await reservationDbHelper.getReservationCampaignRecipientCount(
            fieldName,
            sample.value,
          );
        await campaignPage.selectAudience("Reservation");
        await campaignPage.selectFieldName(fieldName);
        await campaignPage.selectOperator("Equals");
        await campaignPage.enterFilterValue(sample.value);
        await expect(getEmailCountThenRefresh(campaignPage)).resolves.toBe(
          expected,
        );
      });
    }
  });

  // ==================== Reservation Multi-Condition Coverage ====================
  for (const condition of ["AND", "OR"] as const) {
    test(`Verify Reservation Audience Filter with ${condition} conditions pulls the right recipient count`, async ({
      campaignPage,
      crmLoginPage,
      crmLeftMenuPage,
      findReservationPage,
      reservationDbHelper,
      reservationPage,
      ssoLoginPage,
    }) => {
      const sample = await getReservationConditionSampleOrSeed({
        campaignPage,
        crmLoginPage,
        crmLeftMenuPage,
        findReservationPage,
        reservationDbHelper,
        reservationPage,
        seededReservationNumbers,
        ssoLoginPage,
      });
      const criteria: ReadonlyArray<CampaignTextCriterion> = [
        { fieldName: "City", operator: "Equals", value: sample.city },
        {
          fieldName: "State",
          operator: "Equals",
          value: sample.state,
          condition,
        },
      ];
      const expected =
        await reservationDbHelper.getReservationCampaignConditionRecipientCount(
          criteria,
        );

      await applyAudienceConditions(campaignPage, "Reservation", criteria);
      await expect(getEmailCountThenRefresh(campaignPage)).resolves.toBe(
        expected,
      );
    });
  }

  test("Verify Reservation Audience Filter with combined AND and OR conditions pulls the right recipient count", async ({
    campaignPage,
    crmLoginPage,
    crmLeftMenuPage,
    findReservationPage,
    reservationDbHelper,
    reservationPage,
    ssoLoginPage,
  }) => {
    const sample = await getReservationConditionSampleOrSeed({
      campaignPage,
      crmLoginPage,
      crmLeftMenuPage,
      findReservationPage,
      reservationDbHelper,
      reservationPage,
      seededReservationNumbers,
      ssoLoginPage,
    });
    const criteria: ReadonlyArray<CampaignTextCriterion> = [
      { fieldName: "City", operator: "Equals", value: sample.city },
      {
        fieldName: "State",
        operator: "Equals",
        value: sample.state,
        condition: "AND",
      },
      {
        fieldName: "Country",
        operator: "Equals",
        value: sample.country,
        condition: "OR",
      },
    ];
    const expected =
      await reservationDbHelper.getReservationCampaignConditionRecipientCount(
        criteria,
      );

    await applyAudienceConditions(campaignPage, "Reservation", criteria);
    await expect(getEmailCountThenRefresh(campaignPage)).resolves.toBe(
      expected,
    );
  });
});

function getLeadFieldFilterValue(
  operator: LeadFieldTextOperator,
  value: string,
): string {
  if (operator === "Equals" || operator === "Not Equals") {
    return value;
  }

  const characters = Array.from(value);
  const partialLength = Math.max(1, Math.floor(characters.length / 2));

  switch (operator) {
    case "Contains": {
      const startIndex = Math.floor((characters.length - partialLength) / 2);
      return characters.slice(startIndex, startIndex + partialLength).join("");
    }
    case "Starts With":
      return characters.slice(0, partialLength).join("");
    case "Ends With":
      return characters.slice(-partialLength).join("");
  }
}

function getCrmCompanyId(): number {
  const companyId = Number(ConfigManager.testData.crmCompanyId);
  if (!Number.isInteger(companyId) || companyId <= 0) {
    throw new Error(
      "CRMCompanyID is missing or invalid for the active property",
    );
  }
  return companyId;
}

async function applyAudienceConditions(
  campaignPage: CampaignPage,
  audience: CampaignAudience,
  criteria: ReadonlyArray<CampaignTextCriterion>,
): Promise<void> {
  if (criteria.length < 2) {
    throw new Error("At least two campaign criteria are required");
  }

  await campaignPage.selectAudience(audience);
  for (const [index, criterion] of criteria.entries()) {
    if (index === 0) {
      await campaignPage.selectConditionFieldName(index, criterion.fieldName);
      await campaignPage.selectConditionOperator(index, criterion.operator);
      await campaignPage.enterConditionFilterValue(index, criterion.value);
      continue;
    }
    await addAudienceCondition(campaignPage, index, criterion);
  }
}

async function addAudienceCondition(
  campaignPage: CampaignPage,
  conditionIndex: number,
  criterion: CampaignTextCriterion,
): Promise<void> {
  await campaignPage.clickAddCondition();
  await campaignPage.selectConditionJoin(
    conditionIndex,
    criterion.condition ?? "AND",
  );
  await campaignPage.selectConditionFieldName(
    conditionIndex,
    criterion.fieldName,
  );
  await campaignPage.selectConditionOperator(
    conditionIndex,
    criterion.operator,
  );
  await campaignPage.enterConditionFilterValue(conditionIndex, criterion.value);
}

function getAudienceAnchorCriterion(
  fieldName: string,
  sample: { firstName: string; email: string },
): CampaignTextCriterion {
  return fieldName === "Email Address"
    ? { fieldName: "First Name", operator: "Equals", value: sample.firstName }
    : { fieldName: "Email Address", operator: "Equals", value: sample.email };
}

async function getEmailCountThenRefresh(
  campaignPage: CampaignPage,
): Promise<number> {
  const count = await campaignPage.getEmailCount();
  await campaignPage.clickCloseCampaign();
  await campaignPage.clickAddCampaign();
  return count;
}

test.describe("Campaign unsubscribe exclusion", () => {
  test("Verify an unsubscribed customer is excluded from the reservation type campaign email list", async ({
    crmLoginPage,
    campaignPage,
    crmLeftMenuPage,
    customerPage,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    reservationApi,
  }) => {
    test.setTimeout(150_000);
    const credentials = ConfigManager.testData;
    const recipient = GmailHelper.createUniqueRecipient(
      "campaign-unsubscribed-reservation",
    );
    const firstName = TestDataGenerator.firstName();
    const lastName = TestDataGenerator.lastName();
    const city = `UnsubscribeCity${Date.now()}`;

    await ssoLoginPage.propertyLogin(
      SSOUsers.User1.propertyShortName,
      SSOUsers.User1.loginName,
      SSOUsers.User1.password,
    );
    await findReservationPage.chooseReservationTypeRegular();
    await findReservationPage.addNewReservation();
    await reservationPage.selectFirstAvailableRoomType();
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.enterGuestDetails({
      firstName,
      lastName,
      email: recipient,
      city,
    });
    await reservationPage.enterPaymentMethod(
      ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
    );
    await reservationPage.clickSaveButton();
    await reservationPage.verifyAlertMessage(
      AlertMessages.RESERVATION_SAVED_SUCCESS,
    );
    const confirmationNumber = await reservationPage.getReservationNumber();
    await reservationPage.clickCloseButton();

    await crmLoginPage.loginToCRM(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await openCampaign(crmLeftMenuPage, campaignPage);
    await campaignPage.selectAudience("Reservation");
    await campaignPage.selectFieldName("City");
    await campaignPage.selectOperator("Equals");
    await campaignPage.enterFilterValue(city);
    await expect(campaignPage.getEmailCount()).resolves.toBe(1);

    await campaignPage.clickCloseCampaign();
    await crmLeftMenuPage.clickCustomerIcon();
    await customerPage.unsubscribeCustomer(recipient);

    await openCampaign(crmLeftMenuPage, campaignPage);
    await campaignPage.selectAudience("Reservation");
    await campaignPage.verifyAudienceSelected("Reservation");
    await campaignPage.selectFieldName("City");
    await campaignPage.selectOperator("Equals");
    await campaignPage.enterFilterValue(city);
    await expect(campaignPage.getEmailCount()).resolves.toBe(0);

    await reservationApi.deleteReservation(confirmationNumber);
  });

  test("Verify an unsubscribed customer is excluded from the campaign email list", async ({
    crmLoginPage,
    campaignPage,
    crmLeftMenuPage,
    customerPage,
  }) => {
    test.slow();
    const credentials = ConfigManager.testData;
    const recipient = GmailHelper.createUniqueRecipient(
      "campaign-unsubscribed-customer",
    );

    await crmLoginPage.loginToCRM(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await crmLeftMenuPage.clickCustomerIcon();
    await createCustomer(customerPage, recipient);
    await customerPage.unsubscribeCustomer(recipient);

    await openCampaign(crmLeftMenuPage, campaignPage);
    await configureEmailFilter(campaignPage, "Customer", recipient);
    await campaignPage.verifyAudienceSelected("Customer");
    await expect(campaignPage.getEmailCount()).resolves.toBe(0);
  });

  test("Verify an unsubscribed lead is excluded from the campaign email list", async ({
    crmLoginPage,
    campaignPage,
    crmLeftMenuPage,
    leadPage,
  }) => {
    test.slow();
    const credentials = ConfigManager.testData;
    const recipient = GmailHelper.createUniqueRecipient(
      "campaign-unsubscribed-lead",
    );

    await crmLoginPage.loginToCRM(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await crmLeftMenuPage.clickLeadIcon();
    await createLead(leadPage, recipient);
    await leadPage.unsubscribeLead(recipient);

    await openCampaign(crmLeftMenuPage, campaignPage);
    await configureEmailFilter(campaignPage, "Lead", recipient);
    await campaignPage.verifyAudienceSelected("Lead");
    await expect(campaignPage.getEmailCount()).resolves.toBe(0);
  });
});

async function configureEmailFilter(
  campaignPage: CampaignPage,
  audience: CampaignAudience,
  email: string,
): Promise<void> {
  await campaignPage.selectAudience(audience);
  await campaignPage.selectFieldName("Email Address");
  await campaignPage.selectOperator("Equals");
  await campaignPage.enterFilterValue(email);
}

async function openCampaign(
  crmLeftMenuPage: CRMLeftMenuPage,
  campaignPage: CampaignPage,
): Promise<void> {
  await crmLeftMenuPage.clickEmailPromotion();
  await campaignPage.clickCampaigns();
  await campaignPage.clickAddCampaign();
}

async function createLead(
  leadPage: LeadPage,
  email: string,
  firstName = TestDataGenerator.firstName(),
  lastName = TestDataGenerator.lastName(),
): Promise<void> {
  await leadPage.clickAddLead();
  await leadPage.enterFirstName(firstName);
  await leadPage.enterLastName(lastName);
  await leadPage.enterEmail(email);
  await leadPage.clickSaveLead();
  await leadPage.verifyLeadSaved();
}

async function createCustomer(
  customerPage: CustomerPage,
  email: string,
  firstName = TestDataGenerator.firstName(),
  lastName = TestDataGenerator.lastName(),
): Promise<void> {
  await customerPage.clickAddCustomer();
  await customerPage.enterFirstName(firstName);
  await customerPage.enterLastName(lastName);
  await customerPage.enterEmail(email);
  await customerPage.clickSaveCustomer();
  await customerPage.verifyCustomerSaved();
}

type ReservationCampaignSeedFixtures = {
  campaignPage: CampaignPage;
  crmLeftMenuPage: CRMLeftMenuPage;
  crmLoginPage: CRMLoginPage;
  findReservationPage: FindReservationPage;
  reservationDbHelper: ReservationDatabaseHelper;
  reservationPage: ReservationPage;
  seededReservationNumbers: string[];
  ssoLoginPage: SSOLoginPage;
};

async function getReservationConditionSampleOrSeed(
  fixtures: ReservationCampaignSeedFixtures,
): Promise<{ city: string; state: string; country: string }> {
  let sample =
    await fixtures.reservationDbHelper.getReservationCampaignConditionSample();
  if (sample === null) {
    await seedMissingReservationAudienceData(fixtures);
    sample =
      await fixtures.reservationDbHelper.getReservationCampaignConditionSample();
  }
  if (sample === null) {
    throw new Error(
      "A Reservation audience record with City, State, and Country is required",
    );
  }
  return sample;
}

async function seedMissingReservationAudienceData({
  campaignPage,
  crmLeftMenuPage,
  crmLoginPage,
  findReservationPage,
  reservationDbHelper,
  reservationPage,
  seededReservationNumbers,
  ssoLoginPage,
}: ReservationCampaignSeedFixtures): Promise<void> {
  const seedId = Date.now().toString();
  await campaignPage.clickCloseCampaign();
  await ssoLoginPage.propertyLogin(
    SSOUsers.User1.propertyShortName,
    SSOUsers.User1.loginName,
    SSOUsers.User1.password,
  );
  await findReservationPage.chooseReservationTypeRegular();
  await findReservationPage.addNewReservation();
  await reservationPage.selectFirstAvailableRoomType();
  await reservationPage.selectFirstRoomFromDropdown();
  await reservationPage.enterGuestDetails({
    firstName: `Campaign${seedId}`,
    lastName: "Reservation",
    email: `campaign.reservation.${seedId}@example.test`,
    city: `Campaign City ${seedId}`,
    state: `Campaign State ${seedId}`,
    country: `Campaign Country ${seedId}`,
  });
  await reservationPage.enterPaymentMethod(
    ConstNames.RESERVATION_PAYMENT_TYPE_CODE_CASH,
  );
  await reservationPage.clickSaveButton();
  await reservationPage.verifyAlertMessage(
    AlertMessages.RESERVATION_SAVED_SUCCESS,
  );
  const confirmationNumber = await reservationPage.getReservationNumber();
  seededReservationNumbers.push(confirmationNumber);
  await reservationDbHelper.setReservationCampaignGuestProfileValues(
    confirmationNumber,
    {
      guestType: `CampaignGuestType${seedId}`,
      visitType: `CampaignVisitType${seedId}`,
      custom1: `CampaignCustom1${seedId}`,
      custom2: `CampaignCustom2${seedId}`,
      custom3: `CampaignCustom3${seedId}`,
      custom4: `CampaignCustom4${seedId}`,
      custom5: `CampaignCustom5${seedId}`,
      custom6: `CampaignCustom6${seedId}`,
    },
  );
  await reservationPage.clickCloseButton();

  const credentials = ConfigManager.testData;
  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );
  await openCampaign(crmLeftMenuPage, campaignPage);
}

function getCustomerFieldSeedValue(fieldName: string): string {
  if (DATE_CUSTOMER_FIELD_NAMES.has(fieldName)) {
    const date = new Date(
      Date.now() - Math.floor(Math.random() * 6_000) * 24 * 60 * 60 * 1000,
    );
    return date.toISOString().slice(0, 10);
  }
  if (fieldName === "Do Not Allow New Reservation") {
    return Math.random() < 0.5 ? "true" : "false";
  }
  switch (fieldName) {
    case "First Name":
      return TestDataGenerator.firstName();
    case "Last Name":
      return TestDataGenerator.lastName();
    case "Email Address":
      return TestDataGenerator.email();
    case "City":
      return TestDataGenerator.city();
    case "Cell/Pager":
    case "Work Phone":
    case "Mobile Number":
    case "Fax":
      return TestDataGenerator.phoneNumber();
    case "Address":
    case "Address 2":
      return TestDataGenerator.address();
    case "State":
      return TestDataGenerator.state();
    case "Country":
      return TestDataGenerator.country();
    case "Zip":
      return TestDataGenerator.zipCode();
    case "Company Code":
      return TestDataGenerator.companyName();
    case "Display Notes when creating reservation":
      return TestDataGenerator.notes();
    default:
      return `Customer${fieldName.replace(/\W/g, "")}${Date.now()}`;
  }
}

function getLeadFieldSeedValue(fieldName: string): string {
  return getCustomerFieldSeedValue(fieldName);
}

async function createLeadForField(
  leadPage: LeadPage,
  fieldName: string,
  value: string,
): Promise<string> {
  const firstName =
    fieldName === "First Name" ? value : TestDataGenerator.firstName();
  const lastName =
    fieldName === "Last Name" ? value : TestDataGenerator.lastName();
  const email =
    fieldName === "Email Address"
      ? value
      : TestDataGenerator.email(firstName, lastName);

  await leadPage.clickAddLead();
  await leadPage.enterFirstName(firstName);
  await leadPage.enterLastName(lastName);
  await leadPage.enterEmail(email);
  await leadPage.clickSaveLead();
  await leadPage.verifyLeadSaved();
  return email;
}

async function createCustomerForField(
  customerPage: CustomerPage,
  fieldName: string,
  value: string,
): Promise<string> {
  const firstName =
    fieldName === "First Name" ? value : TestDataGenerator.firstName();
  const lastName =
    fieldName === "Last Name" ? value : TestDataGenerator.lastName();

  await customerPage.clickAddCustomer();
  await customerPage.enterFirstName(firstName);
  await customerPage.enterLastName(lastName);
  const email = GmailHelper.createUniqueRecipient("campaign-customer-field");
  await customerPage.enterEmail(email);

  switch (fieldName) {
    case "Email Address":
      await customerPage.enterEmail(value);
      break;
    case "City":
      await customerPage.enterCity(value);
      break;
    case "Cell/Pager":
      await customerPage.enterPhone(value);
      break;
    case "Address":
      await customerPage.enterAddress(value);
      break;
    case "State":
      await customerPage.enterState(value);
      break;
    case "First Name 2":
      await customerPage.enterSecondFirstName(value);
      break;
    case "Last Name 2":
      await customerPage.enterSecondLastName(value);
      break;
    case "Address 2":
      await customerPage.enterSecondAddress(value);
      break;
    case "Work Phone":
      await customerPage.enterWorkPhone(value);
      break;
    case "Mobile Number":
      await customerPage.enterMobilePhone(value);
      break;
    case "Fax":
      await customerPage.enterFax(value);
      break;
    case "Country":
      await customerPage.enterCountry(value);
      break;
    case "Zip":
      await customerPage.enterPostalCode(value);
      break;
    case "Guest Type":
      await customerPage.enterGuestType(value);
      break;
    case "Visit Type":
      await customerPage.enterVisitType(value);
      break;
    case "Vehicle Make":
      await customerPage.enterVehicleMake(value);
      break;
    case "Vehicle Model":
      await customerPage.enterVehicleModel(value);
      break;
    case "Birth Date 1":
      await customerPage.enterBirthDate1(value);
      break;
    case "Birth Date 2":
      await customerPage.enterBirthDate2(value);
      break;
    case "Anniversary":
      await customerPage.enterAnniversary(value);
      break;
    case "License":
      await customerPage.enterLicense(value);
      break;
    case "Company Code":
      await customerPage.enterCompany(value);
      break;
    case "Job Title":
      await customerPage.enterJobTitle(value);
      break;
    case "Custom 1":
      await customerPage.enterCustom1(value);
      break;
    case "Custom 2":
      await customerPage.enterCustom2(value);
      break;
    case "Custom 3":
      await customerPage.enterCustom3(value);
      break;
    case "Custom 4":
      await customerPage.enterCustom4(value);
      break;
    case "Custom 5":
      await customerPage.enterCustom5(value);
      break;
    case "Custom 6":
      await customerPage.enterCustom6(value);
      break;
    case "Do Not Allow New Reservation":
      if (value !== "true") break;
      await customerPage.checkDoNotAllowNewReservation();
      break;
    case "Display Notes when creating reservation":
      await customerPage.enterNotes(value);
      break;
    case "Customer Customized Field":
      await customerPage.enterCustomizedField(value);
      break;
  }

  await customerPage.clickSaveCustomer();
  await customerPage.verifyCustomerSaved();
  return email;
}

async function createCampaignForStatusTracking(
  campaignPage: CampaignPage,
  recipient: string,
  label: string,
): Promise<string> {
  await configureEmailFilter(campaignPage, "Customer", recipient);
  await expect(campaignPage.getEmailCount()).resolves.toBe(1);

  const uniqueId = Date.now();
  const campaignName = `Automation ${label} Campaign ${uniqueId}`;
  await campaignPage.enterCampaignName(campaignName);
  await campaignPage.enterSubject(`Automation ${label} Subject ${uniqueId}`);
  await campaignPage.selectFirstAvailableTemplate();
  await campaignPage.clickCreateCampaign();
  await campaignPage.verifyCampaignCreated(campaignName);
  return campaignName;
}

async function createAndSendCampaign(
  campaignPage: CampaignPage,
  recipient: string,
  label: string,
  audience: "Lead" | "Customer",
): Promise<Date> {
  await configureEmailFilter(campaignPage, audience, recipient);
  await expect(campaignPage.getEmailCount()).resolves.toBeGreaterThanOrEqual(1);
  const uniqueId = Date.now();
  const campaignName = `Automation ${label} Campaign ${uniqueId}`;
  await campaignPage.enterCampaignName(campaignName);
  await campaignPage.enterSubject(`Automation ${label} Subject ${uniqueId}`);
  await campaignPage.selectFirstAvailableTemplate();
  await campaignPage.clickCreateCampaign();
  await campaignPage.verifyCampaignCreated(campaignName);
  const sentAfter = new Date();
  await campaignPage.sendCampaignEmails();
  return sentAfter;
}
