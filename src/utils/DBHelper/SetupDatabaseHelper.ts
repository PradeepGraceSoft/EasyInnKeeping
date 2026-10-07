import { paymentCredential } from "../PaymentGatewayConfig";
import { ConfigManager } from "../ConfigManager";
import { DatabaseUtils } from "./DatabaseUtils";

export type RateDepositPolicy = {
  DepositRequired: boolean;
  DepositType: string | null;
  DepositValue: number | null;
  DepositApplyBySeason: boolean;
};

export type CalendarSortMode = "UnitName" | "UnitNo" | "DisplayOrder";
export type EwrCalendarView = "RoomName" | "RoomType";
export type SortableRoomType = {
  id: number;
  name: string;
  displayOrder: number | null;
};
export type SortableRoom = SortableRoomType & {
  roomType: string;
  roomNo: string | number | null;
};

export type BridgePayCredentials = {
  BridgePayPassword: string | null;
  BridgePayMerchantAccountCode: string | null;
};

export type OnlineBookingBridgePayCredentials = {
  BridgePayPasswordOnline: string | null;
  BridgePayMerchantAccountCodeOnline: string | null;
};

export type AuthorizeNetCredentials = {
  apiLoginId: string | null;
  transactionKey: string | null;
};

export type AvailableCalendarRoom = {
  id: number;
  name: string;
  roomType: string;
};

type SortOrderSnapshot = {
  settings: { SortMode: string | null };
  property: {
    DisplayOrder: number;
    ewrCalendarView: string | null;
    ShowAllRoom: number;
    templateType: string | null;
  };
  roomTypes: SortableRoomType[];
  rooms: SortableRoom[];
};

type NotificationSettingsSnapshot = {
  userId: number;
  enabledSettingIds: number[];
};

/**
 * Setup-specific DB operations.
 * Covers: Room Type, Unit Setup, Rate Setup, Seasonal Rates, Taxes,
 * Custom Labels, Settings, Payment Gateways, Inventory Items,
 * Yield Management, Promo Codes, Booking Engine Settings, Deposit Types.
 */
export class SetupDatabaseHelper {
  private sortOrderSnapshot: SortOrderSnapshot | null = null;
  private notificationSettingsSnapshot: NotificationSettingsSnapshot | null =
    null;

  private get propertyId(): string {
    const propertyId = ConfigManager.testData.propertyId;

    if (!propertyId) {
      throw new Error("propertyId is not configured in test data.");
    }

    return propertyId;
  }

  // ***************** Property setup *********************************

  async enableGuestHub(): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Property SET EnableGuestHub = 1 WHERE property_id = ${this.propertyId}`,
    );
  }

  // ***************** Room Type *********************************

  async trackSortOrderState(): Promise<void> {
    if (this.sortOrderSnapshot) return;

    const settings = await DatabaseUtils.getRow<{ SortMode: string | null }>(
      `SELECT SortMode FROM Settings WHERE PropertyID = ${this.propertyId}`,
    );
    const property = await DatabaseUtils.getRow<SortOrderSnapshot["property"]>(
      `SELECT CAST(DisplayOrder AS int) AS DisplayOrder, ewrCalendarView,
              CAST(ShowAllRoom AS int) AS ShowAllRoom, templateType
       FROM Property WHERE property_id = ${this.propertyId}`,
    );
    if (!settings || !property) {
      throw new Error(
        `Sort settings were not found for property ${this.propertyId}.`,
      );
    }

    this.sortOrderSnapshot = {
      settings,
      property,
      roomTypes: await this.getSortableRoomTypes(),
      rooms: await this.getSortableRooms(),
    };
  }

  async restoreTrackedState(): Promise<void> {
    const snapshot = this.sortOrderSnapshot;
    if (snapshot) {
      await DatabaseUtils.executeUpdate(
        `UPDATE Settings SET SortMode = ${this.sqlString(snapshot.settings.SortMode)}
         WHERE PropertyID = ${this.propertyId}`,
      );
      await DatabaseUtils.executeUpdate(
        `UPDATE Property SET DisplayOrder = ${snapshot.property.DisplayOrder},
                ewrCalendarView = ${this.sqlString(snapshot.property.ewrCalendarView)},
                ShowAllRoom = ${snapshot.property.ShowAllRoom},
                templateType = ${this.sqlString(snapshot.property.templateType)}
         WHERE property_id = ${this.propertyId}`,
      );
      await this.restoreDisplayOrders(
        "RoomType",
        "RoomTypeID",
        snapshot.roomTypes,
      );
      await this.restoreDisplayOrders("Rooms", "Room_id", snapshot.rooms);
      this.sortOrderSnapshot = null;
    }

    await this.restoreNotificationSettings();
  }

  // ***************** Notifications *********************************

  async enablePushAndPaymentNotifications(userName: string): Promise<void> {
    const user = await DatabaseUtils.getRow<{ UserID: number }>(
      `SELECT UserID FROM Worker
       WHERE PropertyID = ${this.propertyId}
       AND UserName = ${this.sqlString(userName)}`,
    );
    if (!user) {
      throw new Error(
        `Notification settings user "${userName}" was not found for property ${this.propertyId}.`,
      );
    }

    if (!this.notificationSettingsSnapshot) {
      const existingSettings = await DatabaseUtils.executeQuery<{
        setting_id: number;
      }>(
        `SELECT setting_id FROM NotificationSettingEnabled
         WHERE property_id = ${this.propertyId} AND user_id = ${user.UserID}
         AND setting_id IN (1, 2)`,
      );
      this.notificationSettingsSnapshot = {
        userId: user.UserID,
        enabledSettingIds: existingSettings.map(({ setting_id }) => setting_id),
      };
    }

    await DatabaseUtils.executeUpdate(
      `INSERT INTO NotificationSettingEnabled (setting_id, property_id, user_id)
       SELECT settings.setting_id, ${this.propertyId}, ${user.UserID}
       FROM (VALUES (1), (2)) AS settings(setting_id)
       WHERE NOT EXISTS (
         SELECT 1 FROM NotificationSettingEnabled enabled
         WHERE enabled.setting_id = settings.setting_id
         AND enabled.property_id = ${this.propertyId}
         AND enabled.user_id = ${user.UserID}
       )`,
    );
  }

  async getSortableRoomTypes(onlineOnly = false): Promise<SortableRoomType[]> {
    return DatabaseUtils.executeQuery<SortableRoomType>(
      `SELECT rt.RoomTypeID AS id, rt.RoomtypeName AS name,
              rt.CondoSortOrder AS displayOrder
       FROM RoomType rt WHERE rt.Property_id = ${this.propertyId}
       ${onlineOnly ? "AND EXISTS (SELECT 1 FROM Rooms r WHERE r.Property_id = rt.Property_id AND r.Room_type = rt.RoomtypeName AND r.unitactive = 'Yes' AND r.OnlineRoom = 1)" : ""}
       ORDER BY rt.RoomtypeName, rt.RoomTypeID`,
    );
  }

  async getSortableRooms(
    roomType?: string,
    onlineOnly = false,
  ): Promise<SortableRoom[]> {
    return DatabaseUtils.executeQuery<SortableRoom>(
      `SELECT Room_id AS id, RoomNo AS roomNo, Room_name AS name, Room_type AS roomType,
              CondoSortOrder AS displayOrder
       FROM Rooms WHERE Property_id = ${this.propertyId}
       ${roomType ? `AND Room_type = ${this.sqlString(roomType)}` : ""}
       ${onlineOnly ? "AND unitactive = 'Yes' AND OnlineRoom = 1" : ""}
       ORDER BY Room_name, Room_id`,
    );
  }

  async getOnlineRoomTypeWithMostRooms(minimumRooms = 2): Promise<string> {
    const row = await DatabaseUtils.getRow<{ roomType: string }>(
      `SELECT TOP (1) Room_type AS roomType
       FROM Rooms
       WHERE Property_id = ${this.propertyId}
       AND unitactive = 'Yes' AND OnlineRoom = 1
       GROUP BY Room_type
       HAVING COUNT(*) >= ${minimumRooms}
       ORDER BY COUNT(*) DESC, Room_type`,
    );
    if (!row?.roomType) {
      throw new Error(
        `No online room type with at least ${minimumRooms} active rooms was found.`,
      );
    }
    return row.roomType;
  }

  async getAvailableRoomIds(
    roomTypeName: string,
    startDate: string,
    endDate: string,
  ): Promise<number[]> {
    if (!roomTypeName.trim() || !startDate.trim() || !endDate.trim()) {
      throw new Error("Room type, start date, and end date are required.");
    }
    const roomIds = await DatabaseUtils.getValues(
      `EXEC sp_core_GetAvailableRooms ${this.propertyId}, 0,
            ${this.sqlString(startDate)}, ${this.sqlString(endDate)},
            ${this.sqlString(roomTypeName)}`,
      "Room_id",
    );
    return roomIds.map(Number).filter(Number.isFinite);
  }

  async getAvailableCalendarRooms(
    startDate: string,
    endDate: string,
    minimumRooms = 3,
  ): Promise<AvailableCalendarRoom[]> {
    if (!Number.isInteger(minimumRooms) || minimumRooms < 1) {
      throw new Error("minimumRooms must be a positive integer.");
    }

    const rooms = await this.getSortableRooms(undefined, true);
    const roomTypes = [...new Set(rooms.map(({ roomType }) => roomType))];
    for (const roomType of roomTypes) {
      const availableIds = new Set(
        await this.getAvailableRoomIds(roomType, startDate, endDate),
      );
      const availableRooms = rooms
        .filter(
          (room) => room.roomType === roomType && availableIds.has(room.id),
        )
        .map(({ id, name }) => ({ id, name, roomType }));
      if (availableRooms.length >= minimumRooms) {
        return availableRooms;
      }
    }

    throw new Error(
      `No room type has ${minimumRooms} available rooms from ${startDate} through ${endDate}.`,
    );
  }

  async getAvailableActiveRoomCount(
    startDate: string,
    endDate: string,
  ): Promise<number> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      throw new Error("Available active room counts require YYYY-MM-DD start and end dates.");
    }
    const activeRooms = await DatabaseUtils.executeQuery<{
      id: number;
      roomType: string;
    }>(
      `SELECT Room_id AS id, Room_type AS roomType
       FROM Rooms
       WHERE Property_id = ${this.propertyId}
         AND unitactive = 'Yes'`,
    );
    const roomTypes = [...new Set(activeRooms.map(({ roomType }) => roomType))];
    let availableCount = 0;
    for (const roomType of roomTypes) {
      const availableIds = new Set(
        await this.getAvailableRoomIds(roomType, startDate, endDate),
      );
      availableCount += activeRooms.filter(
        (room) => room.roomType === roomType && availableIds.has(room.id),
      ).length;
    }
    return availableCount;
  }

  async getAvailableCalendarRoomsAcrossTypes(
    startDate: string,
    endDate: string,
  ): Promise<[AvailableCalendarRoom, AvailableCalendarRoom]> {
    const rooms = await this.getSortableRooms(undefined, true);
    const roomTypes = [...new Set(rooms.map(({ roomType }) => roomType))];
    const availableByType: Array<{
      room: AvailableCalendarRoom;
      baseRate: number;
    }> = [];

    for (const roomType of roomTypes) {
      const availableIds = new Set(
        await this.getAvailableRoomIds(roomType, startDate, endDate),
      );
      const room = rooms.find(
        (candidate) =>
          candidate.roomType === roomType && availableIds.has(candidate.id),
      );
      if (room) {
        const baseRate = Number(await this.getRateBaseAmount(roomType));
        if (Number.isFinite(baseRate)) {
          const differentRateRoom = availableByType.find(
            (candidate) => candidate.baseRate !== baseRate,
          );
          const availableRoom = { id: room.id, name: room.name, roomType };
          if (differentRateRoom) {
            return [differentRateRoom.room, availableRoom];
          }
          availableByType.push({ room: availableRoom, baseRate });
        }
      }
    }

    throw new Error(
      `Two available room types with different rates were not found from ${startDate} through ${endDate}.`,
    );
  }

  async setRoomTypeDisplayOrders(
    orders: ReadonlyArray<{ id: number; displayOrder: number | null }>,
  ): Promise<void> {
    await this.setDisplayOrders("RoomType", "RoomTypeID", orders);
  }

  async setRoomDisplayOrders(
    orders: ReadonlyArray<{ id: number; displayOrder: number | null }>,
  ): Promise<void> {
    await this.setDisplayOrders("Rooms", "Room_id", orders);
  }

  async setPmsSortMode(sortMode: CalendarSortMode): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Settings SET SortMode = '${sortMode}' WHERE PropertyID = ${this.propertyId}`,
    );
  }

  async enableCalendarDragAndDrop(): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Settings SET IsDragAndDrop = 1 WHERE PropertyID = ${this.propertyId}`,
    );
  }

  async displayCalendarReservationsByFirstName(): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Settings SET DisplayName = 'FirstName' WHERE PropertyID = ${this.propertyId}`,
    );
  }

  async setShowAllRooms(enableDisable: number): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Property SET ShowAllRoom = ${enableDisable} WHERE property_id = ${this.propertyId}`,
    );
  }

  async setEwrCalendarView(view: EwrCalendarView): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Property SET ewrCalendarView = '${view}' WHERE property_id = ${this.propertyId}`,
    );
  }

  async assignRateToRoomType(
    roomTypeName: string,
    rateName: string,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE RoomType
       SET Gid = (SELECT Gid FROM GroupRates WHERE Property_ID = ${this.propertyId} AND Groupname = '${rateName}')
       WHERE RoomtypeName = '${roomTypeName}'
       AND Property_id = ${this.propertyId}`,
    );
  }

  // ***************** Unit Setup *********************************

  async assignRateToUnitSetup(
    roomTypeName: string,
    rateName: string,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE rooms
       SET Gid = (SELECT Gid FROM GroupRates WHERE Property_ID = ${this.propertyId} AND Groupname = '${rateName}')
       WHERE Room_type = '${roomTypeName}'
       AND Property_id = ${this.propertyId}`,
    );
  }

  async setOnlineRoomByRoomType(
    roomTypeName: string,
    enableDisable: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE rooms
       SET OnlineRoom = ${enableDisable}
       WHERE Room_type = '${roomTypeName}'
       AND Property_id = ${this.propertyId}`,
    );
  }

  async setUnitDisplayOrder(unitOrder: string): Promise<void> {
    const pid = this.propertyId;

    if (
      unitOrder.toLowerCase() === "ascending" ||
      unitOrder.toLowerCase() === "inactive room"
    ) {
      await DatabaseUtils.executeUpdate(
        `UPDATE rooms SET CondoSortOrder = CASE
           WHEN Room_id = 64 THEN 1 WHEN Room_id = 65 THEN 2
           WHEN Room_id = 66 THEN 3 WHEN Room_id = 67 THEN 4
           WHEN Room_id = 68 THEN 5 ELSE CondoSortOrder END
         WHERE Room_id IN (64, 65, 66, 67, 68) AND Property_id = ${pid}`,
      );

      if (unitOrder.toLowerCase() === "inactive room") {
        await DatabaseUtils.executeUpdate(
          `UPDATE rooms SET unitactive = 'No'
           WHERE Room_id = 66 AND Property_id = ${pid}`,
        );
      }
    } else if (unitOrder.toLowerCase() === "descending") {
      await DatabaseUtils.executeUpdate(
        `UPDATE rooms SET CondoSortOrder = CASE
           WHEN Room_id = 64 THEN 5 WHEN Room_id = 65 THEN 4
           WHEN Room_id = 66 THEN 3 WHEN Room_id = 67 THEN 2
           WHEN Room_id = 68 THEN 1 ELSE CondoSortOrder END
         WHERE Room_id IN (64, 65, 66, 67, 68) AND Property_id = ${pid}`,
      );
    } else if (unitOrder.toLowerCase() === "empty order") {
      await DatabaseUtils.executeUpdate(
        `UPDATE rooms SET CondoSortOrder = 0
         WHERE Room_id IN (64, 65, 66, 67, 68) AND Property_id = ${pid}`,
      );
    } else if (unitOrder.toLowerCase() === "partial empty order") {
      await DatabaseUtils.executeUpdate(
        `UPDATE rooms SET CondoSortOrder = CASE
           WHEN Room_id = 64 THEN 0 WHEN Room_id = 65 THEN 5
           WHEN Room_id = 66 THEN 1 WHEN Room_id = 67 THEN 2
           WHEN Room_id = 68 THEN 0 ELSE CondoSortOrder END
         WHERE Room_id IN (64, 65, 66, 67, 68) AND Property_id = ${pid}`,
      );
    }
  }

  async setRoomTypeBookNowCallUs(
    roomTypeCode: string,
    enableDisable: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE RoomType
       SET OnlineButton = ${enableDisable}, CallUsNotes = 'The room cannot be booked online'
       WHERE RoomTypeCode = '${roomTypeCode}'
       AND Property_id = ${this.propertyId}`,
    );
  }

  async setRoomNameBookNowCallUs(
    roomTypeName: string,
    enableDisable: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE rooms
       SET OnlineButton = ${enableDisable}, CallUsNotes = 'The room cannot be booked online'
       WHERE Room_type = '${roomTypeName}'
       AND Property_id = ${this.propertyId}`,
    );
  }

  async setUnitActiveInactive(
    roomTypeName: string,
    roomName: string,
    activeInactive: string,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE rooms
       SET unitactive = '${activeInactive}'
       WHERE Room_type = '${roomTypeName}'
       AND Room_name = '${roomName}'
       AND Property_id = ${this.propertyId}`,
    );
  }

  async activateAllRoomsOfType(roomTypeName: string): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE rooms
       SET unitactive = 'Yes'
       WHERE Room_type = '${roomTypeName}'
       AND Property_id = ${this.propertyId}`,
    );
  }

  async activateAllRooms(): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE ROOMS SET unitactive = 'Yes'
       WHERE Property_id = ${this.propertyId}`,
    );
  }

  async deactivateAllRoomsExcept(roomTypeName: string): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE ROOMS SET unitactive = 'No'
       WHERE Property_id = ${this.propertyId}
       AND Room_type != '${roomTypeName}'`,
    );
  }

  async getActiveRoomNames(roomTypeName: string): Promise<string[]> {
    return DatabaseUtils.getValues(
      `SELECT Room_name FROM Rooms
       WHERE Property_id = ${this.propertyId}
       AND Room_type = '${roomTypeName}'
       AND OnlineRoom = 1`,
      "Room_name",
    );
  }

  async getInactiveRoomNames(roomTypeName: string): Promise<string[]> {
    return DatabaseUtils.getValues(
      `SELECT Room_name FROM Rooms
       WHERE Property_id = ${this.propertyId}
       AND Room_type = '${roomTypeName}'
       AND OnlineRoom = 0`,
      "Room_name",
    );
  }

  // ***************** Rate Setup *********************************

  async setRateAmount(rateName: string, amount: number): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Rates SET BaseAmount = ${amount}
       WHERE gid = (SELECT Gid FROM GroupRates WHERE Groupname = '${rateName}' AND Property_ID = ${this.propertyId})
       AND propertyid = ${this.propertyId}`,
    );
  }

  async setRateIncludedOccupants(
    roomTypeName: string,
    noOfGuest: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Rates SET noofguest = ${noOfGuest}
       WHERE gid = (SELECT Gid FROM RoomType WHERE Property_id = ${this.propertyId} AND RoomtypeName = '${roomTypeName}')
       AND propertyid = ${this.propertyId}`,
    );
  }

  async setRateEPCAdult(roomTypeName: string, epcAdult: number): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Rates SET extrapersoncharge = ${epcAdult}
       WHERE gid = (SELECT Gid FROM RoomType WHERE Property_id = ${this.propertyId} AND RoomtypeName = '${roomTypeName}')
       AND propertyid = ${this.propertyId}`,
    );
  }

  async setRateEPCChild(roomTypeName: string, epcChild: number): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Rates SET Childrenrate = ${epcChild}
       WHERE gid = (SELECT Gid FROM RoomType WHERE Property_id = ${this.propertyId} AND RoomtypeName = '${roomTypeName}')
       AND propertyid = ${this.propertyId}`,
    );
  }

  async setRateWeekendAmount(
    roomTypeName: string,
    amount: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Rates SET weekendcharge = ${amount}
       WHERE gid = (SELECT Gid FROM RoomType WHERE Property_id = ${this.propertyId} AND RoomtypeName = '${roomTypeName}')
       AND propertyid = ${this.propertyId}`,
    );
  }

  async setRateWeekendDays(
    roomTypeName: string,
    weekdays: string,
  ): Promise<void> {
    const flags = this.parseWeekdayFlags(weekdays);
    await DatabaseUtils.executeUpdate(
      `UPDATE Rates
       SET isMon = ${flags.mon}, isTue = ${flags.tue}, iswed = ${flags.wed},
           isthu = ${flags.thu}, isfri = ${flags.fri}, issat = ${flags.sat}, issun = ${flags.sun}
       WHERE Gid = (SELECT Gid FROM RoomType WHERE Property_id = ${this.propertyId} AND RoomtypeName = '${roomTypeName}')
       AND PropertyID = ${this.propertyId}`,
    );
  }

  async setRateWeekendDaysByRateName(
    rateName: string,
    weekdays: string,
  ): Promise<void> {
    const rateId = await this.getRateId(rateName);
    const flags = this.parseWeekdayFlags(weekdays);
    await DatabaseUtils.executeUpdate(
      `UPDATE Rates
       SET isMon = ${flags.mon}, isTue = ${flags.tue}, iswed = ${flags.wed},
           isthu = ${flags.thu}, isfri = ${flags.fri}, issat = ${flags.sat}, issun = ${flags.sun}
       WHERE Gid = (${rateId}) AND PropertyID = ${this.propertyId}`,
    );
  }

  async getRateId(rateName: string): Promise<string | null> {
    return DatabaseUtils.getValue(
      `SELECT Gid FROM GroupRates
       WHERE Property_id = ${this.propertyId} AND Groupname = '${rateName}'`,
      "Gid",
    );
  }

  async getRateType(roomTypeName: string): Promise<string | null> {
    return DatabaseUtils.getValue(
      `SELECT RateType FROM GroupRates
       WHERE Property_ID = ${this.propertyId}
       AND Gid = (SELECT Gid FROM RoomType WHERE Property_id = ${this.propertyId} AND RoomtypeName = '${roomTypeName}')`,
      "RateType",
    );
  }

  async getRateIncludedOccupants(roomTypeName: string): Promise<string | null> {
    return DatabaseUtils.getValue(
      `SELECT noofguest FROM rates
       WHERE propertyid = ${this.propertyId}
       AND Gid = (SELECT Gid FROM RoomType WHERE Property_id = ${this.propertyId} AND RoomtypeName = '${roomTypeName}')`,
      "noofguest",
    );
  }

  async getRateBaseAmount(roomTypeName: string): Promise<string | null> {
    return DatabaseUtils.getValue(
      `SELECT BaseAmount FROM rates
       WHERE propertyid = ${this.propertyId}
       AND Gid = (SELECT Gid FROM RoomType WHERE Property_id = ${this.propertyId} AND RoomtypeName = '${roomTypeName}')`,
      "BaseAmount",
    );
  }

  async getRateEPCAdult(roomTypeName: string): Promise<string | null> {
    return DatabaseUtils.getValue(
      `SELECT extrapersoncharge FROM rates
       WHERE propertyid = ${this.propertyId}
       AND Gid = (SELECT Gid FROM RoomType WHERE Property_id = ${this.propertyId} AND RoomtypeName = '${roomTypeName}')`,
      "extrapersoncharge",
    );
  }

  async getRateEPCChild(roomTypeName: string): Promise<string | null> {
    return DatabaseUtils.getValue(
      `SELECT Childrenrate FROM rates
       WHERE propertyid = ${this.propertyId}
       AND Gid = (SELECT Gid FROM RoomType WHERE Property_id = ${this.propertyId} AND RoomtypeName = '${roomTypeName}')`,
      "Childrenrate",
    );
  }

  async getRateWeekendSurcharge(roomTypeName: string): Promise<string | null> {
    return DatabaseUtils.getValue(
      `SELECT weekendcharge FROM rates
       WHERE propertyid = ${this.propertyId}
       AND Gid = (SELECT Gid FROM RoomType WHERE Property_id = ${this.propertyId} AND RoomtypeName = '${roomTypeName}')`,
      "weekendcharge",
    );
  }

  // ***************** Seasonal Rates *********************************

  async setSeasonalRateAmount(
    fromDate: string,
    toDate: string,
    roomTypeName: string,
    amount: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE rates SET BaseAmount = ${amount}
       WHERE Rate_id = (SELECT Rate_id FROM rates WHERE propertyid = ${this.propertyId}
         AND Gid = (SELECT Gid FROM RoomType WHERE Property_id = ${this.propertyId} AND RoomtypeName = '${roomTypeName}')
         AND DefinitionRateID != 0)
       AND propertyid = ${this.propertyId}`,
    );
    await DatabaseUtils.executeUpdate(
      `UPDATE rates SET FromDate = '${fromDate}', ToDate = '${toDate}'
       WHERE Rate_id = (SELECT Rate_id FROM rates WHERE propertyid = ${this.propertyId}
         AND Gid = (SELECT Gid FROM RoomType WHERE Property_id = ${this.propertyId} AND RoomtypeName = '${roomTypeName}')
         AND DefinitionRateID != 0)
       AND propertyid = ${this.propertyId}`,
    );
  }

  async setSeasonalRateAmountByRateName(
    rateName: string,
    amount: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Rates SET BaseAmount = ${amount}
       WHERE propertyid = ${this.propertyId}
       AND Gid = (
         SELECT Gid FROM GroupRates
         WHERE Property_ID = ${this.propertyId}
           AND Groupname = '${rateName}'
           AND DefinitionRateID <> 0
       )`,
    );
  }

  async setSeasonalWeekendAmount(
    fromDate: string,
    toDate: string,
    roomTypeName: string,
    amount: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE rates SET weekendcharge = ${amount}
       WHERE Rate_id = (SELECT Rate_id FROM rates WHERE propertyid = ${this.propertyId}
         AND Gid = (SELECT Gid FROM RoomType WHERE Property_id = ${this.propertyId} AND RoomtypeName = '${roomTypeName}')
         AND DefinitionRateID != 0)
       AND propertyid = ${this.propertyId}`,
    );
    await DatabaseUtils.executeUpdate(
      `UPDATE rates SET FromDate = '${fromDate}', ToDate = '${toDate}'
       WHERE Rate_id = (SELECT Rate_id FROM rates WHERE propertyid = ${this.propertyId}
         AND Gid = (SELECT Gid FROM RoomType WHERE Property_id = ${this.propertyId} AND RoomtypeName = '${roomTypeName}')
         AND DefinitionRateID != 0)
       AND propertyid = ${this.propertyId}`,
    );
  }

  async setSeasonalWeekendDays(
    roomTypeName: string,
    weekdays: string,
  ): Promise<void> {
    const flags = this.parseWeekdayFlags(weekdays);
    await DatabaseUtils.executeUpdate(
      `UPDATE Rates
       SET isMon = ${flags.mon}, isTue = ${flags.tue}, iswed = ${flags.wed},
           isthu = ${flags.thu}, isfri = ${flags.fri}, issat = ${flags.sat}, issun = ${flags.sun}
       WHERE Gid = (SELECT Gid FROM RoomType WHERE Property_id = ${this.propertyId} AND RoomtypeName = '${roomTypeName}')
       AND DefinitionRateID != 0
       AND propertyid = ${this.propertyId}`,
    );
  }

  async setSeasonalEPCAdult(
    fromDate: string,
    roomTypeName: string,
    epcAdult: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Rates SET extrapersoncharge = ${epcAdult}
       WHERE gid = (SELECT Gid FROM RoomType WHERE Property_id = ${this.propertyId} AND RoomtypeName = '${roomTypeName}')
       AND FromDate <= '${fromDate}' AND ToDate >= '${fromDate}'
       AND propertyid = ${this.propertyId}`,
    );
  }

  async setSeasonalEPCChild(
    fromDate: string,
    roomTypeName: string,
    epcChild: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Rates SET Childrenrate = ${epcChild}
       WHERE gid = (SELECT Gid FROM RoomType WHERE Property_id = ${this.propertyId} AND RoomtypeName = '${roomTypeName}')
       AND FromDate <= '${fromDate}' AND ToDate >= '${fromDate}'
       AND propertyid = ${this.propertyId}`,
    );
  }

  async setSeasonalIncludedOccupants(
    fromDate: string,
    roomTypeName: string,
    noOfGuests: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Rates SET noofguest = ${noOfGuests}
       WHERE gid = (SELECT Gid FROM RoomType WHERE Property_id = ${this.propertyId} AND RoomtypeName = '${roomTypeName}')
       AND FromDate <= '${fromDate}' AND ToDate >= '${fromDate}'
       AND propertyid = ${this.propertyId}`,
    );
  }

  async getSeasonalBaseAmount(
    roomTypeName: string,
    fromDate: string,
  ): Promise<string | null> {
    return DatabaseUtils.getValue(
      `SELECT BaseAmount FROM rates
       WHERE propertyid = ${this.propertyId}
       AND Gid = (SELECT Gid FROM RoomType WHERE Property_id = ${this.propertyId} AND RoomtypeName = '${roomTypeName}')
       AND FromDate <= '${fromDate}' AND ToDate >= '${fromDate}'`,
      "BaseAmount",
    );
  }

  async getSeasonalBaseAmountByRate(
    rateName: string,
    fromDate: string,
  ): Promise<string | null> {
    const rateId = await this.getRateId(rateName);
    return DatabaseUtils.getValue(
      `SELECT BaseAmount FROM rates
       WHERE propertyid = ${this.propertyId}
       AND Gid = (${rateId})
       AND FromDate <= '${fromDate}' AND ToDate >= '${fromDate}'`,
      "BaseAmount",
    );
  }

  async getSeasonalEPCAdult(
    roomTypeName: string,
    fromDate: string,
  ): Promise<string | null> {
    return DatabaseUtils.getValue(
      `SELECT extrapersoncharge FROM rates
       WHERE propertyid = ${this.propertyId}
       AND Gid = (SELECT Gid FROM RoomType WHERE Property_id = ${this.propertyId} AND RoomtypeName = '${roomTypeName}')
       AND FromDate <= '${fromDate}' AND ToDate >= '${fromDate}'`,
      "extrapersoncharge",
    );
  }

  async getSeasonalEPCChild(
    roomTypeName: string,
    fromDate: string,
  ): Promise<string | null> {
    return DatabaseUtils.getValue(
      `SELECT Childrenrate FROM rates
       WHERE propertyid = ${this.propertyId}
       AND Gid = (SELECT Gid FROM RoomType WHERE Property_id = ${this.propertyId} AND RoomtypeName = '${roomTypeName}')
       AND FromDate <= '${fromDate}' AND ToDate >= '${fromDate}'`,
      "Childrenrate",
    );
  }

  async getSeasonalIncludedOccupants(
    roomTypeName: string,
    fromDate: string,
  ): Promise<string | null> {
    return DatabaseUtils.getValue(
      `SELECT noofguest FROM rates
       WHERE propertyid = ${this.propertyId}
       AND Gid = (SELECT Gid FROM RoomType WHERE Property_id = ${this.propertyId} AND RoomtypeName = '${roomTypeName}')
       AND FromDate <= '${fromDate}' AND ToDate >= '${fromDate}'`,
      "noofguest",
    );
  }

  async getSeasonalWeekendSurcharge(
    roomTypeName: string,
    fromDate: string,
  ): Promise<string | null> {
    return DatabaseUtils.getValue(
      `SELECT weekendcharge FROM rates
       WHERE propertyid = ${this.propertyId}
       AND Gid = (SELECT Gid FROM RoomType WHERE Property_id = ${this.propertyId} AND RoomtypeName = '${roomTypeName}')
       AND FromDate <= '${fromDate}' AND ToDate >= '${fromDate}'`,
      "weekendcharge",
    );
  }

  // ***************** Taxes *********************************

  async setTaxAmount(taxName: string, amount: number): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE taxes SET Amount = '${amount}'
       WHERE TaxName = '${taxName}'
       AND PropertyID = ${this.propertyId}`,
    );
  }

  async setTaxAppliedToLodging(
    taxName: string,
    enableDisable: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Taxes SET Applied = ${enableDisable}
       WHERE TaxName = '${taxName}'
       AND PropertyID = ${this.propertyId}`,
    );
  }

  async setTaxExempt(
    taxName: string,
    enableDisable: number,
    days: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Taxes SET IsTaxExempt = ${enableDisable}, TaxExempt = ${days}
       WHERE TaxName = '${taxName}'
       AND PropertyID = ${this.propertyId}`,
    );
  }

  async getTaxId(taxName: string): Promise<string | null> {
    return DatabaseUtils.getValue(
      `SELECT TaxID FROM Taxes
       WHERE TaxName = '${taxName}'
       AND PropertyID = ${this.propertyId}`,
      "TaxID",
    );
  }

  async enableGSTTax(
    propertyId: string,
    taxProfile: "intra" | "inter",
  ): Promise<void> {
    const intra = taxProfile === "intra" ? 1 : 0;
    const inter = taxProfile === "inter" ? 1 : 0;
    await DatabaseUtils.executeUpdate(
      `INSERT INTO TaxProfile VALUES
         (${propertyId}, 1, 'Intra State', ${intra}),
         (${propertyId}, 2, 'Inter State', ${inter})`,
    );
  }

  async deleteGSTTax(): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `DELETE FROM TaxProfile WHERE PropertyID = ${this.propertyId}`,
    );
  }

  async setGSTTaxAppliedToLodging(enableDisable: number): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE taxes SET Applied = ${enableDisable}
       WHERE TaxID IN (9805, 9806, 9807, 9808, 9809, 9810, 9811, 9812, 9813)
       AND PropertyID = ${this.propertyId}`,
    );
  }

  // ***************** Custom Labels *********************************

  async setCustomLabelDisplayMandatory(labelName: string): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE CustomLabel SET ShowInOnlineMantatory = 2
       WHERE DefaultLabel = '${labelName}'
       AND PropertyID = ${this.propertyId}`,
    );
  }

  async setCustomLabelName(
    labelName: string,
    newLabelName: string,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE CustomLabel SET NewLabel = '${newLabelName}'
       WHERE PropertyID = ${this.propertyId}
       AND DefaultLabel = '${labelName}'
       AND Language = 'en'`,
    );
  }

  // ***************** Default Settings *********************************

  async setAutoHousekeeping(
    enableDisable: number,
    feeType: string,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Property SET AutoHousekeepingFee = ${enableDisable}, AutoHousekeepingFeeType = '${feeType}'
       WHERE property_id = ${this.propertyId}`,
    );
  }

  async setDefaultLandingPage(defaultView: string): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Settings SET DefaultView = '${defaultView}'
       WHERE PropertyID = ${this.propertyId}`,
    );
  }

  async setInventoryTaxBreakdown(
    condition: number,
    columnName: string,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Settings SET ${columnName} = ${condition}
       WHERE propertyid = ${this.propertyId}`,
    );
  }

  async setInvoiceNumberPrefix(invoicePrefix: string): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE SETTINGS SET InvoicePrefix = '${invoicePrefix}'
       WHERE PropertyID = ${this.propertyId}`,
    );
  }

  async setTaxWithoutDiscount(condition: number): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Settings SET TaxWithoutDiscount = ${condition}
       WHERE PropertyID = ${this.propertyId}`,
    );
  }

  async setCalendarTypeRoomName(): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Settings SET CalendarType = 'RoomName'
       WHERE PropertyID = ${this.propertyId}`,
    );
  }

  async setCalendarTypeRoomType(): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Settings SET CalendarType = 'RoomType'
       WHERE PropertyID = ${this.propertyId}`,
    );
  }

  async setUnassignedRoom(condition: number): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Settings SET UnAssignedRoom = ${condition}
       WHERE PropertyID = ${this.propertyId}`,
    );
  }

  async enableUnassignedRoomReservations(): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Settings SET UnAssignedRoom = 1, CalendarType = 'RoomType'
       WHERE PropertyID = ${this.propertyId}`,
    );
  }

  async disableUnassignedRoomReservations(): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Settings SET UnAssignedRoom = 0, CalendarType = 'RoomName'
       WHERE PropertyID = ${this.propertyId}`,
    );
  }

  async verifyUnassignedRoomReservationSettings(
    enabled: boolean,
  ): Promise<void> {
    const settings = await DatabaseUtils.getRow<{
      UnAssignedRoom: boolean | number;
      CalendarType: string;
    }>(
      `SELECT UnAssignedRoom, CalendarType FROM Settings
       WHERE PropertyID = ${this.propertyId}`,
    );
    const expectedRoomSetting = enabled ? 1 : 0;
    const expectedCalendarType = enabled ? "RoomType" : "RoomName";

    if (
      !settings ||
      Number(settings.UnAssignedRoom) !== expectedRoomSetting ||
      settings.CalendarType !== expectedCalendarType
    ) {
      throw new Error(
        `Expected UnAssignedRoom=${expectedRoomSetting} and CalendarType='${expectedCalendarType}', ` +
          `but got UnAssignedRoom=${settings?.UnAssignedRoom ?? "missing"} and ` +
          `CalendarType='${settings?.CalendarType ?? "missing"}'.`,
      );
    }
  }

  async setAutomaticRatePush(condition: number): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE GDSSettings SET FromDate = '2000-01-01 00:00:00.000'
       WHERE PropertyId = ${this.propertyId}`,
    );
    await DatabaseUtils.executeUpdate(
      `UPDATE Settings SET IsOtaAutoRatePush = ${condition}
       WHERE PropertyId = ${this.propertyId}`,
    );
    await DatabaseUtils.executeUpdate(
      `UPDATE GDSSettings SET SendRate = 0
       WHERE PropertyId = ${this.propertyId}`,
    );
  }

  // ***************** Reservation Rules *********************************

  async setReservationRuleDatesApplied(
    ruleName: string,
    condition: string,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE ReservationRules SET IsCustomDate = '${condition}'
       WHERE RuleID IN (SELECT RuleID FROM ReservationRules WHERE PropertyID = ${this.propertyId} AND Notes LIKE '%${ruleName}%')
       AND PropertyID = ${this.propertyId}`,
    );
  }

  async setReservationRuleDateRange(
    ruleName: string,
    fromDate: string,
    toDate: string,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE ReservationRules SET FromDt = '${fromDate}', ToDt = '${toDate}'
       WHERE RuleID IN (SELECT RuleID FROM ReservationRules WHERE PropertyID = ${this.propertyId} AND Notes LIKE '%${ruleName}%')
       AND PropertyID = ${this.propertyId}`,
    );
  }

  async setReservationRuleDayRange(
    ruleName: string,
    fromDays: number,
    toDays: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE ReservationRules SET LeadfDays = ${fromDays}, LeadtoDays = ${toDays}
       WHERE RuleID IN (SELECT RuleID FROM ReservationRules WHERE PropertyID = ${this.propertyId} AND Notes LIKE '%${ruleName}%')
       AND PropertyID = ${this.propertyId}`,
    );
  }

  async setReservationRuleWeekdays(
    ruleName: string,
    isMon: number,
    isTue: number,
    isWed: number,
    isThu: number,
    isFri: number,
    isSat: number,
    isSun: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE ReservationRules
       SET isMon = ${isMon}, isTue = ${isTue}, isWed = ${isWed},
           isthu = ${isThu}, isfri = ${isFri}, issat = ${isSat}, issun = ${isSun}
       WHERE RuleID IN (SELECT RuleID FROM ReservationRules WHERE PropertyID = ${this.propertyId} AND Notes LIKE '%${ruleName}%')
       AND PropertyID = ${this.propertyId}`,
    );
  }

  async setReservationRuleRoomType(
    ruleName: string,
    roomTypeName: string,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE ReservationRules
       SET RoomTypeID = (SELECT RoomTypeID FROM RoomType WHERE Property_id = ${this.propertyId} AND RoomtypeName = '${roomTypeName}')
       WHERE RuleID IN (SELECT RuleID FROM ReservationRules WHERE PropertyID = ${this.propertyId} AND Notes LIKE '%${ruleName}%')
       AND PropertyID = ${this.propertyId}`,
    );
  }

  async setReservationRuleRoomTypeAll(ruleName: string): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE ReservationRules
       SET RoomTypeID = (SELECT STRING_AGG(RoomTypeID, ',') FROM RoomType WHERE Property_id = ${this.propertyId})
       WHERE RuleID IN (SELECT RuleID FROM ReservationRules WHERE PropertyID = ${this.propertyId} AND Notes LIKE '%${ruleName}%')
       AND PropertyID = ${this.propertyId}`,
    );
  }

  async clearReservationRuleRoomType(ruleName: string): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE ReservationRules SET RoomTypeID = ''
       WHERE RuleID IN (SELECT RuleID FROM ReservationRules WHERE PropertyID = ${this.propertyId} AND Notes LIKE '%${ruleName}%')
       AND PropertyID = ${this.propertyId}`,
    );
  }

  async setReservationRuleBookingEngineModule(
    ruleName: string,
    enableDisable: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE ReservationRules SET IsEwrRule = ${enableDisable}
       WHERE RuleID IN (SELECT RuleID FROM ReservationRules WHERE PropertyID = ${this.propertyId} AND Notes LIKE '%${ruleName}%')
       AND PropertyID = ${this.propertyId}`,
    );
  }

  async setReservationRuleFrontOfficeModule(
    ruleName: string,
    enableDisable: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE ReservationRules SET IsPmsRule = ${enableDisable}
       WHERE RuleID IN (SELECT RuleID FROM ReservationRules WHERE PropertyID = ${this.propertyId} AND Notes LIKE '%${ruleName}%')
       AND PropertyID = ${this.propertyId}`,
    );
  }

  async setReservationRuleBookingEngineMessage(
    ruleName: string,
    enableDisable: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE ReservationRules SET IsOnlineDesc = ${enableDisable}
       WHERE RuleID IN (SELECT RuleID FROM ReservationRules WHERE PropertyID = ${this.propertyId} AND Notes LIKE '%${ruleName}%')
       AND PropertyID = ${this.propertyId}`,
    );
  }

  async setReservationRuleFrontOfficeMessage(
    ruleName: string,
    enableDisable: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE ReservationRules SET DisplayNotes = ${enableDisable}
       WHERE RuleID IN (SELECT RuleID FROM ReservationRules WHERE PropertyID = ${this.propertyId} AND Notes LIKE '%${ruleName}%')
       AND PropertyID = ${this.propertyId}`,
    );
  }

  async setReservationRuleMinRooms(
    ruleName: string,
    enableDisable: number,
    value: number,
  ): Promise<void> {
    await this.setReservationRuleFlag(ruleName, "IsMinRoom", enableDisable);
    await this.setReservationRuleValue(ruleName, "MinRoom", value);
  }

  async setReservationRuleMaxRooms(
    ruleName: string,
    enableDisable: number,
    value: number,
  ): Promise<void> {
    await this.setReservationRuleFlag(ruleName, "IsMaxRoom", enableDisable);
    await this.setReservationRuleValue(ruleName, "MaxRoom", value);
  }

  async setReservationRuleMinNights(
    ruleName: string,
    enableDisable: number,
    value: number,
  ): Promise<void> {
    await this.setReservationRuleFlag(ruleName, "IsMinNight", enableDisable);
    await this.setReservationRuleValue(ruleName, "MinNight", value);
  }

  async setReservationRuleMaxNights(
    ruleName: string,
    enableDisable: number,
    value: number,
  ): Promise<void> {
    await this.setReservationRuleFlag(ruleName, "IsMaxNight", enableDisable);
    await this.setReservationRuleValue(ruleName, "MaxNight", value);
  }

  async setReservationRuleDoNotAllow(
    ruleName: string,
    enableDisable: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE ReservationRules SET IsAllowRes = ${enableDisable}
       WHERE RuleID IN (SELECT RuleID FROM ReservationRules WHERE PropertyID = ${this.propertyId} AND Notes LIKE '%${ruleName}%')
       AND PropertyID = ${this.propertyId}`,
    );
  }

  async setReservationRuleClosedToArrival(
    ruleName: string,
    enableDisable: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE ReservationRules SET IsClosedToArrival = ${enableDisable}
       WHERE RuleID IN (SELECT RuleID FROM ReservationRules WHERE PropertyID = ${this.propertyId} AND Notes LIKE '%${ruleName}%')
       AND PropertyID = ${this.propertyId}`,
    );
  }

  async setReservationRuleOverride(
    ruleName: string,
    enableDisable: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE ReservationRules SET OverrideRule = ${enableDisable}
       WHERE RuleID IN (SELECT RuleID FROM ReservationRules WHERE PropertyID = ${this.propertyId} AND Notes LIKE '%${ruleName}%')
       AND PropertyID = ${this.propertyId}`,
    );
  }

  async setReservationRuleOverridePassword(
    ruleName: string,
    password: string,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE ReservationRules SET Password = ${password}
       WHERE RuleID IN (SELECT RuleID FROM ReservationRules WHERE PropertyID = ${this.propertyId} AND Notes LIKE '%${ruleName}%')
       AND PropertyID = ${this.propertyId}`,
    );
  }

  // ***************** Payment Gateway *********************************

  async ensureCashDrawerOpen(): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `IF NOT EXISTS (
         SELECT 1 FROM InventoryRpt
         WHERE PropertyID = ${this.propertyId} AND CashFlag = 1 AND OpenFlag = 1
       )
       INSERT INTO InventoryRpt (
         UserName, DatetimeOpened, DatetimeClosed, OpeningBalance,
         CashReceived, CashSpent, ClosingBalance, PropertyID, type,
         CashFlag, OpenFlag, OpeningNotes
       ) VALUES (
         'Automation', GETDATE(), '1900-01-01', 0,
         0, 0, 0, ${this.propertyId}, 1,
         1, 1, 'Playwright billing test setup'
       )`,
    );
  }

  async setRateDepositRequired(
    rateName: string,
    enabled: boolean,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE GroupRates SET DepositRequired = ${enabled ? 1 : 0}
       WHERE Property_ID = ${this.propertyId} AND Groupname = '${rateName}'`,
    );
  }

  async disableDepositForAllRates(): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE GroupRates SET DepositRequired = 0
       WHERE Property_ID = ${this.propertyId}`,
    );
  }

  async setRateDepositType(
    rateName: string,
    depositType: string,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE GroupRates SET DepositType = '${depositType}'
       WHERE Property_ID = ${this.propertyId} AND Groupname = '${rateName}'`,
    );
  }

  async setRateDepositValue(
    rateName: string,
    depositValue: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE GroupRates SET DepositValue = ${depositValue}
       WHERE Property_ID = ${this.propertyId} AND Groupname = '${rateName}'`,
    );
  }

  async setRateDepositApplyBySeason(
    rateName: string,
    enabled: boolean,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE GroupRates SET DepositApplyBySeason = ${enabled ? 1 : 0}
       WHERE Property_ID = ${this.propertyId} AND Groupname = '${rateName}'`,
    );
  }

  async setSeasonDateRange(
    seasonName: string,
    fromDate: string,
    toDate: string,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE DefinitionRate
       SET MultiDate = 1, FromDate = '${fromDate}', ToDate = '${toDate}'
       WHERE PropertyID = ${this.propertyId} AND SeasonName = '${seasonName}'`,
    );
  }

  async setRateSeasonDepositPolicy(
    rateName: string,
    seasonName: string,
    depositType: string,
    depositValue: number,
    enabled: boolean,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `MERGE RatePlanDepositSeasonPolicy AS target
       USING (
         SELECT ${this.propertyId} AS PropertyId,
                (SELECT Gid FROM GroupRates WHERE Property_ID = ${this.propertyId} AND Groupname = '${rateName}') AS Gid,
                (SELECT DefinitionRateID FROM DefinitionRate WHERE PropertyID = ${this.propertyId} AND SeasonName = '${seasonName}') AS DefinitionRateID
       ) AS source
       ON target.PropertyId = source.PropertyId AND target.Gid = source.Gid
          AND target.DefinitionRateID = source.DefinitionRateID
       WHEN MATCHED THEN UPDATE SET DepositType = '${depositType}',
         DepositValue = ${depositValue}, IsEnabled = ${enabled ? 1 : 0}, ModifiedDate = GETDATE()
       WHEN NOT MATCHED THEN INSERT
         (PropertyId, Gid, DefinitionRateID, DepositType, DepositValue, IsEnabled, CreatedDate)
         VALUES (source.PropertyId, source.Gid, source.DefinitionRateID,
                 '${depositType}', ${depositValue}, ${enabled ? 1 : 0}, GETDATE());`,
    );
  }

  async getRateDepositPolicy(
    rateName: string,
  ): Promise<RateDepositPolicy | null> {
    return DatabaseUtils.getRow<RateDepositPolicy>(
      `SELECT DepositRequired, DepositType, DepositValue, DepositApplyBySeason FROM GroupRates
       WHERE Property_ID = ${this.propertyId} AND Groupname = '${rateName}'`,
    );
  }

  async setPGNoValidation(): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Property
       SET ccvalidation = 'NotRqValidation', ccvalidationonline = 'NotRqValidation'
       WHERE property_id = ${this.propertyId}`,
    );
  }

  async setPGValidation(): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Property
       SET ccvalidation = 'RqValidation', ccvalidationonline = 'RqValidation'
       WHERE property_id = ${this.propertyId}`,
    );
  }

  async setPGAuthorizeNet(): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Property
       SET username =  '${paymentCredential("env_AuthorizeNetUsername").replace(/'/g, "''")}', password =  '${paymentCredential("env_AuthorizeNetPassword").replace(/'/g, "''")}',
           ccvalidation = 'AuthValidation', usernameonline =  '${paymentCredential("env_AuthorizeNetUsername").replace(/'/g, "''")}',
           passwordonline =  '${paymentCredential("env_AuthorizeNetPassword").replace(/'/g, "''")}', ccvalidationonline = 'AuthValidation'
       WHERE property_id = ${this.propertyId}`,
    );
  }

  async getAuthorizeNetCredentials(): Promise<AuthorizeNetCredentials | null> {
    return DatabaseUtils.getRow<AuthorizeNetCredentials>(
      `SELECT username AS apiLoginId, password AS transactionKey
       FROM Property WHERE property_id = ${this.propertyId}`,
    );
  }

  async getBridgePayCredentials(): Promise<BridgePayCredentials | null> {
    return DatabaseUtils.getRow<BridgePayCredentials>(
      `select BridgePayPassword, BridgePayMerchantAccountCode
       from Property where property_id = 5447`,
    );
  }

  async getOnlineBookingBridgePayCredentials(): Promise<OnlineBookingBridgePayCredentials | null> {
    return DatabaseUtils.getRow<OnlineBookingBridgePayCredentials>(
      `SELECT BridgePayPasswordOnline, BridgePayMerchantAccountCodeOnline
       FROM Property WHERE property_id = 5447`,
    );
  }

  async setPGShift4(): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Property
       SET ccvalidation = 'Shift4', ccvalidationonline = 'Shift4',
           username =  '${paymentCredential("env_Shift4Username").replace(/'/g, "''")}',
           usernameonline =  '${paymentCredential("env_Shift4Username").replace(/'/g, "''")}'
       WHERE property_id = ${this.propertyId}`,
    );
  }

  async setPGStripe(): Promise<void> {
    const stripeAccountId = paymentCredential("env_StripeAccountId").replace(/'/g, "''");
    const stripeClientId = paymentCredential("env_StripeClientId").replace(/'/g, "''");
    const stripeSecretKey = paymentCredential("env_StripeSecretKey").replace(/'/g, "''");
    if (!stripeAccountId || !stripeClientId || !stripeSecretKey) {
      throw new Error(
        "Stripe credentials are missing. Copy config/payment-gateways.env.example to config/payment-gateways.env and configure env_StripeAccountId, env_StripeClientId, and env_StripeSecretKey.",
      );
    }

    await DatabaseUtils.executeUpdate(
      `UPDATE Property
       SET ccvalidation = 'Stripe', ccvalidationonline = 'Stripe',
           StripeAccountId = '${stripeAccountId}',
           StripeClientId = '${stripeClientId}',
           IsStripeConnected = 1,
           StripeSKey = '${stripeSecretKey}'
       WHERE property_id = ${this.propertyId}`,
    );
  }

  async setPGPaystack(): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Property
       SET payStackSecretKey =  '${paymentCredential("env_PaystackPayStackSecretKey").replace(/'/g, "''")}',
           password =  '${paymentCredential("env_PaystackPassword").replace(/'/g, "''")}',
           passwordonline =  '${paymentCredential("env_PaystackPassword").replace(/'/g, "''")}',
           ccvalidation = 'payStack', ccvalidationonline = 'payStack'
       WHERE property_id = ${this.propertyId}`,
    );
  }

  async setPGCashfree(): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Property
       SET ccvalidationonline = 'CashFree', usernameonline =  '${paymentCredential("env_CashfreeUsername").replace(/'/g, "''")}',
           passwordonline =  '${paymentCredential("env_CashfreePassword").replace(/'/g, "''")}',
           ccvalidation = 'CashFree', username =  '${paymentCredential("env_CashfreeUsername").replace(/'/g, "''")}',
           password =  '${paymentCredential("env_CashfreePassword").replace(/'/g, "''")}'
       WHERE property_id = ${this.propertyId}`,
    );
  }

  async setPGMoneris(): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Property
       SET CCValidation = 'Square', UserName =  '${paymentCredential("env_MonerisUserName").replace(/'/g, "''")}', Password =  '${paymentCredential("env_MonerisPassword").replace(/'/g, "''")}',
           MonerisRegion = 'Moneris', CCValidationOnline = 'Square',
           UserNameOnline =  '${paymentCredential("env_MonerisUserName").replace(/'/g, "''")}', PasswordOnline =  '${paymentCredential("env_MonerisPassword").replace(/'/g, "''")}'
       WHERE property_id = ${this.propertyId}`,
    );
  }

  async setPGSquare(): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Property
       SET CCValidation = 'Square',
           UserName =  '${paymentCredential("env_SquareUserName").replace(/'/g, "''")}',
           Password =  '${paymentCredential("env_SquarePassword").replace(/'/g, "''")}',
           MonerisRegion =  '${paymentCredential("env_SquareMonerisRegion").replace(/'/g, "''")}', CCValidationOnline = 'Square',
           UserNameOnline =  '${paymentCredential("env_SquareUserName").replace(/'/g, "''")}',
           PasswordOnline =  '${paymentCredential("env_SquarePassword").replace(/'/g, "''")}'
       WHERE property_id = ${this.propertyId}`,
    );
  }

  async setPGPayroc(): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Property
       SET username =  '${paymentCredential("env_PayrocUsername").replace(/'/g, "''")}', password =  '${paymentCredential("env_PayrocPassword").replace(/'/g, "''")}', ccvalidation = 'PAYROC',
           usernameonline =  '${paymentCredential("env_PayrocUsername").replace(/'/g, "''")}', passwordonline =  '${paymentCredential("env_PayrocPassword").replace(/'/g, "''")}', ccvalidationonline = 'PAYROC'
       WHERE property_id = ${this.propertyId}`,
    );
  }

  async setPGPaypal(): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Property
       SET CCValidation = 'PaypalCheckout',
           ClientId =  '${paymentCredential("env_PaypalClientId").replace(/'/g, "''")}',
           ClientSecret =  '${paymentCredential("env_PaypalClientSecret").replace(/'/g, "''")}',
           MonerisRegion = 'Moneris', CCValidationOnline = 'PaypalCheckout',
           ClientIdOnline =  '${paymentCredential("env_PaypalClientId").replace(/'/g, "''")}',
           ClientSecretOnline =  '${paymentCredential("env_PaypalClientSecret").replace(/'/g, "''")}'
       WHERE property_id = ${this.propertyId}`,
    );
  }

  async setPGUSAePay(): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Property
       SET username =  '${paymentCredential("env_USAePayUsername").replace(/'/g, "''")}', password =  '${paymentCredential("env_USAePayPassword").replace(/'/g, "''")}',
           ccvalidation = 'USAPAY', usernameonline =  '${paymentCredential("env_USAePayUsername").replace(/'/g, "''")}',
           passwordonline =  '${paymentCredential("env_USAePayPassword").replace(/'/g, "''")}', ccvalidationonline = 'USAPAY'
       WHERE property_id = ${this.propertyId}`,
    );
  }

  // ***************** Inventory Items *********************************

  async setInventoryItemOnlineBooking(
    itemName: string,
    enableDisable: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET Online = ${enableDisable}
       WHERE AccountCode IN (SELECT AccountCode FROM ACCOUNT WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}')
       AND PropertyID = ${this.propertyId}`,
    );
  }

  async setInventoryItemAppliedLodging(
    itemName: string,
    enableDisable: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET AppliedLodge = ${enableDisable}
       WHERE AccountCode IN (SELECT AccountCode FROM ACCOUNT WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}')
       AND PropertyID = ${this.propertyId}`,
    );
    await DatabaseUtils.executeUpdate(
      `UPDATE AccountLodge SET AppliedLodge = ${enableDisable}
       WHERE AccountCode IN (SELECT AccountCode FROM ACCOUNT WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}')
       AND PropertyID = ${this.propertyId}`,
    );
  }

  async setInventoryItemTax1(itemName: string, taxName: string): Promise<void> {
    await this.setInventoryItemTax(itemName, taxName, "Tax", "Tax");
  }

  async setInventoryItemTax2(itemName: string, taxName: string): Promise<void> {
    await this.setInventoryItemTax(itemName, taxName, "Tax2", "Tax2");
  }

  async setInventoryItemTax3(itemName: string, taxName: string): Promise<void> {
    await this.setInventoryItemTax(itemName, taxName, "Tax3", "Tax3");
  }

  async setInventoryItemDisabled(
    itemName: string,
    enableDisable: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET AccDisable = ${enableDisable}
       WHERE AccountCode IN (SELECT AccountCode FROM ACCOUNT WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}')
       AND PropertyID = ${this.propertyId}`,
    );
  }

  async setInventoryItemAmount(
    itemCode: string,
    amount: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET Amount = '${amount}'
       WHERE AccountCode = ${itemCode} AND PropertyID = ${this.propertyId}`,
    );
    await DatabaseUtils.executeUpdate(
      `UPDATE AccountLodge SET Amount = '${amount}'
       WHERE AccountCode = ${itemCode} AND PropertyID = ${this.propertyId}`,
    );
  }

  /**
   * Sets the EWR inventory price in the writable account tables.
   * AccountCodes is a derived view in the configured database, so its displayed
   * Amount is updated through Account rather than by writing to the view.
   */
  async setOnlineBookingInventoryItemAmount(
    itemName: string,
    amount: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET Amount = ${amount}
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
    await DatabaseUtils.executeUpdate(
      `UPDATE AccountLodge SET Amount = ${amount}
       WHERE PropertyID = ${this.propertyId}
       AND AccountCode IN (
         SELECT AccountCode FROM Account
         WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'
       )`,
    );
  }

  async getInventoryItemNoOfItems(itemName: string): Promise<string | null> {
    return DatabaseUtils.getValue(
      `SELECT NoofItems FROM Account
       WHERE AccountName = '${itemName}' AND PropertyID = ${this.propertyId}`,
      "NoofItems",
    );
  }

  async getInventoryItemAccountCode(itemName: string): Promise<string | null> {
    return DatabaseUtils.getValue(
      `SELECT AccountCode FROM Account
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
      "AccountCode",
    );
  }

  async requireInventoryItemAccountCode(itemName: string): Promise<string> {
    const accountCode = await this.getInventoryItemAccountCode(itemName);
    if (!accountCode) {
      throw new Error(`No account code configured for '${itemName}'.`);
    }
    return accountCode;
  }

  // ***************** Yield Management *********************************

  async setYieldDiscountMode(itemName: string): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET DiscountMode = 'Yield Management'
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
  }

  async setYieldModeOccupancy(itemName: string): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET IsOccupancy = 1
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
  }

  async setYieldModeRate(itemName: string): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET IsOccupancy = 0
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
  }

  async setYieldDiscountTypeFlat(itemName: string): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET DiscountType = 'Flat'
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
  }

  async setYieldDiscountTypePercentage(itemName: string): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET DiscountType = 'Percentage'
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
  }

  async addYieldOccupancyRange(
    itemName: string,
    fromOccupancy: number,
    toOccupancy: number,
    type: string,
    variation: string,
    discountAmount: number,
  ): Promise<void> {
    const amount =
      variation === "Decrease" ? -Math.abs(discountAmount) : discountAmount;
    const accountCode = await this.getInventoryItemAccountCode(itemName);
    await DatabaseUtils.executeUpdate(
      `INSERT INTO YMLevels (PropertyId, AccountCode, MinOccupancy, MaxOccupancy, Type, Amount)
       VALUES (${this.propertyId}, ${accountCode}, ${fromOccupancy}, ${toOccupancy}, '${type}', ${amount})`,
    );
  }

  async deleteYieldOccupancyRanges(itemName: string): Promise<void> {
    const accountCode = await this.getInventoryItemAccountCode(itemName);
    await DatabaseUtils.executeUpdate(
      `DELETE FROM YMLevels
       WHERE PropertyId = ${this.propertyId} AND AccountCode = ${accountCode}`,
    );
  }

  async setYieldAppliesToWebBooking(
    itemName: string,
    enableDisable: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET IsEWR = ${enableDisable}
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
  }

  async setYieldAppliesToFrontOffice(
    itemName: string,
    enableDisable: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET IsPMS = ${enableDisable}
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
  }

  async setYieldDateRange(
    itemName: string,
    fromDate: string,
    toDate: string,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET FromDate = '${fromDate}', ToDate = '${toDate}'
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
  }

  async setYieldDaysApplied(
    itemName: string,
    isSun: number,
    isMon: number,
    isTue: number,
    isWed: number,
    isThu: number,
    isFri: number,
    isSat: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account
       SET Sun = ${isSun}, Mon = ${isMon}, Tue = ${isTue}, Wed = ${isWed},
           Thu = ${isThu}, Fri = ${isFri}, Sat = ${isSat}
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
  }

  async setYieldAllRoomTypes(itemName: string): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET IsRooms = 1
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET DiscountRooms = (SELECT STRING_AGG(RoomTypeID, ',') FROM RoomType WHERE Property_id = ${this.propertyId})
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
  }

  async clearYieldRoomTypes(itemName: string): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET IsRooms = 1
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET DiscountRooms = ''
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
  }

  async setYieldParticularRoomType(
    itemName: string,
    roomTypeName: string,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET IsRooms = 1
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET DiscountRooms = (SELECT RoomTypeID FROM RoomType WHERE Property_id = ${this.propertyId} AND RoomtypeName = '${roomTypeName}')
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
  }

  async setYieldDisabled(
    itemName: string,
    enableDisable: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET AccDisable = ${enableDisable}
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
  }

  async setYieldAmount(itemName: string, amount: number): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET Amount = ${amount}
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
  }

  async setYieldMinNights(
    itemName: string,
    enableDisable: number,
    value: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET IsMinNights = ${enableDisable}, MinNights = ${value}
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
  }

  async setYieldMaxNights(
    itemName: string,
    enableDisable: number,
    value: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET IsMaxNights = ${enableDisable}, MaxNights = ${value}
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
  }

  async setYieldMinRooms(
    itemName: string,
    enableDisable: number,
    value: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET IsMinRooms = ${enableDisable}, MinRooms = ${value}
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
  }

  async setYieldMaxRooms(
    itemName: string,
    enableDisable: number,
    value: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET IsMaxRooms = ${enableDisable}, MaxRooms = ${value}
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
  }

  async setYieldMinAdults(
    itemName: string,
    enableDisable: number,
    value: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET IsMinAdults = ${enableDisable}, MinAdults = ${value}
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
  }

  async setYieldMaxAdults(
    itemName: string,
    enableDisable: number,
    value: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET IsMaxAdults = ${enableDisable}, MaxAdults = ${value}
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
  }

  // ***************** Promo Code *********************************

  async setPromoDiscountTypeFlat(itemName: string): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET DiscountType = 'Flat'
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
  }

  async setPromoDiscountTypePercentage(itemName: string): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET DiscountType = 'Percentage'
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
  }

  async setPromoAmount(itemName: string, amount: number): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET Amount = ${amount}
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
  }

  async setPromoDateRange(
    itemName: string,
    fromDate: string,
    toDate: string,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET FromDate = '${fromDate}', ToDate = '${toDate}'
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
  }

  async setPromoDaysApplied(
    itemName: string,
    isSun: number,
    isMon: number,
    isTue: number,
    isWed: number,
    isThu: number,
    isFri: number,
    isSat: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account
       SET Sun = ${isSun}, Mon = ${isMon}, Tue = ${isTue}, Wed = ${isWed},
           Thu = ${isThu}, Fri = ${isFri}, Sat = ${isSat}
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
  }

  async setPromoAllRooms(itemName: string): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET IsRooms = 1
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET DiscountRooms = (SELECT STRING_AGG(RoomTypeID, ',') FROM RoomType WHERE Property_id = ${this.propertyId})
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
  }

  async clearPromoRooms(itemName: string): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET IsRooms = 1
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET DiscountRooms = ''
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
  }

  async setPromoParticularRoomType(
    itemName: string,
    roomTypeName: string,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET IsRooms = 1
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET DiscountRooms = (SELECT RoomTypeID FROM RoomType WHERE Property_id = ${this.propertyId} AND RoomtypeName = '${roomTypeName}')
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
  }

  async setPromoCode(itemName: string, codeValue: string): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET ExtendedpromoCode = '${codeValue}'
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
  }

  async setPromoAlertMessage(itemName: string, message: string): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET PromoCodeText = '${message}'
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
  }

  async setPromoDisabled(
    itemName: string,
    enableDisable: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET AccDisable = ${enableDisable}
       WHERE PropertyID = ${this.propertyId} AND AccountName = '${itemName}'`,
    );
  }

  // ***************** Booking Engine Settings *********************************

  async setBEViewRoomName(): Promise<void> {
    await this.setEwrCalendarView("RoomName");
  }

  async setBEViewRoomType(): Promise<void> {
    await this.setEwrCalendarView("RoomType");
  }

  async setBEDisplayOrder(enableDisable: number): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE property SET DisplayOrder = ${enableDisable}
       WHERE property_id = ${this.propertyId}`,
    );
  }

  async setBEDisableRoomType(enableDisable: number): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE property SET DisableRoomtype = ${enableDisable}
       WHERE property_id = ${this.propertyId}`,
    );
  }

  async setBEDoNotAllowReservation(enableDisable: number): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE property SET IsAllowOnlineRes = ${enableDisable}
       WHERE property_id = ${this.propertyId}`,
    );
  }

  async setBEDoNotAllowReservationDays(days: number): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE property SET Leaddays = ${days}, NoOnlineInput = 1
       WHERE property_id = ${this.propertyId}`,
    );
  }

  async setBEDoNotAllowReservationDate(): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE property SET NoOnlineResFromdt = '2030-12-31 00:00:00.000', NoOnlineInput = 0
       WHERE property_id = ${this.propertyId}`,
    );
  }

  async setBEDoNotAllowDisplayMessage(enableDisable: number): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Property SET IsLeadRuleDesc = ${enableDisable}
       WHERE property_id = ${this.propertyId}`,
    );
  }

  async setBENoOfChildren(enableDisable: number): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Property SET NoofChildren = ${enableDisable}
       WHERE property_id = ${this.propertyId}`,
    );
  }

  async setBEEnablePromoCode(): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Property SET OnlineDisType = 'AdvancedPromo'
       WHERE property_id = ${this.propertyId}`,
    );
  }

  async setBEPromoCodeAsTextbox(): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Property SET OnlineDisFieldType = 'TextBox'
       WHERE property_id = ${this.propertyId}`,
    );
  }

  async setBEPromoCodeAsDropdown(): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Property SET OnlineDisFieldType = 'DropDown'
       WHERE property_id = ${this.propertyId}`,
    );
  }

  async setBELeadDays(leadDays: number): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE property SET Leadtime = '${leadDays}'
       WHERE property_id = ${this.propertyId}`,
    );
  }

  // async setBELeadCutOffTime(
  //   cutOffTime: "future" | "past",
  // ): Promise<string | null> {
  //   const { DateTime } = await import("luxon");
  //   let dt = DateTime.now().setZone("America/Chicago");

  //   if (cutOffTime === "future") {
  //     dt = dt.plus({ hours: 1 });
  //   } else {
  //     dt = dt.minus({ hours: 1 });
  //   }

  //   const minutes = dt.minute;
  //   const roundedMinutes = minutes < 15 || minutes >= 45 ? 0 : 30;
  //   dt = dt.set({ minute: roundedMinutes, second: 0, millisecond: 0 });

  //   const formatted = dt.toFormat("yyyy-MM-dd HH:mm:ss.SSS");

  //   await DatabaseUtils.executeUpdate(
  //     `UPDATE property SET cutofftime = '${formatted}'
  //      WHERE property_id = ${this.propertyId}`,
  //   );

  //   return cutOffTime === "past" ? dt.toFormat("HH:mm") : null;
  // }

  // ***************** Deposit Types *********************************

  async setDepositType(depositType: string): Promise<void> {
    switch (depositType) {
      case "No of nights":
        await this.setDepositNoOfNights(1);
        break;
      case "No of nights with tax":
        await this.setDepositNoOfNightsWithTax(1);
        break;
      case "Percentage of stay":
        await this.setDepositPercentageOfStay(50);
        break;
      case "Fixed or flat":
        await this.setDepositFixedOrFlat(40);
        break;
      case "No deposit":
        await this.setDepositNoDeposit();
        break;
      case "Full amount":
        await this.setDepositFullAmount();
        break;
      case "Percentage of total":
        await this.setDepositPercentageOfTotal(60);
        break;
      default:
        throw new Error(`Invalid deposit type: ${depositType}`);
    }
  }

  async setDepositNoOfNights(nights: number): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE property SET PaymentType = 'NOOFDAYS', Paymentvalue = '${nights}'
       WHERE property_id = ${this.propertyId}`,
    );
  }

  async setDepositNoOfNightsWithTax(nights: number): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE property SET PaymentType = 'NOOFNIGTHSWITHTAX', Paymentvalue = '${nights}'
       WHERE property_id = ${this.propertyId}`,
    );
  }

  async setDepositPercentageOfStay(percentage: number): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE property SET PaymentType = 'PERCENTAGE', Paymentvalue = '${percentage}'
       WHERE property_id = ${this.propertyId}`,
    );
  }

  async setDepositFixedOrFlat(amount: number): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE property SET PaymentType = 'FLAT', Paymentvalue = '${amount}'
       WHERE property_id = ${this.propertyId}`,
    );
  }

  async setDepositNoDeposit(): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE property SET PaymentType = 'NODEPOSIT', Paymentvalue = '0'
       WHERE property_id = ${this.propertyId}`,
    );
  }

  async setDepositFullAmount(): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE property SET PaymentType = 'FULL', Paymentvalue = '0'
       WHERE property_id = ${this.propertyId}`,
    );
  }

  async setDepositPercentageOfTotal(percentage: number): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE property SET PaymentType = 'ReservationTotal', Paymentvalue = '${percentage}'
       WHERE property_id = ${this.propertyId}`,
    );
  }

  // ***************** Assertions *********************************

  async verifyBulkRatePushesOTARates(todayDate: string): Promise<void> {
    const fromDate = await DatabaseUtils.getValue(
      `SELECT FromDate FROM GDSSettings
       WHERE PropertyId = ${this.propertyId} AND OTAProvider = 'Google Hotels'`,
      "FromDate",
    );
    const cleanDate = (fromDate ?? "").replace(" 00:00:00.0", "");

    if (cleanDate !== todayDate) {
      throw new Error(
        `Expected OTA FromDate '${todayDate}' but got '${cleanDate}'`,
      );
    }

    const sendRate = await DatabaseUtils.getValue(
      `SELECT SendRate FROM GDSSettings
       WHERE PropertyId = ${this.propertyId} AND OTAProvider = 'Google Hotels'`,
      "SendRate",
    );

    if (sendRate !== "1") {
      throw new Error(`Expected SendRate '1' but got '${sendRate}'`);
    }
  }

  async verifyBulkRateNotPushingOTARates(): Promise<void> {
    const fromDate = await DatabaseUtils.getValue(
      `SELECT FromDate FROM GDSSettings
       WHERE PropertyId = ${this.propertyId} AND OTAProvider = 'Google Hotels'`,
      "FromDate",
    );
    const cleanDate = (fromDate ?? "").replace(" 00:00:00.0", "");

    if (cleanDate !== "2000-01-01") {
      throw new Error(
        `Expected OTA FromDate '2000-01-01' but got '${cleanDate}'`,
      );
    }

    const sendRate = await DatabaseUtils.getValue(
      `SELECT SendRate FROM GDSSettings
       WHERE PropertyId = ${this.propertyId} AND OTAProvider = 'Google Hotels'`,
      "SendRate",
    );

    if (sendRate !== "0") {
      throw new Error(`Expected SendRate '0' but got '${sendRate}'`);
    }
  }

  // ***************** Private Helpers *********************************

  private parseWeekdayFlags(weekdays: string) {
    return {
      mon: weekdays.includes("Mon") ? 1 : 0,
      tue: weekdays.includes("Tue") ? 1 : 0,
      wed: weekdays.includes("Wed") ? 1 : 0,
      thu: weekdays.includes("Thu") ? 1 : 0,
      fri: weekdays.includes("Fri") ? 1 : 0,
      sat: weekdays.includes("Sat") ? 1 : 0,
      sun: weekdays.includes("Sun") ? 1 : 0,
    };
  }

  private async setReservationRuleFlag(
    ruleName: string,
    column: string,
    value: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE ReservationRules SET ${column} = ${value}
       WHERE RuleID IN (SELECT RuleID FROM ReservationRules WHERE PropertyID = ${this.propertyId} AND Notes LIKE '%${ruleName}%')
       AND PropertyID = ${this.propertyId}`,
    );
  }

  private async setReservationRuleValue(
    ruleName: string,
    column: string,
    value: number,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE ReservationRules SET ${column} = ${value}
       WHERE RuleID IN (SELECT RuleID FROM ReservationRules WHERE PropertyID = ${this.propertyId} AND Notes LIKE '%${ruleName}%')
       AND PropertyID = ${this.propertyId}`,
    );
  }

  private async setInventoryItemTax(
    itemName: string,
    taxName: string,
    accountColumn: string,
    lodgeColumn: string,
  ): Promise<void> {
    await DatabaseUtils.executeUpdate(
      `UPDATE Account SET ${accountColumn} = (SELECT TaxID FROM TAXES WHERE PropertyID = ${this.propertyId} AND TaxName = '${taxName}')
       WHERE AccountName = '${itemName}' AND PropertyID = ${this.propertyId}`,
    );
    await DatabaseUtils.executeUpdate(
      `UPDATE AccountLodge SET ${lodgeColumn} = CONCAT('-', (SELECT TaxID FROM TAXES WHERE PropertyID = ${this.propertyId} AND TaxName = '${taxName}'))
       WHERE AccountName = '${itemName}' AND PropertyID = ${this.propertyId}`,
    );
  }

  private async setDisplayOrders(
    table: "RoomType" | "Rooms",
    idColumn: "RoomTypeID" | "Room_id",
    orders: ReadonlyArray<{ id: number; displayOrder: number | null }>,
  ): Promise<void> {
    if (orders.length === 0)
      throw new Error("At least one display order is required.");
    const cases = orders
      .map(
        ({ id, displayOrder }) => `WHEN ${id} THEN ${displayOrder ?? "NULL"}`,
      )
      .join(" ");
    const ids = orders.map(({ id }) => id).join(", ");
    await DatabaseUtils.executeUpdate(
      `UPDATE ${table} SET CondoSortOrder = CASE ${idColumn} ${cases} END
       WHERE Property_id = ${this.propertyId} AND ${idColumn} IN (${ids})`,
    );
  }

  private async restoreDisplayOrders(
    table: "RoomType" | "Rooms",
    idColumn: "RoomTypeID" | "Room_id",
    rows: ReadonlyArray<SortableRoomType>,
  ): Promise<void> {
    if (rows.length === 0) return;
    await this.setDisplayOrders(
      table,
      idColumn,
      rows.map(({ id, displayOrder }) => ({ id, displayOrder })),
    );
  }

  private async restoreNotificationSettings(): Promise<void> {
    const snapshot = this.notificationSettingsSnapshot;
    if (!snapshot) return;

    await DatabaseUtils.executeUpdate(
      `DELETE FROM NotificationSettingEnabled
       WHERE property_id = ${this.propertyId} AND user_id = ${snapshot.userId}
       AND setting_id IN (1, 2)`,
    );
    for (const settingId of snapshot.enabledSettingIds) {
      await DatabaseUtils.executeUpdate(
        `INSERT INTO NotificationSettingEnabled (setting_id, property_id, user_id)
         VALUES (${settingId}, ${this.propertyId}, ${snapshot.userId})`,
      );
    }
    this.notificationSettingsSnapshot = null;
  }

  private sqlString(value: string | null): string {
    return value === null ? "NULL" : `'${value.replace(/'/g, "''")}'`;
  }
}
