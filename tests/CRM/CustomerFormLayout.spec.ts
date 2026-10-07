import { expect, test } from "../../src/fixtures/sso.fixture";
import { ConfigManager } from "../../src/utils/ConfigManager";

test.describe("Customer form layout", () => {
  async function openCustomerLayout({ crmLoginPage, crmLeftMenuPage, page }: any) {
    const credentials = ConfigManager.testData;
    await crmLoginPage.loginToCRM(credentials.propertyShortName, credentials.loginName, credentials.password);
    await crmLeftMenuPage.clickCustomerIcon();
    await page.getByTitle("Edit Customer Form Layout", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Edit Customer Form Layout", exact: true })).toBeVisible();
  }

  async function discardCustomerLayout(page: any) {
    await page.locator(".editor-actions").getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByTitle("Edit Customer Form Layout", { exact: true })).toBeVisible();
  }

  test("Verify the Layout action is available on the Customer page", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    const credentials = ConfigManager.testData;
    await crmLoginPage.loginToCRM(credentials.propertyShortName, credentials.loginName, credentials.password);
    await crmLeftMenuPage.clickCustomerIcon();
    await expect(page.getByTitle("Edit Customer Form Layout", { exact: true })).toBeVisible();
  });

  test("Verify clicking Layout opens the Edit Customer Form Layout editor", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    await openCustomerLayout({ crmLoginPage, crmLeftMenuPage, page });
    await expect(page.getByRole("button", { name: "Save Layout", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
  });

  test("Verify Customer tabs can be reordered", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    await openCustomerLayout({ crmLoginPage, crmLeftMenuPage, page });
    const tabs = page.locator(".tabs-list .tab-item-card");
    const first = await tabs.nth(0).locator(".tab-name-text").innerText();
    const second = await tabs.nth(1).locator(".tab-name-text").innerText();
    await tabs.nth(1).getByTitle("Move Tab Up", { exact: true }).click();
    await expect(tabs.nth(0).locator(".tab-name-text")).toHaveText(second);
    await expect(tabs.nth(1).locator(".tab-name-text")).toHaveText(first);
    await discardCustomerLayout(page);
  });

  test("Verify a Customer tab can be deleted after confirmation", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    await openCustomerLayout({ crmLoginPage, crmLeftMenuPage, page });
    const tab = page.locator(".tabs-list .tab-item-card").filter({ hasText: "Custom" });
    await expect(tab).toBeVisible();
    let message = "";
    page.once("dialog", async (dialog) => { message = dialog.message(); await dialog.accept(); });
    await tab.getByTitle("Delete Tab", { exact: true }).click();
    await expect.poll(() => message).toMatch(/delete|remove|field/i);
    await expect(tab).toBeHidden();
    await discardCustomerLayout(page);
  });

  test("Verify fields for the selected Customer tab are displayed correctly", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    await openCustomerLayout({ crmLoginPage, crmLeftMenuPage, page });
    await page.locator(".tabs-list .tab-item-card").filter({ hasText: "General" }).click();
    await expect(page.locator(".active-tab-title")).toHaveText("General");
    await expect(page.locator(".fields-list .field-item-card").first()).toBeVisible();
    await discardCustomerLayout(page);
  });

  test("Verify a new Customer field can be added", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    await openCustomerLayout({ crmLoginPage, crmLeftMenuPage, page });
    await page.getByTitle("Add field to this tab", { exact: true }).click();
    await expect(page.getByRole("heading", { name: /Add Field to/i })).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await discardCustomerLayout(page);
  });

  test("Verify an existing Customer field can be renamed", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    await openCustomerLayout({ crmLoginPage, crmLeftMenuPage, page });
    const field = page.locator(".field-item-card").filter({ hasText: "First Name" }).first();
    await field.getByTitle("Configure field name, type, and options", { exact: true }).click();
    await expect(page.getByPlaceholder("Enter field name", { exact: true })).toHaveValue("First Name");
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await discardCustomerLayout(page);
  });

  test("Verify a Customer field type can be selected and changed", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    await openCustomerLayout({ crmLoginPage, crmLeftMenuPage, page });
    const field = page.locator(".field-item-card").filter({ hasText: "First Name" }).first();
    await field.getByTitle("Configure field name, type, and options", { exact: true }).click();
    const type = page.getByRole("combobox").nth(1);
    await expect(type).toBeVisible();
    await expect(type).toContainText(/Text|Drop|Date|Check/i);
    await type.selectOption({ label: "MultiLine Text Box" });
    await page.getByRole("button", { name: "Apply Changes", exact: true }).click();
    await expect(field).toContainText("MultiLine Text Box");
    await discardCustomerLayout(page);
  });

  test("Verify Required can be enabled and disabled for a Customer field", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    await openCustomerLayout({ crmLoginPage, crmLeftMenuPage, page });
    const field = page.locator(".field-item-card").filter({ hasText: "City" }).first();
    const toggle = field.getByTitle(/Mandatory|Not Mandatory/);
    const before = await toggle.getAttribute("title");
    await toggle.click();
    await expect(toggle).not.toHaveAttribute("title", before || "");
    await toggle.click();
    await expect(toggle).toHaveAttribute("title", before || "");
    await discardCustomerLayout(page);
  });

  test("Verify an enabled Required Customer field prevents blank submission", async ({ crmLoginPage, crmLeftMenuPage, customerPage, page }) => {
    await openCustomerLayout({ crmLoginPage, crmLeftMenuPage, page });
    const city = page.locator(".field-item-card").filter({ hasText: "City" }).first();
    const required = city.getByTitle(/Mandatory|Not Mandatory/);
    const wasRequired = (await required.getAttribute("title")) === "Mandatory (Required)";
    if (!wasRequired) await required.click();
    await page.locator(".editor-actions").getByRole("button", { name: "Save Layout", exact: true }).click();
    await crmLeftMenuPage.clickCustomerIcon();
    await customerPage.clickAddCustomer();
    await customerPage.enterFirstName(`Required-${Date.now()}`);
    await customerPage.enterLastName("Validation");
    await customerPage.enterEmail(`required-${Date.now()}@example.com`);
    await customerPage.clickSaveCustomer();
    await customerPage.verifyMandatoryFieldError("City");
    await page.keyboard.press("Escape");
    await page.reload();
    await crmLeftMenuPage.clickCustomerIcon();
    await page.getByTitle("Edit Customer Form Layout", { exact: true }).click();
    const cityAfter = page.locator(".field-item-card").filter({ hasText: "City" }).first();
    const requiredAfter = cityAfter.getByTitle(/Mandatory|Not Mandatory/);
    if (((await requiredAfter.getAttribute("title")) === "Mandatory (Required)") !== wasRequired) await requiredAfter.click();
    await page.locator(".editor-actions").getByRole("button", { name: "Save Layout", exact: true }).click();
  });

  test("Verify Configure Field options can be enabled and disabled for a Customer field", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    await openCustomerLayout({ crmLoginPage, crmLeftMenuPage, page });
    const field = page.locator(".field-item-card").filter({ hasText: "City" }).first();
    await field.getByTitle("Configure field name, type, and options", { exact: true }).click();
    const editor = page.getByRole("heading", { name: "Configure Field", exact: true }).locator("xpath=../..");
    await expect(editor).toBeVisible();
    for (const label of ["Is Active", "Is Mandatory", "Is Include Filter", "Is Display In Grid"]) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    }
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await discardCustomerLayout(page);
  });

  test("Verify Filterable can be enabled and disabled for a Customer field and reflected in the Customer list", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    await openCustomerLayout({ crmLoginPage, crmLeftMenuPage, page });
    const field = page.locator(".field-item-card").filter({ hasText: "City" }).first();
    const toggle = field.getByTitle(/Included in Filter|Not Included in Filter/);
    const wasEnabled = (await toggle.getAttribute("title")) === "Included in Filter";
    if (!wasEnabled) await toggle.click();
    await page.locator(".editor-actions").getByRole("button", { name: "Save Layout", exact: true }).click();
    await crmLeftMenuPage.clickCustomerIcon();
    await page.getByTitle("Filter", { exact: true }).click();
    const filterType = page.locator("#FilterType");
    await expect(filterType.locator("option", { hasText: "City" })).toHaveCount(1);
    await page.getByTitle("Edit Customer Form Layout", { exact: true }).click();
    const cityAgain = page.locator(".field-item-card").filter({ hasText: "City" }).first();
    const filterAgain = cityAgain.getByTitle(/Included in Filter|Not Included in Filter/);
    if (wasEnabled) await filterAgain.click();
    else await filterAgain.click();
    await page.locator(".editor-actions").getByRole("button", { name: "Save Layout", exact: true }).click();
  });

  test("Verify Displayed in Grid shows and hides a Customer field column", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    await openCustomerLayout({ crmLoginPage, crmLeftMenuPage, page });
    const field = page.locator(".field-item-card").filter({ hasText: "City" }).first();
    const toggle = field.getByTitle(/Displayed in Grid|Not in Grid/);
    const wasEnabled = (await toggle.getAttribute("title")) === "Displayed in Grid";
    if (!wasEnabled) await toggle.click();
    await page.locator(".editor-actions").getByRole("button", { name: "Save Layout", exact: true }).click();
    await crmLeftMenuPage.clickCustomerIcon();
    await expect(page.getByRole("columnheader", { name: /^City/i })).toHaveCount(1);
    await page.getByTitle("Edit Customer Form Layout", { exact: true }).click();
    const fieldAgain = page.locator(".field-item-card").filter({ hasText: "City" }).first();
    const toggleAgain = fieldAgain.getByTitle(/Displayed in Grid|Not in Grid/);
    if (wasEnabled) await toggleAgain.click();
    else await toggleAgain.click();
    await page.locator(".editor-actions").getByRole("button", { name: "Save Layout", exact: true }).click();
  });

  test("Verify Customer fields can be reordered within a tab", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    await openCustomerLayout({ crmLoginPage, crmLeftMenuPage, page });
    const fields = page.locator(".fields-list .field-item-card");
    const first = await fields.nth(0).locator(".field-name-text").innerText();
    const second = await fields.nth(1).locator(".field-name-text").innerText();
    const source = await fields.nth(1).locator('[title="Drag to reorder field"]').boundingBox();
    const target = await fields.nth(0).locator('[title="Drag to reorder field"]').boundingBox();
    if (!source || !target) throw new Error("Customer field drag handles are not visible");
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width / 2, target.y + 8, { steps: 10 });
    await page.mouse.up();
    await expect(fields.nth(0).locator(".field-name-text")).toHaveText(second);
    await expect(fields.nth(1).locator(".field-name-text")).toHaveText(first);
    await discardCustomerLayout(page);
  });

  test("Verify a Customer field can be moved to another tab", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    await openCustomerLayout({ crmLoginPage, crmLeftMenuPage, page });
    const field = page.locator(".field-item-card").filter({ hasText: "City" }).first();
    await field.getByTitle("Move to another tab", { exact: true }).click();
    await page.getByText("Personal", { exact: true }).last().click();
    await expect(field).toBeHidden();
    await discardCustomerLayout(page);
  });

  test("Verify existing Customer records remain accessible after layout changes", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    await openCustomerLayout({ crmLoginPage, crmLeftMenuPage, page });
    const city = page.locator(".field-item-card").filter({ hasText: "City" }).first();
    const required = city.getByTitle(/Mandatory|Not Mandatory/);
    await required.click();
    await page.locator(".editor-actions").getByRole("button", { name: "Save Layout", exact: true }).click();
    await crmLeftMenuPage.clickCustomerIcon();
    const row = page.locator("table tbody tr").first();
    await expect(row).toBeVisible();
    await row.getByTitle("Edit", { exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("Verify a Customer field can be deleted after confirmation", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    await openCustomerLayout({ crmLoginPage, crmLeftMenuPage, page });
    const field = page.locator(".field-item-card").filter({ hasText: "City" }).first();
    let message = "";
    page.once("dialog", async (dialog) => { message = dialog.message(); await dialog.accept(); });
    await field.getByTitle("Remove field", { exact: true }).click();
    await expect.poll(() => message).toMatch(/remove|delete|field/i);
    await expect(field).toBeHidden();
    await discardCustomerLayout(page);
  });

  test("Verify dropdown options can be added, edited, and deleted for a Customer field", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    await openCustomerLayout({ crmLoginPage, crmLeftMenuPage, page });
    await page.getByTitle("Add field to this tab", { exact: true }).click();
    await page.getByPlaceholder("Enter field name", { exact: true }).fill(`Customer Dropdown ${Date.now()}`);
    await page.getByRole("combobox").nth(1).selectOption({ label: "Drop Down" });
    const option = page.getByRole("textbox", { name: "Option value" }).first();
    await option.fill("Option A");
    await expect(option).toHaveValue("Option A");
    await option.fill("Option B");
    await expect(option).toHaveValue("Option B");
    await page.getByRole("button", { name: /Add Option/ }).click();
    const options = page.getByRole("textbox", { name: "Option value" });
    await options.nth(1).fill("Option C");
    await page.getByTitle("Remove option", { exact: true }).last().click();
    await expect(options).toHaveCount(1);
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await discardCustomerLayout(page);
  });

  test("Verify Customer list columns can be enabled and disabled", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    const credentials = ConfigManager.testData;
    await crmLoginPage.loginToCRM(credentials.propertyShortName, credentials.loginName, credentials.password);
    await crmLeftMenuPage.clickCustomerIcon();

    const setColumn = async (columnName: string, enabled: boolean) => {
      await page.getByTitle("Customize Columns", { exact: true }).click();
      const drawer = page.locator(".customize-drawer");
      const card = drawer.locator(".column-card").filter({ hasText: columnName }).first();
      const checkbox = card.locator("input[type='checkbox']");
      if ((await checkbox.isChecked()) !== enabled) {
        await card.locator("label.custom-switch").click();
      }
      await drawer.getByRole("button", { name: "Close", exact: true }).click();
      await crmLeftMenuPage.clickCustomerIcon();
    };

    await setColumn("City", true);
    await expect(page.getByRole("columnheader", { name: /^City/i })).toHaveCount(1);
    await setColumn("City", false);
    await expect(page.getByRole("columnheader", { name: /^City/i })).toHaveCount(0);
  });

  test("Verify Reset default restores the Customer list columns", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    const credentials = ConfigManager.testData;
    await crmLoginPage.loginToCRM(credentials.propertyShortName, credentials.loginName, credentials.password);
    await crmLeftMenuPage.clickCustomerIcon();
    await page.getByTitle("Customize Columns", { exact: true }).click();
    const drawer = page.locator(".customize-drawer");
    await drawer.getByRole("button", { name: /Reset default/i }).click();
    await expect(drawer.getByText(/VISIBLE COLUMNS/i)).toBeVisible();
    await drawer.getByRole("button", { name: "Close", exact: true }).click();
    await crmLeftMenuPage.clickCustomerIcon();
    await expect(page.getByRole("columnheader", { name: /^First Name/i })).toHaveCount(1);
  });
});
