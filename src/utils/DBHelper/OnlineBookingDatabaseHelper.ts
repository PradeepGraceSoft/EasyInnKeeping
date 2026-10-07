import { ConfigManager } from "../ConfigManager";
import { DatabaseUtils } from "./DatabaseUtils";

export type OnlineBookingTemplate = "Modern" | "Classic";

/** Database operations used only by online-booking tests. */
export class OnlineBookingDatabaseHelper {
  private get propertyId(): string {
    const propertyId = ConfigManager.testData.propertyId;

    if (!propertyId) {
      throw new Error("propertyId is not configured in test data.");
    }

    return propertyId;
  }

  async enableEwrAiChatbot(): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Property
       SET IsAIChatBotEnabled = 1
       WHERE property_id = ${this.propertyId}`,
    );
    await DatabaseUtils.executeUpdate(
      `UPDATE Property
       SET IsAIChatBotEWREnabled = 1
       WHERE property_id = ${this.propertyId}`,
    );
  }

  async disableEwrAiChatbot(): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Property
       SET IsAIChatBotEnabled = 0
       WHERE property_id = ${this.propertyId}`,
    );
    await DatabaseUtils.executeUpdate(
      `UPDATE Property
       SET IsAIChatBotEWREnabled = 0
       WHERE property_id = ${this.propertyId}`,
    );
  }

  async setTemplateType(template: OnlineBookingTemplate): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Property
       SET templateType = '${template}'
       WHERE property_id = ${this.propertyId}`,
    );
  }

  async getShoppingCartEnabled(): Promise<boolean> {
    return (
      (await DatabaseUtils.getValue(
        `SELECT EnableShoppingCart
         FROM Property
         WHERE property_id = ${this.propertyId}`,
        "EnableShoppingCart",
      )) === "1"
    );
  }

  async setShoppingCartEnabled(enabled: boolean): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Property
       SET EnableShoppingCart = ${enabled ? 1 : 0}
       WHERE property_id = ${this.propertyId}`,
    );
  }
}
