import { ConfigManager } from "../ConfigManager";
import { DatabaseUtils } from "./DatabaseUtils";

export type LoyaltyTier = { name: string; minimumPoints: number; maximumPoints: number | null };

/** Database operations used by Guest Hub authentication tests. */
export class GuestDatabaseHelper {
  private static readonly loyaltyCompanyId = 1030;
  private static readonly loyaltyGuestEmail = "tester1gracesoft@gmail.com";
  private get propertyId(): string {
    const propertyId = ConfigManager.testData.propertyId;
    if (!propertyId) throw new Error("propertyId is not configured in test data.");
    return propertyId;
  }

  async isGuestHubEnabled(): Promise<boolean> {
    const enabledValue = await DatabaseUtils.getValue(
      `SELECT EnableGuestHub FROM Property WHERE property_id = ${this.propertyId}`,
      "EnableGuestHub",
    );
    return ["1", "true", "yes"].includes(enabledValue?.trim().toLowerCase() ?? "");
  }

  async enableGuestHub(): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Property SET EnableGuestHub = 1 WHERE property_id = ${this.propertyId}`,
    );
    await DatabaseUtils.executeUpdate(
      `UPDATE Settings SET IsEnableSelfCheckIn = 1 WHERE PropertyID = ${this.propertyId}`,
    );
  }

  async isSelfCheckInEnabled(): Promise<boolean> {
    const enabledValue = await DatabaseUtils.getValue(
      `SELECT IsEnableSelfCheckIn FROM Settings WHERE PropertyID = ${this.propertyId}`,
      "IsEnableSelfCheckIn",
    );
    return ["1", "true", "yes"].includes(enabledValue?.trim().toLowerCase() ?? "");
  }

  async areGuestHubPaymentOptionsEnabled(): Promise<boolean> {
    const settings = await DatabaseUtils.getRow<{
      IsEnablePayAmountDue: number | string;
      IsEnablePayOtherAmount: number | string;
      IsEnablePurchaseCartItems: number | string;
    }>(
      `SELECT IsEnablePayAmountDue, IsEnablePayOtherAmount, IsEnablePurchaseCartItems
       FROM Settings
       WHERE PropertyID = ${this.propertyId}`,
    );
    return [
      settings?.IsEnablePayAmountDue,
      settings?.IsEnablePayOtherAmount,
      settings?.IsEnablePurchaseCartItems,
    ].every(
      (value) =>
        value !== undefined && [1, "1", true, "true"].includes(value),
    );
  }

  async enableGuestHubPaymentOptions(): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Settings
       SET IsEnablePayAmountDue = 1,
           IsEnablePayOtherAmount = 1,
           IsEnablePurchaseCartItems = 1
       WHERE PropertyID = ${this.propertyId}`,
    );
  }

  async getGuestId(confirmationNumber: string): Promise<number> {
    if (!/^\d+$/.test(confirmationNumber)) {
      throw new Error(`Invalid reservation confirmation number: ${confirmationNumber}`);
    }
    const guestId = await DatabaseUtils.getValue(
      `SELECT Guestid FROM Reservation
       WHERE Property_id = ${this.propertyId} AND Confirm_num = ${confirmationNumber}`,
      "Guestid",
    );
    if (!guestId || !/^\d+$/.test(guestId)) {
      throw new Error(`Guest ID was not found for reservation ${confirmationNumber}.`);
    }
    return Number(guestId);
  }

  async getGuestHubOtp(
    confirmationNumber: string,
    previousOtp?: string,
    timeoutMs = 60_000,
  ): Promise<string> {
    if (!/^\d+$/.test(confirmationNumber)) {
      throw new Error(`Invalid reservation confirmation number: ${confirmationNumber}`);
    }

    const deadline = Date.now() + timeoutMs;
    do {
      const otp = await DatabaseUtils.getValue(
        `SELECT GuestHubOtp
         FROM Guest
         WHERE propertyid = ${this.propertyId}
           AND id = (
             SELECT Guestid FROM Reservation
             WHERE Property_id = ${this.propertyId} AND Confirm_num = ${confirmationNumber}
           )`,
        "GuestHubOtp",
      );
      if (otp?.trim() && otp.trim() !== previousOtp) return otp.trim();

      if (Date.now() >= deadline) break;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    } while (Date.now() < deadline);

    throw new Error(
      `Guest Hub OTP was not generated for reservation ${confirmationNumber} within ${timeoutMs / 1000} seconds.`,
    );
  }

  async resetGuestHubOtpState(guestId: number): Promise<void> {
    if (!Number.isInteger(guestId) || guestId < 1) {
      throw new Error("guestId must be a positive integer.");
    }
    await DatabaseUtils.executeUpdate(
      `UPDATE Guest
       SET GuestHubOtpRequestCount = 0,
           GuestHubOtpLocked = 0,
           GuestHubOtpInvalidCount = 0
       WHERE propertyid = ${this.propertyId} AND id = ${guestId}`,
    );
  }

  async expireGuestHubOtp(confirmationNumber: string): Promise<void> {
    if (!/^\d+$/.test(confirmationNumber)) {
      throw new Error(`Invalid reservation confirmation number: ${confirmationNumber}`);
    }
    await DatabaseUtils.executeUpdate(
      `UPDATE Guest
       SET GuestHubOtpExpireDate = DATEADD(MINUTE, -1, GETDATE())
       WHERE propertyid = ${this.propertyId}
         AND id = (
           SELECT Guestid FROM Reservation
           WHERE Property_id = ${this.propertyId} AND Confirm_num = ${confirmationNumber}
         )`,
    );
  }

  async getGuestHubOtpRequestDate(confirmationNumber: string): Promise<Date> {
    if (!/^\d+$/.test(confirmationNumber)) {
      throw new Error(`Invalid reservation confirmation number: ${confirmationNumber}`);
    }

    const requestDate = await DatabaseUtils.getValue(
      `SELECT GuestHubOtpRequestDate
       FROM Guest
       WHERE propertyid = ${this.propertyId}
         AND id = (
           SELECT Guestid FROM Reservation
           WHERE Property_id = ${this.propertyId} AND Confirm_num = ${confirmationNumber}
         )`,
      "GuestHubOtpRequestDate",
    );

    if (!requestDate) {
      throw new Error(`No Guest Hub OTP request date found for reservation ${confirmationNumber}.`);
    }

    const parsedDate = new Date(requestDate);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new Error(`Invalid Guest Hub OTP request date for reservation ${confirmationNumber}: ${requestDate}`);
    }

    return parsedDate;
  }

  async setGuestHubOtpRequestDateToYesterday(confirmationNumber: string): Promise<void> {
    if (!/^\d+$/.test(confirmationNumber)) {
      throw new Error(`Invalid reservation confirmation number: ${confirmationNumber}`);
    }

    await DatabaseUtils.executeUpdate(
      `UPDATE Guest
       SET GuestHubOtpRequestDate = DATEADD(DAY, -1, GETDATE())
       WHERE propertyid = ${this.propertyId}
         AND id = (
           SELECT Guestid FROM Reservation
           WHERE Property_id = ${this.propertyId} AND Confirm_num = ${confirmationNumber}
         )`,
    );
  }

  async hasGuestHubOtpFutureExpiry(confirmationNumber: string): Promise<boolean> {
    if (!/^\d+$/.test(confirmationNumber)) {
      throw new Error(`Invalid reservation confirmation number: ${confirmationNumber}`);
    }
    const hasFutureExpiry = await DatabaseUtils.getValue(
      `SELECT CASE WHEN GuestHubOtpExpireDate > GETDATE() THEN 1 ELSE 0 END AS HasFutureExpiry
       FROM Guest
       WHERE propertyid = ${this.propertyId}
         AND id = (
           SELECT Guestid FROM Reservation
           WHERE Property_id = ${this.propertyId} AND Confirm_num = ${confirmationNumber}
         )`,
      "HasFutureExpiry",
    );
    return hasFutureExpiry === "1";
  }

  async getGuestHubUrlKey(): Promise<string> {
    const key = await DatabaseUtils.getValue(
      `SELECT GuestHubUrl FROM Settings WHERE PropertyID = ${this.propertyId}`,
      "GuestHubUrl",
    );
    if (!key) throw new Error(`Guest Hub URL key is not configured for property ${this.propertyId}.`);
    return key;
  }

  async resetLoyaltyDataForGuest(email = GuestDatabaseHelper.loyaltyGuestEmail): Promise<void> {
    const escapedEmail = email.replace(/'/g, "''");
    await DatabaseUtils.executeUpdate(
      `UPDATE EconnectCRM.dbo.LeadList
       SET LoyaltyPoints = '', LoyaltyLevel = ''
       WHERE LeadId = (
         SELECT LeadId FROM EconnectCRM.dbo.LeadList
         WHERE CompanyId = ${GuestDatabaseHelper.loyaltyCompanyId}
           AND EmailId = '${escapedEmail}' AND LeadType = 2
       )`,
    );
    await DatabaseUtils.executeUpdate(
      `DELETE FROM EconnectCRM.dbo.LoyaltyTransactions
       WHERE CompanyId = ${GuestDatabaseHelper.loyaltyCompanyId}
         AND CustomerId = (
           SELECT LeadId FROM EconnectCRM.dbo.LeadList
           WHERE CompanyId = ${GuestDatabaseHelper.loyaltyCompanyId}
             AND EmailId = '${escapedEmail}' AND LeadType = 2
         )`,
    );
  }

  async getLoyaltyDataForGuest(email = GuestDatabaseHelper.loyaltyGuestEmail): Promise<{
    points: string;
    tier: string;
  }> {
    const escapedEmail = email.replace(/'/g, "''");
    const row = await DatabaseUtils.getRow<{ LoyaltyPoints: string | number; LoyaltyLevel: string }>(
      `SELECT LoyaltyPoints, LoyaltyLevel
       FROM EconnectCRM.dbo.LeadList
       WHERE CompanyId = ${GuestDatabaseHelper.loyaltyCompanyId}
         AND EmailId = '${escapedEmail}' AND LeadType = 2`,
    );
    if (!row || row.LoyaltyPoints === null || row.LoyaltyPoints === undefined || !row.LoyaltyLevel) {
      throw new Error("The loyalty data query did not return points and tier for the test guest.");
    }
    return { points: String(row.LoyaltyPoints), tier: row.LoyaltyLevel };
  }

  async getLoyaltyDataForReservation(
    confirmationNumber: string,
    email = GuestDatabaseHelper.loyaltyGuestEmail,
    timeoutMs = 30_000,
  ): Promise<{ points: string; tier: string }> {
    const deadline = Date.now() + timeoutMs;
    const tiers = await this.getLoyaltyTiers();
    const escapedEmail = email.replace(/'/g, "''");
    while (Date.now() < deadline) {
      const pointsValue = await DatabaseUtils.getValue(
        `SELECT TOP 1 BalancePoints
         FROM EconnectCRM.dbo.LoyaltyTransactions
         WHERE CompanyId = ${GuestDatabaseHelper.loyaltyCompanyId}
           AND ConfirmNum = ${confirmationNumber}
           AND CustomerId = (
             SELECT LeadId FROM EconnectCRM.dbo.LeadList
             WHERE CompanyId = ${GuestDatabaseHelper.loyaltyCompanyId}
               AND EmailId = '${escapedEmail}' AND LeadType = 2
           )
         `,
        "BalancePoints",
      );
      const points = Number(pointsValue);
      if (pointsValue !== null && Number.isFinite(points)) {
        const tier = tiers.find(item => points >= item.minimumPoints && (item.maximumPoints === null || points <= item.maximumPoints));
        if (!tier) throw new Error(`No loyalty tier matched ${points} points for reservation ${confirmationNumber}.`);
        return { points: String(points), tier: tier.name };
      }
      await new Promise(resolve => setTimeout(resolve, 1_000));
    }
    throw new Error(`Loyalty points were not generated for reservation ${confirmationNumber} within ${timeoutMs / 1000} seconds.`);
  }

  async getLoyaltyTiers(): Promise<LoyaltyTier[]> {
    return DatabaseUtils.executeQuery<LoyaltyTier>(
      `SELECT TierName AS name, MinimumPoints AS minimumPoints, MaximumPoints AS maximumPoints
       FROM EconnectCRM.dbo.LoyaltyTier
       WHERE CompanyId = ${GuestDatabaseHelper.loyaltyCompanyId}
       ORDER BY MinimumPoints, LoyaltyTierId`,
    );
  }

  async getMonthlyLoyaltyPoints(email: string): Promise<Record<string, number>> {
    const escapedEmail = email.replace(/'/g, "''");
    const rows = await DatabaseUtils.executeQuery<{ monthStart: string; points: number }>(
      `SELECT CONVERT(varchar(7), lt.TransDate, 120) AS monthStart,
              SUM(ISNULL(lt.CreditPoints, 0)) AS points
       FROM EconnectCRM.dbo.LoyaltyTransactions lt
       INNER JOIN EconnectCRM.dbo.LeadList ll ON ll.LeadId = lt.CustomerId
       WHERE lt.CompanyId = ${GuestDatabaseHelper.loyaltyCompanyId}
         AND ll.EmailId = '${escapedEmail}' AND ll.LeadType = 2
       GROUP BY CONVERT(varchar(7), lt.TransDate, 120)`,
    );
    return Object.fromEntries(rows.map(row => [row.monthStart, Number(row.points)]));
  }

  async getLoyaltyPointsForReservation(confirmationNumber: string, email = GuestDatabaseHelper.loyaltyGuestEmail): Promise<number> {
    const escapedEmail = email.replace(/'/g, "''");
    const value = await DatabaseUtils.getValue(
      `SELECT TOP 1 CreditPoints
       FROM EconnectCRM.dbo.LoyaltyTransactions
       WHERE CompanyId = ${GuestDatabaseHelper.loyaltyCompanyId}
         AND ConfirmNum = ${confirmationNumber}
         AND CustomerId = (SELECT LeadId FROM EconnectCRM.dbo.LeadList WHERE CompanyId = ${GuestDatabaseHelper.loyaltyCompanyId} AND EmailId = '${escapedEmail}' AND LeadType = 2)`,
      "CreditPoints",
    );
    const points = Number(value);
    if (value === null || !Number.isFinite(points)) throw new Error(`No loyalty points were found for reservation ${confirmationNumber}.`);
    return points;
  }

  async updateGuestLoyaltyToTier(
    email: string,
    points: number,
    tierName: string,
  ): Promise<void> {
    const escapedEmail = email.replace(/'/g, "''");
    const escapedTier = tierName.replace(/'/g, "''");
    await DatabaseUtils.executeUpdate(
      `UPDATE EconnectCRM.dbo.LeadList
       SET LoyaltyPoints = ${points}, LoyaltyLevel = '${escapedTier}'
       WHERE CompanyId = ${GuestDatabaseHelper.loyaltyCompanyId}
         AND EmailId = '${escapedEmail}' AND LeadType = 2`,
    );
  }
}
