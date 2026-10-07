import { ConfigManager } from "../ConfigManager";
import { DatabaseUtils } from "./DatabaseUtils";

/**
 * SSO-specific DB operations.
 */
export class SSODatabaseHelper {
  private get propertyId(): string {
    const propertyId = ConfigManager.testData.propertyId;

    if (!propertyId) {
      throw new Error("propertyId is not configured in test data.");
    }

    return propertyId;
  }

  async resetOTPDayCount(loginName: string): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE GraceSSO.dbo.UserList
       SET OTPDayCount = 0
       WHERE ReferenceId = ${this.propertyId}
       AND UserName = '${loginName}'`,
    );
  }

  async deleteUserSession(loginName: string): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `DELETE FROM GraceSSO.dbo.UserSessionList
       WHERE UserId = (
         SELECT UserId
         FROM GraceSSO.dbo.UserList
         WHERE ReferenceId = ${this.propertyId}
         AND UserName = '${loginName}'
       )`,
    );
  }

  async resetRetryCount(loginName: string): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE GraceSSO.dbo.UserList
       SET RetryCount = 0
       WHERE ReferenceId = ${this.propertyId}
       AND UserName = '${loginName}'`,
    );
  }

  async expirePasswordResetToken(loginName: string): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE GraceSSO.dbo.UserList
       SET IsPasswordResetTokenExpired = 1
       WHERE ReferenceId = ${this.propertyId}
       AND UserName = '${loginName}'`,
    );
  }

  async getRetryCount(loginName: string): Promise<number> {
    const value = await DatabaseUtils.getValue(
      `SELECT RetryCount
       FROM GraceSSO.dbo.UserList
       WHERE ReferenceId = ${this.propertyId}
       AND UserName = '${loginName}'`,
      "RetryCount",
    );

    return value ? Number(value) : 0;
  }

  async retrieveOTP(loginName: string): Promise<string | null> {
    return DatabaseUtils.getValue(
      `SELECT OTP
       FROM GraceSSO.dbo.UserList
       WHERE UserName = '${loginName}'
       AND ReferenceId = ${this.propertyId}`,
      "OTP",
    );
  }

  async getOTPDayCount(loginName: string): Promise<number> {
    const value = await DatabaseUtils.getValue(
      `SELECT OTPDayCount
       FROM GraceSSO.dbo.UserList
       WHERE ReferenceId = ${this.propertyId}
       AND UserName = '${loginName}'`,
      "OTPDayCount",
    );

    return value ? Number(value) : 0;
  }

  async isOTPGeneratedWithinExpiry(loginName: string): Promise<boolean> {
    const value = await DatabaseUtils.getValue(
      `SELECT CASE
                WHEN DATEDIFF(minute, OTPGeneratedDate, GETDATE()) <= 5
                THEN 1
                ELSE 0
              END AS IsValid
       FROM GraceSSO.dbo.UserList
       WHERE ReferenceId = ${this.propertyId}
       AND UserName = '${loginName}'`,
      "IsValid",
    );

    return value === "1";
  }

  async resetSettings(loginName: string): Promise<void> {
    await this.resetRetryCount(loginName);
    await this.deleteUserSession(loginName);
    await this.resetOTPDayCount(loginName);
  }
}
