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

    // Validate schema parameter
    if (!hanaService.isSafeIdentifier(schema)) {
      return res.status(400).json({ success: false, message: 'Invalid schema name.' });
    }

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

    // Return simple health status without requiring system table privileges
    res.json({
      cpu:  { pct: 0 },  // Requires SYS.M_LOAD_HISTORY_SERVICE privilege
      mem:  {
        pct: 0,
        usedGb: 0,
        totalGb: 0,
      },  // Requires SYS.M_HOST_RESOURCE_UTILIZATION privilege
      disk: {
        pct: 0,
        usedGb: 0,
        totalGb: 0,
      },  // Requires SYS.M_DISK_USAGE privilege
      connections: [],  // Requires SYS.M_CONNECTIONS privilege
      expensiveStatements: [],  // Removed - not useful
    });
  } catch (err) { next(err); }
});

router.get('/lineage/:schema', async (req, res, next) => {
  try {
    if (!hanaService.connection) {
      return res.status(401).json({ success: false, message: 'Not connected.' });
    }
    const { schema } = req.params;

    // Validate schema parameter
    if (!hanaService.isSafeIdentifier(schema)) {
      return res.status(400).json({ success: false, message: 'Invalid schema name.' });
    }

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

// ─────────────────────────────────────────────────────────────────────
// DataSphere Monitoring Endpoints (DWC_GLOBAL)
// ─────────────────────────────────────────────────────────────────────

router.get('/datasphere/tasks', async (req, res, next) => {
  try {
    if (!hanaService.connection) {
      return res.status(401).json({ success: false, message: 'Not connected.' });
    }

    const spaceFilter = req.query.space; // Optional space filter

    // Main task logs with space and object info
    const taskLogsSql = `
      SELECT TOP 30
        t.TASK_LOG_ID,
        t.SPACE_ID,
        t.APPLICATION_ID AS TASK_NAME,
        t.OBJECT_ID,
        t.ACTIVITY,
        t.STATUS,
        t.START_TIME,
        t.END_TIME,
        t."USER",
        SECONDS_BETWEEN(t.START_TIME, COALESCE(t.END_TIME, CURRENT_TIMESTAMP)) AS DURATION_SEC,
        r.PEAK_CPU,
        r.PEAK_MEMORY
      FROM DWC_GLOBAL.TASK_LOGS t
      LEFT JOIN DWC_GLOBAL.RESOURCE_MONITOR r ON t.TASK_LOG_ID = r.TASK_LOG_ID
      ${spaceFilter ? "WHERE t.SPACE_ID = '" + spaceFilter.replace(/'/g, "''") + "'" : "WHERE t.SPACE_ID != '$$global$$'"}
      ORDER BY t.START_TIME DESC
    `;

    // Failed tasks with error messages
    const taskErrorsSql = `
      SELECT TOP 15
        t.TASK_LOG_ID,
        t.SPACE_ID,
        t.APPLICATION_ID AS TASK_NAME,
        t.OBJECT_ID,
        t.START_TIME,
        t."USER",
        m.SEVERITY,
        m.TEXT,
        m.DETAILS
      FROM DWC_GLOBAL.TASK_LOGS t
      JOIN DWC_GLOBAL.TASK_LOG_MESSAGES m ON t.TASK_LOG_ID = m.TASK_LOG_ID
      WHERE t.STATUS = 'FAILED' AND m.SEVERITY IN ('ERROR', 'WARNING')
      ${spaceFilter ? "AND t.SPACE_ID = '" + spaceFilter.replace(/'/g, "''") + "'" : "AND t.SPACE_ID != '$$global$$'"}
      ORDER BY t.START_TIME DESC
    `;

    // Task Chain specific runs
    const taskChainsSql = `
      SELECT TOP 20
        c.CHAIN_TASK_LOG_ID,
        c.TECHNICAL_NAME,
        c.SPACE_ID,
        c.FUTURE_STATUS AS STATUS,
        t.START_TIME,
        t.END_TIME,
        t."USER",
        SECONDS_BETWEEN(t.START_TIME, COALESCE(t.END_TIME, CURRENT_TIMESTAMP)) AS DURATION_SEC
      FROM DWC_GLOBAL.TASK_CHAIN_RUNS c
      JOIN DWC_GLOBAL.TASK_LOGS t ON c.CHAIN_TASK_LOG_ID = t.TASK_LOG_ID
      ${spaceFilter ? "WHERE c.SPACE_ID = '" + spaceFilter.replace(/'/g, "''") + "'" : ""}
      ORDER BY t.START_TIME DESC
    `;

    const taskStatsSql = `
      SELECT 
        STATUS,
        COUNT(*) AS CNT
      FROM DWC_GLOBAL.TASK_LOGS
      WHERE SPACE_ID != '$$global$$'
      GROUP BY STATUS
    `;

    const appStatsSql = `
      SELECT TOP 10
        APPLICATION_ID,
        COUNT(*) AS TOTAL_RUNS,
        SUM(CASE WHEN STATUS = 'COMPLETED' THEN 1 ELSE 0 END) AS COMPLETED,
        SUM(CASE WHEN STATUS = 'FAILED' THEN 1 ELSE 0 END) AS FAILED
      FROM DWC_GLOBAL.TASK_LOGS
      WHERE SPACE_ID != '$$global$$'
      GROUP BY APPLICATION_ID
      ORDER BY TOTAL_RUNS DESC
    `;

    // Get available spaces for filter dropdown
    const spacesSql = `
      SELECT DISTINCT SPACE_ID 
      FROM DWC_GLOBAL.TASK_LOGS 
      WHERE SPACE_ID != '$$global$$'
      ORDER BY SPACE_ID
    `;

    const [taskLogs, taskErrors, taskChains, taskStats, appStats, spaces] = await Promise.all([
      hanaService.execute(taskLogsSql).catch(() => []),
      hanaService.execute(taskErrorsSql).catch(() => []),
      hanaService.execute(taskChainsSql).catch(() => []),
      hanaService.execute(taskStatsSql).catch(() => []),
      hanaService.execute(appStatsSql).catch(() => []),
      hanaService.execute(spacesSql).catch(() => []),
    ]);

    res.json({
      taskLogs,
      taskErrors,
      taskChains,
      taskStats,
      appStats,
      spaces: spaces.map(s => s.SPACE_ID),
    });
  } catch (err) { next(err); }
});

// Get Task Chain detail with sub-tasks and error messages
router.get('/datasphere/taskchain/:chainLogId', async (req, res, next) => {
  try {
    if (!hanaService.connection) {
      return res.status(401).json({ success: false, message: 'Not connected.' });
    }

    const { chainLogId } = req.params;

    // Main chain info
    const chainSql = `
      SELECT 
        c.CHAIN_TASK_LOG_ID,
        c.TECHNICAL_NAME,
        c.SPACE_ID,
        c.FUTURE_STATUS AS STATUS,
        t.START_TIME,
        t.END_TIME,
        t."USER",
        SECONDS_BETWEEN(t.START_TIME, COALESCE(t.END_TIME, CURRENT_TIMESTAMP)) AS DURATION_SEC
      FROM DWC_GLOBAL.TASK_CHAIN_RUNS c
      JOIN DWC_GLOBAL.TASK_LOGS t ON c.CHAIN_TASK_LOG_ID = t.TASK_LOG_ID
      WHERE c.CHAIN_TASK_LOG_ID = ?
    `;

    // Sub-tasks (nodes) in the chain
    const nodesSql = `
      SELECT 
        n.NODE_ID,
        n.TASK_LOG_ID AS SUB_TASK_LOG_ID,
        t.APPLICATION_ID,
        t.OBJECT_ID,
        t.ACTIVITY,
        t.STATUS,
        t.START_TIME,
        t.END_TIME,
        SECONDS_BETWEEN(t.START_TIME, COALESCE(t.END_TIME, CURRENT_TIMESTAMP)) AS DURATION_SEC
      FROM DWC_GLOBAL.TASK_CHAIN_RUN_NODES n
      JOIN DWC_GLOBAL.TASK_LOGS t ON n.TASK_LOG_ID = t.TASK_LOG_ID
      WHERE n.CHAIN_TASK_LOG_ID = ?
      ORDER BY n.NODE_ID
    `;

    // Error messages for the chain and its sub-tasks
    const messagesSql = `
      SELECT 
        m.TASK_LOG_ID,
        m.MESSAGE_NO,
        m.SEVERITY,
        m.TEXT,
        m.DETAILS,
        m.TIMESTAMP
      FROM DWC_GLOBAL.TASK_LOG_MESSAGES m
      WHERE m.TASK_LOG_ID = ? 
         OR m.TASK_LOG_ID IN (
           SELECT n.TASK_LOG_ID FROM DWC_GLOBAL.TASK_CHAIN_RUN_NODES n 
           WHERE n.CHAIN_TASK_LOG_ID = ?
         )
      ORDER BY m.TIMESTAMP
    `;

    const [chain, nodes, messages] = await Promise.all([
      hanaService.execute(chainSql, [chainLogId]),
      hanaService.execute(nodesSql, [chainLogId]),
      hanaService.execute(messagesSql, [chainLogId, chainLogId]),
    ]);

    res.json({
      chain: chain[0] || null,
      nodes,
      messages,
      // Extract only error/warning messages for quick view
      errors: messages.filter(m => m.SEVERITY === 'ERROR' || m.SEVERITY === 'WARNING'),
    });
  } catch (err) { next(err); }
});

router.get('/datasphere/resources', async (req, res, next) => {
  try {
    if (!hanaService.connection) {
      return res.status(401).json({ success: false, message: 'Not connected.' });
    }

    const resourceSql = `
      SELECT TOP 20
        r.TASK_LOG_ID,
        t.APPLICATION_ID AS TASK_NAME,
        t.ACTIVITY,
        t.STATUS,
        t.START_TIME,
        r.PEAK_MEMORY,
        r.PEAK_CPU,
        r.RECORDS,
        r.USED_IN_MEMORY,
        r.USED_IN_DISK,
        r.TARGET_TABLE
      FROM DWC_GLOBAL.RESOURCE_MONITOR r
      JOIN DWC_GLOBAL.TASK_LOGS t ON r.TASK_LOG_ID = t.TASK_LOG_ID
      ORDER BY r.TASK_LOG_ID DESC
    `;

    const meteringSql = `
      SELECT TOP 10 * 
      FROM DWC_GLOBAL.DS_METERING 
      ORDER BY 1 DESC
    `;

    const [resources, metering] = await Promise.all([
      hanaService.execute(resourceSql).catch(() => []),
      hanaService.execute(meteringSql).catch(() => []),
    ]);

    res.json({ resources, metering });
  } catch (err) { next(err); }
});

router.get('/datasphere/overview', async (req, res, next) => {
  try {
    if (!hanaService.connection) {
      return res.status(401).json({ success: false, message: 'Not connected.' });
    }

    const last24hSql = `
      SELECT 
        SUM(CASE WHEN STATUS = 'COMPLETED' THEN 1 ELSE 0 END) AS COMPLETED_24H,
        SUM(CASE WHEN STATUS = 'FAILED' THEN 1 ELSE 0 END) AS FAILED_24H,
        COUNT(*) AS TOTAL_24H
      FROM DWC_GLOBAL.TASK_LOGS
      WHERE START_TIME > ADD_SECONDS(CURRENT_TIMESTAMP, -86400)
    `;

    const activeTasksSql = `
      SELECT COUNT(*) AS ACTIVE_TASKS
      FROM DWC_GLOBAL.TASK_LOGS
      WHERE STATUS NOT IN ('COMPLETED', 'FAILED') AND START_TIME > ADD_SECONDS(CURRENT_TIMESTAMP, -3600)
    `;

    const avgDurationSql = `
      SELECT 
        APPLICATION_ID,
        AVG(SECONDS_BETWEEN(START_TIME, END_TIME)) AS AVG_DURATION_SEC
      FROM DWC_GLOBAL.TASK_LOGS
      WHERE STATUS = 'COMPLETED' AND END_TIME IS NOT NULL
      GROUP BY APPLICATION_ID
      ORDER BY AVG_DURATION_SEC DESC
      LIMIT 5
    `;

    const hourlyTrendSql = `
      SELECT 
        HOUR(START_TIME) AS HOUR,
        COUNT(*) AS TASK_COUNT,
        SUM(CASE WHEN STATUS = 'COMPLETED' THEN 1 ELSE 0 END) AS SUCCESS_COUNT,
        SUM(CASE WHEN STATUS = 'FAILED' THEN 1 ELSE 0 END) AS FAIL_COUNT
      FROM DWC_GLOBAL.TASK_LOGS
      WHERE START_TIME > ADD_SECONDS(CURRENT_TIMESTAMP, -86400)
      GROUP BY HOUR(START_TIME)
      ORDER BY HOUR
    `;

    const [last24h, activeTasks, avgDuration, hourlyTrend] = await Promise.all([
      hanaService.execute(last24hSql).catch(() => [{}]),
      hanaService.execute(activeTasksSql).catch(() => [{}]),
      hanaService.execute(avgDurationSql).catch(() => []),
      hanaService.execute(hourlyTrendSql).catch(() => []),
    ]);

    res.json({
      summary: {
        completed24h: parseInt(last24h[0]?.COMPLETED_24H || 0),
        failed24h: parseInt(last24h[0]?.FAILED_24H || 0),
        total24h: parseInt(last24h[0]?.TOTAL_24H || 0),
        activeTasks: parseInt(activeTasks[0]?.ACTIVE_TASKS || 0),
      },
      avgDuration,
      hourlyTrend,
    });
  } catch (err) { next(err); }
});

module.exports = router;
