import { ConfigManager } from "../utils/ConfigManager";

const propertyShortName = (): string => ConfigManager.testData.propertyShortName;
const password = (): string => ConfigManager.testData.password;

export const SSOUsers = {
  UserAdmin: {
    get propertyShortName() { return propertyShortName(); },
    get loginName() { return ConfigManager.testData.loginName; },
    get password() { return password(); },
  },

  User: {
    get propertyShortName() { return propertyShortName(); },
    loginName: "staff",
    get password() { return password(); },
  },

  User1: {
    get propertyShortName() { return propertyShortName(); },
    loginName: "staff1",
    get password() { return password(); },
  },

  User2: {
    get propertyShortName() { return propertyShortName(); },
    loginName: "staff2",
    get password() { return password(); },
  },

  User3: {
    get propertyShortName() { return propertyShortName(); },
    loginName: "staff3",
    get password() { return password(); },
  },

  User4: {
    get propertyShortName() { return propertyShortName(); },
    loginName: "staff4",
    get password() { return password(); },
  },

  User5: {
    get propertyShortName() { return propertyShortName(); },
    loginName: "staff5",
    get password() { return password(); },
  },

  User6: {
    get propertyShortName() { return propertyShortName(); },
    loginName: "staff6",
    get password() { return password(); },
  },

  User7: {
    get propertyShortName() { return propertyShortName(); },
    loginName: "staff7",
    get password() { return password(); },
  },

  User8: {
    get propertyShortName() { return propertyShortName(); },
    loginName: "staff8",
    get password() { return password(); },
  },
} as const;
