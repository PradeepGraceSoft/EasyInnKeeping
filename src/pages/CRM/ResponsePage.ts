import { Locator, Page, expect } from "@playwright/test";
import { BasePage } from "../../utils/BasePage";

export class ResponsePage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  // ***************** Page Elements *********************************

  private readonly dialog: Locator = this.page.locator("body");
  private readonly bulkEmailHeading: Locator = this.page.getByRole("heading", {
    name: "Bulk Email",
    exact: true,
  });
  private readonly template: Locator = this.dialog.getByText(/^Select Template\s*$/)
    .locator("..").locator("select");
  private readonly callBackDate: Locator = this.dialog.getByText(/^Call Back Date\s*\*?$/)
    .locator("..").locator("input");
  private readonly toCount: Locator = this.dialog.getByText(/^To Count\s*$/)
    .locator("..").locator("input");
  private readonly sendEmailButton: Locator = this.dialog.getByRole("button", {
    name: "Send Email",
    exact: true,
  });
  private readonly emailSentMessage: Locator = this.page.getByRole("alert")
    .filter({ hasText: /^Email sent successfully$/i })
    .first();

  // ***************** Email Response Actions ************************

  async verifyDisplayed(): Promise<void> {
    await expect(this.bulkEmailHeading).toBeVisible();
  }

  async verifyInboxDisplayed(): Promise<void> {
    await expect(this.page.getByText("Staff Response Inbox", { exact: true })).toBeVisible();
  }

  async enterSubject(value: string): Promise<void> {
    await this.dialog.getByText(/^Subject\s*\*?$/).locator("..")
      .locator("input").fill(value);
  }

  async sendInboxEmail(): Promise<void> {
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (response) => response.request().method() === "POST"
          && new URL(response.url()).pathname.endsWith("/StaffResponse/CreateStaffResponse"),
        { timeout: 15000 },
      ),
      this.sendEmailButton.click(),
    ]);
    expect(response.ok(), "Response email send request failed.").toBeTruthy();
    expect(await response.json(), "Response email was not sent.")
      .toMatchObject({ response: "OK", statusCode: 200, skippedEmailCount: 0 });
    await this.verifyEmailSentSuccessfully();
  }

  async verifyEmailActivity(subject: string, staffName: string): Promise<void> {
    const inbox = this.page.locator("#staffResponseModal");
    await inbox.getByText("Activity", { exact: true }).click();
    const activity = inbox.getByRole("article").filter({
      has: this.page.getByRole("heading", { name: subject, exact: true }),
    });
    await expect(inbox.getByRole("article")).toHaveCount(1);
    await expect(activity).toBeVisible();
    await expect(activity.getByText("Email", { exact: true })).toBeVisible();
    await expect(activity.getByText(staffName, { exact: true })).toBeVisible();
    // Provider tracking may be unavailable even when the mailbox receives the email.
    await expect(activity.getByText(/Delivery Status\s*:\s*\S+/)).toBeVisible();
    await expect(activity.getByText("Recipient details", { exact: true })).toBeVisible();
    await expect(activity.getByRole("button", { name: /View Email/ })).toBeVisible();
    await expect(activity.locator("p")).toContainText(/\S+/);
    await expect(activity.getByText("Click to view full email", { exact: true })).toBeVisible();
    await expect(inbox.getByText(/^\d{2}\/\d{2}\/\d{4}$/)).toBeVisible();
    await expect(inbox.getByText(/^\d{1,2}:\d{2}\s*[AP]M$/i)).toBeVisible();
  }

  async verifyToCount(expectedCount: number): Promise<void> {
    await expect(this.toCount).toHaveValue(`${expectedCount} Records Selected`);
  }

  async selectFirstAvailableTemplate(): Promise<void> {
    const templateValue = await this.template.locator("option:not([disabled])")
      .filter({ hasNotText: /^\s*-?No Template-?\s*$/i })
      .first()
      .getAttribute("value");

    if (!templateValue) {
      throw new Error("No email response template is available");
    }

    await this.template.selectOption(templateValue);
  }

  async selectTemplate(templateName: string): Promise<void> {
    await expect(this.template.locator("option", { hasText: templateName }))
      .toHaveCount(1, { timeout: 15000 });
    await this.template.selectOption({ label: templateName });
  }

  async enterCallBackDate(value: string): Promise<void> {
    await this.callBackDate.fill(value);
  }

  async clickSendEmail(): Promise<void> {
    // Sending includes asynchronous editor export before the API request starts.
    // Wait for this send operation before starting the toast assertion window.
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (response) => response.request().method() === "POST"
          && new URL(response.url()).pathname.endsWith("/StaffResponse/CreateBulkStaffResponse"),
        { timeout: 15000 },
      ),
      this.sendEmailButton.click(),
    ]);
    expect(response.ok(), "Bulk Email did not successfully complete the send request.").toBeTruthy();
    const result = await response.json();
    expect(result, "Bulk Email did not confirm that the email was sent.")
      .toMatchObject({ response: "OK", statusCode: 200 });
  }

  async verifyEmailSentSuccessfully(): Promise<void> {
    await expect(this.emailSentMessage, "Email did not display its success message after sending.")
      .toBeVisible();
  }
}
