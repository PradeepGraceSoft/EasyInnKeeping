import { ConfigManager } from "../ConfigManager";
import { DatabaseUtils } from "./DatabaseUtils";

export type ActivityLogEntry = {
  activity: string;
  staffName: string;
  details: string;
  createdAt: Date;
};

export type ReservationCampaignFieldSample = {
  value: string;
};

export type ReservationCampaignCondition = {
  fieldName: string;
  value: string;
  condition?: "AND" | "OR";
};

export type ReservationCampaignConditionSample = {
  city: string;
  state: string;
  country: string;
};

/**
 * Reservation-specific DB operations.
 */
export class ReservationDatabaseHelper {
  constructor(private readonly configuredPropertyId?: string) {}

  private get propertyId(): string {
    const propertyId = this.configuredPropertyId ?? ConfigManager.testData.propertyId;

    if (!propertyId) {
      throw new Error("propertyId is not configured in test data.");
    }

    return propertyId;
  }

  // ***************** Dashboard Counts *********************************

  async getDashboardBusinessDate(daysToAdd = 0): Promise<string> {
    if (!Number.isInteger(daysToAdd) || !/^\d+$/.test(this.propertyId)) {
      throw new Error("Dashboard dates require a numeric property ID and whole-day offset.");
    }
    const date = await DatabaseUtils.getValue(
      `SELECT CONVERT(varchar(10), DATEADD(day, ${daysToAdd}, dbo.GETDATE(${this.propertyId})), 23) AS BusinessDate`,
      "BusinessDate",
    );
    if (!date) throw new Error("The database did not return the Dashboard business date.");
    return date;
  }

  async getDashboardTotalGuestCount(date: string): Promise<number> {
    this.validateDashboardDate(date);
    // Sum today's room guest counts for arrivals and continuing stayovers.
    const count = await DatabaseUtils.getValue(
      `SELECT COALESCE(SUM(NoofGuest), 0) AS TotalGuest FROM BlockRooms
       WHERE Property_id = ${this.propertyId} AND Block_date = '${date} 00:00:00'
         AND Confirm_Num IN (
           SELECT Confirm_num FROM reservation
           WHERE Property_id = ${this.propertyId} AND status <> 'Cancelled'
             AND (
               Arr_date = '${date} 00:00:00'
               OR (Arr_date < '${date} 00:00:00' AND Dept_date > '${date} 00:00:00')
             )
         )`,
      "TotalGuest",
    );
    if (count === null) throw new Error("The database did not return total guests.");
    return Number(count);
  }

  async getDashboardNonExemptRoomRevenue(date: string): Promise<number> {
    this.validateDashboardDate(date);
    // Extend the arrival RoomRate query with continuing stayovers. EXISTS
    // excludes exempt reservations without multiplying room rows by invoices.
    const revenue = await DatabaseUtils.getValue(
      `SELECT COALESCE(SUM(b.RoomRate), 0) AS RoomRevenue
       FROM BlockRooms b
       WHERE b.Property_id = ${this.propertyId}
         AND b.Block_date = '${date} 00:00:00'
         AND b.Confirm_Num IN (
           SELECT r.Confirm_num FROM reservation r
           WHERE r.Property_id = ${this.propertyId} AND r.Status <> 'Cancelled'
             AND (
               r.Arr_date = '${date} 00:00:00'
               OR (r.Arr_date < '${date} 00:00:00' AND r.Dept_date > '${date} 00:00:00')
             )
             AND EXISTS (
               SELECT 1 FROM invoices i
               WHERE i.PropertyID = r.Property_id AND i.Confirm_num = r.Confirm_num
                 AND i.AccountCode = 105
             )
         )`,
      "RoomRevenue",
    );
    if (revenue === null || !Number.isFinite(Number(revenue))) {
      throw new Error("The database did not return a numeric non-exempt room revenue.");
    }
    return Number(revenue);
  }

  async getDashboardExemptRoomRevenue(date: string): Promise<number> {
    this.validateDashboardDate(date);
    const revenue = await DatabaseUtils.getValue(
      `SELECT COALESCE(SUM(b.RoomRate), 0) AS RoomRevenue
       FROM BlockRooms b
       INNER JOIN reservation r ON r.Property_id = b.Property_id AND r.Confirm_num = b.Confirm_Num
       WHERE b.Property_id = ${this.propertyId}
         AND b.Block_date = '${date} 00:00:00'
         AND r.Status <> 'Cancelled'
         AND (r.Arr_date = '${date} 00:00:00'
              OR (r.Arr_date < '${date} 00:00:00' AND r.Dept_date > '${date} 00:00:00'))
         AND NOT EXISTS (
           SELECT 1 FROM invoices i105
           WHERE i105.PropertyID = r.Property_id AND i105.Confirm_num = r.Confirm_num
             AND i105.AccountCode = 105
         )`,
      "RoomRevenue",
    );
    if (revenue === null || !Number.isFinite(Number(revenue))) {
      throw new Error("The database did not return a numeric exempt room revenue.");
    }
    return Number(revenue);
  }

  async getDashboardTotalRoomRevenue(date: string): Promise<number> {
    this.validateDashboardDate(date);
    const revenue = await DatabaseUtils.getValue(
      `SELECT COALESCE(SUM(b.RoomRate), 0) AS RoomRevenue
       FROM BlockRooms b INNER JOIN reservation r
         ON r.Property_id = b.Property_id AND r.Confirm_num = b.Confirm_Num
       WHERE b.Property_id = ${this.propertyId} AND b.Block_date = '${date} 00:00:00'
         AND r.Status <> 'Cancelled'
         AND (r.Arr_date = '${date} 00:00:00'
              OR (r.Arr_date < '${date} 00:00:00' AND r.Dept_date > '${date} 00:00:00'))`,
      "RoomRevenue",
    );
    if (revenue === null || !Number.isFinite(Number(revenue))) {
      throw new Error("The database did not return a numeric total room revenue.");
    }
    return Number(revenue);
  }

  async getDashboardOtherRevenue(date: string): Promise<number> {
    this.validateDashboardDate(date);
    const revenue = await DatabaseUtils.getValue(
      `SELECT COALESCE(SUM(i.Price * i.Quantity), 0) AS OtherRevenue
       FROM Invoices i INNER JOIN Reservation r
         ON r.Property_id = i.PropertyID AND r.Confirm_num = i.Confirm_num
       WHERE i.PropertyID = ${this.propertyId} AND i.AccountName = 'Charge Item'
         AND CAST(i.InvoiceDt AS date) = '${date}' AND r.Status <> 'Cancelled'
         AND (r.Arr_date = '${date} 00:00:00'
              OR (r.Arr_date < '${date} 00:00:00' AND r.Dept_date > '${date} 00:00:00'))`,
      "OtherRevenue",
    );
    if (revenue === null || !Number.isFinite(Number(revenue))) {
      throw new Error("The database did not return a numeric other revenue.");
    }
    return Number(revenue);
  }

  async getDashboardDiscount(date: string): Promise<number> {
    this.validateDashboardDate(date);
    const discount = await DatabaseUtils.getValue(
      `SELECT COALESCE(SUM(i.Price * i.Quantity), 0) AS Discount
       FROM Invoices i INNER JOIN Reservation r ON r.Property_id = i.PropertyID AND r.Confirm_num = i.Confirm_num
       WHERE i.PropertyID = ${this.propertyId} AND i.AccountName = 'Flat Discount'
         AND CAST(i.InvoiceDt AS date) = '${date}' AND r.Status <> 'Cancelled'
         AND (r.Arr_date = '${date} 00:00:00' OR (r.Arr_date < '${date} 00:00:00' AND r.Dept_date > '${date} 00:00:00'))`,
      "Discount",
    );
    if (discount === null || !Number.isFinite(Number(discount))) throw new Error("The database did not return a numeric discount.");
    return Number(discount);
  }

  async getDashboardConfirmedTotalRevenue(date: string): Promise<number> {
    const room = await this.getDashboardTotalRoomRevenue(date);
    const other = await this.getDashboardOtherRevenue(date);
    const discount = await this.getDashboardDiscount(date);
    return Number((room + other - discount).toFixed(2));
  }

  async getDashboardGuestMixCounts(date: string): Promise<{ adults: number; children: number }> {
    this.validateDashboardDate(date);
    const row = await DatabaseUtils.getRow<{ Adults: number | null; Children: number | null }>(
      `SELECT COALESCE(SUM(COALESCE(rr.NoGuest, 0)), 0) AS Adults,
              COALESCE(SUM(COALESCE(rr.Num_kids, 0)), 0) AS Children
       FROM ReservedRooms rr
       INNER JOIN reservation r
         ON r.Property_id = rr.Property_id AND r.Confirm_num = rr.Confirm_num
       WHERE rr.Property_id = ${this.propertyId}
         AND r.status <> 'Cancelled'
         AND (
           CAST(r.Arr_date AS date) = '${date}'
           OR (CAST(r.Arr_date AS date) < '${date}' AND CAST(r.Dept_date AS date) > '${date}')
         )`,
    );
    if (!row) throw new Error("The database did not return Guest Mix counts.");
    return { adults: Number(row.Adults ?? 0), children: Number(row.Children ?? 0) };
  }

  async getDashboardTotalRoomCount(date: string): Promise<number> {
    this.validateDashboardDate(date);
    const count = await DatabaseUtils.getValue(
      `SELECT COUNT(DISTINCT Room_id) AS TotalRooms FROM Rooms
       WHERE Property_id = ${this.propertyId} AND Create_date <= '${date}'`,
      "TotalRooms",
    );
    if (count === null) throw new Error("The database did not return total rooms.");
    return Number(count);
  }

  async getDashboardBlockedRoomCount(date: string): Promise<number> {
    this.validateDashboardDate(date);
    // sp_pms_dashboard's Occupancy mode excludes reservation and group blocks
    // from the maintenance blocks deducted from sellable inventory.
    const count = await DatabaseUtils.getValue(
      `SELECT COUNT(Room_id) AS Blocked FROM BlockRooms
       WHERE Property_id = ${this.propertyId} AND Blocked = 1
         AND Confirm_Num IS NULL AND RoomRate IS NULL
         AND CAST(Block_date AS date) = '${date}'`,
      "Blocked",
    );
    if (count === null) throw new Error("The database did not return blocked rooms.");
    return Number(count);
  }

  async getDashboardBlockedRoom(date: string): Promise<{ id: number; name: string } | null> {
    this.validateDashboardDate(date);
    return DatabaseUtils.getRow<{ id: number; name: string }>(
      `SELECT TOP (1) r.Room_id AS id, r.Room_name AS name
       FROM BlockRooms b
       INNER JOIN Rooms r ON r.Property_id = b.Property_id AND r.Room_id = b.Room_id
       WHERE b.Property_id = ${this.propertyId} AND b.Blocked = 1
         AND b.Confirm_Num IS NULL AND b.RoomRate IS NULL
         AND CAST(b.Block_date AS date) = '${date}'
       ORDER BY r.Room_name, r.Room_id`,
    );
  }

  async getDashboardOccupancyRoomCounts(date: string): Promise<{
    arrivals: number; stayovers: number; dayUse: number; groupBlocks: number;
  }> {
    this.validateDashboardDate(date);
    // Independently count the categories summed by sp_pms_dashboard Occupancy.
    // Presence on the preceding night distinguishes arrivals from stayovers;
    // same-day meeting rooms and unconfirmed group allocations also contribute.
    const counts = await DatabaseUtils.getRow<{
      arrivals: number; stayovers: number; dayUse: number; groupBlocks: number;
    }>(
      `WITH Occupied AS (
         SELECT b.Room_id, b.RoomType, b.Confirm_Num,
           CASE WHEN EXISTS (
             SELECT 1 FROM BlockRooms previous
             WHERE previous.Property_id = b.Property_id
               AND previous.Confirm_Num = b.Confirm_Num
               AND previous.Room_id = b.Room_id
               AND CAST(previous.Block_date AS date) = DATEADD(day, -1, CAST('${date}' AS date))
           ) THEN 1 ELSE 0 END AS PreviousNight
         FROM BlockRooms b
         INNER JOIN Reservation r ON r.Property_id = b.Property_id AND r.Confirm_num = b.Confirm_Num
         WHERE b.Property_id = ${this.propertyId} AND r.Status <> 'CANCELLED'
           AND b.Confirm_Num IS NOT NULL AND b.RoomRate IS NOT NULL
           AND CAST(b.Block_date AS date) = '${date}'
       )
       SELECT
         COUNT(DISTINCT CASE WHEN RoomType <> 'Meeting Room' AND Confirm_Num > 0 AND PreviousNight = 0 THEN Room_id END) AS arrivals,
         COUNT(DISTINCT CASE WHEN RoomType <> 'Meeting Room' AND Confirm_Num > 0 AND PreviousNight = 1 THEN Room_id END) AS stayovers,
         COUNT(DISTINCT CASE WHEN RoomType = 'Meeting Room' THEN Room_id END) AS dayUse,
         (SELECT COUNT(DISTINCT b.Room_id) FROM BlockRooms b
          INNER JOIN GroupBlock g ON g.Propertyid = b.Property_id AND g.GroupCode = b.GroupCode
          WHERE b.Property_id = ${this.propertyId} AND b.GroupCode > 0
            AND b.Confirm_Num = 0 AND b.RoomType <> 'Meeting Room'
            AND CAST(b.Block_date AS date) = '${date}') AS groupBlocks
       FROM Occupied`,
    );
    if (!counts) throw new Error("The database did not return Dashboard occupancy room counts.");
    return counts;
  }

  async getDashboardOccupiedReservation(date: string): Promise<{
    confirmationNumber: string; roomName: string;
  } | null> {
    this.validateDashboardDate(date);
    return DatabaseUtils.getRow<{ confirmationNumber: string; roomName: string }>(
      `SELECT TOP (1) CAST(r.Confirm_num AS varchar(30)) AS confirmationNumber,
              room.Room_name AS roomName
       FROM Reservation r
       INNER JOIN BlockRooms b ON b.Property_id = r.Property_id AND b.Confirm_Num = r.Confirm_num
       INNER JOIN Rooms room ON room.Property_id = b.Property_id AND room.Room_id = b.Room_id
       WHERE r.Property_id = ${this.propertyId} AND r.Status <> 'CANCELLED'
         AND r.Arr_date <= '${date}' AND r.Dept_date > '${date}'
         AND b.Confirm_Num > 0 AND b.RoomRate IS NOT NULL
         AND (b.RoomRate > 0 OR b.ExtraPersonCharge > 0)
         AND b.RoomType <> 'Meeting Room' AND CAST(b.Block_date AS date) = '${date}'
       ORDER BY CASE WHEN r.Arr_date = '${date}' THEN 0 ELSE 1 END,
                r.Confirm_num, room.Room_id`,
    );
  }

  async getDashboardAdrData(date: string): Promise<{
    arrivals: number; stayovers: number; reservedRooms: number; roomRevenue: number;
  }> {
    this.validateDashboardDate(date);
    const result = await DatabaseUtils.getRow<{
      arrivals: number; stayovers: number; reservedRooms: number; roomRevenue: number;
    }>(
      `WITH ReservedRoomNights AS (
         SELECT DISTINCT b.Room_id, b.Confirm_Num,
           ISNULL(b.RoomRate, 0) + ISNULL(b.ExtraPersonCharge, 0) AS RoomRevenue,
           CASE WHEN EXISTS (
             SELECT 1 FROM BlockRooms previous
             WHERE previous.Property_id = b.Property_id
               AND previous.Confirm_Num = b.Confirm_Num
               AND previous.Room_id = b.Room_id
               AND CAST(previous.Block_date AS date) = DATEADD(day, -1, CAST('${date}' AS date))
           ) THEN 1 ELSE 0 END AS IsStayover
         FROM BlockRooms b
         INNER JOIN Reservation r ON r.Property_id = b.Property_id AND r.Confirm_num = b.Confirm_Num
         WHERE b.Property_id = ${this.propertyId} AND r.Status <> 'CANCELLED'
           AND b.Confirm_Num > 0 AND b.RoomRate IS NOT NULL
           AND b.RoomType <> 'Meeting Room'
           AND CAST(b.Block_date AS date) = '${date}'
       )
       SELECT
         COUNT(DISTINCT CASE WHEN IsStayover = 0 THEN Room_id END) AS arrivals,
         COUNT(DISTINCT CASE WHEN IsStayover = 1 THEN Room_id END) AS stayovers,
         COUNT(DISTINCT Room_id) AS reservedRooms,
         CAST(ISNULL((
           SELECT SUM(night.RoomRevenue)
           FROM ReservedRoomNights night
           INNER JOIN Invoices i ON i.PropertyID = ${this.propertyId}
             AND i.Confirm_num = night.Confirm_Num AND i.AccountCode = 100
         ), 0) AS DECIMAL(18, 2)) AS roomRevenue
       FROM ReservedRoomNights`,
    );
    if (!result) throw new Error("The database did not return ADR room and revenue totals.");
    return {
      arrivals: Number(result.arrivals),
      stayovers: Number(result.stayovers),
      reservedRooms: Number(result.reservedRooms),
      roomRevenue: Number(result.roomRevenue),
    };
  }

  async getDashboardAdrReservation(date: string): Promise<{
    confirmationNumber: string; roomName: string; roomRate: number;
  } | null> {
    this.validateDashboardDate(date);
    return DatabaseUtils.getRow<{
      confirmationNumber: string; roomName: string; roomRate: number;
    }>(
      `SELECT TOP (1) CAST(r.Confirm_num AS varchar(30)) AS confirmationNumber,
              room.Room_name AS roomName, b.RoomRate AS roomRate
       FROM Reservation r
       INNER JOIN BlockRooms b ON b.Property_id = r.Property_id AND b.Confirm_Num = r.Confirm_num
       INNER JOIN Rooms room ON room.Property_id = b.Property_id AND room.Room_id = b.Room_id
       WHERE r.Property_id = ${this.propertyId} AND r.Status <> 'CANCELLED'
         AND r.Arr_date <= '${date}' AND r.Dept_date > '${date}'
         AND b.Confirm_Num > 0 AND b.RoomRate IS NOT NULL
         AND b.RoomType <> 'Meeting Room' AND CAST(b.Block_date AS date) = '${date}'
         AND EXISTS (SELECT 1 FROM Invoices i
                     WHERE i.PropertyID = r.Property_id
                       AND i.Confirm_num = r.Confirm_num AND i.AccountCode = 100)
         AND (SELECT COUNT(DISTINCT roomCount.Room_id) FROM BlockRooms roomCount
              WHERE roomCount.Property_id = r.Property_id
                AND roomCount.Confirm_Num = r.Confirm_num
                AND roomCount.RoomRate IS NOT NULL
                AND roomCount.RoomType <> 'Meeting Room'
                AND CAST(roomCount.Block_date AS date) = '${date}') = 1
       ORDER BY CASE WHEN r.Arr_date = '${date}' THEN 0 ELSE 1 END,
                r.Confirm_num, room.Room_id`,
    );
  }

  private validateDashboardDate(date: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d+$/.test(this.propertyId)) {
      throw new Error("Dashboard metrics require a numeric property ID and a YYYY-MM-DD date.");
    }
  }

  async getRoomNames(): Promise<string[]> {
    if (!/^\d+$/.test(this.propertyId)) {
      throw new Error("Room lookup requires a numeric property ID.");
    }
    return DatabaseUtils.getValues(
      `SELECT Room_name FROM rooms WHERE Property_id = ${this.propertyId}`,
      "Room_name",
    );
  }

  async getCurrentDate(daysToAdd = 0): Promise<string> {
    if (!Number.isInteger(daysToAdd)) throw new Error("Date offset must be a whole number of days.");
    // Dashboard GetCounts receives Day=Today and resolves the date on the server.
    const date = await DatabaseUtils.getValue(
      `SELECT CONVERT(varchar(10), DATEADD(day, ${daysToAdd}, GETDATE()), 23) AS Today`, "Today",
    );
    if (!date) throw new Error("The database did not return the current date for the Dashboard comparison.");
    return date;
  }

  async getArrivalsCount(date: string): Promise<number> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d+$/.test(this.propertyId)) {
      throw new Error("Dashboard arrivals require a numeric property ID and a YYYY-MM-DD date.");
    }
    const reservations = await DatabaseUtils.executeQuery(
      `SELECT *
       FROM reservation
       WHERE Property_id = ${this.propertyId}
         AND status <> 'Cancelled'
         AND Arr_date = '${date}'`,
    );
    return reservations.length;
  }

  async findReservationForActivity(
    date: string, activity: "Arrival" | "Departure" | "Stayover" | "Checked In",
  ): Promise<string | null> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d+$/.test(this.propertyId)) {
      throw new Error("Reservation Activity requires a numeric property ID and a YYYY-MM-DD date.");
    }
    const predicates = {
      Arrival: `Arr_date = '${date}'`,
      Departure: `Dept_date = '${date}'`,
      Stayover: `Arr_date < '${date}' AND Dept_date > '${date}'`,
      "Checked In": `Arr_date = '${date}' AND REPLACE(REPLACE(status, '-', ''), ' ', '') = 'CheckedIn'`,
    };
    const row = await DatabaseUtils.getRow<{ Confirm_num: number }>(
      `SELECT TOP (1) Confirm_num FROM reservation
       WHERE Property_id = ${this.propertyId} AND status <> 'Cancelled'
         AND ${predicates[activity]}
       ORDER BY Confirm_num DESC`,
    );
    return row ? String(row.Confirm_num) : null;
  }

  async getArrivalStatus(confirmationNumber: string, date: string): Promise<string | null> {
    if (!/^\d+$/.test(confirmationNumber) || !/^\d+$/.test(this.propertyId) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error("Arrival status requires numeric reservation/property IDs and a YYYY-MM-DD date.");
    }
    return DatabaseUtils.getValue(
      `SELECT status FROM reservation
       WHERE Property_id = ${this.propertyId}
         AND Confirm_num = ${confirmationNumber}
         AND Arr_date = '${date}'`,
      "status",
    );
  }

  async getDeparturesCount(date: string): Promise<number> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d+$/.test(this.propertyId)) {
      throw new Error("Dashboard departures require a numeric property ID and a YYYY-MM-DD date.");
    }
    const reservations = await DatabaseUtils.executeQuery(
      `SELECT * FROM reservation
       WHERE Property_id = ${this.propertyId}
         AND status <> 'Cancelled'
         AND Dept_date = '${date}'`,
    );
    return reservations.length;
  }

  async getOccupiedRoomCount(date: string): Promise<number> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d+$/.test(this.propertyId)) {
      throw new Error("Dashboard occupied rooms require a numeric property ID and a YYYY-MM-DD date.");
    }
    const count = await DatabaseUtils.getValue(
      `SELECT COUNT(DISTINCT reservedRoom.Room_ID) AS Occupied
       FROM reservation r
       INNER JOIN ReservedRooms reservedRoom
         ON reservedRoom.Property_id = r.Property_id
        AND reservedRoom.Confirm_num = r.Confirm_num
        AND ISNULL(reservedRoom.isDeleted, 0) = 0
       WHERE r.Property_id = ${this.propertyId}
         AND r.status <> 'Cancelled'
         AND r.Arr_date <= '${date}'
         AND r.Dept_date > '${date}'`,
      "Occupied",
    );
    if (count === null) throw new Error("The database did not return the occupied room count.");
    return Number(count);
  }

  async getDepartureStatus(confirmationNumber: string, date: string): Promise<string | null> {
    if (!/^\d+$/.test(confirmationNumber) || !/^\d+$/.test(this.propertyId) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error("Departure status requires numeric reservation/property IDs and a YYYY-MM-DD date.");
    }
    return DatabaseUtils.getValue(
      `SELECT status FROM reservation
       WHERE Property_id = ${this.propertyId}
         AND Confirm_num = ${confirmationNumber}
         AND Dept_date = '${date}'`, "status",
    );
  }

  async getAvailableRooms(
    roomTypeName: string,
    startDate: string,
    endDate: string,
  ): Promise<string[]> {
    return DatabaseUtils.getValues(
      `exec sp_core_GetAvailableRooms ${this.propertyId}, 0, '${startDate}', '${endDate}', '${roomTypeName}'`,
      "Room_id",
    );
  }

  async getStayoverReservations(date: string): Promise<{ Confirm_num: number }[]> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d+$/.test(this.propertyId)) {
      throw new Error("Stayovers require a numeric property ID and a YYYY-MM-DD date.");
    }
    return DatabaseUtils.executeQuery<{ Confirm_num: number }>(
      `SELECT * FROM reservation
       WHERE Property_id = ${this.propertyId}
         AND status <> 'Cancelled'
         AND Arr_date < '${date}'
         AND Dept_date > '${date}'`,
    );
  }

  async getReservationStayDates(confirmationNumber: string): Promise<{
    arrival: string; departure: string; status: string;
  } | null> {
    if (!/^\d+$/.test(confirmationNumber) || !/^\d+$/.test(this.propertyId)) {
      throw new Error("Reservation stay dates require numeric reservation and property IDs.");
    }
    return DatabaseUtils.getRow(
      `SELECT CONVERT(varchar(10), Arr_date, 23) AS arrival,
              CONVERT(varchar(10), Dept_date, 23) AS departure, status
       FROM reservation WHERE Property_id = ${this.propertyId}
         AND Confirm_num = ${confirmationNumber}`,
    );
  }

  /**
   * Returns a PMS value that can be entered in the Reservation campaign filter.
   * The value and the matching-count query deliberately use the same field
   * definition so UI assertions cannot drift from the PMS source of truth.
   */
  async getReservationCampaignFieldSample(
    fieldName: string,
  ): Promise<ReservationCampaignFieldSample | null> {
    const field = this.getReservationCampaignField(fieldName);
    return DatabaseUtils.getRow<ReservationCampaignFieldSample>(
      `WITH ReservationAudience AS (
         SELECT r.Reservation_id,
                r.Property_id,
                r.Confirm_num,
                r.Guestid,
                r.Arr_date,
                r.Dept_date,
                r.Post_Tax_Total,
                r.StayLength,
                g.City,
                g.Country,
                g.State,
                g.GuestType,
                g.VisitType,
                g.Custom1,
                g.Custom2,
                g.Custom3,
                g.Custom4,
                g.Custom5,
                g.Custom6,
                COUNT(*) OVER (PARTITION BY r.Guestid) AS TotalStays
         FROM Reservation r
         INNER JOIN Guest g
           ON g.id = r.Guestid
          AND g.propertyid = r.Property_id
         WHERE r.Property_id = ${this.propertyId}
           AND g.Email IS NOT NULL
           AND LTRIM(RTRIM(g.Email)) <> ''
       )
       SELECT TOP (1) ${field.sampleExpression} AS value
       FROM ReservationAudience r
       ${field.joins}
       WHERE ${field.nonEmptyPredicate}
       ORDER BY r.Reservation_id DESC`,
    );
  }

  /**
   * Counts distinct guest recipients matching one Reservation campaign filter.
   */
  async getReservationCampaignRecipientCount(
    fieldName: string,
    value: string,
  ): Promise<number> {
    const field = this.getReservationCampaignField(fieldName);
    const escapedValue = this.escapeSqlLiteral(value);
    const result = await DatabaseUtils.getValue(
      `WITH ReservationAudience AS (
         SELECT r.Reservation_id,
                r.Property_id,
                r.Confirm_num,
                r.Guestid,
                r.Arr_date,
                r.Dept_date,
                r.Post_Tax_Total,
                r.StayLength,
                g.City,
                g.Country,
                g.State,
                g.GuestType,
                g.VisitType,
                g.Custom1,
                g.Custom2,
                g.Custom3,
                g.Custom4,
                g.Custom5,
                g.Custom6,
                COUNT(*) OVER (PARTITION BY r.Guestid) AS TotalStays
         FROM Reservation r
         INNER JOIN Guest g
           ON g.id = r.Guestid
          AND g.propertyid = r.Property_id
         WHERE r.Property_id = ${this.propertyId}
           AND g.Email IS NOT NULL
           AND LTRIM(RTRIM(g.Email)) <> ''
       )
       ${field.countExpression?.(escapedValue) ?? `SELECT COUNT(DISTINCT r.Guestid) AS recipientCount
       FROM ReservationAudience r
       WHERE ${field.matchesExpression(escapedValue)}`}`,
      "recipientCount",
    );
    return Number(result ?? 0);
  }

  async getReservationCampaignConditionSample(): Promise<ReservationCampaignConditionSample | null> {
    return DatabaseUtils.getRow<ReservationCampaignConditionSample>(
      `SELECT TOP (1)
         LTRIM(RTRIM(g.City)) AS city,
         LTRIM(RTRIM(g.State)) AS state,
         LTRIM(RTRIM(g.Country)) AS country
       FROM Reservation r
       INNER JOIN Guest g
         ON g.id = r.Guestid
        AND g.propertyid = r.Property_id
       WHERE r.Property_id = ${this.propertyId}
         AND g.Email IS NOT NULL
         AND LTRIM(RTRIM(g.Email)) <> ''
         AND LTRIM(RTRIM(g.City)) <> ''
         AND LTRIM(RTRIM(g.State)) <> ''
         AND LTRIM(RTRIM(g.Country)) <> ''
       ORDER BY r.Reservation_id DESC`,
    );
  }

  /** Counts Reservation audience records for ordered AND/OR conditions. */
  async getReservationCampaignConditionRecipientCount(
    criteria: ReadonlyArray<ReservationCampaignCondition>,
  ): Promise<number> {
    if (criteria.length < 2) {
      throw new Error("At least two Reservation conditions are required");
    }

    const predicates = criteria.map((criterion, index) => {
      const field = this.getReservationCampaignField(criterion.fieldName);
      const connector = index === 0 ? "" : ` ${criterion.condition ?? "AND"} `;
      return `${connector}${field.matchesExpression(
        this.escapeSqlLiteral(criterion.value),
      )}`;
    });
    const result = await DatabaseUtils.getValue(
      `WITH ReservationAudience AS (
         SELECT r.Reservation_id,
                r.Property_id,
                r.Confirm_num,
                r.Guestid,
                r.Arr_date,
                r.Dept_date,
                r.Post_Tax_Total,
                r.StayLength,
                g.City,
                g.Country,
                g.State,
                g.GuestType,
                g.VisitType,
                g.Custom1,
                g.Custom2,
                g.Custom3,
                g.Custom4,
                g.Custom5,
                g.Custom6,
                COUNT(*) OVER (PARTITION BY r.Guestid) AS TotalStays
         FROM Reservation r
         INNER JOIN Guest g
           ON g.id = r.Guestid
          AND g.propertyid = r.Property_id
         WHERE r.Property_id = ${this.propertyId}
           AND g.Email IS NOT NULL
           AND LTRIM(RTRIM(g.Email)) <> ''
       )
       SELECT COUNT(DISTINCT r.Guestid) AS recipientCount
       FROM ReservationAudience r
       WHERE (${predicates.join("")})`,
      "recipientCount",
    );
    return Number(result ?? 0);
  }

  /**
   * Adds the Reservation-audience guest profile values to a reservation that
   * was created through the PMS UI.  Only the campaign fields that are not
   * exposed in the regular reservation form are changed.
   */
  async setReservationCampaignGuestProfileValues(
    confirmationNumber: string,
    values: Readonly<{
      guestType: string;
      visitType: string;
      custom1: string;
      custom2: string;
      custom3: string;
      custom4: string;
      custom5: string;
      custom6: string;
    }>,
  ): Promise<void> {
    if (!/^\d+$/.test(confirmationNumber)) {
      throw new Error(`Invalid confirmation number: ${confirmationNumber}`);
    }
    const escaped = Object.fromEntries(
      Object.entries(values).map(([key, value]) => [
        key,
        this.escapeSqlLiteral(value),
      ]),
    ) as Record<keyof typeof values, string>;
    await DatabaseUtils.executeUpdate(
      `UPDATE g
       SET g.GuestType = '${escaped.guestType}',
           g.VisitType = '${escaped.visitType}',
           g.Custom1 = '${escaped.custom1}',
           g.Custom2 = '${escaped.custom2}',
           g.Custom3 = '${escaped.custom3}',
           g.Custom4 = '${escaped.custom4}',
           g.Custom5 = '${escaped.custom5}',
           g.Custom6 = '${escaped.custom6}'
       FROM Guest g
       INNER JOIN Reservation r
         ON r.Guestid = g.id
        AND r.Property_id = g.propertyid
       WHERE r.Property_id = ${this.propertyId}
         AND r.Confirm_num = ${confirmationNumber}`,
    );
  }

  async getGSTInvoiceNumber(confirmNumber: string): Promise<string | null> {
    return DatabaseUtils.getValue(
      `SELECT InvoicePrefix
       FROM Reservation
       WHERE Property_id = ${this.propertyId}
       AND Confirm_num = '${confirmNumber}'`,
      "InvoicePrefix",
    );
  }

  async getReservationActivity(
    confirmNumber: string,
    _createdAfter: Date,
  ): Promise<ActivityLogEntry[]> {
    if (!/^\d+$/.test(confirmNumber)) {
      throw new Error(`Invalid confirmation number: ${confirmNumber}`);
    }

    return DatabaseUtils.executeQuery<ActivityLogEntry>(
      `SELECT Activity AS activity, StaffName AS staffName, Details AS details,
              CreatedDt AS createdAt
       FROM ActivityLog
       WHERE PropertyID = ${this.propertyId}
       AND Confirm_num = ${confirmNumber}
       ORDER BY CreatedDt DESC`,
    );
  }

  async getRoomActivity(createdAfter: Date): Promise<ActivityLogEntry[]> {
    return DatabaseUtils.executeQuery<ActivityLogEntry>(
      `SELECT Activity AS activity, StaffName AS staffName, Details AS details,
              CreatedDt AS createdAt
       FROM ActivityLog
       WHERE PropertyID = ${this.propertyId}
       AND CreatedDt >= '${this.toSqlDateTime(createdAfter)}'
       AND (Confirm_num IS NULL OR Confirm_num = 0)
       ORDER BY CreatedDt DESC`,
    );
  }

  async getGroupActivity(groupCode: string): Promise<ActivityLogEntry[]> {
    if (!/^\d+$/.test(groupCode)) {
      throw new Error(`Invalid group code: ${groupCode}`);
    }

    return DatabaseUtils.executeQuery<ActivityLogEntry>(
      `SELECT Activity AS activity, StaffName AS staffName, Details AS details,
              CreatedDt AS createdAt
       FROM ActivityLog
       WHERE PropertyID = ${this.propertyId}
       AND GroupCode = '${groupCode}'
       ORDER BY CreatedDt DESC`,
    );
  }

  private toSqlDateTime(value: Date): string {
    if (Number.isNaN(value.getTime())) throw new Error("A valid activity timestamp is required.");
    return value.toISOString().replace("T", " ").replace("Z", "");
  }

  private getReservationCampaignField(fieldName: string): {
    sampleExpression: string;
    nonEmptyPredicate: string;
    joins: string;
    matchesExpression: (escapedValue: string) => string;
    countExpression?: (escapedValue: string) => string;
  } {
    const scalarFields: Record<
      string,
      { column: string; numeric?: boolean; date?: boolean }
    > = {
      "Arrival Date": { column: "Arr_date", date: true },
      "Depature Date": { column: "Dept_date", date: true },
      City: { column: "City" },
      Country: { column: "Country" },
      State: { column: "State" },
      "Reservation Total": { column: "Post_Tax_Total", numeric: true },
      "Stay Length": { column: "StayLength", numeric: true },
      "Guest Type": { column: "GuestType" },
      "Visit Type": { column: "VisitType" },
      Custom1: { column: "Custom1" },
      Custom2: { column: "Custom2" },
      Custom3: { column: "Custom3" },
      Custom4: { column: "Custom4" },
      Custom5: { column: "Custom5" },
      Custom6: { column: "Custom6" },
      "Total Stays": { column: "TotalStays", numeric: true },
    };
    const scalar = scalarFields[fieldName];
    if (scalar) {
      const expression = scalar.date
        ? `CONVERT(varchar(10), r.${scalar.column}, 23)`
        : scalar.numeric
          ? `CONVERT(varchar(30), r.${scalar.column})`
          : `LTRIM(RTRIM(r.${scalar.column}))`;
      return {
        sampleExpression: expression,
        nonEmptyPredicate: scalar.numeric
          ? `r.${scalar.column} IS NOT NULL`
          : `r.${scalar.column} IS NOT NULL AND LTRIM(RTRIM(CONVERT(varchar(max), r.${scalar.column}))) <> ''`,
        joins: "",
        matchesExpression: (escapedValue) => scalar.date
          ? `CONVERT(varchar(10), r.${scalar.column}, 23) = '${escapedValue}'`
          : scalar.numeric
            ? `CONVERT(varchar(30), r.${scalar.column}) = '${escapedValue}'`
            : `LTRIM(RTRIM(r.${scalar.column})) = '${escapedValue}'`,
      };
    }

    const roomFields: Record<string, string> = {
      "Room Name": "room.Room_name",
      "Room Type": "reservedRoom.RoomType",
    };
    const roomColumn = roomFields[fieldName];
    if (roomColumn) {
      return {
        sampleExpression: `LTRIM(RTRIM(${roomColumn}))`,
        nonEmptyPredicate: `${roomColumn} IS NOT NULL AND LTRIM(RTRIM(${roomColumn})) <> ''`,
        joins: `INNER JOIN ReservedRooms reservedRoom
                  ON reservedRoom.Property_id = r.Property_id
                 AND reservedRoom.Confirm_num = r.Confirm_num
                 AND ISNULL(reservedRoom.isDeleted, 0) = 0
                ${fieldName === "Room Name" ? `INNER JOIN Rooms room
                  ON room.Property_id = reservedRoom.Property_id
                 AND room.Room_id = reservedRoom.Room_ID` : ""}`,
        matchesExpression: (escapedValue) => `EXISTS (
          SELECT 1
          FROM ReservedRooms reservedRoom
          ${fieldName === "Room Name" ? `INNER JOIN Rooms room
            ON room.Property_id = reservedRoom.Property_id
           AND room.Room_id = reservedRoom.Room_ID` : ""}
          WHERE reservedRoom.Property_id = r.Property_id
            AND reservedRoom.Confirm_num = r.Confirm_num
            AND ISNULL(reservedRoom.isDeleted, 0) = 0
            AND LTRIM(RTRIM(${roomColumn})) = '${escapedValue}'
        )`,
      };
    }

    throw new Error(`Unsupported Reservation campaign field "${fieldName}"`);
  }

  private escapeSqlLiteral(value: string): string {
    return value.replace(/'/g, "''");
  }

  async getZipCodeLocations(limit = 2): Promise<
    Array<{ zipCode: string; city: string; state: string; country: string }>
  > {
    const rows = await DatabaseUtils.executeQuery<Record<string, unknown>>(
      `SELECT TOP (100) *
       FROM ZipCodes
       WHERE PropertyID = ${this.propertyId}
       ORDER BY ZipCode`,
    );

    const getColumn = (row: Record<string, unknown>, names: string[]): string => {
      const entry = Object.entries(row).find(([key]) =>
        names.some((name) => name.toLowerCase() === key.toLowerCase()),
      );
      return entry?.[1] === null || entry?.[1] === undefined
        ? ""
        : String(entry[1]).trim();
    };

    return rows
      .map((row) => ({
        zipCode: getColumn(row, ["ZipCode", "Zip", "PostalCode"]),
        city: getColumn(row, ["City", "CityName"]),
        state: getColumn(row, ["State", "StateName", "Province"]),
        country: getColumn(row, ["Country", "CountryName"]),
      }))
      .filter(
        ({ zipCode, city, state, country }) =>
          zipCode !== "" && city !== "" && state !== "" && country !== "",
      )
      .slice(0, limit);
  }
}
