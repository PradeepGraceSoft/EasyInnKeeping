import { APIRequestContext, request } from "@playwright/test";
import { ConfigManager } from "../utils/ConfigManager";
import { DatabaseUtils } from "../utils/DBHelper/DatabaseUtils";

type UserValidationSession = {
  SessionID: string;
  IpAddress: string;
};

type AuthenticationResponse = Record<string, unknown>;

/** API operations used to manage reservations created by test workflows. */
export class ReservationApi {
  private static readonly authenticationUrl =
    "https://gracebeta.com/PMSUI-TRUNK/auth/api/Auth/Authenticate";
  private static readonly deleteReservationUrl =
    "https://gracebeta.com/PMSUI-test1/mig/webapi/api/Reservation/SaveReservationInit";
  private static readonly deleteGroupReservationUrl =
    "https://gracebeta.com/PMSUI-test1/mig/webapi/api/Group/SaveGroupBlockInit";

  async deleteReservation(confirmNum: string | number): Promise<void> {
    const propertyId = this.getPropertyId();
    const confirmationNumber = this.getConfirmationNumber(confirmNum);
    const session = await this.getLatestSession(propertyId);
    const accessToken = await this.authenticate(propertyId, session);
    const apiContext = await request.newContext({
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    try {
      const response = await apiContext.post(ReservationApi.deleteReservationUrl, {
        data: {
          NameOnAccount: "",
          AccountType: "",
          AccountNumber: "",
          RoutingNumber: "",
          BankName: "",
          EcheckType: "",
          IsEditLockAudit: 0,
          Property: { PropertyID: propertyId },
          ConfirmNum: confirmationNumber,
          PageNo: 1,
          Status: "DELETE",
          Guest: {
            NameOnAccount: "",
            AccountType: "",
            AccountNumber: "",
            RoutingNumber: "",
            BankName: "",
            GuestID: 0,
          },
          Mode: "DELETE",
        },
      });

      if (!response.ok()) {
        throw new Error(
          `Reservation deletion API failed for confirmation ${confirmationNumber}: ${response.status()} ${response.statusText()}`,
        );
      }
    } finally {
      await apiContext.dispose();
    }
  }

  async deleteSharedReservations(primaryConfirmNum: string | number): Promise<void> {
    const propertyId = this.getPropertyId();
    const primaryConfirmationNumber = this.getConfirmationNumber(primaryConfirmNum);
    const sharedConfirmationNumbers = await DatabaseUtils.getValues(
      `SELECT Confirm_num
       FROM Reservation
       WHERE Property_id = ${propertyId}
         AND (Confirm_num = ${primaryConfirmationNumber}
           OR ShareRoomId = ${primaryConfirmationNumber})
       ORDER BY CASE WHEN Confirm_num = ${primaryConfirmationNumber} THEN 1 ELSE 0 END,
                Confirm_num DESC`,
      "Confirm_num",
    );

    for (const confirmationNumber of sharedConfirmationNumbers) {
      await this.deleteReservation(confirmationNumber);
    }
  }

  async deleteGroupReservation(groupCode: string | number): Promise<void> {
    const propertyId = this.getPropertyId();
    const normalizedGroupCode = this.getConfirmationNumber(groupCode);
    const groupName = await DatabaseUtils.getValue(
      `SELECT GroupName
       FROM GroupBlock
       WHERE PropertyID = ${propertyId}
         AND GroupCode = ${normalizedGroupCode}`,
      "GroupName",
    );

    if (!groupName) {
      throw new Error(`Group ${normalizedGroupCode} was not found for deletion.`);
    }

    const session = await this.getLatestSession(propertyId);
    const accessToken = await this.authenticate(propertyId, session);
    const apiContext = await request.newContext({
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    try {
      const response = await apiContext.post(ReservationApi.deleteGroupReservationUrl, {
        data: {
          NameOnAccount: "",
          AccountType: "",
          AccountNumber: "",
          RoutingNumber: "",
          BankName: "",
          EcheckType: "",
          IsEditLockAudit: 0,
          Property: { PropertyID: propertyId },
          GroupName: groupName,
          GroupCode: normalizedGroupCode,
          PageNo: 0,
          Status: "DELETE",
          Guest: {
            NameOnAccount: "",
            AccountType: "",
            AccountNumber: "",
            RoutingNumber: "",
            BankName: "",
            GuestID: 0,
          },
          Mode: "DELETE",
        },
      });

      if (!response.ok()) {
        throw new Error(
          `Group deletion API failed for group ${normalizedGroupCode}: ${response.status()} ${response.statusText()}`,
        );
      }
    } finally {
      await apiContext.dispose();
    }
  }

  private async authenticate(
    propertyId: number,
    session: UserValidationSession,
  ): Promise<string> {
    const credentials = ConfigManager.testData;
    const apiContext = await request.newContext({
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: { "Content-Type": "application/json" },
    });

    try {
      const response = await apiContext.post(ReservationApi.authenticationUrl, {
        data: {
          SessionId: session.SessionID,
          UserName: credentials.loginName,
          PropertyId: String(propertyId),
          IP: session.IpAddress,
          ShortName: credentials.propertyShortName,
          Password: credentials.password,
        },
      });

      if (!response.ok()) {
        throw new Error(
          `Reservation authentication API failed: ${response.status()} ${response.statusText()}`,
        );
      }

      return this.getAccessToken((await response.json()) as AuthenticationResponse);
    } finally {
      await apiContext.dispose();
    }
  }

  private async getLatestSession(propertyId: number): Promise<UserValidationSession> {
    const recentSession = await DatabaseUtils.getRow<UserValidationSession>(
      `SELECT TOP 1 SessionID, IpAddress
       FROM UserValidation
       WHERE PropertyID = ${propertyId}
       AND Logged_Dt > DATEADD(DAY, -1, GETDATE())
       ORDER BY Logged_Dt DESC`,
    );

    if (recentSession?.SessionID && recentSession.IpAddress) {
      return recentSession;
    }

    const session = await DatabaseUtils.getRow<UserValidationSession>(
      `SELECT TOP 1 SessionID, IpAddress
       FROM UserValidation
       WHERE PropertyID = ${propertyId}
       ORDER BY Logged_Dt DESC`,
    );

    if (!session?.SessionID || !session.IpAddress) {
      throw new Error(
        `No session was found for property ${propertyId}.`,
      );
    }

    return session;
  }

  private getAccessToken(response: AuthenticationResponse): string {
    const token = response.accessToken ?? response.AccessToken;
    if (typeof token !== "string" || !token) {
      throw new Error("Authentication response did not include an accessToken.");
    }
    return token;
  }

  private getPropertyId(): number {
    const propertyId = Number(ConfigManager.testData.propertyId);
    if (!Number.isInteger(propertyId) || propertyId <= 0) {
      throw new Error("A valid PropertyID must be configured in config/testdata.env.");
    }
    return propertyId;
  }

  private getConfirmationNumber(confirmNum: string | number): number {
    const confirmationNumber = Number(confirmNum);
    if (!Number.isInteger(confirmationNumber) || confirmationNumber <= 0) {
      throw new Error(`Invalid reservation confirmation number: ${confirmNum}`);
    }
    return confirmationNumber;
  }
}
