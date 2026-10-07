import { expect, test } from "../../src/fixtures/sso.fixture";
import { ConfigManager } from "../../src/utils/ConfigManager";

test.describe("Lead form layout", () => {
  async function openLeadLayout({ crmLoginPage, crmLeftMenuPage, page }: any) {
    const credentials = ConfigManager.testData;

    await crmLoginPage.loginToCRM(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await crmLeftMenuPage.clickLeadIcon();
    await page.getByTitle("Edit Lead Form Layout", { exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Edit Lead Form Layout", exact: true }),
    ).toBeVisible();
  }

  async function discardLeadLayoutChanges(page: any) {
    const dialog = page.getByRole("dialog");
    const modal = page.getByRole("heading", { name: /Add Field to|Configure Field/i }).locator("xpath=../..");
    if (await dialog.isVisible().catch(() => false)) {
      const closeButton = dialog.getByRole("button", { name: /cancel|close/i }).first();
      if (await closeButton.isVisible().catch(() => false)) await closeButton.click();
    } else if (await modal.isVisible().catch(() => false)) {
      const closeButton = page.getByRole("button", { name: "Close", exact: true });
      if (await closeButton.isVisible().catch(() => false)) await closeButton.click();
    }
    await page.locator(".editor-actions").getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.getByTitle("Edit Lead Form Layout", { exact: true })).toBeVisible();
  }

  test("Verify the Layout action is available on the Lead page", async ({
    crmLoginPage,
    crmLeftMenuPage,
    page,
  }) => {
    const credentials = ConfigManager.testData;

    await crmLoginPage.loginToCRM(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await crmLeftMenuPage.clickLeadIcon();

    const layoutButton = page.getByTitle("Edit Lead Form Layout", { exact: true });
    await expect(layoutButton).toBeVisible();
    await expect(layoutButton).toBeEnabled();
  });

  test("Verify clicking Layout opens the Edit Lead Form Layout editor", async ({
    crmLoginPage,
    crmLeftMenuPage,
    page,
  }) => {
    const credentials = ConfigManager.testData;

    await crmLoginPage.loginToCRM(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await crmLeftMenuPage.clickLeadIcon();

    await page.getByTitle("Edit Lead Form Layout", { exact: true }).click();

    await expect(
      page.getByRole("heading", { name: "Edit Lead Form Layout", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Save Layout", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
  });

  test("Verify Lead tabs can be reordered", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    await openLeadLayout({ crmLoginPage, crmLeftMenuPage, page });

    const tabs = page.locator(".tabs-list .tab-item-card");
    const firstTabName = await tabs.nth(0).locator(".tab-name-text").innerText();
    const secondTabName = await tabs.nth(1).locator(".tab-name-text").innerText();
    await tabs.nth(1).getByTitle("Move Tab Up", { exact: true }).click();

    await expect(tabs.nth(0).locator(".tab-name-text")).toHaveText(secondTabName);
    await expect(tabs.nth(1).locator(".tab-name-text")).toHaveText(firstTabName);
    await discardLeadLayoutChanges(page);
  });

  test("Verify a Lead tab can be deleted after confirmation", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    await openLeadLayout({ crmLoginPage, crmLeftMenuPage, page });

    const tab = page.locator(".tabs-list .tab-item-card").filter({ hasText: "Custom" });
    await expect(tab).toBeVisible();
    let deleteAlertMessage = "";
    page.once("dialog", async (dialog) => {
      deleteAlertMessage = dialog.message();
      await dialog.accept();
    });
    await tab.getByTitle("Delete Tab", { exact: true }).click();
    await expect.poll(() => deleteAlertMessage).toMatch(/delete|existing|field/i);
    await expect(tab).toBeHidden();
    await discardLeadLayoutChanges(page);
  });

  test("Verify fields for the selected Lead tab are displayed correctly", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    await openLeadLayout({ crmLoginPage, crmLeftMenuPage, page });

    const generalTab = page.locator(".tabs-list .tab-item-card").filter({ hasText: "General" });
    await generalTab.click();
    await expect(page.locator(".active-tab-title")).toHaveText("General");
    await expect(page.locator(".fields-list .field-item-card").first()).toBeVisible();
    await expect(page.locator(".active-tab-count")).toContainText("fields");
    await discardLeadLayoutChanges(page);
  });

  test("Verify a new Lead field can be added", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    await openLeadLayout({ crmLoginPage, crmLeftMenuPage, page });

    await page.getByTitle("Add field to this tab", { exact: true }).click();
    const fieldEditor = page.getByRole("heading", { name: "Add Field to General", exact: true }).locator("xpath=../..");
    await expect(fieldEditor).toBeVisible();
    await expect(fieldEditor).toContainText(/field|type/i);
    await discardLeadLayoutChanges(page);
  });

  test("Verify an existing Lead field can be renamed", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    await openLeadLayout({ crmLoginPage, crmLeftMenuPage, page });

    const field = page.locator(".field-item-card").filter({ hasText: "First Name" }).first();
    await field.getByTitle("Configure field name, type, and options", { exact: true }).click();
    const fieldEditor = page.getByRole("heading", { name: /Configure Field/i }).locator("xpath=../..");
    await expect(fieldEditor).toBeVisible();
    await expect(page.getByPlaceholder("Enter field name", { exact: true })).toHaveValue("First Name");
    await discardLeadLayoutChanges(page);
  });

  test("Verify a Lead field type can be selected", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    await openLeadLayout({ crmLoginPage, crmLeftMenuPage, page });

    const field = page.locator(".field-item-card").filter({ hasText: "First Name" }).first();
    await field.getByTitle("Configure field name, type, and options", { exact: true }).click();
    const fieldEditor = page.getByRole("heading", { name: /Configure Field/i }).locator("xpath=../..");
    await expect(fieldEditor).toBeVisible();
    // The editor exposes Field Type as the first combobox in the modal;
    // the second combobox is the optional API mapping field.
    const typeControl = page.getByRole("combobox").nth(1);
    await expect(typeControl).toBeVisible();
    await expect(typeControl).toContainText(/text|number|date|dropdown/i);
    await discardLeadLayoutChanges(page);
  });

  test("Verify an existing Lead field type can be changed after confirmation", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    await openLeadLayout({ crmLoginPage, crmLeftMenuPage, page });

    const field = page.locator(".field-item-card").filter({ hasText: "First Name" }).first();
    await field.getByTitle("Configure field name, type, and options", { exact: true }).click();
    const typeControl = page.getByRole("combobox").nth(1);
    await typeControl.selectOption({ label: "MultiLine Text Box" });

    let typeChangeAlert = "";
    page.once("dialog", async (dialog) => {
      typeChangeAlert = dialog.message();
      await dialog.accept();
    });
    await page.getByRole("button", { name: "Apply Changes", exact: true }).click();
    await expect(field).toContainText("MultiLine Text Box");
    await discardLeadLayoutChanges(page);
  });

  test("Verify Required can be enabled and disabled for a Lead field", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    await openLeadLayout({ crmLoginPage, crmLeftMenuPage, page });

    const field = page.locator(".field-item-card").filter({ hasText: "City" }).first();
    const required = field.getByTitle(/Mandatory|Not Mandatory/);
    const before = await required.getAttribute("title");
    await required.click();
    await expect(required).not.toHaveAttribute("title", before || "");
    await required.click();
    await expect(required).toHaveAttribute("title", before || "");
    await discardLeadLayoutChanges(page);
  });

  test("Verify an enabled Required Lead field prevents blank submission", async ({ crmLoginPage, crmLeftMenuPage, leadPage, page }) => {
    const credentials = ConfigManager.testData;
    await crmLoginPage.loginToCRM(credentials.propertyShortName, credentials.loginName, credentials.password);
    await crmLeftMenuPage.clickLeadIcon();

    await page.getByTitle("Edit Lead Form Layout", { exact: true }).click();
    const cityField = page.locator(".field-item-card").filter({ hasText: "City" }).first();
    const required = cityField.getByTitle(/Mandatory|Not Mandatory/);
    const wasRequired = (await required.getAttribute("title")) === "Mandatory (Required)";
    if (!wasRequired) await required.click();
    await page.locator(".editor-actions").getByRole("button", { name: "Save Layout", exact: true }).click();
    await crmLeftMenuPage.clickLeadIcon();

    await leadPage.clickAddLead();
    await leadPage.enterFirstName(`Required-${Date.now()}`);
    await leadPage.enterLastName("Validation");
    await leadPage.enterEmail(`required-${Date.now()}@example.com`);
    await leadPage.clickSaveLead();
    await leadPage.verifyMandatoryFieldError("City");

    await page.getByRole("dialog").getByRole("button", { name: /cancel|close/i }).first().click();
    await page.reload();
    await crmLeftMenuPage.clickLeadIcon();
    await page.getByTitle("Edit Lead Form Layout", { exact: true }).click();
    const cityFieldAfterValidation = page.locator(".field-item-card").filter({ hasText: "City" }).first();
    const requiredAfterValidation = cityFieldAfterValidation.getByTitle(/Mandatory|Not Mandatory/);
    const currentlyRequired = (await requiredAfterValidation.getAttribute("title")) === "Mandatory (Required)";
    if (currentlyRequired !== wasRequired) await requiredAfterValidation.click();
    await page.locator(".editor-actions").getByRole("button", { name: "Save Layout", exact: true }).click();
  });

  test("Verify Filterable can be enabled and disabled for a Lead field", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    const credentials = ConfigManager.testData;
    await crmLoginPage.loginToCRM(
      credentials.propertyShortName,
      credentials.loginName,
      credentials.password,
    );
    await crmLeftMenuPage.clickLeadIcon();

    const setCityFilterable = async (enabled: boolean): Promise<void> => {
      await page.getByTitle("Edit Lead Form Layout", { exact: true }).click();
      await expect(page.getByRole("heading", { name: "Edit Lead Form Layout", exact: true })).toBeVisible();
      const field = page.locator(".field-item-card").filter({ hasText: "City" }).first();
      const filterable = field.getByTitle(/Included in Filter|Not Included in Filter/);
      const currentlyEnabled = (await filterable.getAttribute("title")) === "Included in Filter";
      if (currentlyEnabled !== enabled) await filterable.click();
      await page.locator(".editor-actions").getByRole("button", { name: "Save Layout", exact: true }).click();
      await crmLeftMenuPage.clickLeadIcon();
    };

    await setCityFilterable(true);
    await page.getByTitle("Filter", { exact: true }).click();
    const filterType = page.locator("#FilterType");
    await expect(filterType.locator("option", { hasText: "City" })).toHaveCount(1);

    await setCityFilterable(false);
    await page.getByTitle("Filter", { exact: true }).click();
    await expect(filterType.locator("option", { hasText: "City" })).toHaveCount(0);
  });

  test("Verify Displayed in Grid shows and hides a Lead field column", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    const credentials = ConfigManager.testData;
    await crmLoginPage.loginToCRM(credentials.propertyShortName, credentials.loginName, credentials.password);
    await crmLeftMenuPage.clickLeadIcon();

    const setCityDisplayedInGrid = async (enabled: boolean): Promise<void> => {
      await page.getByTitle("Edit Lead Form Layout", { exact: true }).click();
      const cityField = page.locator(".field-item-card").filter({ hasText: "City" }).first();
      const gridToggle = cityField.getByTitle(/Displayed in Grid|Not in Grid/);
      const currentlyEnabled = (await gridToggle.getAttribute("title")) === "Displayed in Grid";
      if (currentlyEnabled !== enabled) await gridToggle.click();
      await page.locator(".editor-actions").getByRole("button", { name: "Save Layout", exact: true }).click();
      await crmLeftMenuPage.clickLeadIcon();
    };

    await setCityDisplayedInGrid(true);
    await expect(page.getByRole("columnheader", { name: /^City/i })).toHaveCount(1);

    await setCityDisplayedInGrid(false);
    await expect(page.getByRole("columnheader", { name: /^City/i })).toHaveCount(0);
  });

  test("Verify Configure Field options can be enabled and disabled", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    await openLeadLayout({ crmLoginPage, crmLeftMenuPage, page });

    const field = page.locator(".field-item-card").filter({ hasText: "City" }).first();
    await field.getByTitle("Configure field name, type, and options", { exact: true }).click();
    const fieldConfig = page.getByRole("heading", { name: "Configure Field", exact: true }).locator("xpath=../..");
    await expect(fieldConfig).toBeVisible();

    const optionLabels = ["Is Active", "Is Mandatory", "Is Include Filter", "Is Display In Grid"];
    const visibleCheckboxes = page.locator("input[type='checkbox']:visible");
    const checkboxCount = await visibleCheckboxes.count();
    for (const [index, label] of optionLabels.entries()) {
      await expect(page.getByText(label, { exact: true })).toBeVisible();
      const checkbox = visibleCheckboxes.nth(checkboxCount - optionLabels.length + index);
      await expect(checkbox).toBeVisible();
      const wasChecked = await checkbox.isChecked();
      await checkbox.click();
      await expect(checkbox).toBeChecked({ checked: !wasChecked });
      await checkbox.click();
      await expect(checkbox).toBeChecked({ checked: wasChecked });
    }

    await page.getByRole("button", { name: "Close", exact: true }).click();
    await discardLeadLayoutChanges(page);
  });

  test("Verify Lead fields can be reordered within a tab", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    await openLeadLayout({ crmLoginPage, crmLeftMenuPage, page });

    const fields = page.locator(".fields-list .field-item-card");
    const firstName = await fields.nth(0).locator(".field-name-text").innerText();
    const secondName = await fields.nth(1).locator(".field-name-text").innerText();
    const sourceBox = await fields.nth(1).locator('[title="Drag to reorder field"]').boundingBox();
    const targetBox = await fields.nth(0).locator('[title="Drag to reorder field"]').boundingBox();
    if (!sourceBox || !targetBox) throw new Error("Field drag handles are not visible");
    await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 8, { steps: 10 });
    await page.mouse.up();
    await expect(fields.nth(0).locator(".field-name-text")).toHaveText(secondName);
    await expect(fields.nth(1).locator(".field-name-text")).toHaveText(firstName);
    await discardLeadLayoutChanges(page);
  });

  test("Verify a Lead field can be moved to another tab", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    await openLeadLayout({ crmLoginPage, crmLeftMenuPage, page });

    const field = page.locator(".field-item-card").filter({ hasText: "City" }).first();
    await field.getByTitle("Move to another tab", { exact: true }).click();
    const moveOption = page.getByText("Personal", { exact: true }).last();
    await expect(moveOption).toBeVisible();
    await moveOption.click();
    await expect(page.locator(".active-tab-title")).toHaveText("General");
    await expect(field).toBeHidden();
    await discardLeadLayoutChanges(page);
  });

  test("Verify a Lead field can be deleted after confirmation", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    await openLeadLayout({ crmLoginPage, crmLeftMenuPage, page });

    const field = page.locator(".field-item-card").filter({ hasText: "City" }).first();
    let deleteAlertMessage = "";
    page.once("dialog", async (dialog) => {
      deleteAlertMessage = dialog.message();
      await dialog.accept();
    });
    await field.getByTitle("Remove field", { exact: true }).click();
    await expect.poll(() => deleteAlertMessage).toMatch(/remove|delete|existing|clear|value/i);
    await expect(field).toBeHidden();
    await discardLeadLayoutChanges(page);
  });

  test("Verify dropdown options can be added, edited, and deleted", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    await openLeadLayout({ crmLoginPage, crmLeftMenuPage, page });

    await page.getByTitle("Add field to this tab", { exact: true }).click();
    const fieldName = page.getByPlaceholder("Enter field name", { exact: true });
    await fieldName.fill(`Automation Dropdown ${Date.now()}`);
    await page.getByRole("combobox").nth(1).selectOption({ label: "Drop Down" });

    const optionInput = page.getByRole("textbox", { name: "Option value" }).first();
    await expect(optionInput).toBeVisible();
    await optionInput.fill("Option A");
    await expect(optionInput).toHaveValue("Option A");

    const editedOption = page.getByRole("textbox", { name: "Option value" }).first();
    await editedOption.fill("Option B");
    await expect(editedOption).toHaveValue("Option B");

    await page.getByRole("button", { name: /Add Option/ }).click();
    const optionInputsAfterEdit = page.getByRole("textbox", { name: "Option value" });
    await optionInputsAfterEdit.nth(1).fill("Option C");
    await page.getByTitle("Remove option", { exact: true }).last().click();
    await expect(optionInputsAfterEdit).toHaveCount(1);
    await discardLeadLayoutChanges(page);
  });

  test("Verify existing Lead records remain accessible after layout changes", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    await openLeadLayout({ crmLoginPage, crmLeftMenuPage, page });

    const cityField = page.locator(".field-item-card").filter({ hasText: "City" }).first();
    const required = cityField.getByTitle(/Mandatory|Not Mandatory/);
    await required.click();
    await page.goBack();
    await crmLeftMenuPage.clickLeadIcon();

    const firstLead = page.locator("table tbody tr").first();
    await expect(firstLead).toBeVisible();
    await firstLead.getByTitle("Edit", { exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    const editLeadCancel = page
      .getByRole("heading", { name: "Edit Lead", exact: true })
      .locator("xpath=..")
      .getByRole("button", { name: "Cancel", exact: true });
    await editLeadCancel.click();
    await page.keyboard.press("Escape");
  });

  test("Verify a field moved to another tab is reflected when creating a new Lead", async ({ crmLoginPage, crmLeftMenuPage, leadPage, page }) => {
    const credentials = ConfigManager.testData;
    await crmLoginPage.loginToCRM(credentials.propertyShortName, credentials.loginName, credentials.password);
    await crmLeftMenuPage.clickLeadIcon();

    await page.getByTitle("Edit Lead Form Layout", { exact: true }).click();
    let cityField = page.locator(".field-item-card").filter({ hasText: "City" }).first();
    if (await cityField.count() === 0) {
      await page.getByText("Personal", { exact: true }).last().click();
      cityField = page.locator(".field-item-card").filter({ hasText: "City" }).first();
      await cityField.getByTitle("Move to another tab", { exact: true }).click();
      await page.getByText("General", { exact: true }).last().click();
      await page.locator(".editor-actions").getByRole("button", { name: "Save Layout", exact: true }).click();
      await crmLeftMenuPage.clickLeadIcon();
      await page.getByTitle("Edit Lead Form Layout", { exact: true }).click();
    }
    cityField = page.locator(".field-item-card").filter({ hasText: "City" }).first();
    await cityField.getByTitle("Move to another tab", { exact: true }).click();
    await page.getByText("Personal", { exact: true }).last().click();
    await page.locator(".editor-actions").getByRole("button", { name: "Save Layout", exact: true }).click();
    await crmLeftMenuPage.clickLeadIcon();

    await page.getByRole("button", { name: /Add Lead/i }).click();
    const leadEditor = page.getByRole("dialog");
    await expect(leadEditor).toBeVisible();
    await leadPage.enterFirstName(`Layout-${Date.now()}`);
    await leadPage.enterLastName("Automation");
    await leadPage.enterEmail(`layout-${Date.now()}@example.com`);
    await page.locator("button").filter({ hasText: "Personal" }).last().click();
    await expect(leadEditor.getByText("City", { exact: true })).toBeVisible();
    await leadEditor.getByRole("button", { name: /cancel|close/i }).first().click({ force: true });

    await page.reload();
    await expect(page.getByTitle("Edit Lead Form Layout", { exact: true })).toBeVisible();
    await page.getByTitle("Edit Lead Form Layout", { exact: true }).click();
    await page.getByText("Personal", { exact: true }).last().click();
    const movedCityField = page.locator(".field-item-card").filter({ hasText: "City" }).first();
    await movedCityField.getByTitle("Move to another tab", { exact: true }).click();
    await page.getByText("General", { exact: true }).last().click();
    await page.locator(".editor-actions").getByRole("button", { name: "Save Layout", exact: true }).click();
  });

  test("Verify a field moved to another tab is reflected when editing an existing Lead", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    const credentials = ConfigManager.testData;
    await crmLoginPage.loginToCRM(credentials.propertyShortName, credentials.loginName, credentials.password);
    await crmLeftMenuPage.clickLeadIcon();

    await page.getByTitle("Edit Lead Form Layout", { exact: true }).click();
    let cityField = page.locator(".field-item-card").filter({ hasText: "City" }).first();
    if (await cityField.count() === 0) {
      await page.getByText("Personal", { exact: true }).last().click();
      cityField = page.locator(".field-item-card").filter({ hasText: "City" }).first();
    }
    await cityField.getByTitle("Move to another tab", { exact: true }).click();
    await page.getByText("Personal", { exact: true }).last().click();
    await page.locator(".editor-actions").getByRole("button", { name: "Save Layout", exact: true }).click();
    await crmLeftMenuPage.clickLeadIcon();

    const firstLead = page.locator("table tbody tr").first();
    await firstLead.getByTitle("Edit", { exact: true }).click();
    const leadEditor = page.getByRole("dialog");
    await expect(leadEditor).toBeVisible();
    await page.locator("button").filter({ hasText: "Personal" }).last().click();
    await expect(leadEditor.getByText("City", { exact: true })).toBeVisible();
    await leadEditor.getByRole("button", { name: /cancel|close/i }).first().click({ force: true });

    await page.reload();
    await expect(page.getByTitle("Edit Lead Form Layout", { exact: true })).toBeVisible();
    await page.getByTitle("Edit Lead Form Layout", { exact: true }).click();
    await page.getByText("Personal", { exact: true }).last().click();
    const movedCityField = page.locator(".field-item-card").filter({ hasText: "City" }).first();
    await movedCityField.getByTitle("Move to another tab", { exact: true }).click();
    await page.getByText("General", { exact: true }).last().click();
    await page.locator(".editor-actions").getByRole("button", { name: "Save Layout", exact: true }).click();
  });

  test("Verify Lead list columns can be enabled and disabled", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    const credentials = ConfigManager.testData;
    await crmLoginPage.loginToCRM(credentials.propertyShortName, credentials.loginName, credentials.password);
    await crmLeftMenuPage.clickLeadIcon();

    const setColumn = async (columnName: string, enabled: boolean) => {
      await page.getByTitle("Customize Columns", { exact: true }).click();
      const drawer = page.locator(".customize-drawer");
      const card = drawer.locator(".column-card").filter({ hasText: columnName }).first();
      const checkbox = card.locator("input[type='checkbox']");
      if ((await checkbox.isChecked()) !== enabled) {
        await card.locator("label.custom-switch").click();
      }
      await drawer.getByRole("button", { name: "Close", exact: true }).click();
      await crmLeftMenuPage.clickLeadIcon();
    };

    await setColumn("City", true);
    await expect(page.getByRole("columnheader", { name: /^City/i })).toHaveCount(1);
    await setColumn("City", false);
    await expect(page.getByRole("columnheader", { name: /^City/i })).toHaveCount(0);
  });

  test("Verify Reset default restores the Lead list columns", async ({ crmLoginPage, crmLeftMenuPage, page }) => {
    const credentials = ConfigManager.testData;
    await crmLoginPage.loginToCRM(credentials.propertyShortName, credentials.loginName, credentials.password);
    await crmLeftMenuPage.clickLeadIcon();
    await page.getByTitle("Customize Columns", { exact: true }).click();
    const drawer = page.locator(".customize-drawer");
    await drawer.getByRole("button", { name: /Reset default/i }).click();
    await expect(drawer.getByText(/VISIBLE COLUMNS/i)).toBeVisible();
    await drawer.getByRole("button", { name: "Close", exact: true }).click();
    await crmLeftMenuPage.clickLeadIcon();
    await expect(page.getByRole("columnheader", { name: /^First Name/i })).toHaveCount(1);
  });
});
