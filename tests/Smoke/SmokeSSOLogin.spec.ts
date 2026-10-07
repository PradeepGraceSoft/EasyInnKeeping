import { SSODatabaseHelper } from "../../src/utils/DBHelper/SSODatabaseHelper";
import { test, expect } from "../../src/fixtures/sso.fixture";
import { AlertMessages } from "../../src/constants/AlertMessages";
import { SSOUsers } from "../../src/test-data/SSOUsers";

// =========================================================================
// Scenario: Allow property user to login with valid credentials and 2FA
// =========================================================================

test("should allow the property info user to login with valid credentials and 2FA", async ({
  ssoLoginPage,
  dbHelper,
}) => {
  const user = SSOUsers.UserAdmin;
  await dbHelper.resetSettings(user.loginName);
  await ssoLoginPage.navigateToLoginPage();
  await ssoLoginPage.enterAdminCredentials();
  await ssoLoginPage.clickLoginButton();
  await ssoLoginPage.verifyVerificationCodeScreenDisplayed();
  await ssoLoginPage.selectEmailDeliveryMethod();
  await ssoLoginPage.enterVerificationCode(user.loginName);
  await ssoLoginPage.clickVerifyAccountButton();
  await ssoLoginPage.verifySuccessfulLogin();
});

// =========================================================================
// Scenario: Allow staff user to login with valid credentials
// =========================================================================

test("should allow staff user to login with valid credentials", async ({
  dbHelper,
  ssoLoginPage,
}) => {
  const user = SSOUsers.User;
  await dbHelper.resetSettings(user.loginName);
  await ssoLoginPage.navigateToLoginPage();
  await ssoLoginPage.enterStaffCredentials();
  await ssoLoginPage.clickLoginButton();
  await ssoLoginPage.verifyVerificationCodeScreenDisplayed();
  await ssoLoginPage.selectEmailDeliveryMethod();
  await ssoLoginPage.enterVerificationCode(user.loginName);
  await ssoLoginPage.clickVerifyAccountButton();
  await ssoLoginPage.verifySuccessfulLogin();
});


// =========================================================================
// Scenario: Prevent login with invalid credentials
// =========================================================================

test("should not login with valid short name, valid login name, and invalid password", async ({
  ssoLoginPage,
  dbHelper,
}) => {
  const user = SSOUsers.UserAdmin;
  await dbHelper.resetSettings(user.loginName);
  await ssoLoginPage.navigateToLoginPage();
  await ssoLoginPage.enterValidShortNameValidLoginInvalidPassword();
  await ssoLoginPage.clickLoginButton();
  await ssoLoginPage.verifyLoginPageIsDisplayed();
  await ssoLoginPage.verifyErrorMessageDisplayed(
    AlertMessages.LOGIN_INVALID_CREDENTIALS,
  );
});

test("should not login with valid short name, invalid login name, and valid password", async ({
  ssoLoginPage,
  dbHelper,
}) => {
  const user = SSOUsers.UserAdmin;
  await dbHelper.resetSettings(user.loginName);
  await ssoLoginPage.navigateToLoginPage();
  await ssoLoginPage.enterValidShortNameInvalidLoginValidPassword();
  await ssoLoginPage.clickLoginButton();
  await ssoLoginPage.verifyLoginPageIsDisplayed();
  await ssoLoginPage.verifyErrorMessageDisplayed(
    AlertMessages.LOGIN_INVALID_CREDENTIALS,
  );
});

test("should not login with valid short name, invalid login name, and invalid password", async ({
  ssoLoginPage,
  dbHelper,
}) => {
  const user = SSOUsers.UserAdmin;
  await dbHelper.resetSettings(user.loginName);
  await ssoLoginPage.navigateToLoginPage();
  await ssoLoginPage.enterValidShortNameInvalidLoginInvalidPassword();
  await ssoLoginPage.clickLoginButton();
  await ssoLoginPage.verifyLoginPageIsDisplayed();
  await ssoLoginPage.verifyErrorMessageDisplayed(
    AlertMessages.LOGIN_INVALID_CREDENTIALS,
  );
});

test("should not login with invalid short name, invalid login name, and valid password", async ({
  ssoLoginPage,
}) => {
  await ssoLoginPage.navigateToLoginPage();
  await ssoLoginPage.enterInvalidShortNameInvalidLoginValidPassword();
  await ssoLoginPage.clickLoginButton();
  await ssoLoginPage.verifyLoginPageIsDisplayed();
  await ssoLoginPage.verifyErrorMessageDisplayed(
    AlertMessages.LOGIN_INVALID_CREDENTIALS,
  );
});

test("should not login with invalid short name, valid login name, and invalid password", async ({
  ssoLoginPage,
  dbHelper,
}) => {
  await ssoLoginPage.navigateToLoginPage();
  await ssoLoginPage.enterInvalidShortNameValidLoginInvalidPassword();
  await ssoLoginPage.clickLoginButton();
  await ssoLoginPage.verifyLoginPageIsDisplayed();
  await ssoLoginPage.verifyErrorMessageDisplayed(
    AlertMessages.LOGIN_INVALID_CREDENTIALS,
  );
});

test("should not login with all invalid credentials", async ({
  ssoLoginPage,
}) => {
  await ssoLoginPage.navigateToLoginPage();
  await ssoLoginPage.enterAllInvalidCredentials();
  await ssoLoginPage.clickLoginButton();
  await ssoLoginPage.verifyLoginPageIsDisplayed();
  await ssoLoginPage.verifyErrorMessageDisplayed(
    AlertMessages.LOGIN_INVALID_CREDENTIALS,
  );
});

// =========================================================================
// Scenario: Prevent login when all fields are empty
// =========================================================================

test("should display validation error when all fields are empty", async ({
  ssoLoginPage,
}) => {
  await ssoLoginPage.navigateToLoginPage();
  await ssoLoginPage.clearAllCredentialFields();
  await ssoLoginPage.clickLoginButton();
  await ssoLoginPage.verifyErrorMessageDisplayed(
    AlertMessages.LOGIN_EMPTY_ALL_CREDENTIALS,
  );
});

// =========================================================================
// Scenario: Prevent login when short name is empty
// =========================================================================

test("should display validation error when property short name is empty", async ({
  ssoLoginPage,
}) => {
  await ssoLoginPage.navigateToLoginPage();
  await ssoLoginPage.enterPropertyShortNameEmptyValidLoginPassword();
  await ssoLoginPage.clickLoginButton();
  await ssoLoginPage.verifyErrorMessageDisplayed(
    AlertMessages.LOGIN_EMPTY_SHORT_NAME,
  );
});

// =========================================================================
// Scenario: Prevent login with leading and trailing spaces
// =========================================================================

test("should handle leading and trailing spaces in credentials", async ({
  ssoLoginPage,
  dbHelper,
}) => {
  const user = SSOUsers.UserAdmin;
  await dbHelper.resetSettings(user.loginName);
  await ssoLoginPage.navigateToLoginPage();
  await ssoLoginPage.enterCredentialsWithLeadingTrailingSpaces();
  await ssoLoginPage.clickLoginButton();
  await ssoLoginPage.verifyVerificationCodeScreenDisplayed();
  await ssoLoginPage.selectEmailDeliveryMethod();
  await ssoLoginPage.enterVerificationCode(user.loginName);
  await ssoLoginPage.clickVerifyAccountButton();
  await ssoLoginPage.verifySuccessfulLogin();
});

// =========================================================================
// Scenario: Case sensitivity in password
// =========================================================================

test("should fail login when password has incorrect letter casing", async ({
  ssoLoginPage,
  dbHelper,
}) => {
  const user = SSOUsers.UserAdmin;
  await dbHelper.resetSettings(user.loginName);
  await ssoLoginPage.navigateToLoginPage();
  await ssoLoginPage.enterPropertyShortName(user.propertyShortName);
  await ssoLoginPage.enterLoginName(user.loginName);
  await ssoLoginPage.enterPassword(user.password.toLowerCase());
  await ssoLoginPage.clickLoginButton();
  await ssoLoginPage.verifyLoginPageIsDisplayed();
  await ssoLoginPage.verifyErrorMessageDisplayed(
    AlertMessages.LOGIN_INVALID_CREDENTIALS,
  );
});

test("should require staff B to re-authenticate with 2FA after Staff A logout", async ({
  ssoLoginPage,
  dbHelper,
}) => {
  const user = SSOUsers.User2;
  await dbHelper.resetSettings(user.loginName);
  // Staff A login
  await ssoLoginPage.navigateToLoginPage();
  await ssoLoginPage.enterStaffCredentialsUserBased(
    user.propertyShortName,
    user.loginName,
    user.password,
  );
  await ssoLoginPage.clickLoginButton();
  await ssoLoginPage.verifyVerificationCodeScreenDisplayed();
  await ssoLoginPage.selectEmailDeliveryMethod();
  await ssoLoginPage.enterVerificationCode(user.loginName);
  await ssoLoginPage.clickVerifyAccountButton();
  await ssoLoginPage.verifySuccessfulLogin();

  // Staff A logout
  await ssoLoginPage.clickLogoutButton();
  await ssoLoginPage.verifyLoginPageIsDisplayed();

  // Staff B (Manager) login - should require 2FA
  await ssoLoginPage.navigateToLoginPage();
  const managerUser = SSOUsers.User3;
  await dbHelper.resetSettings(managerUser.loginName);
  await ssoLoginPage.enterStaffCredentialsUserBased(
    managerUser.propertyShortName,
    managerUser.loginName,
    managerUser.password,
  );
  await ssoLoginPage.clickLoginButton();
  await ssoLoginPage.verifyVerificationCodeScreenDisplayed();
  await ssoLoginPage.selectEmailDeliveryMethod();
  await ssoLoginPage.enterVerificationCode(managerUser.loginName);
  await ssoLoginPage.clickVerifyAccountButton();
});

// =========================================================================
// Scenario: Warning message on consecutive failed attempts
// =========================================================================

test("should display warning after 3 failed login attempts", async ({
  page,
  ssoLoginPage,
  dbHelper,
}) => {
  const User = SSOUsers.User4;
  dbHelper.resetSettings(User.loginName);
  await ssoLoginPage.navigateToLoginPage();

  for (let attempt = 1; attempt <= 3; attempt++) {
    await ssoLoginPage.enterStaffCredentialsUserBased(
      User.propertyShortName,
      User.loginName,
      "InvalidPassword",
    );
    await ssoLoginPage.clickLoginButton();
    await page.waitForTimeout(1000);
  }

  await ssoLoginPage.verifyErrorMessageDisplayed(
    AlertMessages.LOGIN_LOCKED_TWO_ATTEMPTS_LEFT,
  );
});

test("should display warning after 4 failed login attempts", async ({
  page,
  ssoLoginPage,
  dbHelper,
}) => {
  const User = SSOUsers.User8;
  dbHelper.resetSettings(User.loginName);
  await ssoLoginPage.navigateToLoginPage();

  for (let attempt = 1; attempt <= 4; attempt++) {
    await ssoLoginPage.enterStaffCredentialsUserBased(
      User.propertyShortName,
      User.loginName,
      "InvalidPassword",
    );
    await ssoLoginPage.clickLoginButton();
    await page.waitForTimeout(1000);
  }

  await ssoLoginPage.verifyErrorMessageDisplayed(
    AlertMessages.LOGIN_LOCKED_ONE_ATTEMPTS_LEFT,
  );
});

// =========================================================================
// Scenario: Lock account after 5 failed attempts
// =========================================================================

test("should lock account after 5 consecutive failed login attempts", async ({
  ssoLoginPage,
  dbHelper,
}) => {
  const User = SSOUsers.User5;
  dbHelper.resetSettings(User.loginName);
  await ssoLoginPage.navigateToLoginPage();
  for (let attempt = 1; attempt <= 5; attempt++) {
    await ssoLoginPage.enterStaffCredentialsUserBased(
      User.propertyShortName,
      User.loginName,
      "InvalidPassword",
    );
    await ssoLoginPage.clickLoginButton();
  }

  await ssoLoginPage.verifyErrorMessageDisplayed(
    AlertMessages.LOGIN_LOCKED_ACCOUNT,
  );
});

// =========================================================================
// Scenario: Locked account should not allow login with valid credentials
// =========================================================================

test("should prevent login with valid credentials when account is locked", async ({
  ssoLoginPage,
  dbHelper,
}) => {
  const User = SSOUsers.User6;
  dbHelper.resetSettings(User.loginName);
  // Lock the account
  await ssoLoginPage.navigateToLoginPage();
  for (let attempt = 1; attempt <= 5; attempt++) {
    await ssoLoginPage.enterStaffCredentialsUserBased(
      User.propertyShortName,
      User.loginName,
      "InvalidPassword",
    );
    await ssoLoginPage.clickLoginButton();
  }

  await ssoLoginPage.verifyErrorMessageDisplayed(
    AlertMessages.LOGIN_LOCKED_ACCOUNT,
  );

  // Try to login with valid credentials
  await ssoLoginPage.navigateToLoginPage();
  await ssoLoginPage.enterStaffCredentialsUserBased(
    User.propertyShortName,
    User.loginName,
    User.password,
  );
});

// =========================================================================
// Scenario: Two invalid attempts then correct on third — retry count resets
// =========================================================================

test("should reset retry count after successful login following failed attempts", async ({
  page,
  ssoLoginPage,
}) => {
  const dbHelper = new SSODatabaseHelper();
  const User = SSOUsers.User7;
  await ssoLoginPage.navigateToLoginPage();
  await ssoLoginPage.enterStaffCredentialsUserBased(
    User.propertyShortName,
    User.loginName,
    "InvalidPassword",
  );

  // First invalid attempt
  await ssoLoginPage.navigateToLoginPage();
  await ssoLoginPage.enterStaffCredentialsUserBased(
    User.propertyShortName,
    User.loginName,
    "InvalidPassword",
  );
  await ssoLoginPage.clickLoginButton();
  await page.waitForTimeout(500);

  // Second invalid attempt
  await ssoLoginPage.navigateToLoginPage();
  await ssoLoginPage.enterStaffCredentialsUserBased(
    User.propertyShortName,
    User.loginName,
    "InvalidPassword",
  );
  await ssoLoginPage.clickLoginButton();
  await page.waitForTimeout(500);

  // Third attempt with valid credentials
  await ssoLoginPage.navigateToLoginPage();
  await ssoLoginPage.enterStaffCredentialsUserBased(
    User.propertyShortName,
    User.loginName,
    User.password,
  );
  await ssoLoginPage.clickLoginButton();
  await ssoLoginPage.verifyVerificationCodeScreenDisplayed();
  await ssoLoginPage.selectEmailDeliveryMethod();
  await ssoLoginPage.enterVerificationCode(User.loginName);
  await ssoLoginPage.clickVerifyAccountButton();
  await ssoLoginPage.verifySuccessfulLogin();

  // Verify retry count is reset
  const retryCount = await dbHelper.getRetryCount(User.loginName);
  expect(retryCount).toBe(0);
});


// =========================================================================
// Scenario: Logout the admin and the staff login successfully
// =========================================================================

test("Logout the admin and the staff login successfully", async ({
  ssoLoginPage,
  dbHelper,
}) => {
  const user = SSOUsers.UserAdmin;
  await dbHelper.resetSettings(user.loginName);
  await ssoLoginPage.navigateToLoginPage();
  await ssoLoginPage.enterStaffCredentialsUserBased(
    user.propertyShortName,
    user.loginName,
    user.password,
  );
  await ssoLoginPage.clickLoginButton();
  await ssoLoginPage.verifyVerificationCodeScreenDisplayed();
  await ssoLoginPage.selectEmailDeliveryMethod();
  await ssoLoginPage.enterVerificationCode(user.loginName);
  await ssoLoginPage.clickVerifyAccountButton();
  await ssoLoginPage.verifySuccessfulLogin();

  // Logout
  await ssoLoginPage.clickLogoutButton();
  await ssoLoginPage.verifyLoginPageIsDisplayed();

  const user1 = SSOUsers.User8;
  await dbHelper.resetSettings(user1.loginName);
  await ssoLoginPage.navigateToLoginPage();
  await ssoLoginPage.enterStaffCredentialsUserBased(
    user1.propertyShortName,
    user1.loginName,
    user1.password,
  );
  await ssoLoginPage.clickLoginButton();
  await ssoLoginPage.verifyVerificationCodeScreenDisplayed();
  await ssoLoginPage.selectEmailDeliveryMethod();
  await ssoLoginPage.enterVerificationCode(user1.loginName);
  await ssoLoginPage.clickVerifyAccountButton();
  await ssoLoginPage.verifySuccessfulLogin();

  // Logout
  await ssoLoginPage.clickLogoutButton();
  await ssoLoginPage.verifyLoginPageIsDisplayed();
});
