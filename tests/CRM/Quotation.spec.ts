import { expect, test } from "../../src/fixtures/sso.fixture";
import { ConstNames } from "../../src/constants/ConstNames";
import { ConfigManager } from "../../src/utils/ConfigManager";
import { DateUtils } from "../../src/utils/DateUtils";
import { TestDataGenerator } from "../../src/utils/TestDataGenerator";
import { GmailHelper } from "../../src/utils/GmailHelper";
import { CRMLoginPage } from "../../src/pages/CRM/CRMLoginPage";
import { CRMLeftMenuPage } from "../../src/pages/CRM/CRMLeftMenuPage";
import { LeadPage } from "../../src/pages/CRM/LeadPage";
import { QuotationPage } from "../../src/pages/CRM/QuotationPage";
import { SSOLoginPage } from "../../src/pages/SSOLoginPage";
import { SSODatabaseHelper } from "../../src/utils/DBHelper/SSODatabaseHelper";
import { OutboundEmailConfigurations } from "../../src/utils/DBHelper/CRMDatabaseHelper";

test.describe("Quotation", () => {
  test("Verify a quotation sent from CRM is successfully delivered to the Lead's email address", async ({
    dbHelper,
    ssoLoginPage,
    crmLoginPage,
    crmLeftMenuPage,
    leadPage,
    quotationPage,
  }) => {
    test.setTimeout(150000);

    await sendQuotation({
      dbHelper,
      ssoLoginPage,
      crmLoginPage,
      crmLeftMenuPage,
      leadPage,
      quotationPage,
    });
  });

  test("Verify the quotation email uses the configured default email provider", async ({
    dbHelper,
    ssoLoginPage,
    crmLoginPage,
    crmLeftMenuPage,
    leadPage,
    quotationPage,
    crmLeadDbHelper,
  }) => {
    test.setTimeout(150000);
    const defaultProvider = OutboundEmailConfigurations.SENDGRID_API;

    await crmLeadDbHelper.activateEmailConfiguration(defaultProvider);
    await expect(crmLeadDbHelper.getEmailConfigurationState(defaultProvider)).resolves
      .toEqual({ isActive: true, isDefault: true });

    await sendQuotation({
      dbHelper,
      ssoLoginPage,
      crmLoginPage,
      crmLeftMenuPage,
      leadPage,
      quotationPage,
    });
  });

  test("Verify the generated quotation contains the correct calculated Room Total, Tax, and Grand Total", async ({
    setupDb,
    dbHelper,
    ssoLoginPage,
    crmLoginPage,
    crmLeftMenuPage,
    leadPage,
    quotationPage,
  }) => {
    test.setTimeout(90000);

    await setupDb.setTaxAmount(ConstNames.TAX_NAME_LODGING, 5);
    await setupDb.setTaxExempt(ConstNames.TAX_NAME_LODGING, 0, 0);
    await setupDb.setTaxAppliedToLodging(ConstNames.TAX_NAME_LODGING, 1);
    await setupDb.setTaxAmount(ConstNames.TAX_NAME_STATE, 0);
    await setupDb.setTaxExempt(ConstNames.TAX_NAME_STATE, 0, 0);
    await setupDb.setTaxAppliedToLodging(ConstNames.TAX_NAME_STATE, 0);
    await setupDb.setRateAmount(ConstNames.RATES_NAME_REGULAR_RATE, 100);

    await createQuotationDraft({
      dbHelper,
      ssoLoginPage,
      crmLoginPage,
      crmLeftMenuPage,
      leadPage,
      quotationPage,
    });

    await quotationPage.verifyRoomTotal("100");
    await quotationPage.verifyTax("5");
    await quotationPage.verifyGrandTotal("105");
  });
});

type QuotationFixtures = {
  dbHelper: SSODatabaseHelper;
  ssoLoginPage: SSOLoginPage;
  crmLoginPage: CRMLoginPage;
  crmLeftMenuPage: CRMLeftMenuPage;
  leadPage: LeadPage;
  quotationPage: QuotationPage;
};

async function sendQuotation({
  dbHelper,
  ssoLoginPage,
  crmLoginPage,
  crmLeftMenuPage,
  leadPage,
  quotationPage,
}: QuotationFixtures): Promise<void> {
  const recipient = "tester1gracesoft@gmail.com";
  await createQuotationDraft({
    dbHelper,
    ssoLoginPage,
    crmLoginPage,
    crmLeftMenuPage,
    leadPage,
    quotationPage,
  }, recipient);
  const sentAfter = new Date();
  await quotationPage.clickSendQuotation();
  await quotationPage.verifyQuotationSentSuccessfully();
  await GmailHelper.verifyEmailReceived(recipient, sentAfter);
}

async function createQuotationDraft({
  dbHelper,
  ssoLoginPage,
  crmLoginPage,
  crmLeftMenuPage,
  leadPage,
  quotationPage,
}: QuotationFixtures, recipient = GmailHelper.createUniqueRecipient("quotation-draft")): Promise<void> {
  const credentials = ConfigManager.testData;
  const firstName = TestDataGenerator.firstName();
  const lastName = TestDataGenerator.lastName();

  await dbHelper.resetSettings(credentials.loginName);
  await ssoLoginPage.propertyLogin(
    credentials.propertyShortName,
    credentials.loginName,
    credentials.password,
  );

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

  await leadPage.clickQuotation(firstName, lastName);
  await quotationPage.verifyDisplayed();
  await quotationPage.selectFirstAvailableProperty();
  await quotationPage.selectFirstAvailableTemplate();
  await quotationPage.enterCheckInDate(DateUtils.addDaysYYYYMMDD(1));
  await quotationPage.enterCheckOutDate(DateUtils.addDaysYYYYMMDD(2));
  await quotationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
  await quotationPage.selectFirstAvailableRoom();
  await quotationPage.selectRate(ConstNames.RATES_NAME_REGULAR_RATE);
  await quotationPage.clickAddRow();
}
