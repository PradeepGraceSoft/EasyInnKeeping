import { DatabaseUtils } from "./DatabaseUtils";

type VrboRoomFeature = {
  minimumPriorNotify: number | null;
};

export class OTADatabaseHelper {
  private readonly originalMinimumPriorNotify = new Map<string, number | null>();

  async setVrboMinimumPriorNotify(
    propertyId: number,
    roomType: string,
    minimumPriorNotify: number | null,
  ): Promise<void> {
    this.validateInputs(propertyId, roomType, minimumPriorNotify);
    const stateKey = this.getStateKey(propertyId, roomType);

    if (!this.originalMinimumPriorNotify.has(stateKey)) {
      this.originalMinimumPriorNotify.set(
        stateKey,
        await this.getVrboMinimumPriorNotify(propertyId, roomType),
      );
    }

    await DatabaseUtils.executeUpdate(`
      UPDATE OTAVrboRoomFeature
      SET minimumPriorNotify = ${minimumPriorNotify === null ? "NULL" : minimumPriorNotify}
      WHERE RoomType = '${this.escapeSql(roomType)}'
        AND Property_id = ${propertyId};

      IF @@ROWCOUNT <> 1
        THROW 50001, 'The Vrbo room feature was not found or was duplicated.', 1;
    `);
  }

  async getVrboMinimumPriorNotify(
    propertyId: number,
    roomType: string,
  ): Promise<number | null> {
    this.validatePropertyAndRoomType(propertyId, roomType);
    const row = await DatabaseUtils.getRow<VrboRoomFeature>(`
      SELECT minimumPriorNotify
      FROM OTAVrboRoomFeature
      WHERE RoomType = '${this.escapeSql(roomType)}'
        AND Property_id = ${propertyId}
    `);

    if (!row) {
      throw new Error(
        `Vrbo room feature was not found for property ${propertyId} and room type "${roomType}".`,
      );
    }

    return row.minimumPriorNotify === null
      ? null
      : Number(row.minimumPriorNotify);
  }

  async getVrboAvailabilityXml(
    propertyId: number,
    roomCode: string,
    roomId: number,
  ): Promise<string> {
    if (!Number.isInteger(propertyId) || propertyId <= 0) {
      throw new Error(`Invalid property ID: ${propertyId}`);
    }
    if (!roomCode.trim()) {
      throw new Error("The Vrbo room code is required.");
    }
    if (!Number.isInteger(roomId) || roomId <= 0) {
      throw new Error(`Invalid room ID: ${roomId}`);
    }

    const rows = await DatabaseUtils.executeQuery<Record<string, unknown>>(`
      EXEC sp_OTA_Schema_VRBOAvialability
        'VRBO',
        ${propertyId},
        '${this.escapeSql(roomCode)}',
        ${roomId}
    `);
    const xml = rows
      .flatMap((row) => Object.values(row))
      .find((value) => typeof value === "string" && value.includes("<"));

    if (typeof xml !== "string") {
      throw new Error("The Vrbo availability procedure did not return XML.");
    }

    return xml;
  }

  async restoreTrackedState(): Promise<void> {
    for (const [stateKey, minimumPriorNotify] of this.originalMinimumPriorNotify) {
      const separatorIndex = stateKey.indexOf(":");
      const propertyId = Number(stateKey.slice(0, separatorIndex));
      const roomType = stateKey.slice(separatorIndex + 1);
      const sqlValue = minimumPriorNotify === null ? "NULL" : minimumPriorNotify;

      await DatabaseUtils.executeUpdate(`
        UPDATE OTAVrboRoomFeature
        SET minimumPriorNotify = ${sqlValue}
        WHERE RoomType = '${this.escapeSql(roomType)}'
          AND Property_id = ${propertyId}
      `);
    }

    this.originalMinimumPriorNotify.clear();
  }

  private validateInputs(
    propertyId: number,
    roomType: string,
    minimumPriorNotify: number | null,
  ): void {
    this.validatePropertyAndRoomType(propertyId, roomType);
    if (
      minimumPriorNotify !== null &&
      (!Number.isInteger(minimumPriorNotify) || minimumPriorNotify < 0)
    ) {
      throw new Error(`Invalid minimum prior notification: ${minimumPriorNotify}`);
    }
  }

  private validatePropertyAndRoomType(
    propertyId: number,
    roomType: string,
  ): void {
    if (!Number.isInteger(propertyId) || propertyId <= 0) {
      throw new Error(`Invalid property ID: ${propertyId}`);
    }
    if (!roomType.trim()) {
      throw new Error("The Vrbo room type is required.");
    }
  }

  private getStateKey(propertyId: number, roomType: string): string {
    return `${propertyId}:${roomType}`;
  }

  private escapeSql(value: string): string {
    return value.replace(/'/g, "''");
  }
}
