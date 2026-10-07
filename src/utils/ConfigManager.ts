import dotenv from 'dotenv';
import path from 'node:path';

export class ConfigManager {

  private static initialized = false;
  private static activePropertyKey = "A";
  private static activeEnvironment = "trunk";

  static initialize(environment: string = process.env.TEST_ENV ?? "trunk"): void {

    if (this.initialized) {
      return;
    }

    const normalizedEnvironment = environment.trim().toLowerCase();
    const environmentFiles: Record<string, string | undefined> = {
      trunk: undefined,
      test1: "test1.env",
    };

    if (!(normalizedEnvironment in environmentFiles)) {
      throw new Error(
        `Unknown TEST_ENV "${environment}". Expected "trunk" or "test1".`,
      );
    }

    const trunkResult = dotenv.config({
      path: path.resolve("config", "qa.env"),
    });

    if (trunkResult.error) {
      throw new Error(
        `Unable to load trunk configuration from config/qa.env: ${trunkResult.error.message}`,
      );
    }

    const environmentFile = environmentFiles[normalizedEnvironment];
    if (environmentFile) {
      const environmentResult = dotenv.config({
        path: path.resolve("config", environmentFile),
        override: true,
      });

      if (environmentResult.error) {
        throw new Error(
          `Unable to load configuration for "${normalizedEnvironment}" from config/${environmentFile}: ${environmentResult.error.message}`,
        );
      }
    }

    this.activeEnvironment = normalizedEnvironment;

    dotenv.config({
      path: path.resolve('config/db.env')
    });

    dotenv.config({
      path: path.resolve('config/testdata.env')
    });

    // Optional local-only payment credentials. The example file documents the
    // expected keys without putting secrets in source control.
    dotenv.config({
      path: path.resolve('config/payment-gateways.env')
    });

    this.initialized = true;
  }

  static get environment(): string {
    this.initialize();
    return this.activeEnvironment;
  }

  static useProperty(propertyKey: string): void {
    this.initialize();

    const normalizedKey = propertyKey.trim().toUpperCase();
    if (!/^[A-E]$/.test(normalizedKey)) {
      throw new Error(`Unknown property key "${propertyKey}". Expected A, B, C, D, or E.`);
    }

    this.activePropertyKey = normalizedKey;
    this.validateActiveProperty();
  }

  private static getPropertyValue(name: string): string {
    return process.env[`env_Property${this.activePropertyKey}_${name}`]?.trim() ?? '';
  }

  private static validateActiveProperty(): void {
    const requiredValues = ["PropertyID", "PropertyShortName", "LoginName", "Password"];
    const missingValues = requiredValues.filter(
      (name) => !this.getPropertyValue(name),
    );

    if (missingValues.length > 0) {
      throw new Error(
        `Property ${this.activePropertyKey} is missing configuration in config/testdata.env: ${missingValues.join(", ")}`,
      );
    }
  }

  static get branch() {

    return {

      verifyLogin:
        process.env.env_VerifyLogin ?? '',

      apiUrl:
        process.env.env_ApiUrl ?? '',

      onlineBookingBaseUrl:
        process.env.env_OnlinebookingBaseURL?.trim() ?? '',

      guestHubBaseUrl:
        process.env.env_GuestHubBaseURL?.trim() ?? '',

      crmBaseUrl:
        process.env.env_CRMBaseURL?.trim() ?? '',

      sendCampaignEmailUrl:
        process.env.env_SendCampaignEmailURL?.trim() ?? ''
    };
  }

  static get database() {

    const rawUrl = process.env.env_dbURL?.trim() ?? '';

    return {

      server:
        process.env.env_dbServer ?? '',

      database:
        process.env.env_dbName ?? '',

      username:
        process.env.env_dbusername ?? '',

      password:
        process.env.env_dbpass ?? '',

      connectionString:
        rawUrl ? ConfigManager.parseJdbcConnectionString(rawUrl) : ''
    };
  }

  private static parseJdbcConnectionString(url: string): string {
    const trimmed = url.trim();

    if (!trimmed.toLowerCase().startsWith('jdbc:sqlserver://')) {
      return trimmed;
    }

    const body = trimmed.slice('jdbc:'.length);
    const rawServerAndParams = body.slice('sqlserver://'.length);
    const [serverPart, ...params] = rawServerAndParams.split(';');
    const server = serverPart.trim();

    const normalizedParams = params
      .map((param) => param.trim())
      .filter(Boolean)
      .map((param) => {
        const [key, value] = param.split('=');

        if (!key || value === undefined) {
          return '';
        }

        const normalizedKey = key.trim().toLowerCase() === 'databasename'
          ? 'Database'
          : key.trim();

        return `${normalizedKey}=${value.trim()}`;
      })
      .filter(Boolean);

    const username = process.env.env_dbusername?.trim();
    const password = process.env.env_dbpass?.trim();

    const authParams = [
      username ? `User Id=${username}` : '',
      password ? `Password=${password}` : ''
    ].filter(Boolean);

    return `Server=${server}${
      normalizedParams.length > 0 ? ';' + normalizedParams.join(';') : ''
    }${authParams.length > 0 ? ';' + authParams.join(';') : ''}`;
  }

  static get testData() {

    const getValue = (name: string, legacyName?: string): string =>
      this.getPropertyValue(name) ||
      (this.activePropertyKey === "A" && legacyName
        ? process.env[legacyName]?.trim() ?? ''
        : '');

    return {

      propertyId:
        getValue("PropertyID", "env_PropertyID"),

      propertyShortName:
        getValue("PropertyShortName", "env_PropertyShortName"),

      loginName:
        getValue("LoginName", "env_LoginName"),

      password:
        getValue("Password", "env_Password"),

      staffLoginName:
        getValue("StaffLoginName", "env_StaffLoginName"),

      staffPassword:
        getValue("StaffPassword", "env_StaffPassword"),

      managerLoginName:
        getValue("ManagerLoginName", "env_ManagerLoginName"),

      managerPassword:
        getValue("ManagerPassword", "env_ManagerPassword"),

      creditCardViewPassword:
        getValue("CreditCardViewPassword", "env_CreditCardViewPassword"),

      emailAddress:
        getValue("EmailAddress", "env_EmailAddress"),

      crmCompanyId:
        getValue("CRMCompanyID")
    };
  }

  static get gmail() {
    return {
      email: process.env.env_GmailEmail?.trim() ?? '',
      appPassword: process.env.env_GmailAppPassword?.replace(/\s/g, '') ?? '',
      rejectUnauthorized:
        process.env.env_GmailRejectUnauthorized?.trim().toLowerCase() !== 'false'
    };
  }
}
