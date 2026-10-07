import { test } from "../../src/fixtures/sso.fixture";
import { SSOUsers } from "../../src/test-data/SSOUsers";
import { PosTerminalPage } from "../../src/pages/POS/PosTerminalPage";

test.describe.configure({ mode: "serial", timeout: 90_000 });

test.beforeEach(async ({ ssoLoginPage, setupDb }) => {
  await setupDb.ensureCashDrawerOpen();

  await ssoLoginPage.propertyLogin(
    SSOUsers.User.propertyShortName,
    SSOUsers.User.loginName,
    SSOUsers.User.password,
  );
});

test("Staff can create and cash-pay a Gift Shop POS order", async ({
  page,
}) => {
  const posTerminalPage = new PosTerminalPage(page);

  await posTerminalPage.clickPosMenu();
  await posTerminalPage.clickPosTerminalTab();
  await posTerminalPage.clickOutletContaining("Gift");
  await posTerminalPage.verifyOutletSelected("Gift");
  await posTerminalPage.clickFirstCatalogItem();
  await posTerminalPage.clickPay();
  const giftShopAmount = await posTerminalPage.getPaymentAmount();
  await posTerminalPage.selectCashPayment();
  await posTerminalPage.enterPaymentAmount(giftShopAmount);
  await posTerminalPage.clickAddPayment();
  await posTerminalPage.verifyReceiptPreviewDisplayed();
  await posTerminalPage.verifyAmountPaid(giftShopAmount);
  await posTerminalPage.clickCloseReceipt();
});

test("Staff can create and cash-pay a Restaurant POS order", async ({ page }) => {
  const posTerminalPage = new PosTerminalPage(page);

  await posTerminalPage.clickPosMenu();
  await posTerminalPage.clickPosTerminalTab();
  await posTerminalPage.clickOutletContaining("Restaurant");
  await posTerminalPage.verifyOutletSelected("Restaurant");
  await posTerminalPage.selectFirstRestaurantServiceValues();
  await posTerminalPage.clickFirstCatalogItem();
  await posTerminalPage.clickSendOrder();
  await posTerminalPage.clickSaleFinished();
  await posTerminalPage.clickPay();
  const restaurantAmount = await posTerminalPage.getPaymentAmount();
  await posTerminalPage.selectCashPayment();
  await posTerminalPage.enterPaymentAmount(restaurantAmount);
  await posTerminalPage.clickAddPayment();
  await posTerminalPage.verifyReceiptPreviewDisplayed();
  await posTerminalPage.verifyAmountPaid(restaurantAmount);
  await posTerminalPage.clickCloseReceipt();
});
