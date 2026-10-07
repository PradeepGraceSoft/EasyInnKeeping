import { expect, test } from "../../../src/fixtures/sso.fixture";
import { AlertMessages } from "../../../src/constants/AlertMessages";
import { ConstNames } from "../../../src/constants/ConstNames";
import { SSOUsers } from "../../../src/test-data/SSOUsers";

type DesktopNotification = {
  body: string;
  title: string;
};

const PUSH_NOTIFICATION_URL =
  "https://gracebeta.com/PMSUI-test1/mig/webapi/api/PushNotification/SendMultiUserNotification";

test.describe("Push notifications", () => {
  test("receives a payment-processing push notification when enabled", async ({
    context,
    page,
    setupDb,
    ssoLoginPage,
    findReservationPage,
    reservationPage,
    billingPage,
  }) => {
    const user = SSOUsers.User;
    await context.grantPermissions(["notifications"]);
    await observeDesktopNotifications(page);
    await setupDb.enablePushAndPaymentNotifications(user.loginName);
    await setupDb.setPGAuthorizeNet();

    await ssoLoginPage.propertyLogin(
      user.propertyShortName,
      user.loginName,
      user.password,
    );
    await expect
      .poll(() => page.evaluate(() => Notification.permission), {
        message: "Desktop notifications should be enabled in the browser.",
        timeout: 15000,
      })
      .toBe("granted");

    await findReservationPage.addNewReservation();
    await reservationPage.selectRoomType(ConstNames.ROOMTYPE_NAME_REGULAR_ROOM);
    await reservationPage.selectFirstRoomFromDropdown();
    await reservationPage.enterGuestInfo();
    const visaPaymentAccountCode =
      await setupDb.requireInventoryItemAccountCode(
        ConstNames.INVENTORY_PAYMENT_VISA_PAYMENT,
      );
    await reservationPage.enterPaymentMethod(visaPaymentAccountCode);
    await billingPage.enterBillingCCDetails();
    await reservationPage.clickSaveButton();
    await reservationPage.verifyAlertMessage(
      AlertMessages.RESERVATION_SAVED_SUCCESS,
    );

    await billingPage.clickBillingTab();
    await billingPage.enterPaymentAmountTextBox("50.00");
    await billingPage.clickProcessButton();
    await reservationPage.verifyAlertMessage(
      AlertMessages.RESERVATION_PAYMENT_PROCESS_SUCCESS,
    );
    const pushNotificationResponse = await page.request.get(
      PUSH_NOTIFICATION_URL,
    );
    expect(
      pushNotificationResponse.ok(),
      "The push-notification endpoint should accept the payment notification request.",
    ).toBeTruthy();

    await expect
      .poll(async () => {
        const notifications = await getDesktopNotifications(page);
        return notifications.some(({ title, body }) =>
          /payment received/i.test(`${title} ${body}`),
        );
      }, {
        message:
          "A successful payment should display a Payment Received desktop notification.",
        timeout: 30000,
      })
      .toBe(true);

    await reservationPage.deleteCurrentReservation();
  });
});

async function observeDesktopNotifications(
  page: import("@playwright/test").Page,
): Promise<void> {
  await page.addInitScript(() => {
    const observedNotifications: DesktopNotification[] = [];
    const NativeNotification = window.Notification;

    Object.defineProperty(window, "__desktopNotifications", {
      configurable: true,
      value: observedNotifications,
      writable: false,
    });

    if (!NativeNotification) return;

    class ObservedNotification extends NativeNotification {
      constructor(title: string, options?: NotificationOptions) {
        observedNotifications.push({ body: options?.body ?? "", title });
        super(title, options);
      }
    }

    Object.defineProperty(window, "Notification", {
      configurable: true,
      value: ObservedNotification,
    });
  });
}

async function getDesktopNotifications(
  page: import("@playwright/test").Page,
): Promise<DesktopNotification[]> {
  return page.evaluate(() => {
    return (window as Window & {
      __desktopNotifications?: DesktopNotification[];
    }).__desktopNotifications ?? [];
  });
}
