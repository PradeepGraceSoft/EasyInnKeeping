import { Locator, Page, expect } from "@playwright/test";
import { BasePage } from "../../utils/BasePage";
import { ConfigManager } from "../../utils/ConfigManager";
import { AlertMessages } from "../../constants/AlertMessages";

export type CampaignAudience = "Lead" | "Customer" | "Reservation";
export type CampaignDeliveryStatus = {
  totalSent: number;
  pending: number;
  delivered: number;
  failed: number;
  opened: number;
};
export type CampaignOperator =
  | "Equals"
  | "Not Equals"
  | "Contains"
  | "Starts With"
  | "Ends With"
  | "Greater Than"
  | "Less Than"
  | "Greater Than Or Equal"
  | "Less Than Or Equal";

export const CAMPAIGN_OPERATORS: readonly CampaignOperator[] = [
  "Equals",
  "Not Equals",
  "Contains",
  "Starts With",
  "Ends With",
  "Greater Than",
  "Less Than",
  "Greater Than Or Equal",
  "Less Than Or Equal",
];

export class CampaignPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ***************** Page Elements *********************************

  private readonly campaignsTab: Locator = this.page
    .getByRole("button", {
      name: /campaigns/i,
    })
    .or(this.page.getByRole("link", { name: /campaigns/i }));
  private readonly addCampaignButton: Locator = this.page.getByText(
    "+ Add Campaign",
    {
      exact: true,
    },
  );
  private readonly campaignPanel: Locator = this.page
    .locator("#addCampaignOffcanvas")
    .first();
  private readonly fieldName: Locator =
    this.getSelectByLabel(/^Field Name\s*\*?$/i);
  private readonly operator: Locator =
    this.getSelectByLabel(/^Operator\s*\*?$/i);
  private readonly filterValue: Locator =
    this.getInputByLabel(/^Value\s*\*?$/i);
  private readonly getEmailCountButton: Locator = this.campaignPanel.getByRole(
    "button",
    {
      name: /get email count/i,
    },
  );
  private readonly addConditionButton: Locator = this.campaignPanel.getByRole(
    "button",
    {
      name: /add condition/i,
    },
  );
  private readonly conditionRows: Locator =
    this.campaignPanel.locator(".criteria-row");
  private readonly campaignName: Locator = this.getInputByLabel(
    /^Campaign Name\s*\*?$/i,
  );
  private readonly template: Locator =
    this.getSelectByLabel(/^Select Template$/i);
  private readonly subject: Locator = this.getInputByLabel(/^Subject\s*\*?$/i);
  private readonly createCampaignButton: Locator = this.campaignPanel.getByRole(
    "button",
    {
      name: /create campaign/i,
    },
  );
  private readonly recipientRequiredAlert: Locator = this.page.getByText(
    AlertMessages.CAMPAIGN_NO_EMAIL_FOR_FILTER,
    { exact: true },
  );
  private readonly closeCampaignButton: Locator = this.campaignPanel
    .getByRole("button", {
      name: /close|cancel/i,
    })
    .or(this.campaignPanel.locator("button.btn-close"));
  private readonly campaignStatusTable: Locator = this.page
    .getByRole("table")
    .filter({
      has: this.page.getByRole("columnheader", { name: /^Total Sent/ }),
    });

  // ***************** Navigation *************************************

  async clickCampaigns(): Promise<void> {
    await this.waitForLoadingOverlay();
    await this.campaignsTab.first().click();
    await expect(this.addCampaignButton).toBeVisible();
  }

  async reloadCampaignList(): Promise<void> {
    await this.page.reload();
    await expect(this.campaignsTab.first()).toBeVisible();
    await this.campaignsTab.first().click();
    await expect(this.campaignStatusTable).toBeVisible();
  }

  async clickAddCampaign(): Promise<void> {
    await this.waitForLoadingOverlay();
    await this.addCampaignButton.click();
    await expect(this.campaignPanel).toBeVisible();
  }

  async getCampaignDeliveryStatus(
    campaignName: string,
  ): Promise<CampaignDeliveryStatus | null> {
    const campaignRow = this.campaignStatusTable
      .getByRole("row")
      .filter({
        has: this.page.getByRole("cell", { name: campaignName, exact: true }),
      })
      .first();
    if (await campaignRow.count() === 0) return null;

    const headers = (await this.campaignStatusTable
      .getByRole("columnheader")
      .allTextContents()).map((header) => header.trim());
    const values = (await campaignRow.getByRole("cell").allTextContents())
      .map((value) => value.trim());

    return {
      totalSent: this.getCampaignStatusCount(headers, values, "Total Sent"),
      pending: this.getCampaignStatusCount(headers, values, "Pending"),
      delivered: this.getCampaignStatusCount(headers, values, "Delivered"),
      failed: this.getCampaignStatusCount(headers, values, "Failed"),
      opened: this.getCampaignStatusCount(headers, values, "Opened"),
    };
  }

  async verifyCampaignDeliveryStatus(
    campaignName: string,
    expected: Partial<CampaignDeliveryStatus>,
  ): Promise<void> {
    await expect.poll(
      () => this.getCampaignDeliveryStatus(campaignName),
      {
        message: `Campaign status should match for "${campaignName}"`,
        timeout: 30_000,
      },
    ).toMatchObject(expected);
  }

  async clickCloseCampaign(): Promise<void> {
    await this.closeCampaignButton.first().click();
    await expect(this.campaignPanel).toBeHidden();
  }

  // ***************** Audience Filter Actions ************************

  async selectAudience(audience: CampaignAudience): Promise<void> {
    const audienceLabel = this.campaignPanel
      .locator("label")
      .filter({ hasText: audience })
      .first();
    const selectedAudience = this.campaignPanel
      .locator("input[type=radio]:checked")
      .first();
    const selectedAudienceId = await selectedAudience.getAttribute("id");

    if (!selectedAudienceId?.toLowerCase().includes(audience.toLowerCase())) {
      await audienceLabel.click();
      await expect(selectedAudience).toHaveAttribute(
        "id",
        new RegExp(`sourceType${audience}`, "i"),
      );
    }

    await expect
      .poll(() => this.getFieldNameOptions(), {
        message: `${audience} campaign fields should finish loading`,
      })
      .not.toEqual([]);
  }

  async selectFirstFieldName(): Promise<string> {
    const options = await this.fieldName
      .locator("option")
      .evaluateAll((items) =>
        items
          .map((item) => ({
            label: (item.textContent ?? "").trim(),
            disabled: (item as HTMLOptionElement).disabled,
          }))
          .filter((item) => item.label && !item.disabled),
      );
    if (options.length === 0)
      throw new Error("No audience Field Name is available");
    await this.fieldName.selectOption({ label: options[0].label });
    return options[0].label;
  }

  async selectFieldName(fieldName: string): Promise<void> {
    await this.fieldName.selectOption({ label: fieldName });
  }

  async clickAddCondition(): Promise<void> {
    const conditionCount = await this.conditionRows.count();
    await this.addConditionButton.click();
    await expect(this.conditionRows).toHaveCount(conditionCount + 1);
  }

  async clickDeleteCondition(conditionIndex: number): Promise<void> {
    const conditionCount = await this.conditionRows.count();
    if (conditionIndex <= 0 || conditionIndex >= conditionCount) {
      throw new Error(`Condition ${conditionIndex + 1} cannot be deleted`);
    }
    await this.conditionRows
      .nth(conditionIndex)
      .getByRole("button")
      .last()
      .click();
    await expect(this.conditionRows).toHaveCount(conditionCount - 1);
  }

  async selectConditionFieldName(
    conditionIndex: number,
    fieldName: string,
  ): Promise<void> {
    await this.getConditionSelect(
      conditionIndex,
      /^Field Name\s*\*?$/i,
    ).selectOption({ label: fieldName });
  }

  async selectOperator(operator: CampaignOperator): Promise<void> {
    await this.operator.selectOption({ label: operator });
  }

  async selectConditionOperator(
    conditionIndex: number,
    operator: CampaignOperator,
  ): Promise<void> {
    await this.getConditionSelect(
      conditionIndex,
      /^Operator\s*\*?$/i,
    ).selectOption({ label: operator });
  }

  async selectConditionJoin(
    conditionIndex: number,
    condition: "AND" | "OR",
  ): Promise<void> {
    await this.conditionRows
      .nth(conditionIndex)
      .locator('select[formcontrolname="condition"]')
      .selectOption({ label: condition });
  }

  async enterFilterValue(value: string): Promise<void> {
    await this.filterValue.fill(value);
  }

  async enterConditionFilterValue(
    conditionIndex: number,
    value: string,
  ): Promise<void> {
    await this.getConditionInput(conditionIndex, /^Value\s*\*?$/i).fill(value);
  }

  async clickGetEmailCount(): Promise<void> {
    await this.waitForLoadingOverlay();
    await expect(
      this.getEmailCountButton,
      "Get Email Count should be enabled after all audience criteria are complete",
    ).toBeEnabled();
    await this.getEmailCountButton.click();
  }

  async getEmailCount(): Promise<number> {
    const response = this.page.waitForResponse(
      (candidate) =>
        candidate.request().method() === "POST" &&
        candidate.url().includes("/api/Email/ReadCampaignMailList"),
    );
    await this.clickGetEmailCount();
    await response;
    const count = this.campaignPanel.locator(".audience-count");
    await expect(count).toBeVisible();
    const text = (await count.innerText()).trim();
    const match = text.match(/(\d+)/);
    if (!match)
      throw new Error(`Could not parse recipient count from "${text}"`);
    return Number(match[1]);
  }

  async verifyAudienceSelected(audience: CampaignAudience): Promise<void> {
    await expect(
      this.campaignPanel.locator("input[type=radio]:checked").first(),
    ).toHaveAttribute("id", new RegExp(`sourceType${audience}`));
  }

  async verifyFieldNameSelected(fieldName: string): Promise<void> {
    await expect(this.fieldName).toHaveValue(/.+/);
    await expect(this.fieldName.locator("option:checked")).toHaveText(
      fieldName,
    );
  }

  async getFieldNameOptions(): Promise<string[]> {
    const options = await this.fieldName
      .locator("option")
      .evaluateAll((items) =>
        items
          .map((item) => (item.textContent ?? "").trim())
          .filter((label) => label && label !== "Select Field"),
      );
    return options;
  }

  async verifyFieldNameOptions(expected: ReadonlyArray<string>): Promise<void> {
    const actual = await this.getFieldNameOptions();
    for (const label of expected) {
      expect(actual, `Field Name should contain "${label}"`).toContain(label);
    }
    expect(
      actual.length,
      `Field Name option count should be at least ${expected.length}`,
    ).toBeGreaterThanOrEqual(expected.length);
  }

  async verifyTemplateNamesPresent(
    expectedNames: ReadonlyArray<string>,
  ): Promise<void> {
    const templateNames = expectedNames.map((name) => name.trim()).filter(Boolean);

    await expect(this.template).toBeVisible();
    await expect
      .poll(
        async () => {
          const dropdownNames = await this.template
            .locator("option")
            .evaluateAll((items) =>
              items
                .map((item) => (item.textContent ?? "").trim())
                .filter((name) => name && name !== "-No Template-"),
            );
          return templateNames.filter((name) => !dropdownNames.includes(name));
        },
        {
          message:
            "Select Template should contain every database template for the selected audience",
          timeout: 15_000,
        },
      )
      .toEqual([]);
  }

  async verifySupportedOperators(): Promise<void> {
    const labels = (await this.operator.locator("option").allTextContents())
      .map((label) => label.trim())
      .filter(Boolean);
    for (const operator of CAMPAIGN_OPERATORS) {
      expect(labels).toContain(operator);
    }
  }

  async verifyAudienceFilterApplied(
    operator: CampaignOperator,
    value: string,
  ): Promise<void> {
    await expect(this.operator.locator("option:checked")).toHaveText(operator);
    await expect(this.filterValue).toHaveValue(value);
    await expect(this.getEmailCountButton).toBeEnabled();
  }

  async addParagraphToEmailBody(): Promise<void> {
    const editor = this.campaignPanel.locator("iframe").contentFrame();
    const paragraphTool = editor.getByRole("button", {
      name: "Paragraph",
      exact: true,
    });
    const emptyCanvas = editor.getByText(
      "No content here. Drag content from right.",
      { exact: true },
    );
    const paragraph = editor.getByText(
      /This is a new Paragraph block\. Change the text\./,
    );

    await expect(paragraphTool).toBeVisible({ timeout: 15_000 });
    for (let attempt = 0; attempt < 3 && !(await paragraph.isVisible()); attempt++) {
      await paragraphTool.dragTo(emptyCanvas, { force: true });
    }
    await expect(paragraph).toBeVisible({ timeout: 10_000 });
    await paragraph.dblclick({ force: true });
  }

  async clickEmailBodyMergeTags(): Promise<void> {
    const editor = this.campaignPanel.locator("iframe").contentFrame();
    const mergeTags = editor
      .getByTestId("hotkeys")
      .getByRole("button", { name: "Merge Tags", exact: true });
    if (!(await mergeTags.isVisible({ timeout: 45_000 }))) {
      throw new Error(
        'The email editor did not finish loading the "Merge Tags" menu item within 45 seconds.',
      );
    }
    await mergeTags.click();
  }

  async verifyEmailBodyMergeTags(audience: CampaignAudience): Promise<void> {
    const expectedPrefix = `${audience} -`;
    const allowedPrefixes = ["Company -", expectedPrefix];
    const mergeTags = this.page
      .getByRole("dialog", { name: "Merge Tags", exact: true })
      .getByRole("group", { name: "Available merge tags", exact: true })
      .getByRole("button");

    if (!(await mergeTags.first().isVisible({ timeout: 45_000 }))) {
      throw new Error(
        'The email editor did not display the available "Merge Tags" list within 45 seconds.',
      );
    }

    const visibleMergeTags = (await mergeTags.allTextContents())
      .map((tag) => tag.trim())
      .filter((tag) => tag.includes(" - "));
    const unexpectedTags = visibleMergeTags.filter(
      (tag) => !allowedPrefixes.some((prefix) => tag.startsWith(prefix)),
    );

    expect(
      visibleMergeTags.some((tag) => tag.startsWith("Company -")),
      "Company merge tags should be available for every audience",
    ).toBeTruthy();
    expect(
      visibleMergeTags.some((tag) => tag.startsWith(expectedPrefix)),
      `${audience} merge tags should be available for the ${audience} audience`,
    ).toBeTruthy();
    expect(
      unexpectedTags,
      `Only Company and ${audience} merge tags should be available`,
    ).toEqual([]);
  }

  // ***************** Campaign Actions *******************************

  async enterCampaignName(value: string): Promise<void> {
    await this.campaignName.fill(value);
  }

  async selectFirstAvailableTemplate(): Promise<string> {
    const options = this.template.locator("option");
    await expect(
      options.nth(1),
      "A saved Email Template is required",
    ).toBeAttached();
    const labels = (await options.allTextContents()).map((label) =>
      label.trim(),
    );
    const builtInIndex = labels.findIndex(
      (label) => label === "Festival Package Template",
    );
    const selectedIndex = builtInIndex > 0 ? builtInIndex : 1;
    const templateName = labels[selectedIndex];
    await this.template.selectOption({ index: selectedIndex });
    await expect(this.template.locator("option:checked")).toHaveText(
      templateName,
    );
    const editor = this.campaignPanel.locator("iframe").contentFrame();
    await expect(
      editor.getByRole("button", { name: "Paragraph", exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      editor.getByText("No content here. Drag content from right.", {
        exact: true,
      }),
    ).toBeHidden({ timeout: 15000 });
    await this.subject.click();
    await expect(this.subject).toBeFocused();
    return templateName;
  }

  async selectTemplate(templateName: string): Promise<void> {
    await expect(
      this.template.locator("option", { hasText: templateName }),
    ).toHaveCount(1, { timeout: 15000 });
    await this.template.selectOption({ label: templateName });
    await expect(this.template.locator("option:checked")).toHaveText(
      templateName,
    );
    const editor = this.campaignPanel.locator("iframe").contentFrame();
    await expect(
      editor.getByRole("button", { name: "Paragraph", exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      editor.getByText("No content here. Drag content from right.", {
        exact: true,
      }),
    ).toBeHidden({ timeout: 15000 });
    await this.subject.click();
    await expect(this.subject).toBeFocused();
  }

  async enterSubject(value: string): Promise<void> {
    await this.subject.fill(value);
  }

  async clickCreateCampaign(): Promise<void> {
    const confirmationHandled = new Promise<void>((resolve, reject) => {
      this.page.once("dialog", async (dialog) => {
        try {
          expect(dialog.type()).toBe("confirm");
          expect(dialog.message()).toContain("create this campaign");
          await dialog.accept();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
    await this.createCampaignButton.click();
    await confirmationHandled;
  }

  async clickCreateCampaignExpectingValidation(): Promise<void> {
    await this.createCampaignButton.click();
  }

  async clickCreateCampaignExpectingRecipientAlert(): Promise<void> {
    const confirmationHandled = new Promise<void>((resolve, reject) => {
      this.page.once("dialog", async (dialog) => {
        try {
          expect(dialog.type()).toBe("confirm");
          expect(dialog.message()).toContain("create this campaign");
          await dialog.accept();
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
    const validationAlert = this.recipientRequiredAlert.waitFor({
      state: "visible",
      timeout: 15_000,
    });

    await this.createCampaignButton.click();
    await confirmationHandled;
    await validationAlert;
  }

  async verifyTemplateSelected(templateName: string): Promise<void> {
    await expect(this.template.locator("option:checked")).toHaveText(
      templateName,
    );
  }

  async verifyCampaignCreated(campaignName: string): Promise<void> {
    await expect(this.campaignPanel).toBeHidden({ timeout: 15000 });
    await expect(
      this.page.getByRole("cell", { name: campaignName, exact: true }),
    ).toBeVisible();
  }

  async sendCampaignEmails(): Promise<void> {
    const url = ConfigManager.branch.sendCampaignEmailUrl;
    if (!url)
      throw new Error("env_SendCampaignEmailURL is missing from config/qa.env");
    const result = await this.page.evaluate(async (endpoint) => {
      const response = await fetch(endpoint, {
        method: "GET",
        credentials: "include",
      });
      return { ok: response.ok, status: response.status };
    }, url);
    expect(
      result.ok,
      `Campaign delivery endpoint returned ${result.status}`,
    ).toBeTruthy();
  }

  async verifyRecipientRequired(campaignName: string): Promise<void> {
    await expect(this.campaignPanel).toBeVisible();
    await expect(
      this.page.getByRole("cell", { name: campaignName, exact: true }),
    ).toHaveCount(0);
  }

  async verifyTemplateRequired(campaignName: string): Promise<void> {
    await expect(this.campaignPanel).toBeVisible();
    await expect(this.template.locator("option:checked")).toHaveText(
      /No Template/i,
    );
    await expect(
      this.page.getByRole("cell", { name: campaignName, exact: true }),
    ).toHaveCount(0);
  }

  private getInputByLabel(label: RegExp): Locator {
    return this.campaignPanel
      .getByText(label)
      .first()
      .locator("..")
      .locator("input, textarea")
      .first();
  }

  private getCampaignStatusCount(
    headers: ReadonlyArray<string>,
    values: ReadonlyArray<string>,
    status: string,
  ): number {
    const index = headers.findIndex((header) =>
      header.toLowerCase().includes(status.toLowerCase()),
    );
    if (index < 0) {
      throw new Error(`Campaign list does not contain the ${status} column`);
    }

    const value = Number(values[index]);
    if (!Number.isInteger(value) || value < 0) {
      throw new Error(`Campaign ${status} value is invalid: ${values[index]}`);
    }
    return value;
  }

  private getSelectByLabel(label: RegExp): Locator {
    return this.campaignPanel
      .getByText(label)
      .first()
      .locator("..")
      .locator("select")
      .first();
  }

  private getConditionSelect(conditionIndex: number, label: RegExp): Locator {
    return this.conditionRows
      .nth(conditionIndex)
      .getByText(label)
      .first()
      .locator("..")
      .locator("select")
      .first();
  }

  private getConditionInput(conditionIndex: number, label: RegExp): Locator {
    return this.conditionRows
      .nth(conditionIndex)
      .getByText(label)
      .first()
      .locator("..")
      .locator("input, textarea")
      .first();
  }

  private async waitForLoadingOverlay(): Promise<void> {
    await expect
      .poll(
        () => this.page.locator(".ngx-spinner-overlay:visible").count(),
        {
          message: "Campaign loading overlays should be hidden",
          timeout: 15_000,
        },
      )
      .toBe(0);
  }
}
