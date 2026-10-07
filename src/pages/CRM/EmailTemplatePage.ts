import { Locator, Page, expect } from "@playwright/test";
import { BasePage } from "../../utils/BasePage";

export type EmailTemplateCategory =
  | "Lead"
  | "Customer"
  | "Quotation"
  | "Reservation";
export type MergeTagTemplateCategory =
  | "Lead"
  | "Customer"
  | "Quotation"
  | "Reservation";

export class EmailTemplatePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ***************** Page Elements *********************************

  private readonly pageHeading: Locator = this.page.getByRole("heading", {
    name: "Manage Email Template",
    exact: true,
  });
  private readonly addTemplateButton: Locator = this.page.getByText(
    "Create from Scratch",
    { exact: true },
  );
  private readonly createFromTemplateButton: Locator = this.page.getByText(
    "Create from Template",
    { exact: true },
  );
  private readonly templateSearchInput: Locator = this.page.getByPlaceholder(
    /search/i,
  ).first();
  private readonly dialog: Locator = this.page.locator("#addEmailTemplateOffcanvas");
  private readonly templateName: Locator = this.getInputByLabel(/^(?:template )?name\s*\*?$/i);
  private readonly templateType: Locator = this.dialog
    .getByText(/^Template Type\s*\*?$/i)
    .first()
    .locator("..")
    .locator("select")
    .first();
  private readonly subject: Locator = this.getInputByLabel(/^subject\s*\*?$/i);
  private readonly saveButton: Locator = this.dialog.getByRole("button", {
    name: /save/i,
  });

  // ***************** Email Template Actions ************************

  async verifyDisplayed(): Promise<void> {
    await expect(this.pageHeading).toBeVisible();
    await expect(this.addTemplateButton).toBeVisible();
  }

  async clickAddTemplate(): Promise<void> {
    await this.addTemplateButton.click();
    await expect(this.templateName).toBeVisible();
  }

  async clickCreateFromTemplate(): Promise<void> {
    await this.createFromTemplateButton.click();
  }

  async searchAndSelectTemplate(searchTerm: string): Promise<void> {
    const gallery = this.page.getByRole("dialog", { name: "Template Gallery" });
    const searchInput = gallery.getByRole("textbox", { name: "Search Templates..." });
    await expect(searchInput).toBeVisible({ timeout: 15000 });
    await searchInput.fill(searchTerm);

    // Wait for the matching card heading to appear after search filters
    const templateHeading = gallery.getByRole("heading", { name: searchTerm, exact: true });
    await expect(templateHeading).toBeVisible({ timeout: 15000 });

    // The "Use Template" button is only revealed on hover of the card.
    // Navigate up to the card container (heading → parent row → card wrapper).
    const templateCard = templateHeading.locator("..").locator("..");
    await templateCard.hover();

    // Click "Use Template" with force to bypass the iframe preview intercepting pointer events
    const useTemplateBtn = templateCard.getByRole("button", { name: "Use Template", exact: true });
    await expect(useTemplateBtn).toBeVisible({ timeout: 5000 });
    await useTemplateBtn.click({ force: true });

    // Wait for the gallery to close and the Add Email Template offcanvas to open
    await expect(gallery).toBeHidden({ timeout: 15000 });
    await expect(this.dialog).toBeVisible({ timeout: 15000 });
  }

  async verifyTemplateCategoryPreloaded(expectedCategory: EmailTemplateCategory): Promise<void> {
    // After "Create from Template", Template Type is rendered as a plain text input (read-only)
    const typeField = this.dialog
      .getByText(/^Template Type\s*\*?$/i)
      .first()
      .locator("..")
      .locator("input, select")
      .first();
    await expect(typeField).toHaveValue(new RegExp(expectedCategory, "i"));
  }

  async verifyEditorHasContent(content: string): Promise<void> {
    const editor = this.dialog.locator("iframe").contentFrame();
    const contentElement = editor.getByText(content, { exact: false }).first();
    await expect(contentElement).toContainText(content, { timeout: 15000 });
  }


  async enterTemplateName(value: string): Promise<void> {
    await this.templateName.fill(value);
  }

  async enterSubject(value: string): Promise<void> {
    await this.subject.fill(value);
  }

  async selectTemplateType(category: EmailTemplateCategory): Promise<void> {
    await this.templateType.selectOption({ label: category });
  }

  async addParagraphContent(value: string): Promise<void> {
    const editor = this.dialog.locator("iframe").contentFrame();
    const paragraphTool = editor.getByRole("button", {
      name: "Paragraph",
      exact: true,
    });
    const emptyCanvas = editor.getByText(
      "No content here. Drag content from right.",
      { exact: true },
    );

    await expect(paragraphTool).toBeVisible({ timeout: 15000 });
    const paragraph = editor.getByText(
      /This is a new Paragraph block\. Change the text\./,
    );

    for (let attempt = 0; attempt < 3 && !(await paragraph.isVisible()); attempt++) {
      await paragraphTool.dragTo(emptyCanvas, { force: true });
      if (await paragraph.isVisible()) break;
    }
    await expect(paragraph).toBeVisible({ timeout: 10000 });
    await paragraph.dblclick({ force: true });
    const paragraphEditor = editor.getByRole("textbox").filter({
      visible: true,
    }).first();
    await expect(paragraphEditor).toBeVisible();
    // Scope keyboard input to the editor iframe. `End` only moves to the end
    // of the current visual line; Control+End reliably appends to the block.
    await paragraphEditor.click();
    await paragraphEditor.press("Control+End");
    await paragraphEditor.pressSequentially(` ${value}`);
    await expect(paragraphEditor).toContainText(value);
    await editor.getByRole("banner")
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await this.subject.click();
    await expect(this.subject).toBeFocused();
  }

  async insertAndVerifyMergeField(
    category: MergeTagTemplateCategory,
    specificTag?: string,
  ): Promise<string> {
    const editor = this.dialog.locator("iframe").contentFrame();
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

    await expect(paragraphTool).toBeVisible({ timeout: 15000 });
    for (let attempt = 0; attempt < 3 && !(await paragraph.isVisible()); attempt++) {
      await paragraphTool.dragTo(emptyCanvas, { force: true });
      if (await paragraph.isVisible()) break;
    }

    await expect(paragraph).toBeVisible({ timeout: 10000 });
    await paragraph.dblclick({ force: true });

    // Put a collapsed caret in the editable content before opening the
    // toolbar. The merge-tag command inserts at this saved selection.
    const paragraphEditor = editor.getByRole("textbox").filter({ visible: true }).first();
    await expect(paragraphEditor).toBeVisible();
    await paragraphEditor.click();
    await paragraphEditor.press("Control+End");

    const mergeTags = editor
      .getByTestId("hotkeys")
      .getByRole("button", { name: "Merge Tags", exact: true });
    await mergeTags.click();

    const expectedGroup = category === "Customer" ? "Company" : category;
    const mergeTagsDialog = this.page.getByRole("dialog", {
      name: "Merge Tags",
      exact: true,
    });
    await expect(mergeTagsDialog).toBeVisible();
    const candidateFields = mergeTagsDialog.getByRole("button")
      .filter({ hasText: new RegExp(`^${expectedGroup}\\s*-`, "i") });

    const mergeField = specificTag
      ? candidateFields.filter({ hasText: specificTag }).first()
      : candidateFields.last();

    await expect(mergeField).toBeVisible();
    const mergeFieldName = (await mergeField.innerText()).trim();
    await mergeField.click();

    await expect(paragraphEditor).not.toHaveText(
      "This is a new Paragraph block. Change the text.",
    );
    await editor.getByRole("banner")
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await this.subject.click();

    return mergeFieldName;
  }

  async getAllMergeTagsForCategory(
    category: MergeTagTemplateCategory,
  ): Promise<string[]> {
    const editor = this.dialog.locator("iframe").contentFrame();
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

    await expect(paragraphTool).toBeVisible({ timeout: 15000 });
    for (let attempt = 0; attempt < 3 && !(await paragraph.isVisible()); attempt++) {
      await paragraphTool.dragTo(emptyCanvas, { force: true });
      if (await paragraph.isVisible()) break;
    }

    await expect(paragraph).toBeVisible({ timeout: 10000 });
    await paragraph.dblclick({ force: true });

    const mergeTags = editor
      .getByTestId("hotkeys")
      .getByRole("button", { name: "Merge Tags", exact: true });
    await mergeTags.click();

    const expectedGroup = category === "Customer" ? "Company" : category;
    const mergeTagsDialog = this.page.getByRole("dialog", {
      name: "Merge Tags",
      exact: true,
    });
    await expect(mergeTagsDialog).toBeVisible();
    const mergeFields = mergeTagsDialog.getByRole("button")
      .filter({ hasText: new RegExp(`^${expectedGroup}\\s*-`, "i") });
    const tags = (await mergeFields.allTextContents()).map((t) => t.trim()).filter(Boolean);
    return tags;
  }

  async clickSaveTemplate(): Promise<void> {
    await this.saveButton.click();
    await expect(this.dialog).toBeHidden({ timeout: 15000 });
  }

  async clickSaveTemplateExpectingValidation(): Promise<void> {
    await this.saveButton.click();
  }

  async verifyTemplateCreated(
    templateName: string,
    category: EmailTemplateCategory,
  ): Promise<void> {
    const templateRow = this.page.getByRole("row").filter({
      has: this.page.getByRole("cell", { name: templateName, exact: true }),
    });
    await expect(templateRow).toBeVisible();
    await expect(templateRow.getByRole("cell", { name: category, exact: true }))
      .toBeVisible();
  }

  async verifyDuplicateTemplateNameRejected(): Promise<void> {
    const duplicateMessage = this.page.getByText(
      "Template Name already exists",
      { exact: true },
    );
    await expect(duplicateMessage).toBeVisible();
    await expect(this.dialog).toBeVisible();
  }

  async verifySubjectRequired(): Promise<void> {
    const requiredMessage = this.page.getByRole("alert").filter({
      hasText: "Subject should not blank",
    });
    await expect(requiredMessage).toBeVisible();
    await expect(this.dialog).toBeVisible();
  }

  async verifyTemplateContent(templateName: string, content: string): Promise<void> {
    const templateRow = this.page.getByRole("row").filter({
      has: this.page.getByRole("cell", { name: templateName, exact: true }),
    });
    await templateRow.getByTitle("Edit Email", { exact: true }).first().click();

    const editor = this.dialog.locator("iframe").contentFrame();
    const savedParagraph = editor.getByText(content, { exact: false }).first();
    await expect(savedParagraph).toContainText(content, { timeout: 15000 });
    await this.dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    const confirmDialog = this.page.getByRole("dialog").filter({
      has: this.page.getByRole("heading", { name: "Confirm", exact: true }),
    });
    await confirmDialog.getByRole("button", { name: "Yes", exact: true }).click();
    await expect(this.dialog).toBeHidden();
  }

  private getInputByLabel(label: RegExp): Locator {
    return this.dialog
      .getByText(label)
      .first()
      .locator("..")
      .locator("input, textarea")
      .first();
  }
}
