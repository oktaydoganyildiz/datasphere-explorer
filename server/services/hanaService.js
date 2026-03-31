const hana = require('@sap/hana-client');

class HanaService {
  constructor() {
    this.connection = null;
    this.currentConfig = null;
  }

  // Connect to HANA
  async connect(config) {
    // If already connected to the same config, return success
    if (this.connection && this.isSameConfig(config)) {
      return { success: true, message: 'Already connected' };
    }

    // Close existing connection if config is different
    if (this.connection) {
      await this.disconnect();
    }

    const connParams = {
      serverNode: `${config.host}:${config.port}`,
      uid: config.user,
      pwd: config.password,
      encrypt: 'true', // Required for HANA Cloud/DataSphere
      sslValidateCertificate: 'false', // Often needed for dev/self-signed
      connectTimeout: 10000
    };

    return new Promise((resolve, reject) => {
      this.connection = hana.createConnection();
      this.connection.connect(connParams, (err) => {
        if (err) {
          console.error('HANA Connection Error:', err);
          return reject(this.parseError(err));
        }
        this.currentConfig = config;
        resolve({ success: true, message: 'Connected to HANA successfully' });
      });
    });
  }

  // Disconnect
  disconnect() {
    return new Promise((resolve) => {
      if (this.connection) {
        this.connection.disconnect(() => {
          this.connection = null;
          this.currentConfig = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // Execute a query
  execute(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.connection) {
        return reject({ message: 'Not connected to HANA database.' });
      }

      this.connection.exec(sql, params, (err, rows) => {
        if (err) {
          return reject(this.parseError(err));
        }
        resolve(rows);
      });
    });
  }

  // Get Schemas (only those with tables or views)
  async getSchemas() {
    const sql = `
      SELECT SCHEMA_NAME 
      FROM SYS.SCHEMAS 
      WHERE SCHEMA_OWNER != '_SYS_REPO' 
        AND SCHEMA_NAME IN (
          SELECT SCHEMA_NAME FROM SYS.M_TABLES WHERE SCHEMA_NAME IS NOT NULL
          UNION
          SELECT SCHEMA_NAME FROM SYS.VIEWS WHERE SCHEMA_NAME IS NOT NULL
        )
      ORDER BY SCHEMA_NAME
    `;
    return this.execute(sql);
  }

  // Get Tables in a Schema
  async getTables(schema) {
    const sql = `
      SELECT TABLE_NAME, 'TABLE' as TYPE, RECORD_COUNT 
      FROM SYS.M_TABLES 
      WHERE SCHEMA_NAME = ? 
      UNION ALL
      SELECT VIEW_NAME as TABLE_NAME, 'VIEW' as TYPE, NULL as RECORD_COUNT
      FROM SYS.VIEWS
      WHERE SCHEMA_NAME = ?
      ORDER BY TYPE, TABLE_NAME
    `;
    return this.execute(sql, [schema, schema]);
  }

  // Preview Table Data (Top 100)
  async getPreview(schema, table) {
    // Sanitizing schema and table names is crucial to prevent injection, 
    // but parameterized queries for identifiers aren't supported in standard SQL.
    // We double-quote them to handle special chars/case sensitivity safely.
    const safeSchema = schema.replace(/"/g, '""');
    const safeTable = table.replace(/"/g, '""');
    const sql = `SELECT TOP 100 * FROM "${safeSchema}"."${safeTable}"`;
    return this.execute(sql);
  }

  // Get Column Metadata
  async getColumns(schema, table) {
    // Strategy: Try TABLE_COLUMNS first. If that returns empty, try VIEW_COLUMNS.
    // We catch errors to prevent the request from failing if one of the system tables is inaccessible.
    
    try {
      // Attempt 1: Check SYS.TABLE_COLUMNS
      const sqlTable = `
        SELECT COLUMN_NAME, DATA_TYPE_NAME, LENGTH, IS_NULLABLE 
        FROM SYS.TABLE_COLUMNS 
        WHERE SCHEMA_NAME = ? AND TABLE_NAME = ? 
        ORDER BY POSITION
      `;
      const tableCols = await this.execute(sqlTable, [schema, table]);
      if (tableCols && tableCols.length > 0) return tableCols;

    } catch (e) {
      // Ignore error and proceed to check VIEW_COLUMNS
      // console.warn('SYS.TABLE_COLUMNS check failed, trying VIEW_COLUMNS', e.message);
    }

    try {
      // Attempt 2: Check SYS.VIEW_COLUMNS
      const sqlView = `
        SELECT COLUMN_NAME, DATA_TYPE_NAME, LENGTH, IS_NULLABLE 
        FROM SYS.VIEW_COLUMNS 
        WHERE SCHEMA_NAME = ? AND VIEW_NAME = ? 
        ORDER BY POSITION
      `;
      const viewCols = await this.execute(sqlView, [schema, table]);
      return viewCols;

    } catch (e) {
      console.warn(`Could not fetch metadata for ${schema}.${table}: ${e.message}`);
      return []; // Return empty array so fallback logic in routes can take over
    }
  }

  // Helper: Check if config is same (simple object comparison)
  isSameConfig(config) {
    if (!this.currentConfig) return false;
    return (
      this.currentConfig.host === config.host &&
      this.currentConfig.port === config.port &&
      this.currentConfig.user === config.user
    );
  }

  // Helper: Parse Error
  parseError(err) {
    // Simplified error parsing
    if (err.code === -10709) return { message: 'Connection refused. Check host/port.' };
    if (err.code === 10) return { message: 'Authentication failed. Check user/password.' };
    return { message: err.message, code: err.code };
  }
}

module.exports = new HanaService();
