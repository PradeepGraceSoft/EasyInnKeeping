import { ConfigManager } from "../ConfigManager";
import { DatabaseUtils } from "./DatabaseUtils";

export type CurrencyChange = {
  originalCurrency: string | null;
  testCurrency: "$" | "£";
};

export class POSDatabaseHelper {
  private originalCurrency: string | null | undefined;

  private get propertyId(): string {
    const propertyId = ConfigManager.testData.propertyId;
    if (!/^\d+$/.test(propertyId)) {
      throw new Error("A numeric propertyId is required for POS database setup.");
    }
    return propertyId;
  }

  async getPropertyCurrency(): Promise<string | null> {
    return DatabaseUtils.getValue(
      `SELECT Currency FROM Property WHERE property_id = ${this.propertyId}`,
      "Currency",
    );
  }

  async useDifferentCurrency(): Promise<CurrencyChange> {
    const currentCurrency = await this.getPropertyCurrency();
    if (this.originalCurrency === undefined) {
      this.originalCurrency = currentCurrency;
    }

    const testCurrency = currentCurrency?.trim() === "$" ? "£" : "$";
    await DatabaseUtils.executeUpdate(
      `UPDATE Property SET Currency = ${this.sqlString(testCurrency)}
       WHERE property_id = ${this.propertyId}`,
    );

    const savedCurrency = await this.getPropertyCurrency();
    if (savedCurrency?.trim() !== testCurrency) {
      throw new Error(
        `POS currency setup expected '${testCurrency}' but database returned '${savedCurrency}'.`,
      );
    }

    return { originalCurrency: currentCurrency, testCurrency };
  }

  async restoreTrackedState(): Promise<void> {
    if (this.originalCurrency === undefined) return;

    await DatabaseUtils.executeUpdate(
      `UPDATE Property SET Currency = ${this.sqlString(this.originalCurrency)}
       WHERE property_id = ${this.propertyId}`,
    );
    this.originalCurrency = undefined;
  }

  private sqlString(value: string | null): string {
    return value === null ? "NULL" : `N'${value.replace(/'/g, "''")}'`;
  }
}
