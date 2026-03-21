const express = require('express');
const router = express.Router();
const hanaService = require('../services/hanaService');

router.get('/dashboard', async (req, res, next) => {
  try {
    if (!hanaService.connection) {
      return res.status(401).json({ success: false, message: 'Not connected.' });
    }
    const config = hanaService.currentConfig;
    const schema = req.query.schema || config.schema || 'SYS';

    const statsSql = `
      SELECT 'TABLE' as TYPE, COUNT(*) as COUNT FROM SYS.M_TABLES WHERE SCHEMA_NAME = ?
      UNION ALL
      SELECT 'VIEW' as TYPE, COUNT(*) as COUNT FROM SYS.VIEWS WHERE SCHEMA_NAME = ?
    `;
    const counts = await hanaService.execute(statsSql, [schema, schema]);
    const totalTables = counts.find(c => c.TYPE === 'TABLE')?.COUNT || 0;
    const totalViews  = counts.find(c => c.TYPE === 'VIEW')?.COUNT  || 0;

    const topTablesSql = `
      SELECT TOP 5 TABLE_NAME, RECORD_COUNT
      FROM SYS.M_TABLES WHERE SCHEMA_NAME = ?
      ORDER BY RECORD_COUNT DESC
    `;
    const topTables = await hanaService.execute(topTablesSql, [schema]);

    const connSql = `SELECT COUNT(*) AS COUNT FROM SYS.M_CONNECTIONS WHERE CONNECTION_STATUS = 'RUNNING'`;
    const connResult = await hanaService.execute(connSql);
    const activeConnections = connResult[0]?.COUNT || 0;

    res.json({ schema, totalTables, totalViews, topTables, activeConnections });
  } catch (err) { next(err); }
});

router.get('/health', async (req, res, next) => {
  try {
    if (!hanaService.connection) {
      return res.status(401).json({ success: false, message: 'Not connected.' });
    }

    const cpuSql = `
      SELECT TOP 1
        ROUND(AVG(TOTAL_CPU_USER_TIME + TOTAL_CPU_SYSTEM_TIME) / NULLIF(AVG(TOTAL_CPU_USER_TIME + TOTAL_CPU_SYSTEM_TIME + TOTAL_CPU_WIO_TIME + TOTAL_CPU_IDLE_TIME), 0) * 100, 1) AS CPU_PCT
      FROM SYS.M_LOAD_HISTORY_SERVICE
      WHERE TIME > ADD_SECONDS(CURRENT_TIMESTAMP, -60)
    `;

    const memSql = `
      SELECT TOP 1
        ROUND(USED_PHYSICAL_MEMORY / NULLIF(TOTAL_PHYSICAL_MEMORY, 0) * 100, 1) AS MEM_PCT,
        ROUND(USED_PHYSICAL_MEMORY / 1073741824.0, 2) AS USED_GB,
        ROUND(TOTAL_PHYSICAL_MEMORY / 1073741824.0, 2) AS TOTAL_GB
      FROM SYS.M_HOST_RESOURCE_UTILIZATION
    `;

    const diskSql = `
      SELECT
        ROUND(SUM(USED_SIZE) / NULLIF(SUM(TOTAL_SIZE), 0) * 100, 1) AS DISK_PCT,
        ROUND(SUM(USED_SIZE)  / 1073741824.0, 2) AS USED_GB,
        ROUND(SUM(TOTAL_SIZE) / 1073741824.0, 2) AS TOTAL_GB
      FROM SYS.M_DISK_USAGE
      WHERE USED_SIZE > 0
    `;

    const connDetailSql = `
      SELECT TOP 10
        CONNECTION_ID,
        USER_NAME,
        CLIENT_HOST,
        CONNECTION_STATUS,
        CURRENT_STATEMENT_TYPE as STMT_TYPE,
        SECONDS_BETWEEN(START_TIME, CURRENT_TIMESTAMP) AS DURATION_S
      FROM SYS.M_CONNECTIONS
      WHERE CONNECTION_STATUS IN ('RUNNING', 'IDLE')
      ORDER BY CONNECTION_STATUS DESC, DURATION_S DESC
    `;

    const expensiveSql = `
      SELECT TOP 5
        ROUND(DURATION_MICROSEC / 1000.0, 0) AS DURATION_MS,
        EXECUTION_COUNT,
        STATEMENT_STRING
      FROM SYS.M_EXPENSIVE_STATEMENTS
      ORDER BY DURATION_MICROSEC DESC
    `;

    const [cpuRows, memRows, diskRows, connRows] = await Promise.all([
      hanaService.execute(cpuSql).catch(() => []),
      hanaService.execute(memSql).catch(() => []),
      hanaService.execute(diskSql).catch(() => []),
      hanaService.execute(connDetailSql).catch(() => []),
    ]);

    const expRows = await hanaService.execute(expensiveSql).catch(() => []);

    res.json({
      cpu:  { pct: parseFloat(cpuRows[0]?.CPU_PCT  || 0) },
      mem:  {
        pct:     parseFloat(memRows[0]?.MEM_PCT   || 0),
        usedGb:  parseFloat(memRows[0]?.USED_GB   || 0),
        totalGb: parseFloat(memRows[0]?.TOTAL_GB  || 0),
      },
      disk: {
        pct:     parseFloat(diskRows[0]?.DISK_PCT  || 0),
        usedGb:  parseFloat(diskRows[0]?.USED_GB   || 0),
        totalGb: parseFloat(diskRows[0]?.TOTAL_GB  || 0),
      },
      connections: connRows,
      expensiveStatements: expRows,
    });
  } catch (err) { next(err); }
});

router.get('/lineage/:schema', async (req, res, next) => {
  try {
    if (!hanaService.connection) {
      return res.status(401).json({ success: false, message: 'Not connected.' });
    }
    const { schema } = req.params;

    const tablesSql = `
      SELECT TABLE_NAME, RECORD_COUNT, TABLE_TYPE
      FROM SYS.M_TABLES
      WHERE SCHEMA_NAME = ?
      ORDER BY TABLE_NAME
    `;

    const viewsSql = `
      SELECT VIEW_NAME AS TABLE_NAME, 'VIEW' AS TABLE_TYPE
      FROM SYS.VIEWS
      WHERE SCHEMA_NAME = ?
      ORDER BY VIEW_NAME
    `;

    const fkSql = `
      SELECT
        r.TABLE_NAME        AS SOURCE_TABLE,
        r.REFERENCED_TABLE_NAME AS TARGET_TABLE,
        c.COLUMN_NAME,
        r.CONSTRAINT_NAME
      FROM SYS.REFERENTIAL_CONSTRAINTS r
      JOIN SYS.CONSTRAINT_COLUMNS c
        ON c.CONSTRAINT_NAME = r.CONSTRAINT_NAME
       AND c.SCHEMA_NAME     = r.SCHEMA_NAME
      WHERE r.SCHEMA_NAME = ?
      ORDER BY r.TABLE_NAME
    `;

    const [tableRows, viewRows, fkRows] = await Promise.all([
      hanaService.execute(tablesSql, [schema]).catch(() => []),
      hanaService.execute(viewsSql,  [schema]).catch(() => []),
      hanaService.execute(fkSql,     [schema]).catch(() => []),
    ]);

    const nodes = [
      ...tableRows.map(t => ({
        id:    t.TABLE_NAME,
        label: t.TABLE_NAME,
        type:  'TABLE',
        rows:  t.RECORD_COUNT || 0,
      })),
      ...viewRows.map(v => ({
        id:    v.TABLE_NAME,
        label: v.TABLE_NAME,
        type:  'VIEW',
        rows:  null,
      })),
    ];

    const links = fkRows
      .filter(r => r.SOURCE_TABLE && r.TARGET_TABLE)
      .map(r => ({
        source: r.SOURCE_TABLE,
        target: r.TARGET_TABLE,
        column: r.COLUMN_NAME,
      }));

    res.json({ nodes, links });
  } catch (err) { next(err); }
});

module.exports = router;
