import { DatabaseUtils } from "./DatabaseUtils";

export const outboundEmailDisplayNames = [
  "ECONNECT SENDGRID API",
  "ECONNECT POSTMARK SERVER",
  "ECONNECT SMTP POSTMARK",
] as const;

export const OutboundEmailConfigurations = {
  SENDGRID_API: outboundEmailDisplayNames[0],
  POSTMARK_SERVER: outboundEmailDisplayNames[1],
  SMTP_POSTMARK: outboundEmailDisplayNames[2],
} as const;

export type OutboundEmailDisplayName =
  (typeof outboundEmailDisplayNames)[number];

export type OutboundEmailConfigurationState = {
  isActive: boolean;
  isDefault: boolean;
};

export type LeadFieldTextOperator =
  | "Equals"
  | "Not Equals"
  | "Contains"
  | "Starts With"
  | "Ends With";

export type CampaignTextCriterion = {
  fieldName: string;
  operator: LeadFieldTextOperator;
  value: string;
  condition?: CampaignLogicalCondition;
};

export type CampaignLogicalCondition = "AND" | "OR";

export type CampaignTemplateAudience = "Lead" | "Customer" | "Reservation";

export type CampaignAudienceFilterSample = {
  firstName: string;
  lastName: string;
  email: string;
};

export type CampaignFieldFilterSample = {
  firstName: string;
  email: string;
  value: string;
};

export type DefaultEmailConfiguration = {
  displayName: string;
};

export type LeadFilterData = {
  firstName: string;
  lastName: string;
  email: string;
  submissionDate: string;
};

export type OutboundEmailConfigurationSnapshot = Record<
  OutboundEmailDisplayName,
  OutboundEmailConfigurationState
>;

export class CRMEmailTemplateDatabaseHelper {
  async getCampaignTemplateNames(
    companyId: number,
    audience: CampaignTemplateAudience,
  ): Promise<string[]> {
    if (!Number.isInteger(companyId) || companyId <= 0) {
      throw new Error(`Invalid CompanyId: ${companyId}`);
    }

    return DatabaseUtils.getValues(`
      SELECT TemplateName
      FROM EconnectCRM.dbo.EmailTemplate
      WHERE CompanyId = ${companyId}
        AND TemplateType = '${audience}'
      ORDER BY EmailTemplateId DESC
    `, "TemplateName");
  }
}

export class CRMCampaignDatabaseHelper {
  async markCampaignEmailsOpened(campaignName: string): Promise<void> {
    const campaignId = await this.getCampaignId(campaignName);
    await DatabaseUtils.executeUpdate(`
      UPDATE UnifiedInbox.dbo.OutboundEmail
      SET IsRead = 1
      WHERE CampaignId = ${campaignId};

      IF @@ROWCOUNT = 0
        THROW 50001, 'No outbound email was found for the campaign.', 1;
    `);
  }

  private async getCampaignId(campaignName: string): Promise<number> {
    const escapedCampaignName = campaignName.replace(/'/g, "''");
    const campaignId = await DatabaseUtils.getValue(`
      SELECT CampaignId
      FROM UnifiedInbox.dbo.CampaignList
      WHERE CampaignName = '${escapedCampaignName}'
        AND IsDeleted = 0
    `, "CampaignId");

    if (campaignId === null) {
      throw new Error(`Campaign was not found: ${campaignName}`);
    }

    return Number(campaignId);
  }
}

export class CRMLeadDatabaseHelper {
  private readonly originalGuestSynchronization = new Map<number, boolean>();
  private emailConfigurationSnapshot?: OutboundEmailConfigurationSnapshot;
  private static readonly leadStatuses = new Set([
    "Dead",
    "Active",
    "Waiting",
    "Hot",
    "Customer",
    "OnBoarding",
    "In Free Trail",
    "Demo Completed",
    "Qualified",
    "PreQualify",
    "Customer Success Completed",
  ]);

  async setGuestSynchronization(
    propertyId: number,
    enabled: boolean,
  ): Promise<void> {
    if (!Number.isInteger(propertyId) || propertyId <= 0) {
      throw new Error(`Invalid PropertyID: ${propertyId}`);
    }

    if (!this.originalGuestSynchronization.has(propertyId)) {
      this.originalGuestSynchronization.set(
        propertyId,
        await this.getGuestSynchronizationState(propertyId),
      );
    }

    // SyncGuestToCRM is a bit flag: 1 enables PMS -> CRM sync and 0 disables it.
    const syncGuestToCrm = enabled ? 1 : 0;
    await DatabaseUtils.executeUpdate(`
      UPDATE Settings
      SET SyncGuestToCRM = ${syncGuestToCrm}
      WHERE PropertyID = ${propertyId};

      IF @@ROWCOUNT <> 1
        THROW 50001, 'Property settings were not found or were duplicated.', 1;
    `);
  }

  async getGuestSynchronizationState(propertyId: number): Promise<boolean> {
    if (!Number.isInteger(propertyId) || propertyId <= 0) {
      throw new Error(`Invalid PropertyID: ${propertyId}`);
    }

    const value = await DatabaseUtils.getValue(
      `SELECT SyncGuestToCRM FROM Settings WHERE PropertyID = ${propertyId}`,
      "SyncGuestToCRM",
    );

    if (value === null) {
      throw new Error(`Property settings were not found: ${propertyId}`);
    }

    return value === "1" || value.toLowerCase() === "true";
  }

  async activateEmailConfiguration(
    displayName: OutboundEmailDisplayName,
  ): Promise<void> {
    if (!outboundEmailDisplayNames.includes(displayName)) {
      throw new Error(`Unsupported outbound email configuration: ${displayName}`);
    }

    this.emailConfigurationSnapshot ??= await this.getEmailConfigurationSnapshot();

    const configuredDisplayNames = outboundEmailDisplayNames
      .map((name) => `'${name}'`)
      .join(", ");

    await DatabaseUtils.executeUpdate(`
      SET XACT_ABORT ON;
      BEGIN TRANSACTION;

      UPDATE UnifiedInbox.dbo.OutboundEmailConfig
      SET IsDefault = 0,
          IsActive = 0
      WHERE DisplayName IN (${configuredDisplayNames});

      UPDATE UnifiedInbox.dbo.OutboundEmailConfig
      SET IsActive = 1
      WHERE DisplayName = '${displayName}';

      IF @@ROWCOUNT <> 1
        THROW 50001, 'Outbound email configuration was not found or was duplicated.', 1;

      UPDATE UnifiedInbox.dbo.OutboundEmailConfig
      SET IsDefault = 1
      WHERE DisplayName = '${displayName}';

      COMMIT TRANSACTION;
    `);
  }

  async deactivateEmailConfiguration(
    displayName: OutboundEmailDisplayName,
  ): Promise<void> {
    if (!outboundEmailDisplayNames.includes(displayName)) {
      throw new Error(`Unsupported outbound email configuration: ${displayName}`);
    }

    this.emailConfigurationSnapshot ??= await this.getEmailConfigurationSnapshot();

    await DatabaseUtils.executeUpdate(`
      UPDATE UnifiedInbox.dbo.OutboundEmailConfig
      SET IsDefault = 0,
          IsActive = 0
      WHERE DisplayName = '${displayName}';

      IF @@ROWCOUNT <> 1
        THROW 50001, 'Outbound email configuration was not found or was duplicated.', 1;
    `);
  }

  async getEmailConfigurationState(
    displayName: OutboundEmailDisplayName,
  ): Promise<OutboundEmailConfigurationState> {
    if (!outboundEmailDisplayNames.includes(displayName)) {
      throw new Error(`Unsupported outbound email configuration: ${displayName}`);
    }

    const state = await DatabaseUtils.getRow<{
      IsActive: boolean;
      IsDefault: boolean;
    }>(`
      SELECT IsActive, IsDefault
      FROM UnifiedInbox.dbo.OutboundEmailConfig
      WHERE DisplayName = '${displayName}'
    `);

    if (!state) {
      throw new Error(`Outbound email configuration was not found: ${displayName}`);
    }

    return {
      isActive: Boolean(state.IsActive),
      isDefault: Boolean(state.IsDefault),
    };
  }

  async getEmailConfigurationSnapshot(): Promise<OutboundEmailConfigurationSnapshot> {
    const entries = await Promise.all(
      outboundEmailDisplayNames.map(async (displayName) => [
        displayName,
        await this.getEmailConfigurationState(displayName),
      ] as const),
    );

    return Object.fromEntries(entries) as OutboundEmailConfigurationSnapshot;
  }

  async restoreEmailConfigurationSnapshot(
    snapshot: OutboundEmailConfigurationSnapshot,
  ): Promise<void> {
    const updates = outboundEmailDisplayNames.map((displayName) => {
      const state = snapshot[displayName];
      return `
        UPDATE UnifiedInbox.dbo.OutboundEmailConfig
        SET IsActive = ${state.isActive ? 1 : 0},
            IsDefault = ${state.isDefault ? 1 : 0}
        WHERE DisplayName = '${displayName}';

        IF @@ROWCOUNT <> 1
          THROW 50001, 'Outbound email configuration was not found or was duplicated.', 1;
      `;
    }).join("\n");

    await DatabaseUtils.executeUpdate(`
      SET XACT_ABORT ON;
      BEGIN TRANSACTION;
      ${updates}
      COMMIT TRANSACTION;
    `);
  }

  async restoreTrackedState(): Promise<void> {
    for (const [propertyId, enabled] of this.originalGuestSynchronization) {
      await DatabaseUtils.executeUpdate(`
        UPDATE Settings
        SET SyncGuestToCRM = ${enabled ? 1 : 0}
        WHERE PropertyID = ${propertyId}
      `);
    }
    this.originalGuestSynchronization.clear();

    if (this.emailConfigurationSnapshot) {
      await this.restoreEmailConfigurationSnapshot(this.emailConfigurationSnapshot);
      this.emailConfigurationSnapshot = undefined;
    }
  }

  async updateLeadCreatedOn(
    companyId: number,
    email: string,
    createdOn: string,
  ): Promise<void> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(createdOn)) {
      throw new Error(`Invalid CreatedOn date: ${createdOn}`);
    }

    const escapedEmail = email.replace(/'/g, "''");
    await DatabaseUtils.executeUpdate(`
      UPDATE EconnectCRM.dbo.LeadList
      SET CreatedOn = '${createdOn} 01:34:41.8832191'
      WHERE CompanyId = ${companyId}
        AND LeadType = 1
        AND IsDeleted = 0
        AND EmailId = '${escapedEmail}'
    `);
  }

  async getDefaultEmailConfiguration(): Promise<DefaultEmailConfiguration> {
    const configuration = await DatabaseUtils.getRow<DefaultEmailConfiguration>(`
      SELECT TOP 1 DisplayName AS displayName
      FROM UnifiedInbox.dbo.OutboundEmailConfig
      WHERE IsActive = 1
        AND IsDefault = 1
    `);
    if (!configuration) {
      throw new Error("No active default outbound email configuration was found");
    }
    return configuration;
  }

  async updateLeadStatus(
    companyId: number,
    email: string,
    statusName: string,
  ): Promise<void> {
    if (!Number.isInteger(companyId)) {
      throw new Error(`Invalid CompanyId: ${companyId}`);
    }
    if (!CRMLeadDatabaseHelper.leadStatuses.has(statusName)) {
      throw new Error(`Invalid lead status: ${statusName}`);
    }

    const escapedEmail = email.replace(/'/g, "''");
    await DatabaseUtils.executeUpdate(`
      UPDATE EconnectCRM.dbo.LeadList
      SET StatusId = (
        SELECT StatusId
        FROM EconnectCRM.dbo.StatusList
        WHERE CompanyId = ${companyId}
          AND StatusName = '${statusName}'
      )
      WHERE CompanyId = ${companyId}
        AND LeadType = 1
        AND IsDeleted = 0
        AND EmailId = '${escapedEmail}'
    `);
  }

  async getLeadFilterData(
    companyId: number,
    email: string,
  ): Promise<LeadFilterData> {
    if (!Number.isInteger(companyId) || companyId <= 0) {
      throw new Error(`Invalid CompanyId: ${companyId}`);
    }

    const escapedEmail = email.replace(/'/g, "''");
    const lead = await DatabaseUtils.getRow<LeadFilterData>(`
      SELECT
        lead.ContactName AS firstName,
        lastName.FieldValue AS lastName,
        lead.EmailId AS email,
        CONVERT(varchar(10), lead.CreatedOn, 101) AS submissionDate
      FROM EconnectCRM.dbo.LeadList AS lead
      INNER JOIN EconnectCRM.dbo.LeadFieldsValues AS lastName
        ON lastName.LeadId = lead.LeadId
        AND lastName.IsDeleted = 0
      INNER JOIN EconnectCRM.dbo.CustomFields AS field
        ON field.FieldId = lastName.FieldId
        AND field.CompanyId = ${companyId}
        AND field.FieldName = 'Last Name'
        AND field.FormType = 'Lead'
      WHERE lead.CompanyId = ${companyId}
        AND lead.LeadType = 1
        AND lead.IsDeleted = 0
        AND lead.EmailId = '${escapedEmail}'
    `);

    if (!lead) {
      throw new Error(`Lead with email "${email}" was not found`);
    }
    return lead;
  }

  async getLeadCountByEmail(companyId: number, email: string): Promise<number> {
    if (!Number.isInteger(companyId) || companyId <= 0) {
      throw new Error(`Invalid CompanyId: ${companyId}`);
    }

    const escapedEmail = email.replace(/'/g, "''");
    const count = await DatabaseUtils.getValue(`
      SELECT COUNT(*) AS LeadCount
      FROM EconnectCRM.dbo.LeadList
      WHERE CompanyId = ${companyId}
        AND LeadType = 1
        AND IsDeleted = 0
        AND EmailId = '${escapedEmail}'
    `, "LeadCount");
    if (count === null) throw new Error(`Lead count was not returned for "${email}"`);
    return Number(count);
  }

  async getCustomFieldValueCount(
    companyId: number,
    fieldName: string,
    fieldValue: string,
    includeMatchingValues: boolean,
  ): Promise<number> {
    if (!Number.isInteger(companyId) || companyId <= 0) {
      throw new Error(`Invalid CompanyId: ${companyId}`);
    }

    const escapedFieldName = fieldName.replace(/'/g, "''");
    const escapedFieldValue = fieldValue.replace(/'/g, "''");
    const valueCondition = includeMatchingValues
      ? `FieldValue = '${escapedFieldValue}'`
      : `(FieldValue <> '${escapedFieldValue}' OR FieldValue IS NULL)`;
    const count = await DatabaseUtils.getValue(
      `
        SELECT COUNT(*) AS FieldValueCount
        FROM EconnectCRM.dbo.LeadFieldsValues
        WHERE FieldId = (
          SELECT FieldId
          FROM EconnectCRM.dbo.CustomFields
          WHERE CompanyId = ${companyId}
            AND FieldName = '${escapedFieldName}'
            AND FormType = 'Lead'
        )
          AND IsDeleted = 0
          AND ${valueCondition}
      `,
      "FieldValueCount",
    );

    if (count === null) {
      throw new Error("Custom field value count was not returned by the database");
    }

    return Number(count);
  }

  async getLeadFirstNameCount(
    companyId: number,
    firstName: string,
    includeMatchingValues: boolean,
  ): Promise<number> {
    if (!Number.isInteger(companyId) || companyId <= 0) {
      throw new Error(`Invalid CompanyId: ${companyId}`);
    }

    const escapedFirstName = firstName.replace(/'/g, "''");
    const valueCondition = includeMatchingValues
      ? `ContactName = '${escapedFirstName}'`
      : `(ContactName <> '${escapedFirstName}' OR ContactName IS NULL)`;
    const count = await DatabaseUtils.getValue(
      `
        SELECT COUNT(*) AS LeadCount
        FROM EconnectCRM.dbo.LeadList
        WHERE CompanyId = ${companyId}
          AND LeadType = 1
          AND IsDeleted = 0
          AND ${valueCondition}
      `,
      "LeadCount",
    );

    if (count === null) {
      throw new Error("Lead first-name count was not returned by the database");
    }

    return Number(count);
  }

  async getLeadFieldSampleValue(
    companyId: number,
    fieldName: string,
  ): Promise<string | null> {
    if (!Number.isInteger(companyId) || companyId <= 0) {
      throw new Error(`Invalid CompanyId: ${companyId}`);
    }

    const escapedFieldName = fieldName.replace(/'/g, "''");
    const leadColumn = this.getLeadColumn(fieldName);
    const value = leadColumn
      ? await DatabaseUtils.getValue(
        `
          SELECT TOP 1 lead.[${leadColumn}] AS FieldValue
          FROM EconnectCRM.dbo.LeadList AS lead
          WHERE lead.CompanyId = ${companyId}
            AND lead.LeadType = 1
            AND lead.IsDeleted = 0
            AND lead.EmailId IS NOT NULL
            AND LTRIM(RTRIM(lead.EmailId)) <> ''
            AND lead.[${leadColumn}] IS NOT NULL
            AND LTRIM(RTRIM(CONVERT(nvarchar(max), lead.[${leadColumn}]))) <> ''
          ORDER BY NEWID()
        `,
        "FieldValue",
      )
      : await DatabaseUtils.getValue(
        `
          SELECT TOP 1 fieldValue.FieldValue
          FROM EconnectCRM.dbo.LeadFieldsValues AS fieldValue
          INNER JOIN EconnectCRM.dbo.LeadList AS lead
            ON lead.LeadId = fieldValue.LeadId
          WHERE fieldValue.FieldId = (
            SELECT FieldId
            FROM EconnectCRM.dbo.CustomFields
            WHERE CompanyId = ${companyId}
              AND FieldName = '${escapedFieldName}'
              AND FormType = 'Lead'
          )
            AND fieldValue.IsDeleted = 0
            AND fieldValue.FieldValue IS NOT NULL
            AND fieldValue.FieldValue <> ''
            AND lead.CompanyId = ${companyId}
            AND lead.LeadType = 1
            AND lead.IsDeleted = 0
            AND lead.EmailId IS NOT NULL
            AND LTRIM(RTRIM(lead.EmailId)) <> ''
          ORDER BY NEWID()
        `,
        "FieldValue",
      );

    return value;
  }

  async getLeadFieldRecipientCount(
    companyId: number,
    fieldName: string,
    operator: LeadFieldTextOperator,
    value: string,
  ): Promise<number> {
    if (!Number.isInteger(companyId) || companyId <= 0) {
      throw new Error(`Invalid CompanyId: ${companyId}`);
    }

    const escapedFieldName = fieldName.replace(/'/g, "''");
    const condition = this.getTextOperatorCondition(operator, value);
    const leadColumn = this.getLeadColumn(fieldName);
    const fieldValueCondition = operator === "Not Equals"
      ? `fieldValue.FieldValue = '${value.replace(/'/g, "''")}'`
      : condition.replace(/FieldValue/g, "fieldValue.FieldValue");
    const query = leadColumn
      ? `
        SELECT COUNT(DISTINCT lead.LeadId) AS RecipientCount
        FROM EconnectCRM.dbo.LeadList AS lead
        WHERE lead.CompanyId = ${companyId}
          AND lead.LeadType = 1
          AND lead.IsDeleted = 0
          AND lead.EmailId IS NOT NULL
          AND LTRIM(RTRIM(lead.EmailId)) <> ''
          AND ${condition.replace(/FieldValue/g, `lead.[${leadColumn}]`)}
      `
      : `
        SELECT COUNT(DISTINCT lead.LeadId) AS RecipientCount
        FROM EconnectCRM.dbo.LeadList AS lead
        WHERE lead.CompanyId = ${companyId}
          AND lead.LeadType = 1
          AND lead.IsDeleted = 0
          AND lead.EmailId IS NOT NULL
          AND LTRIM(RTRIM(lead.EmailId)) <> ''
          AND ${operator === "Not Equals" ? "NOT EXISTS" : "EXISTS"} (
            SELECT 1
            FROM EconnectCRM.dbo.LeadFieldsValues AS fieldValue
            WHERE fieldValue.LeadId = lead.LeadId
              AND fieldValue.FieldId = (
                SELECT FieldId
                FROM EconnectCRM.dbo.CustomFields
                WHERE CompanyId = ${companyId}
                  AND FieldName = '${escapedFieldName}'
                  AND FormType = 'Lead'
              )
              AND fieldValue.IsDeleted = 0
              AND ${fieldValueCondition}
          )
      `;
    const count = await DatabaseUtils.getValue(query, "RecipientCount");

    if (count === null) {
      throw new Error(`Recipient count was not returned for Lead field "${fieldName}"`);
    }

    return Number(count);
  }

  async getLeadAudienceFilterSample(
    companyId: number,
  ): Promise<CampaignAudienceFilterSample | null> {
    if (!Number.isInteger(companyId) || companyId <= 0) {
      throw new Error(`Invalid CompanyId: ${companyId}`);
    }

    return DatabaseUtils.getRow<CampaignAudienceFilterSample>(`
      SELECT TOP 1
        lead.ContactName AS firstName,
        fieldValue.FieldValue AS lastName,
        lead.EmailId AS email
      FROM EconnectCRM.dbo.LeadList AS lead
      INNER JOIN EconnectCRM.dbo.LeadFieldsValues AS fieldValue
        ON fieldValue.LeadId = lead.LeadId
        AND fieldValue.IsDeleted = 0
      INNER JOIN EconnectCRM.dbo.CustomFields AS field
        ON field.FieldId = fieldValue.FieldId
        AND field.CompanyId = ${companyId}
        AND field.FieldName = 'Last Name'
        AND field.FormType = 'Lead'
      WHERE lead.CompanyId = ${companyId}
        AND lead.LeadType = 1
        AND lead.IsDeleted = 0
        AND lead.EmailId IS NOT NULL
        AND LTRIM(RTRIM(lead.EmailId)) <> ''
        AND lead.ContactName IS NOT NULL
        AND LTRIM(RTRIM(lead.ContactName)) <> ''
        AND fieldValue.FieldValue IS NOT NULL
        AND LTRIM(RTRIM(fieldValue.FieldValue)) <> ''
      ORDER BY NEWID()
    `);
  }

  async getLeadAudienceFieldSample(
    companyId: number,
    fieldName: string,
  ): Promise<CampaignFieldFilterSample | null> {
    if (!Number.isInteger(companyId) || companyId <= 0) {
      throw new Error(`Invalid CompanyId: ${companyId}`);
    }

    const leadColumn = this.getLeadColumn(fieldName);
    if (leadColumn) {
      return DatabaseUtils.getRow<CampaignFieldFilterSample>(`
        SELECT TOP 1
          lead.ContactName AS firstName,
          lead.EmailId AS email,
          lead.[${leadColumn}] AS value
        FROM EconnectCRM.dbo.LeadList AS lead
        WHERE lead.CompanyId = ${companyId}
          AND lead.LeadType = 1
          AND lead.IsDeleted = 0
          AND lead.EmailId IS NOT NULL
          AND LTRIM(RTRIM(lead.EmailId)) <> ''
          AND lead.ContactName IS NOT NULL
          AND LTRIM(RTRIM(lead.ContactName)) <> ''
          AND lead.[${leadColumn}] IS NOT NULL
          AND LTRIM(RTRIM(CONVERT(nvarchar(max), lead.[${leadColumn}]))) <> ''
        ORDER BY NEWID()
      `);
    }

    const escapedFieldName = fieldName.replace(/'/g, "''");
    return DatabaseUtils.getRow<CampaignFieldFilterSample>(`
      SELECT TOP 1
        lead.ContactName AS firstName,
        lead.EmailId AS email,
        fieldValue.FieldValue AS value
      FROM EconnectCRM.dbo.LeadList AS lead
      INNER JOIN EconnectCRM.dbo.LeadFieldsValues AS fieldValue
        ON fieldValue.LeadId = lead.LeadId
        AND fieldValue.IsDeleted = 0
      INNER JOIN EconnectCRM.dbo.CustomFields AS field
        ON field.FieldId = fieldValue.FieldId
        AND field.CompanyId = ${companyId}
        AND field.FieldName = '${escapedFieldName}'
        AND field.FormType = 'Lead'
      WHERE lead.CompanyId = ${companyId}
        AND lead.LeadType = 1
        AND lead.IsDeleted = 0
        AND lead.EmailId IS NOT NULL
        AND LTRIM(RTRIM(lead.EmailId)) <> ''
        AND lead.ContactName IS NOT NULL
        AND LTRIM(RTRIM(lead.ContactName)) <> ''
        AND fieldValue.FieldValue IS NOT NULL
        AND LTRIM(RTRIM(fieldValue.FieldValue)) <> ''
      ORDER BY NEWID()
    `);
  }

  async getLeadAudienceRecipientCount(
    companyId: number,
    criteria: ReadonlyArray<CampaignTextCriterion>,
  ): Promise<number> {
    if (!Number.isInteger(companyId) || companyId <= 0) {
      throw new Error(`Invalid CompanyId: ${companyId}`);
    }
    if (criteria.length < 2) {
      throw new Error("At least two audience criteria are required");
    }

    const conditions = this.combineLeadAudienceConditions(companyId, criteria);
    const count = await DatabaseUtils.getValue(`
      SELECT COUNT(DISTINCT lead.LeadId) AS RecipientCount
      FROM EconnectCRM.dbo.LeadList AS lead
      WHERE lead.CompanyId = ${companyId}
        AND lead.LeadType = 1
        AND lead.IsDeleted = 0
        AND lead.EmailId IS NOT NULL
        AND LTRIM(RTRIM(lead.EmailId)) <> ''
        AND (${conditions})
    `, "RecipientCount");

    if (count === null) {
      throw new Error("Lead audience recipient count was not returned by the database");
    }

    return Number(count);
  }

  async addLeadFieldValue(
    companyId: number,
    leadEmail: string,
    fieldName: string,
    fieldValue: string,
  ): Promise<void> {
    const escapedEmail = leadEmail.replace(/'/g, "''");
    const escapedFieldName = fieldName.replace(/'/g, "''");
    const escapedFieldValue = fieldValue.replace(/'/g, "''");
    await DatabaseUtils.executeUpdate(`
      DECLARE @LeadId INT = (
        SELECT TOP 1 LeadId
        FROM EconnectCRM.dbo.LeadList
        WHERE CompanyId = ${companyId}
          AND LeadType = 1
          AND IsDeleted = 0
          AND EmailId = '${escapedEmail}'
        ORDER BY LeadId DESC
      );
      DECLARE @FieldId INT = (
        SELECT FieldId
        FROM EconnectCRM.dbo.CustomFields
        WHERE CompanyId = ${companyId}
          AND FieldName = '${escapedFieldName}'
          AND FormType = 'Lead'
      );

      IF @LeadId IS NULL OR @FieldId IS NULL
        THROW 50001, 'Lead or Lead field was not found.', 1;

      INSERT INTO EconnectCRM.dbo.LeadFieldsValues (
        LeadId, FieldId, FieldValue, CreatedAt, IsDeleted
      ) VALUES (
        @LeadId, @FieldId, '${escapedFieldValue}', GETUTCDATE(), 0
      );
    `);
  }

  private getTextOperatorCondition(
    operator: LeadFieldTextOperator,
    value: string,
  ): string {
    const escapedValue = value.replace(/'/g, "''");
    const likeValue = escapedValue
      .replace(/\\/g, "\\\\")
      .replace(/%/g, "\\%")
      .replace(/_/g, "\\_")
      .replace(/\[/g, "\\[");

    switch (operator) {
      case "Equals":
        return `FieldValue = '${escapedValue}'`;
      case "Not Equals":
        return `(FieldValue <> '${escapedValue}' OR FieldValue IS NULL)`;
      case "Contains":
        return `FieldValue LIKE '%${likeValue}%' ESCAPE '\\'`;
      case "Starts With":
        return `FieldValue LIKE '${likeValue}%' ESCAPE '\\'`;
      case "Ends With":
        return `FieldValue LIKE '%${likeValue}' ESCAPE '\\'`;
    }
  }

  private getLeadColumn(fieldName: string): string | null {
    if (fieldName === "First Name") return "ContactName";
    if (fieldName === "Email Address") return "EmailId";
    return null;
  }

  private getLeadAudienceCondition(
    companyId: number,
    criterion: CampaignTextCriterion,
  ): string {
    const leadColumn = this.getLeadColumn(criterion.fieldName);
    const condition = this.getTextOperatorCondition(criterion.operator, criterion.value);
    if (leadColumn) {
      return condition.replace(/FieldValue/g, `lead.[${leadColumn}]`);
    }

    const escapedFieldName = criterion.fieldName.replace(/'/g, "''");
    const fieldValueCondition = criterion.operator === "Not Equals"
      ? `fieldValue.FieldValue = '${criterion.value.replace(/'/g, "''")}'`
      : condition.replace(/FieldValue/g, "fieldValue.FieldValue");
    return `${criterion.operator === "Not Equals" ? "NOT EXISTS" : "EXISTS"} (
      SELECT 1
      FROM EconnectCRM.dbo.LeadFieldsValues AS fieldValue
      WHERE fieldValue.LeadId = lead.LeadId
        AND fieldValue.FieldId = (
          SELECT FieldId
          FROM EconnectCRM.dbo.CustomFields
          WHERE CompanyId = ${companyId}
            AND FieldName = '${escapedFieldName}'
            AND FormType = 'Lead'
        )
        AND fieldValue.IsDeleted = 0
        AND ${fieldValueCondition}
    )`;
  }

  private combineLeadAudienceConditions(
    companyId: number,
    criteria: ReadonlyArray<CampaignTextCriterion>,
  ): string {
    return criteria
      .map((criterion, index) => {
        const condition = this.getLeadAudienceCondition(companyId, criterion);
        if (index === 0) return condition;
        const connector = criterion.condition ?? "AND";
        return `${connector} ${condition}`;
      })
      .join("\n          ");
  }
}

export class CRMCustomerDatabaseHelper {
  private readonly originalAdditionalGuest = new Map<number, boolean>();
  private static readonly leadStatuses = new Set([
    "Dead",
    "Active",
    "Waiting",
    "Hot",
    "Customer",
    "OnBoarding",
    "In Free Trail",
    "Demo Completed",
    "Qualified",
    "PreQualify",
    "Customer Success Completed",
  ]);

  async deleteCustomerByEmail(companyId: number, email: string): Promise<void> {
    if (!Number.isInteger(companyId) || companyId <= 0) {
      throw new Error(`Invalid CompanyId: ${companyId}`);
    }

    const escapedEmail = email.replace(/'/g, "''");
    await DatabaseUtils.executeUpdate(`
      DELETE FROM EconnectCRM.dbo.CustomerFieldsValue
      WHERE LeadId IN (
        SELECT LeadId
        FROM EconnectCRM.dbo.LeadList
        WHERE CompanyId = ${companyId}
          AND EmailId = '${escapedEmail}'
          AND LeadType = 2
      );

      DELETE FROM EconnectCRM.dbo.LeadList
      WHERE CompanyId = ${companyId}
        AND EmailId = '${escapedEmail}'
        AND LeadType = 2
    `);
  }

  async customerExistsByEmail(companyId: number, email: string): Promise<boolean> {
    if (!Number.isInteger(companyId) || companyId <= 0) {
      throw new Error(`Invalid CompanyId: ${companyId}`);
    }

    const escapedEmail = email.replace(/'/g, "''");
    const count = await DatabaseUtils.getValue(
      `
        SELECT COUNT(*) AS CustomerCount
        FROM EconnectCRM.dbo.LeadList
        WHERE CompanyId = ${companyId}
          AND EmailId = '${escapedEmail}'
          AND LeadType = 2
          AND IsDeleted = 0
      `,
      "CustomerCount",
    );
    return Number(count) > 0;
  }

  async updateCustomerCreatedOn(
    companyId: number,
    email: string,
    createdOn: string,
  ): Promise<void> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(createdOn)) {
      throw new Error(`Invalid CreatedOn date: ${createdOn}`);
    }

    if (!Number.isInteger(companyId) || companyId <= 0) {
      throw new Error(`Invalid CompanyId: ${companyId}`);
    }

    const escapedEmail = email.replace(/'/g, "''");
    await DatabaseUtils.executeUpdate(`
      UPDATE EconnectCRM.dbo.LeadList
      SET CreatedOn = '${createdOn} 01:34:41.8832191'
      WHERE CompanyId = ${companyId}
        AND LeadType = 2
        AND IsDeleted = 0
        AND EmailId = '${escapedEmail}'
    `);
  }

  async updateCustomerStatus(
    companyId: number,
    email: string,
    statusName: string,
  ): Promise<void> {
    if (!Number.isInteger(companyId)) {
      throw new Error(`Invalid CompanyId: ${companyId}`);
    }
    if (!CRMCustomerDatabaseHelper.leadStatuses.has(statusName)) {
      throw new Error(`Invalid lead status: ${statusName}`);
    }

    const escapedEmail = email.replace(/'/g, "''");
    await DatabaseUtils.executeUpdate(`
      UPDATE EconnectCRM.dbo.LeadList
      SET StatusId = (
        SELECT StatusId
        FROM EconnectCRM.dbo.StatusList
        WHERE CompanyId = ${companyId}
          AND StatusName = '${statusName}'
      )
      WHERE CompanyId = ${companyId}
        AND LeadType = 2
        AND IsDeleted = 0
        AND EmailId = '${escapedEmail}'
    `);
  }

  async setAdditionalGuest(propertyId: number, enabled: boolean): Promise<void> {
    if (!Number.isInteger(propertyId)) {
      throw new Error(`Invalid PropertyID: ${propertyId}`);
    }

    if (!this.originalAdditionalGuest.has(propertyId)) {
      this.originalAdditionalGuest.set(
        propertyId,
        await this.getAdditionalGuestState(propertyId),
      );
    }

    await DatabaseUtils.executeUpdate(`
      UPDATE Settings
      SET AdditionalGuest = ${enabled ? 1 : 0}
      WHERE PropertyID = ${propertyId}
    `);
  }

  async getAdditionalGuestState(propertyId: number): Promise<boolean> {
    if (!Number.isInteger(propertyId) || propertyId <= 0) {
      throw new Error(`Invalid PropertyID: ${propertyId}`);
    }

    const value = await DatabaseUtils.getValue(
      `SELECT AdditionalGuest FROM Settings WHERE PropertyID = ${propertyId}`,
      "AdditionalGuest",
    );

    if (value === null) {
      throw new Error(`Property settings were not found: ${propertyId}`);
    }

    return value === "1" || value.toLowerCase() === "true";
  }

  async getCustomerFieldSampleValue(
    companyId: number,
    fieldName: string,
  ): Promise<string | null> {
    if (!Number.isInteger(companyId) || companyId <= 0) {
      throw new Error(`Invalid CompanyId: ${companyId}`);
    }

    const escapedFieldName = fieldName.replace(/'/g, "''");
    const formType = this.getCampaignCustomerFormType(fieldName);
    const leadColumn = this.getCustomerLeadColumn(fieldName);
    const value = leadColumn
      ? await DatabaseUtils.getValue(
        `
          SELECT TOP 1 customer.[${leadColumn}] AS FieldValue
          FROM EconnectCRM.dbo.LeadList AS customer
          WHERE customer.CompanyId = ${companyId}
            AND customer.LeadType = 2
            AND customer.IsDeleted = 0
            AND customer.EmailId IS NOT NULL
            AND LTRIM(RTRIM(customer.EmailId)) <> ''
            AND customer.[${leadColumn}] IS NOT NULL
            AND LTRIM(RTRIM(CONVERT(nvarchar(max), customer.[${leadColumn}]))) <> ''
          ORDER BY NEWID()
        `,
        "FieldValue",
      )
      : await DatabaseUtils.getValue(
        `
          SELECT TOP 1 fieldValue.FieldValue
          FROM EconnectCRM.dbo.CustomerFieldsValue AS fieldValue
          INNER JOIN EconnectCRM.dbo.LeadList AS customer
            ON customer.LeadId = fieldValue.LeadId
          WHERE fieldValue.FieldId = (
            SELECT FieldId
            FROM EconnectCRM.dbo.CustomFields
            WHERE CompanyId = ${companyId}
              AND FieldName = '${escapedFieldName}'
              AND FormType = '${formType}'
          )
            AND fieldValue.IsDeleted = 0
            AND fieldValue.FieldValue IS NOT NULL
            AND fieldValue.FieldValue <> ''
            AND customer.CompanyId = ${companyId}
            AND customer.LeadType = 2
            AND customer.IsDeleted = 0
            AND customer.EmailId IS NOT NULL
            AND LTRIM(RTRIM(customer.EmailId)) <> ''
          ORDER BY NEWID()
        `,
        "FieldValue",
      );

    return value;
  }

  async getCustomerFieldRecipientCount(
    companyId: number,
    fieldName: string,
    operator: LeadFieldTextOperator,
    value: string,
  ): Promise<number> {
    if (!Number.isInteger(companyId) || companyId <= 0) {
      throw new Error(`Invalid CompanyId: ${companyId}`);
    }

    const escapedFieldName = fieldName.replace(/'/g, "''");
    const formType = this.getCampaignCustomerFormType(fieldName);
    const condition = this.getTextOperatorCondition(operator, value);
    const leadColumn = this.getCustomerLeadColumn(fieldName);
    const fieldValueCondition = operator === "Not Equals"
      ? `fieldValue.FieldValue = '${value.replace(/'/g, "''")}'`
      : condition.replace(/FieldValue/g, "fieldValue.FieldValue");
    const query = leadColumn
      ? `
        SELECT COUNT(DISTINCT customer.LeadId) AS RecipientCount
        FROM EconnectCRM.dbo.LeadList AS customer
        WHERE customer.CompanyId = ${companyId}
          AND customer.LeadType = 2
          AND customer.IsDeleted = 0
          AND customer.EmailId IS NOT NULL
          AND LTRIM(RTRIM(customer.EmailId)) <> ''
          AND ${condition.replace(/FieldValue/g, `customer.[${leadColumn}]`)}
      `
      : `
        SELECT COUNT(DISTINCT customer.LeadId) AS RecipientCount
        FROM EconnectCRM.dbo.LeadList AS customer
        WHERE customer.CompanyId = ${companyId}
          AND customer.LeadType = 2
          AND customer.IsDeleted = 0
          AND customer.EmailId IS NOT NULL
          AND LTRIM(RTRIM(customer.EmailId)) <> ''
          AND ${operator === "Not Equals" ? `NOT EXISTS` : "EXISTS"} (
            SELECT 1
            FROM EconnectCRM.dbo.CustomerFieldsValue AS fieldValue
            WHERE fieldValue.LeadId = customer.LeadId
              AND fieldValue.FieldId = (
                SELECT FieldId
                FROM EconnectCRM.dbo.CustomFields
                WHERE CompanyId = ${companyId}
                  AND FieldName = '${escapedFieldName}'
                  AND FormType = '${formType}'
              )
              AND fieldValue.IsDeleted = 0
              AND ${fieldValueCondition}
          )
      `;
    const count = await DatabaseUtils.getValue(query, "RecipientCount");

    if (count === null) {
      throw new Error(`Recipient count was not returned for Customer field "${fieldName}"`);
    }

    return Number(count);
  }

  async getCustomerAudienceFilterSample(
    companyId: number,
  ): Promise<CampaignAudienceFilterSample | null> {
    if (!Number.isInteger(companyId) || companyId <= 0) {
      throw new Error(`Invalid CompanyId: ${companyId}`);
    }

    return DatabaseUtils.getRow<CampaignAudienceFilterSample>(`
      SELECT TOP 1
        customer.ContactName AS firstName,
        fieldValue.FieldValue AS lastName,
        customer.EmailId AS email
      FROM EconnectCRM.dbo.LeadList AS customer
      INNER JOIN EconnectCRM.dbo.CustomerFieldsValue AS fieldValue
        ON fieldValue.LeadId = customer.LeadId
        AND fieldValue.IsDeleted = 0
      INNER JOIN EconnectCRM.dbo.CustomFields AS field
        ON field.FieldId = fieldValue.FieldId
        AND field.CompanyId = ${companyId}
        AND field.FieldName = 'Last Name'
        AND field.FormType = 'Customer'
      WHERE customer.CompanyId = ${companyId}
        AND customer.LeadType = 2
        AND customer.IsDeleted = 0
        AND customer.EmailId IS NOT NULL
        AND LTRIM(RTRIM(customer.EmailId)) <> ''
        AND customer.ContactName IS NOT NULL
        AND LTRIM(RTRIM(customer.ContactName)) <> ''
        AND fieldValue.FieldValue IS NOT NULL
        AND LTRIM(RTRIM(fieldValue.FieldValue)) <> ''
      ORDER BY NEWID()
    `);
  }

  async getCustomerAudienceFieldSample(
    companyId: number,
    fieldName: string,
  ): Promise<CampaignFieldFilterSample | null> {
    if (!Number.isInteger(companyId) || companyId <= 0) {
      throw new Error(`Invalid CompanyId: ${companyId}`);
    }

    const leadColumn = this.getCustomerLeadColumn(fieldName);
    if (leadColumn) {
      return DatabaseUtils.getRow<CampaignFieldFilterSample>(`
        SELECT TOP 1
          customer.ContactName AS firstName,
          customer.EmailId AS email,
          customer.[${leadColumn}] AS value
        FROM EconnectCRM.dbo.LeadList AS customer
        WHERE customer.CompanyId = ${companyId}
          AND customer.LeadType = 2
          AND customer.IsDeleted = 0
          AND customer.EmailId IS NOT NULL
          AND LTRIM(RTRIM(customer.EmailId)) <> ''
          AND customer.ContactName IS NOT NULL
          AND LTRIM(RTRIM(customer.ContactName)) <> ''
          AND customer.[${leadColumn}] IS NOT NULL
          AND LTRIM(RTRIM(CONVERT(nvarchar(max), customer.[${leadColumn}]))) <> ''
        ORDER BY NEWID()
      `);
    }

    const escapedFieldName = fieldName.replace(/'/g, "''");
    return DatabaseUtils.getRow<CampaignFieldFilterSample>(`
      SELECT TOP 1
        customer.ContactName AS firstName,
        customer.EmailId AS email,
        fieldValue.FieldValue AS value
      FROM EconnectCRM.dbo.LeadList AS customer
      INNER JOIN EconnectCRM.dbo.CustomerFieldsValue AS fieldValue
        ON fieldValue.LeadId = customer.LeadId
        AND fieldValue.IsDeleted = 0
      INNER JOIN EconnectCRM.dbo.CustomFields AS field
        ON field.FieldId = fieldValue.FieldId
        AND field.CompanyId = ${companyId}
        AND field.FieldName = '${escapedFieldName}'
        AND field.FormType = 'Customer'
      WHERE customer.CompanyId = ${companyId}
        AND customer.LeadType = 2
        AND customer.IsDeleted = 0
        AND customer.EmailId IS NOT NULL
        AND LTRIM(RTRIM(customer.EmailId)) <> ''
        AND customer.ContactName IS NOT NULL
        AND LTRIM(RTRIM(customer.ContactName)) <> ''
        AND fieldValue.FieldValue IS NOT NULL
        AND LTRIM(RTRIM(fieldValue.FieldValue)) <> ''
      ORDER BY NEWID()
    `);
  }

  async getCustomerAudienceRecipientCount(
    companyId: number,
    criteria: ReadonlyArray<CampaignTextCriterion>,
  ): Promise<number> {
    if (!Number.isInteger(companyId) || companyId <= 0) {
      throw new Error(`Invalid CompanyId: ${companyId}`);
    }
    if (criteria.length < 2) {
      throw new Error("At least two audience criteria are required");
    }

    const conditions = this.combineCustomerAudienceConditions(companyId, criteria);
    const count = await DatabaseUtils.getValue(`
      SELECT COUNT(DISTINCT customer.LeadId) AS RecipientCount
      FROM EconnectCRM.dbo.LeadList AS customer
      WHERE customer.CompanyId = ${companyId}
        AND customer.LeadType = 2
        AND customer.IsDeleted = 0
        AND customer.EmailId IS NOT NULL
        AND LTRIM(RTRIM(customer.EmailId)) <> ''
        AND (${conditions})
    `, "RecipientCount");

    if (count === null) {
      throw new Error("Customer audience recipient count was not returned by the database");
    }

    return Number(count);
  }

  async addCustomerFieldValue(
    companyId: number,
    customerEmail: string,
    fieldName: string,
    fieldValue: string,
  ): Promise<void> {
    if (!Number.isInteger(companyId) || companyId <= 0) {
      throw new Error(`Invalid CompanyId: ${companyId}`);
    }

    const escapedEmail = customerEmail.replace(/'/g, "''");
    const escapedFieldName = fieldName.replace(/'/g, "''");
    const escapedFieldValue = fieldValue.replace(/'/g, "''");
    const formType = this.getCampaignCustomerFormType(fieldName);
    await DatabaseUtils.executeUpdate(`
      DECLARE @LeadId INT = (
        SELECT TOP 1 LeadId
        FROM EconnectCRM.dbo.LeadList
        WHERE CompanyId = ${companyId}
          AND LeadType = 2
          AND IsDeleted = 0
          AND EmailId = '${escapedEmail}'
        ORDER BY LeadId DESC
      );
      DECLARE @FieldId INT = (
        SELECT FieldId
        FROM EconnectCRM.dbo.CustomFields
        WHERE CompanyId = ${companyId}
          AND FieldName = '${escapedFieldName}'
          AND FormType = '${formType}'
      );

      IF @LeadId IS NULL OR @FieldId IS NULL
        THROW 50001, 'Customer or Customer field was not found.', 1;

      INSERT INTO EconnectCRM.dbo.CustomerFieldsValue (
        LeadId,
        FieldId,
        FieldValue,
        CreatedAt,
        IsDeleted
      ) VALUES (
        @LeadId,
        @FieldId,
        '${escapedFieldValue}',
        GETUTCDATE(),
        0
      );
    `);
  }

  async restoreTrackedState(): Promise<void> {
    for (const [propertyId, enabled] of this.originalAdditionalGuest) {
      await DatabaseUtils.executeUpdate(`
        UPDATE Settings
        SET AdditionalGuest = ${enabled ? 1 : 0}
        WHERE PropertyID = ${propertyId}
      `);
    }
    this.originalAdditionalGuest.clear();
  }

  private getTextOperatorCondition(
    operator: LeadFieldTextOperator,
    value: string,
  ): string {
    const escapedValue = value.replace(/'/g, "''");
    const likeValue = escapedValue
      .replace(/\\/g, "\\\\")
      .replace(/%/g, "\\%")
      .replace(/_/g, "\\_")
      .replace(/\[/g, "\\[");

    switch (operator) {
      case "Equals":
        return `FieldValue = '${escapedValue}'`;
      case "Not Equals":
        return `(FieldValue <> '${escapedValue}' OR FieldValue IS NULL)`;
      case "Contains":
        return `FieldValue LIKE '%${likeValue}%' ESCAPE '\\'`;
      case "Starts With":
        return `FieldValue LIKE '${likeValue}%' ESCAPE '\\'`;
      case "Ends With":
        return `FieldValue LIKE '%${likeValue}' ESCAPE '\\'`;
    }
  }

  private getCampaignCustomerFormType(fieldName: string): "Lead" | "Customer" {
    return "Customer";
  }

  private getCustomerLeadColumn(fieldName: string): string | null {
    if (fieldName === "First Name") return "ContactName";
    if (fieldName === "Email Address") return "EmailId";
    return null;
  }

  private getCustomerAudienceCondition(
    companyId: number,
    criterion: CampaignTextCriterion,
  ): string {
    const leadColumn = this.getCustomerLeadColumn(criterion.fieldName);
    const condition = this.getTextOperatorCondition(criterion.operator, criterion.value);
    if (leadColumn) {
      return condition.replace(/FieldValue/g, `customer.[${leadColumn}]`);
    }

    const escapedFieldName = criterion.fieldName.replace(/'/g, "''");
    const fieldValueCondition = criterion.operator === "Not Equals"
      ? `fieldValue.FieldValue = '${criterion.value.replace(/'/g, "''")}'`
      : condition.replace(/FieldValue/g, "fieldValue.FieldValue");
    return `${criterion.operator === "Not Equals" ? "NOT EXISTS" : "EXISTS"} (
      SELECT 1
      FROM EconnectCRM.dbo.CustomerFieldsValue AS fieldValue
      WHERE fieldValue.LeadId = customer.LeadId
        AND fieldValue.FieldId = (
          SELECT FieldId
          FROM EconnectCRM.dbo.CustomFields
          WHERE CompanyId = ${companyId}
            AND FieldName = '${escapedFieldName}'
            AND FormType = 'Customer'
        )
        AND fieldValue.IsDeleted = 0
        AND ${fieldValueCondition}
    )`;
  }

  private combineCustomerAudienceConditions(
    companyId: number,
    criteria: ReadonlyArray<CampaignTextCriterion>,
  ): string {
    return criteria
      .map((criterion, index) => {
        const condition = this.getCustomerAudienceCondition(companyId, criterion);
        if (index === 0) return condition;
        const connector = criterion.condition ?? "AND";
        return `${connector} ${condition}`;
      })
      .join("\n          ");
  }
}
