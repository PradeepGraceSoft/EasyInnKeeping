import { ConnectionPool, config as SqlConfig } from "mssql";

import { ConfigManager } from "../ConfigManager";

export class DatabaseUtils {
  private static pool: ConnectionPool | null = null;

  private constructor() {}

  /**
   * Initialize DB Connection Pool
   */
  static async connect(): Promise<void> {
    if (this.pool) {
      return;
    }

    const db = ConfigManager.database;

    if (db.connectionString) {
      this.pool = new ConnectionPool(db.connectionString);
    } else {
      const config: SqlConfig = {
        server: db.server,
        database: db.database,
        user: db.username,
        password: db.password,
        options: {
          encrypt: true,
          trustServerCertificate: true,
        },
      };

      this.pool = new ConnectionPool(config);
    }

    await this.pool.connect();
  }

  /**
   * Close DB Connection Pool
   */
  static async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }
  }

  /**
   * Get Connection Pool
   */
  private static getPool(): ConnectionPool {
    if (!this.pool) {
      throw new Error(
        "Database not connected. Call DatabaseUtils.connect() first.",
      );
    }

    return this.pool;
  }

  /**
   * Execute INSERT / UPDATE / DELETE
   */
  static async executeUpdate(query: string): Promise<void> {
    try {
      await this.getPool().request().query(query);
    } catch (error) {
      throw new Error(`Database update failed: ${error}`);
    }
  }

  /**
   * Retrieve Single Value
   */
  static async getValue(
    query: string,
    columnName: string,
  ): Promise<string | null> {
    try {
      const result = await this.getPool().request().query<any>(query);
      const rows = result.recordset ?? [];

      if (rows.length === 0) {
        return null;
      }

      const value = rows[0][columnName];

      return value !== null && value !== undefined ? String(value) : null;
    } catch (error) {
      throw new Error(`Database retrieval failed: ${error}`);
    }
  }

  /**
   * Retrieve Multiple Values From Single Column
   */
  static async getValues(query: string, columnName: string): Promise<string[]> {
    try {
      const result = await this.getPool().request().query<any>(query);
      const rows = result.recordset ?? [];

      return rows.map((row: any) => String(row[columnName]));
    } catch (error) {
      throw new Error(`Database multi retrieval failed: ${error}`);
    }
  }

  /**
   * Retrieve Full Result Set
   */
  static async executeQuery<T>(query: string): Promise<T[]> {
    try {
      const result = await this.getPool().request().query<T>(query);
      return result.recordset ?? [];
    } catch (error) {
      throw new Error(`Database query failed: ${error}`);
    }
  }

  /**
   * Retrieve First Row
   */
  static async getRow<T>(query: string): Promise<T | null> {
    const rows = await this.executeQuery<T>(query);

    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Check if record exists
   */
  static async exists(query: string): Promise<boolean> {
    const rows = await this.executeQuery(query);

    return rows.length > 0;
  }
}
