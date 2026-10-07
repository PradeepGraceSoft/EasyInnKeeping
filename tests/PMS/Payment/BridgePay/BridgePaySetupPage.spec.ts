import { test, expect } from "../../../../src/fixtures/pms.fixture";
import {
  BridgePayCredentials,
  OnlineBookingBridgePayIsolationCredentials,
} from "../../../../src/test-data/BridgePay";

test.describe("BridgePay - Setup - ", () => {
  test("Makes BridgePay available and displays its credential fields", async ({
    layoutPage,
    setupPage,
  }) => {
    await layoutPage.clickSetupIcon();
    await setupPage.navigateToCreditCardSetup();
    await setupPage.openPmsCreditCardValidationDropdown();
    await setupPage.verifyBridgePayIsAvailable();
    await setupPage.selectBridgePay();
    await setupPage.verifyBridgePayCredentialFieldsDisplayed();
  });

  test("Verifies BridgePay can be configured for Online Booking", async ({
    layoutPage,
    setupPage,
  }) => {
    await layoutPage.clickSetupIcon();
    await setupPage.navigateToCreditCardSetup();
    await setupPage.openOnlineBookingCreditCardValidationDropdown();
    await setupPage.verifyOnlineBookingBridgePayIsAvailable();
    await setupPage.selectOnlineBookingBridgePay();
    await setupPage.verifyOnlineBookingBridgePayCredentialFieldsDisplayed();
  });

  test("Verifies valid BridgePay credentials can be configured for Online Booking", async ({
    layoutPage,
    setupPage,
    setupDb,
  }) => {
    await layoutPage.clickSetupIcon();
    await setupPage.navigateToCreditCardSetup();
    await setupPage.openOnlineBookingCreditCardValidationDropdown();
    await setupPage.selectOnlineBookingBridgePay();
    await setupPage.enterOnlineBookingBridgePayCredentials(
      BridgePayCredentials,
    );
    await setupPage.saveBridgePayConfiguration();
    await setupPage.verifyBridgePayConfigurationSavedAlert();
    await setupPage.closeBridgePayConfigurationSavedAlert();
    await setupPage.clickCreditCard();
    const savedCredentials =
      await setupDb.getOnlineBookingBridgePayCredentials();
    await setupPage.verifySavedOnlineBookingBridgePayCredentials(
      BridgePayCredentials,
      savedCredentials,
    );
  });

  test("Verifies PMS and Online Booking BridgePay configurations do not overwrite each other", async ({
    page,
    layoutPage,
    setupPage,
    setupDb,
  }) => {
    test.setTimeout(90_000);
    await layoutPage.clickSetupIcon();
    await setupPage.navigateToCreditCardSetup();
    await setupPage.openPmsCreditCardValidationDropdown();
    await setupPage.selectBridgePay();
    await setupPage.enterBridgePayCredentials(BridgePayCredentials);
    await setupPage.saveBridgePayConfiguration();
    await setupPage.verifyBridgePayConfigurationSavedAlert();
    await setupPage.closeBridgePayConfigurationSavedAlert();
    await setupPage.clickCreditCard();

    await setupPage.openOnlineBookingCreditCardValidationDropdown();
    await setupPage.selectOnlineBookingBridgePay();
    await setupPage.enterOnlineBookingBridgePayCredentials(
      OnlineBookingBridgePayIsolationCredentials,
    );
    await setupPage.saveBridgePayConfiguration();
    await setupPage.verifyBridgePayConfigurationSavedAlert();
    await setupPage.closeBridgePayConfigurationSavedAlert();
    await setupPage.clickCreditCard();

    const savedPmsCredentials = await setupDb.getBridgePayCredentials();
    const savedOnlineCredentials =
      await setupDb.getOnlineBookingBridgePayCredentials();
    await setupPage.verifyBridgePayConfigurationsRemainIndependent(
      BridgePayCredentials,
      OnlineBookingBridgePayIsolationCredentials,
      savedPmsCredentials,
      savedOnlineCredentials,
    );
  });

  test("Verifies valid BridgePay credentials can be saved", async ({
    layoutPage,
    setupPage,
    setupDb,
  }) => {
    await layoutPage.clickSetupIcon();
    await setupPage.navigateToCreditCardSetup();
    await setupPage.openPmsCreditCardValidationDropdown();
    await setupPage.selectBridgePay();
    await setupPage.enterBridgePayCredentials(BridgePayCredentials);
    await setupPage.saveBridgePayConfiguration();
    await setupPage.verifyBridgePayConfigurationSavedAlert();
    await setupPage.closeBridgePayConfigurationSavedAlert();
    await setupPage.clickCreditCard();
    await setupPage.verifySavedBridgePayCredentials(BridgePayCredentials);

    const credentials = await setupDb.getBridgePayCredentials();
    expect(
      credentials,
      "BridgePay credentials were not found for property 5447.",
    ).not.toBeNull();
    expect(
      credentials?.BridgePayPassword,
      "BridgePay password does not match the database value.",
    ).toBe(BridgePayCredentials.password);
    expect(
      credentials?.BridgePayMerchantAccountCode,
      "BridgePay merchant account code does not match the database value.",
    ).toBe(BridgePayCredentials.merchantAccountCode);
  });

  test("Does not save BridgePay configuration when a required credential is missing", async ({
    layoutPage,
    setupPage,
  }) => {
    await layoutPage.clickSetupIcon();
    await setupPage.navigateToCreditCardSetup();
    await setupPage.openPmsCreditCardValidationDropdown();
    await setupPage.selectBridgePay();
    await setupPage.verifyBridgePayRequiredFieldValidation();
  });

  test("Removes BridgePay fields when Authorize.Net is selected", async ({
    layoutPage,
    setupPage,
    setupDb,
  }) => {
    await layoutPage.clickSetupIcon();
    await setupPage.navigateToCreditCardSetup();
    await setupPage.openPmsCreditCardValidationDropdown();
    await setupPage.selectBridgePay();
    await setupPage.verifyBridgePayCredentialFieldsDisplayed();
    await setupPage.selectAuthorizeNet();
    await setupPage.verifyBridgePayFieldsHidden();
    await setupPage.verifyAuthorizeNetFieldsDisplayed();
    const authorizeNetCredentials = await setupDb.getAuthorizeNetCredentials();
    expect(authorizeNetCredentials).not.toBeNull();
    if (
      authorizeNetCredentials?.apiLoginId &&
      authorizeNetCredentials.transactionKey
    ) {
      await setupPage.enterAuthorizeNetCredentials({
        apiLoginId: authorizeNetCredentials.apiLoginId,
        transactionKey: authorizeNetCredentials.transactionKey,
      });
    }
    await setupPage.saveBridgePayConfiguration();
    await setupPage.verifyBridgePayConfigurationSavedAlert();
    await setupPage.closeBridgePayConfigurationSavedAlert();
    await setupPage.clickCreditCard();
    await setupPage.verifyAuthorizeNetIsActive();
  });
});
