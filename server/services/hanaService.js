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

  // Get Schemas (including tables, views, virtual tables, and synonyms)
  async getSchemas() {
    const sql = `
      SELECT SCHEMA_NAME 
      FROM SYS.SCHEMAS 
      WHERE SCHEMA_OWNER NOT IN ('_SYS_REPO', '_SYS_STATISTICS')
        AND (
          SCHEMA_NAME IN (SELECT SCHEMA_NAME FROM SYS.TABLES)
          OR SCHEMA_NAME IN (SELECT SCHEMA_NAME FROM SYS.VIEWS)
          OR SCHEMA_NAME IN (SELECT SCHEMA_NAME FROM SYS.SYNONYMS)
        )
      ORDER BY SCHEMA_NAME
    `;
    return this.execute(sql);
  }

  // Get Tables in a Schema (including Virtual Tables and Synonyms)
  async getTables(schema) {
    const sql = `
      SELECT t.TABLE_NAME, 
             CASE WHEN t.TABLE_TYPE = 'VIRTUAL' THEN 'VIRTUAL TABLE' ELSE 'TABLE' END as TYPE, 
             m.RECORD_COUNT 
      FROM SYS.TABLES t
      LEFT JOIN SYS.M_TABLES m ON t.SCHEMA_NAME = m.SCHEMA_NAME AND t.TABLE_NAME = m.TABLE_NAME
      WHERE t.SCHEMA_NAME = ?
      UNION ALL
      SELECT VIEW_NAME as TABLE_NAME, 'VIEW' as TYPE, NULL as RECORD_COUNT
      FROM SYS.VIEWS
      WHERE SCHEMA_NAME = ?
      UNION ALL
      SELECT SYNONYM_NAME as TABLE_NAME, 'SYNONYM' as TYPE, NULL as RECORD_COUNT
      FROM SYS.SYNONYMS
      WHERE SCHEMA_NAME = ?
      ORDER BY TYPE, TABLE_NAME
    `;
    return this.execute(sql, [schema, schema, schema]);
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

  // Get Column Metadata (with Synonym support and cycle detection)
  async getColumns(schema, table) {
    const visited = new Set();
    return this._getColumnsRecursive(schema, table, visited);
  }

  // Private recursive method with cycle detection
  async _getColumnsRecursive(schema, table, visited, depth = 0) {
    // Prevent infinite recursion (max 10 levels)
    const MAX_RECURSION_DEPTH = 10;
    if (depth > MAX_RECURSION_DEPTH) {
      console.warn(`Maximum recursion depth exceeded for ${schema}.${table}`);
      return [];
    }

    // Cycle detection: key is "schema.table"
    const key = `${schema}.${table}`;
    if (visited.has(key)) {
      console.warn(`Circular synonym reference detected for ${key}`);
      return [];
    }
    visited.add(key);

    // 1. Check if it's a Synonym first
    try {
      const synonymSql = `SELECT BASE_SCHEMA_NAME, BASE_OBJECT_NAME FROM SYS.SYNONYMS WHERE SCHEMA_NAME = ? AND SYNONYM_NAME = ?`;
      const synonym = await this.execute(synonymSql, [schema, table]);
      if (synonym && synonym.length > 0) {
        // Resolve synonym and get columns for the base object
        return this._getColumnsRecursive(
          synonym[0].BASE_SCHEMA_NAME,
          synonym[0].BASE_OBJECT_NAME,
          visited,
          depth + 1
        );
      }
    } catch (e) {
      // Ignore and continue
    }

    // 2. Try TABLE_COLUMNS (covers physical and virtual tables)
    try {
      const sqlTable = `
        SELECT COLUMN_NAME, DATA_TYPE_NAME, LENGTH, IS_NULLABLE
        FROM SYS.TABLE_COLUMNS
        WHERE SCHEMA_NAME = ? AND TABLE_NAME = ?
        ORDER BY POSITION
      `;
      const tableCols = await this.execute(sqlTable, [schema, table]);
      if (tableCols && tableCols.length > 0) return tableCols;
    } catch (e) {}

    // 3. Try VIEW_COLUMNS
    try {
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
      return [];
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

  // Helper: Check if identifier is safe (schema/table names)
  // Prevents SQL injection for identifiers
  isSafeIdentifier(identifier) {
    if (!identifier || typeof identifier !== 'string') {
      return false;
    }

    // Check length (HANA limit is 255)
    if (identifier.length > 255) {
      return false;
    }

    // Check for empty or whitespace-only
    if (identifier.trim().length === 0) {
      return false;
    }

    // Allow alphanumeric, underscores, and hyphens
    // Must start with letter or underscore
    const validIdentifierRegex = /^[a-zA-Z_][a-zA-Z0-9_-]*$/;
    return validIdentifierRegex.test(identifier);
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
