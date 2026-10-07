import { test } from "../../../src/fixtures/sso.fixture";
import { PosDashboardPage } from "../../../src/pages/POS/PosDashboardPage";
import { PosTerminalPage } from "../../../src/pages/POS/PosTerminalPage";
import { SSOUsers } from "../../../src/test-data/SSOUsers";

test.describe.configure({ mode: "serial", timeout: 90_000 });

test("Sales card loads and displays the configured currency format", async ({
  page,
  posDb,
  ssoLoginPage,
}) => {
  const { testCurrency } = await posDb.useDifferentCurrency();
  await ssoLoginPage.propertyLogin(
    SSOUsers.User.propertyShortName,
    SSOUsers.User.loginName,
    SSOUsers.User.password,
  );

  const posDashboardPage = new PosDashboardPage(page);
  const posTerminalPage = new PosTerminalPage(page);

  await posTerminalPage.clickPosMenu();
  await posDashboardPage.clickDashboardTab();
  await posDashboardPage.verifySalesCurrency(testCurrency);
});

test("Sales includes the Gift Shop item amount plus tax after cash payment", async ({
  page,
  setupDb,
  ssoLoginPage,
}) => {
  await setupDb.ensureCashDrawerOpen();
  await ssoLoginPage.propertyLogin(
    SSOUsers.User.propertyShortName,
    SSOUsers.User.loginName,
    SSOUsers.User.password,
  );

  const posDashboardPage = new PosDashboardPage(page);
  const posTerminalPage = new PosTerminalPage(page);

  await posTerminalPage.clickPosMenu();
  await posDashboardPage.clickDashboardTab();
  const salesBeforePayment = await posDashboardPage.getSalesAmount();

  await posTerminalPage.clickPosTerminalTab();
  await posTerminalPage.clickOutletContaining("Gift");
  await posTerminalPage.verifyOutletSelected("Gift");
  await posTerminalPage.clickFirstCatalogItem();
  await posTerminalPage.clickPay();
  const amountDue = await posTerminalPage.getPaymentAmount();
  await posTerminalPage.selectCashPayment();
  await posTerminalPage.enterPaymentAmount(amountDue);
  await posTerminalPage.clickAddPayment();
  await posTerminalPage.verifyReceiptPreviewDisplayed();
  await posTerminalPage.verifyAmountPaid(amountDue);
  await posTerminalPage.clickCloseReceipt();

  await posDashboardPage.clickDashboardTab();
  await posDashboardPage.verifySalesAmount(
    salesBeforePayment + Number(amountDue),
  );
});

test("Sales displays only the paid Gift Shop item amount when tax is zero", async ({
  page,
  setupDb,
  ssoLoginPage,
}) => {
  await setupDb.ensureCashDrawerOpen();
  await ssoLoginPage.propertyLogin(
    SSOUsers.User.propertyShortName,
    SSOUsers.User.loginName,
    SSOUsers.User.password,
  );

  const posDashboardPage = new PosDashboardPage(page);
  const posTerminalPage = new PosTerminalPage(page);

  await posTerminalPage.clickPosMenu();
  await posDashboardPage.clickDashboardTab();
  const salesBeforePayment = await posDashboardPage.getSalesAmount();

  await posTerminalPage.clickPosTerminalTab();
  await posTerminalPage.clickOutletContaining("Gift");
  await posTerminalPage.verifyOutletSelected("Gift");
  await posTerminalPage.clickCatalogItem("Pant No Tax");
  await posTerminalPage.clickPay();
  const itemAmount = await posTerminalPage.getPaymentAmount();
  await posTerminalPage.selectCashPayment();
  await posTerminalPage.enterPaymentAmount(itemAmount);
  await posTerminalPage.clickAddPayment();
  await posTerminalPage.verifyReceiptPreviewDisplayed();
  await posTerminalPage.verifyReceiptTax("0");
  await posTerminalPage.verifyAmountPaid(itemAmount);
  await posTerminalPage.clickCloseReceipt();

  await posDashboardPage.clickDashboardTab();
  await posDashboardPage.verifySalesAmount(
    salesBeforePayment + Number(itemAmount),
  );
});

test("Sales includes the combined total of multiple items in one paid Gift Shop order", async ({
  page,
  setupDb,
  ssoLoginPage,
}) => {
  await setupDb.ensureCashDrawerOpen();
  await ssoLoginPage.propertyLogin(
    SSOUsers.User.propertyShortName,
    SSOUsers.User.loginName,
    SSOUsers.User.password,
  );

  const posDashboardPage = new PosDashboardPage(page);
  const posTerminalPage = new PosTerminalPage(page);

  await posTerminalPage.clickPosMenu();
  await posDashboardPage.clickDashboardTab();
  const salesBeforePayment = await posDashboardPage.getSalesAmount();

  await posTerminalPage.clickPosTerminalTab();
  await posTerminalPage.clickOutletContaining("Gift");
  await posTerminalPage.verifyOutletSelected("Gift");
  await posTerminalPage.clickCatalogItem("L Shirt");
  await posTerminalPage.clickCatalogItem("Pant No Tax");
  await posTerminalPage.clickPay();
  const combinedOrderTotal = await posTerminalPage.getPaymentAmount();
  await posTerminalPage.selectCashPayment();
  await posTerminalPage.enterPaymentAmount(combinedOrderTotal);
  await posTerminalPage.clickAddPayment();
  await posTerminalPage.verifyReceiptPreviewDisplayed();
  await posTerminalPage.verifyReceiptContainsItems([
    "L Shirt",
    "Pant No Tax",
  ]);
  await posTerminalPage.verifyAmountPaid(combinedOrderTotal);
  await posTerminalPage.clickCloseReceipt();

  await posDashboardPage.clickDashboardTab();
  await posDashboardPage.verifySalesAmount(
    salesBeforePayment + Number(combinedOrderTotal),
  );
});
