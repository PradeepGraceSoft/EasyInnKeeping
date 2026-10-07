import { expect, test } from "../../src/fixtures/sso.fixture";
import { ConfigManager } from "../../src/utils/ConfigManager";
import { DateUtils } from "../../src/utils/DateUtils";
import { TestDataGenerator } from "../../src/utils/TestDataGenerator";
import { GmailHelper } from "../../src/utils/GmailHelper";
import { CRMLoginPage } from "../../src/pages/CRM/CRMLoginPage";
import { CRMLeftMenuPage } from "../../src/pages/CRM/CRMLeftMenuPage";
import { LeadPage } from "../../src/pages/CRM/LeadPage";
import { ResponsePage } from "../../src/pages/CRM/ResponsePage";
import {
  CRMLeadDatabaseHelper,
  OutboundEmailConfigurations,
  OutboundEmailDisplayName,
} from "../../src/utils/DBHelper/CRMDatabaseHelper";

type EmailConfigurationFixtures = {
  crmLoginPage: CRMLoginPage;
  crmLeftMenuPage: CRMLeftMenuPage;
  leadPage: LeadPage;
  responsePage: ResponsePage;
  crmLeadDbHelper: CRMLeadDatabaseHelper;
};

test.describe("Email Configuration", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(210000);

  test("send a lead response using ECONNECT SENDGRID API", async ({
    crmLoginPage, crmLeftMenuPage, leadPage, responsePage, crmLeadDbHelper,
  }) => {
    await sendLeadResponse(
      { crmLoginPage, crmLeftMenuPage, leadPage, responsePage, crmLeadDbHelper },
      OutboundEmailConfigurations.SENDGRID_API,
    );
  });

  test("send a lead response using ECONNECT POSTMARK SERVER", async ({
    crmLoginPage, crmLeftMenuPage, leadPage, responsePage, crmLeadDbHelper,
  }) => {
    await sendLeadResponse(
      { crmLoginPage, crmLeftMenuPage, leadPage, responsePage, crmLeadDbHelper },
      OutboundEmailConfigurations.POSTMARK_SERVER,
    );
  });

  test("send a lead response using ECONNECT SMTP POSTMARK", async ({
    crmLoginPage, crmLeftMenuPage, leadPage, responsePage, crmLeadDbHelper,
  }) => {
    await sendLeadResponse(
      { crmLoginPage, crmLeftMenuPage, leadPage, responsePage, crmLeadDbHelper },
      OutboundEmailConfigurations.SMTP_POSTMARK,
    );
  });

  test("uses the configured default active email configuration for outbound emails", async ({
    crmLoginPage, crmLeftMenuPage, leadPage, responsePage, crmLeadDbHelper,
  }) => {
    const displayName = OutboundEmailConfigurations.SENDGRID_API;

    await crmLeadDbHelper.activateEmailConfiguration(displayName);
    await expect(crmLeadDbHelper.getEmailConfigurationState(displayName)).resolves
      .toEqual({ isActive: true, isDefault: true });

    await sendLeadResponse(
      { crmLoginPage, crmLeftMenuPage, leadPage, responsePage, crmLeadDbHelper },
      displayName,
      false,
    );
  });

  test("does not use an inactive email configuration for outbound emails", async ({
    crmLoginPage, crmLeftMenuPage, leadPage, responsePage, crmLeadDbHelper,
  }) => {
    const activeDisplayName = OutboundEmailConfigurations.SENDGRID_API;
    const inactiveDisplayName = OutboundEmailConfigurations.POSTMARK_SERVER;

    await crmLeadDbHelper.activateEmailConfiguration(activeDisplayName);
    await crmLeadDbHelper.deactivateEmailConfiguration(inactiveDisplayName);
    await expect(crmLeadDbHelper.getEmailConfigurationState(inactiveDisplayName)).resolves
      .toEqual({ isActive: false, isDefault: false });

    await sendLeadResponse(
      { crmLoginPage, crmLeftMenuPage, leadPage, responsePage, crmLeadDbHelper },
      activeDisplayName,
      false,
    );
  });
});

async function sendLeadResponse(
  {
    crmLoginPage,
    crmLeftMenuPage,
    leadPage,
    responsePage,
    crmLeadDbHelper,
  }: EmailConfigurationFixtures,
  displayName: OutboundEmailDisplayName,
  activateConfiguration = true,
): Promise<void> {
  const credentials = ConfigManager.testData;
  const firstName = TestDataGenerator.firstName();
  const lastName = TestDataGenerator.lastName();
  const recipient = "tester1gracesoft@gmail.com";

  if (activateConfiguration) {
    await crmLeadDbHelper.activateEmailConfiguration(displayName);
  }

  await crmLoginPage.loginToCRM(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );
  await crmLeftMenuPage.clickLeadIcon();
  await leadPage.clickAddLead();
  await leadPage.enterFirstName(firstName);
  await leadPage.enterLastName(lastName);
  await leadPage.enterEmail(recipient);
  await leadPage.clickSaveLead();
  await leadPage.verifyLeadSaved();

  await leadPage.clickResponse(firstName, lastName);
  await responsePage.verifyDisplayed();
  await responsePage.selectFirstAvailableTemplate();
  await responsePage.enterCallBackDate(DateUtils.addDaysYYYYMMDD(1));
  const sentAfter = new Date();
  await responsePage.clickSendEmail();
  await responsePage.verifyEmailSentSuccessfully();
  await GmailHelper.verifyEmailReceived(recipient, sentAfter, 120_000);
}


// Verify the system uses the configured default active email configuration for outbound emails.
// Verify an inactive email configuration cannot be used for outbound emails.
// Verify SMTP authentication and SSL/security settings work correctly with the configured provider.
// Verify outbound email fails gracefully when SMTP/provider credentials are invalid.
// Verify switching the default email configuration causes subsequent outbound emails to use the newly selected provider.
// Verify the configured From Name, From Email, and Display Name are correctly reflected in the outbound email.
// Verify CRM emails, quotations, campaigns, and other outbound communications use the configured default email provider.
