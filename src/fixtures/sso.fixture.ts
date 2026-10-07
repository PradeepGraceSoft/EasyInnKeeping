import { test as base } from "@playwright/test";
import { SSOLoginPage } from "../pages/SSOLoginPage";
import { ReservationPage } from "../pages/ReservationPage";
import { FindReservationPage } from "../pages/FindReservationPage";
import { LayoutPage } from "../pages/LayoutPage";
import { SSODatabaseHelper } from "../utils/DBHelper/SSODatabaseHelper";
import { ReservationDatabaseHelper } from "../utils/DBHelper/ReservationDatabaseHelper";
import { DatabaseUtils } from "../utils/DBHelper/DatabaseUtils";
import { SetupDatabaseHelper } from "../utils/DBHelper/SetupDatabaseHelper";
import { BillingPage } from "../pages/BillingPage";
import { ConfigManager } from "../utils/ConfigManager";
import { OnlineBookingPage } from "../pages/OnlineBookingPage";
import { CRMLoginPage } from "../pages/CRM/CRMLoginPage";
import { CRMLeftMenuPage } from "../pages/CRM/CRMLeftMenuPage";
import { LeadPage } from "../pages/CRM/LeadPage";
import {
  CRMCampaignDatabaseHelper,
  CRMCustomerDatabaseHelper,
  CRMEmailTemplateDatabaseHelper,
  CRMLeadDatabaseHelper,
} from "../utils/DBHelper/CRMDatabaseHelper";
import { CustomerPage } from "../pages/CRM/CustomerPage";
import { StaffResponsePage } from "../pages/CRM/StaffResponsePage";
import { ResponsePage } from "../pages/CRM/ResponsePage";
import { QuotationPage } from "../pages/CRM/QuotationPage";
import { EmailTemplatePage } from "../pages/CRM/EmailTemplatePage";
import { CampaignPage } from "../pages/CRM/CampaignPage";
import { CalendarPage } from "../pages/CalendarPage";
import { OnlineBookingDatabaseHelper } from "../utils/DBHelper/OnlineBookingDatabaseHelper";
import { OTADatabaseHelper } from "../utils/DBHelper/OTADatabaseHelper";
import { GuestDatabaseHelper } from "../utils/DBHelper/GuestDatabaseHelper";
import { GuestHubPage } from "../pages/GuestHubPage";
import { GuestPage } from "../pages/GuestPage";
import { ReservationApi } from "../api/ReservationApi";
import { POSDatabaseHelper } from "../utils/DBHelper/POSDatabaseHelper";
import { SetupPage } from "../pages/SetupPage";

type SSOFixtures = {
  ssoLoginPage: SSOLoginPage;
  reservationPage: ReservationPage;
  findReservationPage: FindReservationPage;
  layoutPage: LayoutPage;
  dbHelper: SSODatabaseHelper;
  reservationDbHelper: ReservationDatabaseHelper;
  setupDb: SetupDatabaseHelper;
  billingPage: BillingPage;
  onlineBookingPage: OnlineBookingPage;
  onlineBookingDb: OnlineBookingDatabaseHelper;
  otaDb: OTADatabaseHelper;
  guestHubPage: GuestHubPage;
  guestPage: GuestPage;
  crmLoginPage: CRMLoginPage;
  crmLeftMenuPage: CRMLeftMenuPage;
  leadPage: LeadPage;
  crmLeadDbHelper: CRMLeadDatabaseHelper;
  crmCampaignDbHelper: CRMCampaignDatabaseHelper;
  crmEmailTemplateDbHelper: CRMEmailTemplateDatabaseHelper;
  customerPage: CustomerPage;
  crmCustomerDbHelper: CRMCustomerDatabaseHelper;
  staffResponsePage: StaffResponsePage;
  responsePage: ResponsePage;
  quotationPage: QuotationPage;
  emailTemplatePage: EmailTemplatePage;
  campaignPage: CampaignPage;
  calendarPage: CalendarPage;
  reservationApi: ReservationApi;
  posDb: POSDatabaseHelper;
  setupPage: SetupPage;
};

type SSOWorkerFixtures = {
  propertyContext: void;
  dbConnection: void;
  guestDb: GuestDatabaseHelper;
};

export const test = base.extend<SSOFixtures, SSOWorkerFixtures>({

  propertyContext: [
    async ({}, use, workerInfo) => {
      const projectEnvironment = workerInfo.project.metadata.environment;
      const environment = process.env.TEST_ENV ?? projectEnvironment;
      if (projectEnvironment !== undefined && typeof projectEnvironment !== "string") {
        throw new Error(
          `Project "${workerInfo.project.name}" has an invalid metadata.environment value.`,
        );
      }
      ConfigManager.initialize(environment);

      const propertyKey = workerInfo.project.metadata.propertyKey;
      if (typeof propertyKey !== "string") {
        throw new Error(
          `Project "${workerInfo.project.name}" does not define metadata.propertyKey.`,
        );
      }

      ConfigManager.useProperty(propertyKey);
      await use();
    },
    { scope: "worker", auto: true },
  ],

  dbConnection: [
    async ({ propertyContext }, use) => {
      await DatabaseUtils.connect();

      await use();

      await DatabaseUtils.disconnect();
    },
    { scope: "worker" },
  ],

  dbHelper: async ({ dbConnection }, use) => {
    await use(new SSODatabaseHelper());
  },

  reservationDbHelper: async ({ dbConnection }, use) => {
    await use(new ReservationDatabaseHelper());
  },

  setupDb: async ({ dbConnection }, use) => {
    const helper = new SetupDatabaseHelper();
    try {
      await use(helper);
    } finally {
      await helper.restoreTrackedState();
    }
  },

  posDb: async ({ dbConnection }, use) => {
    const helper = new POSDatabaseHelper();
    try {
      await use(helper);
    } finally {
      await helper.restoreTrackedState();
    }
  },

  setupPage: async ({ page }, use) => {
    await use(new SetupPage(page));
  },

  crmLeadDbHelper: async ({ dbConnection }, use) => {
    const helper = new CRMLeadDatabaseHelper();
    try {
      await use(helper);
    } finally {
      await helper.restoreTrackedState();
    }
  },

  crmCampaignDbHelper: async ({ dbConnection }, use) => {
    await use(new CRMCampaignDatabaseHelper());
  },

  crmEmailTemplateDbHelper: async ({ dbConnection }, use) => {
    await use(new CRMEmailTemplateDatabaseHelper());
  },

  crmCustomerDbHelper: async ({ dbConnection }, use) => {
    const helper = new CRMCustomerDatabaseHelper();
    try {
      await use(helper);
    } finally {
      await helper.restoreTrackedState();
    }
  },

  ssoLoginPage: async ({ page, dbHelper }, use) => {
    await use(new SSOLoginPage(page, dbHelper));
  },

  reservationApi: async ({ dbConnection }, use) => {
    await use(new ReservationApi());
  },

  reservationPage: async ({ page, reservationDbHelper, reservationApi }, use) => {
    await use(new ReservationPage(page, reservationDbHelper, reservationApi));
  },

  findReservationPage: async ({ page }, use) => {
    await use(new FindReservationPage(page));
  },

  layoutPage: async ({ page }, use) => {
    await use(new LayoutPage(page));
  },

  billingPage: async ({ page }, use) => {
    await use(new BillingPage(page));
  },

  onlineBookingPage: async ({ page }, use) => {
    await use(new OnlineBookingPage(page));
  },

  onlineBookingDb: async ({ dbConnection }, use) => {
    await use(new OnlineBookingDatabaseHelper());
  },

  otaDb: async ({ dbConnection }, use) => {
    const helper = new OTADatabaseHelper();
    try {
      await use(helper);
    } finally {
      await helper.restoreTrackedState();
    }
  },

  guestDb: [
    async ({ dbConnection }, use) => {
      await use(new GuestDatabaseHelper());
    },
    { scope: "worker" },
  ],

  guestHubPage: async ({ page }, use) => {
    await use(new GuestHubPage(page));
  },

  guestPage: async ({ page }, use) => {
    await use(new GuestPage(page));
  },

  crmLoginPage: async ({ page }, use) => {
    await use(new CRMLoginPage(page));
  },

  crmLeftMenuPage: async ({ page }, use) => {
    await use(new CRMLeftMenuPage(page));
  },

  leadPage: async ({ page }, use) => {
    await use(new LeadPage(page));
  },

  customerPage: async ({ page }, use) => {
    await use(new CustomerPage(page));
  },

  staffResponsePage: async ({ page }, use) => {
    await use(new StaffResponsePage(page));
  },

  responsePage: async ({ page }, use) => {
    await use(new ResponsePage(page));
  },

  quotationPage: async ({ page }, use) => {
    await use(new QuotationPage(page));
  },

  emailTemplatePage: async ({ page }, use) => {
    await use(new EmailTemplatePage(page));
  },

  campaignPage: async ({ page }, use) => {
    await use(new CampaignPage(page));
  },

  calendarPage: async ({ page }, use) => {
    await use(new CalendarPage(page));
  },

});

export { expect } from "@playwright/test";
