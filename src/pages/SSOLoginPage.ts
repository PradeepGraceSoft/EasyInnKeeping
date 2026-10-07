import { Locator, Page } from "@playwright/test";
import { BasePage } from "../utils/BasePage";
import { ConfigManager } from "../utils/ConfigManager";
import { SSODatabaseHelper } from "../utils/DBHelper/SSODatabaseHelper";
import { Routes } from "../constants/Routes";
import { LoginSessionStorage } from "../utils/LoginSessionStorage";

export class SSOLoginPage extends BasePage {
  constructor(
    page: Page,
    private readonly ssoDatabaseHelper: SSODatabaseHelper = new SSODatabaseHelper(),
  ) {
    super(page);
  }

  // ***************** Page Elements *********************************

  private readonly propertyShortName: Locator = this.page.getByRole("textbox", {
    name: "Property Short Name",
  });

  private readonly username: Locator = this.page.getByRole("textbox", {
    name: "User Name",
  });

  private readonly password: Locator = this.page.getByRole("textbox", {
    name: "Password",
  });

  private readonly rememberMe: Locator = this.page.locator("#RememberMe");

  private readonly loginButton: Locator = this.page.getByRole("button", {
    name: "Login",
  });

  private readonly forgotPasswordLink: Locator = this.page.locator(
    "a:has-text('Forgot Password?')",
  );

  private readonly loginErrorMessage: Locator = this.page.locator(
    ".alert.alert-danger ul",
  );

  private readonly login2FAErrorMessage: Locator = this.page.locator(
    ".alert.alert-danger",
  );

  private readonly shortNameValidationMessage: Locator = this.page.locator(
    "xpath=//span[@data-valmsg-for='ShortName']",
  );

  private readonly usernameValidationMessage: Locator = this.page.locator(
    "xpath=//span[@data-valmsg-for='Username']",
  );

  private readonly passwordValidationMessage: Locator = this.page.locator(
    "xpath=//span[@data-valmsg-for='Password']",
  );

  private readonly accountLockedMessage: Locator = this.page.locator(
    "xpath=//div[contains(text(),'locked') or contains(@class,'locked-message')]",
  );

  private readonly verificationCodeTextBox: Locator = this.page.locator(
    "#VerificationNumber",
  );

  private readonly verificationCodeEmailOption: Locator = this.page.locator(
    "input#OptionList[value='Email']",
  );

  private readonly verificationCodeSMSOption: Locator = this.page.locator(
    "input#OptionList[value='SMS']",
  );

  private readonly verificationNextButton: Locator = this.page.locator(
    "button[formaction*='LoginAuthentication/Next']",
  );

  private readonly verificationVerifyButton: Locator = this.page.locator(
    "button.property-login",
  );

  private readonly resendCodeLink: Locator = this.page.locator(
    "a[href*='ResendVerificationCode']",
  );

  private readonly logoutButton: Locator = this.page.locator(
    "img[alt='logout icon']",
  );

  private readonly newPasswordInput: Locator =
    this.page.locator("#NewPassword");

  private readonly confirmPasswordInput: Locator =
    this.page.locator("#ConfirmPassword");

  // Intentionally shares #Button1 with loginButton — same element, different page context
  private readonly resetPasswordButton: Locator = this.page.locator("#Button1");

  // ***************** Navigation *********************************

  async navigateToLoginPage(): Promise<void> {
    await this.page.goto(ConfigManager.branch.verifyLogin);
  }

  // ***************** Login *********************************

  private async login(
    shortName: string,
    username: string,
    password: string,
  ): Promise<void> {
    await this.propertyShortName.fill(shortName);
    await this.username.fill(username);
    await this.password.fill(password);
    await this.loginButton.click();
  }

  async loginAsPropertyUser(): Promise<void> {
    const props = ConfigManager.testData;
    await this.propertyLogin(
      props.propertyShortName,
      props.loginName,
      props.password,
    );
  }

  async loginAsStaffUser(): Promise<void> {
    const props = ConfigManager.testData;
    await this.login(
      props.propertyShortName,
      props.staffLoginName,
      props.staffPassword,
    );
  }

  async loginAsManagerUser(): Promise<void> {
    const props = ConfigManager.testData;
    await this.login(
      props.propertyShortName,
      props.managerLoginName,
      props.managerPassword,
    );
  }

  async clickLoginButton(): Promise<void> {
    await this.loginButton.click();
  }

  async clickLogoutButton(): Promise<void> {
    await this.logoutButton.click();
  }

  async propertyLogin(
    shortName: string,
    username: string,
    password: string,
  ): Promise<void> {
    const configured = ConfigManager.testData;
    if (shortName !== configured.propertyShortName || username !== configured.loginName || password !== configured.password) {
      await this.regularPropertyLogin(shortName, username, password);
      return;
    }
    // The SPA requires its canonical uppercase deployment path. The lowercase
    // SSO entry URL redirects to the SPA root and drops the /list route.
    const pmsBaseUrl = new URL(`${ConfigManager.branch.verifyLogin.replace(/\/$/, "")}/`);
    pmsBaseUrl.pathname = pmsBaseUrl.pathname.toUpperCase();
    await LoginSessionStorage.loginWithSavedSession(this.page, {
      propertyId: configured.propertyId,
      username,
      reservationListUrl: new URL(
        Routes.PMS_RESERVATION_LIST_URL,
        pmsBaseUrl,
      ).href,
    }, () => this.regularPropertyLogin(shortName, username, password));
  }

  /** Credentials/OTP flow used when the session utility requires fresh authentication. */
  async regularPropertyLogin(
    shortName: string,
    username: string,
    password: string,
  ): Promise<void> {
    await this.navigateToLoginPage();
    if (this.page.url().includes(Routes.PMS_LOGIN_SUCCESS_URL)) {
      return;
    }

    await this.login(shortName, username, password);

    await this.page.waitForURL(
      (url) =>
        url.pathname.includes(Routes.PMS_LOGIN_VERIFICATION_CODE_URL) ||
        url.pathname.includes(Routes.PMS_LOGIN_SUCCESS_URL),
    );
    if (this.page.url().includes(Routes.PMS_LOGIN_SUCCESS_URL)) {
      return;
    }

    await this.verifyVerificationCodeScreenDisplayed();
    await this.selectEmailDeliveryMethod();
    await this.enterVerificationCode(username);
    await this.clickVerifyAccountButton();
    await this.verifySuccessfulLogin();
  }

  // ***************** Credential Entry *********************************

  async enterPropertyShortName(shortName: string): Promise<void> {
    await this.propertyShortName.fill(shortName);
  }

  async enterLoginName(username: string): Promise<void> {
    await this.username.fill(username);
  }

  async enterPassword(password: string): Promise<void> {
    await this.password.fill(password);
  }

  async enterStaffCredentials(): Promise<void> {
    const props = ConfigManager.testData;
    await this.propertyShortName.fill(props.propertyShortName);
    await this.username.fill(props.staffLoginName);
    await this.password.fill(props.staffPassword);
  }

  async enterStaffCredentialsUserBased(
    propertyShortName: string,
    loginName: string,
    password: string,
  ): Promise<void> {
    await this.propertyShortName.fill(propertyShortName);
    await this.username.fill(loginName);
    await this.password.fill(password);
  }

  async enterAdminCredentials(): Promise<void> {
    const props = ConfigManager.testData;
    await this.propertyShortName.fill(props.propertyShortName);
    await this.username.fill(props.loginName);
    await this.password.fill(props.password);
  }

  async enterManagerCredentials(): Promise<void> {
    const props = ConfigManager.testData;
    await this.propertyShortName.fill(props.propertyShortName);
    await this.username.fill(props.managerLoginName);
    await this.password.fill(props.managerPassword);
  }

  async enterPropertyShortNameEmptyValidLoginPassword(): Promise<void> {
    const props = ConfigManager.testData;
    await this.propertyShortName.fill("");
    await this.username.fill(props.loginName);
    await this.password.fill(props.password);
  }

  async enterValidShortNameValidLoginInvalidPassword(): Promise<void> {
    const props = ConfigManager.testData;
    await this.propertyShortName.fill(props.propertyShortName);
    await this.username.fill(props.loginName);
    await this.password.fill(`Invalid${props.password}`);
  }

  async enterValidShortNameInvalidLoginValidPassword(): Promise<void> {
    const props = ConfigManager.testData;
    await this.propertyShortName.fill(props.propertyShortName);
    await this.username.fill("invaliduser");
    await this.password.fill(props.password);
  }

  async enterValidShortNameInvalidLoginInvalidPassword(): Promise<void> {
    const props = ConfigManager.testData;
    await this.propertyShortName.fill(props.propertyShortName);
    await this.username.fill("invaliduser");
    await this.password.fill("InvalidPassword123");
  }

  async enterInvalidShortNameInvalidLoginValidPassword(): Promise<void> {
    const props = ConfigManager.testData;
    await this.propertyShortName.fill("invalidshortname");
    await this.username.fill("invaliduser");
    await this.password.fill(props.password);
  }

  async enterInvalidShortNameValidLoginInvalidPassword(): Promise<void> {
    const props = ConfigManager.testData;
    await this.propertyShortName.fill("invalidshortname");
    await this.username.fill(props.loginName);
    await this.password.fill(`${props.password}1`);
  }

  async enterAllInvalidCredentials(): Promise<void> {
    await this.propertyShortName.fill("invalidshortname");
    await this.username.fill("invaliduser");
    await this.password.fill("InvalidPassword123");
  }

  async enterCredentialsWithLeadingTrailingSpaces(): Promise<void> {
    const props = ConfigManager.testData;
    await this.propertyShortName.fill(` ${props.propertyShortName} `);
    await this.username.fill(` ${props.loginName} `);
    await this.password.fill(` ${props.password} `);
  }

  async clearAllCredentialFields(): Promise<void> {
    await this.propertyShortName.clear();
    await this.username.clear();
    await this.password.clear();
  }

  // ***************** Remember Me *********************************

  async enableRememberMe(): Promise<void> {
    if (!(await this.rememberMe.isChecked())) {
      await this.rememberMe.check();
    }
  }

  async disableRememberMe(): Promise<void> {
    if (await this.rememberMe.isChecked()) {
      await this.rememberMe.uncheck();
    }
  }

  // ***************** Logout *********************************

  async logout(): Promise<void> {
    await this.logoutButton.click();
  }

  // ***************** 2FA *********************************

  async selectEmailDeliveryMethod(): Promise<void> {
    await this.verificationCodeEmailOption.check();
    await this.verificationNextButton.click();
  }

  async selectSMSVerification(): Promise<void> {
    await this.verificationCodeSMSOption.check();
    await this.verificationNextButton.click();
  }

  async resendVerificationCode(): Promise<void> {
    await this.resendCodeLink.click();
  }

  async enterVerificationCode(loginName: string): Promise<void> {
    const otp = await this.ssoDatabaseHelper.retrieveOTP(loginName);

    if (!otp) {
      throw new Error(`OTP not found for ${loginName}`);
    }

    await this.verificationCodeTextBox.fill(otp);
  }

  async verifyOTP(): Promise<void> {
    await this.verificationVerifyButton.click();
  }

  async clickVerifyAccountButton(): Promise<void> {
    await this.verificationVerifyButton.click();
  }

  // ***************** Password Reset *********************************

  async resetPassword(
    password: string,
    confirmPassword: string,
  ): Promise<void> {
    await this.newPasswordInput.fill(password);
    await this.confirmPasswordInput.fill(confirmPassword);
    await this.resetPasswordButton.click();
  }

  // ***************** Assertions *********************************

  async verifySuccessfulLogin(): Promise<void> {
    await this.waitForUrl(Routes.PMS_LOGIN_SUCCESS_URL);
  }

  async verifyLoginPageIsDisplayed(): Promise<void> {
    await this.loginButton.waitFor({ state: "visible" });
  }

  async verifyVerificationCodeScreenDisplayed(): Promise<void> {
    await this.verifyCurrentLandingPageURL("LoginAuthentication");
  }

  async verifyAccountLockedMessageDisplayed(): Promise<void> {
    await this.accountLockedMessage.waitFor({ state: "visible" });
  }

  async verifyErrorMessageDisplayed(expectedAlert: string): Promise<void> {
    const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

    const actualMessage = await this.getVisibleErrorMessage();

    if (!actualMessage) {
      throw new Error(
        `Expected alert '${expectedAlert}' but no alert was visible.`,
      );
    }

    if (!normalize(actualMessage).includes(normalize(expectedAlert))) {
      throw new Error(
        `Expected alert '${expectedAlert}' but got '${actualMessage}'`,
      );
    }
  }

  // ***************** DB Helpers *********************************

  async dbUpdateSSOResetTokenExpiry(loginName: string): Promise<void> {
    await this.ssoDatabaseHelper.expirePasswordResetToken(loginName);
  }

  async isOTPGeneratedWithinExpiry(loginName: string): Promise<boolean> {
    return this.ssoDatabaseHelper.isOTPGeneratedWithinExpiry(loginName);
  }

  async getOTPDayCount(loginName: string): Promise<number> {
    return this.ssoDatabaseHelper.getOTPDayCount(loginName);
  }

  // ***************** Getters *********************************

  async getLoginErrorMessage(): Promise<string> {
    return (await this.loginErrorMessage.textContent())?.trim() ?? "";
  }

  async get2FAErrorMessage(): Promise<string> {
    return (await this.login2FAErrorMessage.textContent())?.trim() ?? "";
  }

  async getPropertyShortNameValue(): Promise<string> {
    return this.propertyShortName.inputValue();
  }

  async getUsernameValue(): Promise<string> {
    return this.username.inputValue();
  }

  async getPasswordValue(): Promise<string> {
    return this.password.inputValue();
  }

  // ***************** Private Helpers *********************************

  private async getVisibleErrorMessage(): Promise<string> {
    const loginMessage = await this.getLoginErrorMessageIfVisible();
    if (loginMessage) return loginMessage;

    const verificationMessage = await this.get2FAErrorMessageIfVisible();
    if (verificationMessage) return verificationMessage;

    const accountLockedMessage = await this.getAccountLockedMessageIfVisible();
    if (accountLockedMessage) return accountLockedMessage;

    return "";
  }

  private async getLoginErrorMessageIfVisible(): Promise<string> {
    if (
      (await this.loginErrorMessage.count()) &&
      (await this.loginErrorMessage.isVisible())
    ) {
      return this.getLoginErrorMessage();
    }

    return "";
  }

  private async get2FAErrorMessageIfVisible(): Promise<string> {
    if (
      (await this.login2FAErrorMessage.count()) &&
      (await this.login2FAErrorMessage.isVisible())
    ) {
      return this.get2FAErrorMessage();
    }

    return "";
  }

  private async getAccountLockedMessageIfVisible(): Promise<string> {
    if (
      (await this.accountLockedMessage.count()) &&
      (await this.accountLockedMessage.isVisible())
    ) {
      return (await this.accountLockedMessage.textContent())?.trim() ?? "";
    }

    return "";
  }
}
