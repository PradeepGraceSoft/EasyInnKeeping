import { test } from "../../src/fixtures/sso.fixture";
import {
  EmailTemplateCategory,
  EmailTemplatePage,
} from "../../src/pages/CRM/EmailTemplatePage";
import { ConfigManager } from "../../src/utils/ConfigManager";
import { ConstNames } from "../../src/constants/ConstNames";
import { DateUtils } from "../../src/utils/DateUtils";
import { GmailHelper } from "../../src/utils/GmailHelper";
import { TestDataGenerator } from "../../src/utils/TestDataGenerator";

test.describe("Email Template", () => {
  test.beforeEach(async ({ crmLoginPage, crmLeftMenuPage, emailTemplatePage }) => {
    const credentials = ConfigManager.testData;

    await crmLoginPage.loginToCRM(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await crmLeftMenuPage.clickEmailPromotion();
    await emailTemplatePage.verifyDisplayed();
  });

  test("Verify a new Email Template can be created from scratch categorized as Lead", async ({
    emailTemplatePage,
  }) => {
    await createAndVerifyEmailTemplate(emailTemplatePage, "Lead");
  });

  test("Verify a new Email Template can be created from scratch categorized as Customer", async ({
    emailTemplatePage,
  }) => {
    await createAndVerifyEmailTemplate(emailTemplatePage, "Customer");
  });

  test("Verify a new Email Template can be created from scratch categorized as Quotation", async ({
    emailTemplatePage,
  }) => {
    await createAndVerifyEmailTemplate(emailTemplatePage, "Quotation");
  });

  test("Verify duplicate Template Names cannot be created", async ({
    emailTemplatePage,
  }) => {
    const uniqueId = Date.now();
    const templateName = `Duplicate Template ${uniqueId}`;

    await createEmailTemplate(emailTemplatePage, "Lead", templateName, uniqueId);
    await emailTemplatePage.verifyTemplateCreated(templateName, "Lead");

    await emailTemplatePage.clickAddTemplate();
    await emailTemplatePage.enterTemplateName(templateName);
    await emailTemplatePage.selectTemplateType("Customer");
    await emailTemplatePage.enterSubject(`Duplicate Subject ${uniqueId}`);
    await emailTemplatePage.clickSaveTemplateExpectingValidation();
    await emailTemplatePage.verifyDuplicateTemplateNameRejected();
  });

  test("Verify Subject is mandatory", async ({ emailTemplatePage }) => {
    const uniqueId = Date.now();

    await emailTemplatePage.clickAddTemplate();
    await emailTemplatePage.enterTemplateName(`Subject Required Template ${uniqueId}`);
    await emailTemplatePage.selectTemplateType("Lead");
    await emailTemplatePage.clickSaveTemplateExpectingValidation();
    await emailTemplatePage.verifySubjectRequired();
  });

  test("Verify merge fields can be inserted into the template for lead", async ({
    emailTemplatePage,
  }) => {
    await createAndVerifyMergeFieldTemplate(emailTemplatePage, "Lead");
  });

  test("Verify merge fields can be inserted into the template for customer", async ({
    emailTemplatePage,
  }) => {
    await createAndVerifyMergeFieldTemplate(emailTemplatePage, "Customer");
  });

  test("Verify merge fields can be inserted into the template for quotation", async ({
    emailTemplatePage,
  }) => {
    await createAndVerifyMergeFieldTemplate(emailTemplatePage, "Quotation");
  });

  test("Verify a saved merge tag Lead template can be selected and used when sending emails to Leads.", async ({
    crmLeftMenuPage,
    emailTemplatePage,
    leadPage,
    responsePage,
  }) => {
    test.setTimeout(150000);
    const templateName = await createAndVerifyMergeFieldTemplate(
      emailTemplatePage,
      "Lead",
    );
    const firstName = TestDataGenerator.firstName();
    const lastName = TestDataGenerator.lastName();
    const recipient = ConfigManager.gmail.email;

    await crmLeftMenuPage.clickLeadIcon();
    await leadPage.clickAddLead();
    await leadPage.enterFirstName(firstName);
    await leadPage.enterLastName(lastName);
    await leadPage.enterEmail(recipient);
    await leadPage.clickSaveLead();
    await leadPage.verifyLeadSaved();
    await leadPage.clickResponse(firstName, lastName);
    await responsePage.verifyDisplayed();
    await responsePage.selectTemplate(templateName);
    await responsePage.enterCallBackDate(DateUtils.addDaysYYYYMMDD(1));
    const sentAfter = new Date();
    await responsePage.clickSendEmail();
    await responsePage.verifyEmailSentSuccessfully();
    await GmailHelper.verifyEmailReceived(recipient, sentAfter);
  });

  test("Verify a saved merge tag Customer template can be selected and used when sending emails to Customers.", async ({
    crmLeftMenuPage,
    emailTemplatePage,
    customerPage,
    responsePage,
    crmCustomerDbHelper,
  }) => {
    test.setTimeout(150000);
    const templateName = await createAndVerifyMergeFieldTemplate(
      emailTemplatePage,
      "Customer",
    );
    const firstName = TestDataGenerator.firstName();
    const lastName = TestDataGenerator.lastName();
    const recipient = ConfigManager.gmail.email;
    const companyId = Number(ConfigManager.testData.crmCompanyId);

    await crmCustomerDbHelper.deleteCustomerByEmail(companyId, recipient);

    await crmLeftMenuPage.clickCustomerIcon();
    await customerPage.clickAddCustomer();
    await customerPage.enterFirstName(firstName);
    await customerPage.enterLastName(lastName);
    await customerPage.enterEmail(recipient);
    await customerPage.clickSaveCustomer();
    await customerPage.verifyCustomerSaved();
    await customerPage.selectCustomer(firstName, lastName);
    await customerPage.clickBulkEmail();
    await responsePage.verifyDisplayed();
    await responsePage.selectTemplate(templateName);
    await responsePage.enterCallBackDate(DateUtils.addDaysYYYYMMDD(1));
    const sentAfter = new Date();
    await responsePage.clickSendEmail();
    await responsePage.verifyEmailSentSuccessfully();
    await GmailHelper.verifyEmailReceived(recipient, sentAfter);
  });

  test("Verify a saved merge tag Quotation template can be selected and used in the Quotation workflow.", async ({
    dbHelper,
    ssoLoginPage,
    crmLoginPage,
    crmLeftMenuPage,
    emailTemplatePage,
    leadPage,
    quotationPage,
  }) => {
    test.setTimeout(150000);
    const templateName = await createAndVerifyMergeFieldTemplate(
      emailTemplatePage,
      "Quotation",
    );
    const firstName = TestDataGenerator.firstName();
    const lastName = TestDataGenerator.lastName();
    const recipient = GmailHelper.createUniqueRecipient("quotation-merge-template");
    const credentials = ConfigManager.testData;

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
    await quotationPage.selectTemplate(templateName);
    await quotationPage.enterCheckInDate(DateUtils.addDaysYYYYMMDD(1));
    await quotationPage.enterCheckOutDate(DateUtils.addDaysYYYYMMDD(2));
    await quotationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await quotationPage.selectFirstAvailableRoom();
    await quotationPage.selectRate(ConstNames.RATES_NAME_REGULAR_RATE);
    await quotationPage.clickAddRow();
    await quotationPage.verifyTemplateSelected(templateName);
  });
});

async function createAndVerifyEmailTemplate(
  emailTemplatePage: EmailTemplatePage,
  category: EmailTemplateCategory,
): Promise<void> {
  const uniqueId = Date.now();
  const templateName = `Automation ${category} Template ${uniqueId}`;
  const content = `Automation ${category} paragraph content ${uniqueId}`;

  await createEmailTemplate(
    emailTemplatePage,
    category,
    templateName,
    uniqueId,
    content,
  );
  await emailTemplatePage.verifyTemplateCreated(templateName, category);
  await emailTemplatePage.verifyTemplateContent(templateName, content);
}

async function createEmailTemplate(
  emailTemplatePage: EmailTemplatePage,
  category: EmailTemplateCategory,
  templateName: string,
  uniqueId: number,
  content?: string,
): Promise<void> {
  await emailTemplatePage.clickAddTemplate();
  await emailTemplatePage.enterTemplateName(templateName);
  await emailTemplatePage.selectTemplateType(category);
  await emailTemplatePage.enterSubject(`Automation ${category} Subject ${uniqueId}`);
  if (content) {
    await emailTemplatePage.addParagraphContent(content);
  }
  await emailTemplatePage.clickSaveTemplate();
}

async function createAndVerifyMergeFieldTemplate(
  emailTemplatePage: EmailTemplatePage,
  category: "Lead" | "Customer" | "Quotation",
): Promise<string> {
  const uniqueId = Date.now();
  const templateName = `Automation ${category} Merge Field ${uniqueId}`;

  await emailTemplatePage.clickAddTemplate();
  await emailTemplatePage.enterTemplateName(templateName);
  await emailTemplatePage.selectTemplateType(category);
  await emailTemplatePage.enterSubject(`Automation ${category} Merge Subject ${uniqueId}`);
  await emailTemplatePage.insertAndVerifyMergeField(category);
  await emailTemplatePage.clickSaveTemplate();
  await emailTemplatePage.verifyTemplateCreated(templateName, category);
  return templateName;
}
