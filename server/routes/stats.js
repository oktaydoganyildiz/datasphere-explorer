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

    // Storage utilization (used/total + %)
    const diskSql = `
      SELECT
        ROUND(SUM(USED_SIZE) / NULLIF(SUM(FILE_SIZE), 0) * 100, 1) AS DISK_PCT,
        ROUND(SUM(USED_SIZE)  / 1073741824.0, 2) AS USED_GB,
        ROUND(SUM(FILE_SIZE) / 1073741824.0, 2) AS TOTAL_GB
      FROM SYS.M_DISK_USAGE
      WHERE USED_SIZE > 0
    `;
    const diskRows = await hanaService.execute(diskSql).catch(() => []);
    const storage = diskRows?.[0]
      ? {
          pct: parseFloat(diskRows[0].DISK_PCT || 0) || 0,
          usedGb: parseFloat(diskRows[0].USED_GB || 0) || 0,
          totalGb: parseFloat(diskRows[0].TOTAL_GB || 0) || 0,
        }
      : { pct: 0, usedGb: 0, totalGb: 0 };

    const taskChainsSql = `
      SELECT TOP 10
        TASK_CHAIN_NAME AS OBJECT_ID,
        TASK_CHAIN_NAME,
        'Task Chain' AS ACTIVITY,
        STATUS,
        LAST_RUN_START_TIME,
        LAST_RUN_END_TIME,
        LAST_RUN_STATUS,
        NULL AS TRIGGERED_BY,
        SECONDS_BETWEEN(LAST_RUN_START_TIME, LAST_RUN_END_TIME) AS DURATION
      FROM SYS.M_TASK_CHAINS
      ORDER BY LAST_RUN_START_TIME DESC
    `;
    
    const altTaskChainsSql = `
      SELECT TOP 10
        TASK_NAME AS TASK_CHAIN_NAME,
        TASK_NAME AS OBJECT_ID,
        'Task Run' AS ACTIVITY,
        STATUS,
        START_TIME AS LAST_RUN_START_TIME,
        END_TIME AS LAST_RUN_END_TIME,
        RUN_STATUS AS LAST_RUN_STATUS,
        USER_NAME AS TRIGGERED_BY,
        SECONDS_BETWEEN(START_TIME, END_TIME) AS DURATION
      FROM _SYS_TASK.TASK_RUNS
      ORDER BY START_TIME DESC
    `;

    // Prefer DWC_GLOBAL task log view if available
    // This table/view is expected to store DataSphere / HANA Cloud task chain run history.
    const dwcTaskLogsSql = `
      SELECT TOP 10
        *
      FROM "DWC_GLOBAL"."TASK_LOGS_V_EXT"
      ORDER BY START_TIME DESC
    `;
    
    // Recent Data Loads - tüm schemalar için (schema parametresinden bağımsız)
    let recentDataLoads = [];
    let taskRows = [];
    try {
      // 1) DWC_GLOBAL.TASK_LOGS_V_EXT
      try {
        taskRows = await hanaService.execute(dwcTaskLogsSql);
      } catch (e) {
        console.log('TASK_LOGS_V_EXT error:', e.message);
      }
      if (!taskRows || taskRows.length === 0) {
        // 2) SYS.M_TASK_CHAINS
        try {
          taskRows = await hanaService.execute(taskChainsSql);
        } catch (e) {
          console.log('M_TASK_CHAINS error:', e.message);
        }
      }
      if (!taskRows || taskRows.length === 0) {
        // 3) _SYS_TASK.TASK_RUNS
        try {
          taskRows = await hanaService.execute(altTaskChainsSql);
        } catch (e) {
          console.log('TASK_RUNS error:', e.message);
        }
      }

      console.log('taskRows sample:', JSON.stringify(taskRows[0], null, 2));
      recentDataLoads = (taskRows || []).map(tc => {
        const start = tc.START_TIME;
        const end = tc.END_TIME;
        const statusRaw = (tc.STATUS || '').toString().toUpperCase();
        const status =
          statusRaw === 'COMPLETED' ? 'success' :
          (statusRaw === 'FAILED' || statusRaw === 'ERROR' || statusRaw === 'CANCELLED' || statusRaw === 'CANCELED') ? 'failed' :
          'running';

        const durationSec = (start && end ? Math.floor((new Date(end) - new Date(start)) / 1000) : null);
        let durationStr = '-';
        if (durationSec !== null && durationSec !== undefined) {
          const hrs = Math.floor(durationSec / 3600);
          const mins = Math.floor((durationSec % 3600) / 60);
          const secs = durationSec % 60;
          if (hrs > 0) durationStr = `${hrs}h ${mins}m`;
          else if (mins > 0) durationStr = `${mins}m ${secs}s`;
          else durationStr = `${secs}s`;
        }

        return {
          task: tc.TASK_NAME || tc.OBJECT_ID || '-',
          objectId: tc.OBJECT_ID || '-',
          activity: tc.ACTIVITY || '-',
          time: start ? new Date(start).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-',
          status,
          duration: durationStr,
          triggeredBy: tc.TRIGGERED_BY || '-'
        };
      });
    } catch (e) {
      console.error('Task chains error:', e.message);
      recentDataLoads = [];
    }

    res.json({ schema, totalTables, totalViews, topTables, activeConnections, recentDataLoads, storage });
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
        CONNECTION_TYPE as STMT_TYPE,
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

    // DWC_GLOBAL - Task Performance
    const taskLogsSql = `
      SELECT TOP 10 * FROM "DWC_GLOBAL"."TASK_LOGS_V_EXT" ORDER BY START_TIME DESC
    `;

    // DWC_GLOBAL - Scheduled Tasks
    const taskSchedulesSql = `
      SELECT TOP 10 * FROM "DWC_GLOBAL"."TASK_SCHEDULES_V_EXT" ORDER BY NEXT_RUN_TIME ASC
    `;

    // DWC_GLOBAL - Task Error Messages
    const taskErrorsSql = `
      SELECT TOP 10 * FROM "DWC_GLOBAL"."TASK_LOG_MESSAGES_V_EXT" WHERE STATUS IN ('FAILED', 'ERROR') ORDER BY START_TIME DESC
    `;

    // DWC_GLOBAL - Task Locks
    const taskLocksSql = `
      SELECT TOP 10 * FROM "DWC_GLOBAL"."TASK_LOCKS_V_EXT" ORDER BY START_TIME DESC
    `;

    // SYS - Disk Details (fallback to M_DISK_USAGE)
    let diskDetailSql = `
      SELECT 
        VOLUME_ID,
        FILE_TYPE,
        ROUND(USED_SIZE / 1073741824.0, 2) AS USED_GB,
        ROUND(TOTAL_SIZE / 1073741824.0, 2) AS TOTAL_GB,
        ROUND(USED_SIZE / NULLIF(TOTAL_SIZE, 0) * 100, 1) AS USAGE_PCT
      FROM SYS.M_DISKS
      ORDER BY USAGE_PCT DESC
    `;

    const diskDetailAltSql = `
      SELECT 
        'DATA' AS VOLUME_ID,
        'DATA' AS FILE_TYPE,
        ROUND(SUM(USED_SIZE) / 1073741824.0, 2) AS USED_GB,
        ROUND(SUM(TOTAL_SIZE) / 1073741824.0, 2) AS TOTAL_GB,
        ROUND(SUM(USED_SIZE) / NULLIF(SUM(TOTAL_SIZE), 0) * 100, 1) AS USAGE_PCT
      FROM SYS.M_DISK_USAGE
      GROUP BY FILE_TYPE
    `;

    // Fallback CPU query
    const cpuAltSql = `
      SELECT TOP 1 0 AS CPU_PCT
    `;

    // Fallback Memory query
    const memAltSql = `
      SELECT TOP 1 0 AS MEM_PCT, 0 AS USED_GB, 0 AS TOTAL_GB
    `;

    let cpuRows, memRows, diskRows, connRows, taskLogs, taskSchedules, taskErrors, taskLocks, diskDetails;

    try { cpuRows = await hanaService.execute(cpuSql); } catch (e) { 
      console.log('CPU query error:', e.message); 
      try { cpuRows = await hanaService.execute(cpuAltSql); } catch { cpuRows = []; }
    }
    try { memRows = await hanaService.execute(memSql); } catch (e) { 
      console.log('MEM query error:', e.message); 
      try { memRows = await hanaService.execute(memAltSql); } catch { memRows = []; }
    }
    try { diskRows = await hanaService.execute(diskSql); } catch (e) { 
      console.log('DISK query error:', e.message); 
      diskRows = [];
    }
    try { connRows = await hanaService.execute(connDetailSql); } catch (e) { 
      console.log('CONN query error:', e.message); 
      connRows = [];
    }
    try { taskLogs = await hanaService.execute(taskLogsSql); } catch (e) { 
      console.log('TASK_LOGS query error:', e.message); 
      taskLogs = [];
    }
    try { taskSchedules = await hanaService.execute(taskSchedulesSql); } catch (e) { 
      console.log('TASK_SCHEDULES query error:', e.message); 
      taskSchedules = [];
    }
    try { taskErrors = await hanaService.execute(taskErrorsSql); } catch (e) { 
      console.log('TASK_ERRORS query error:', e.message); 
      taskErrors = [];
    }
    try { taskLocks = await hanaService.execute(taskLocksSql); } catch (e) { 
      console.log('TASK_LOCKS query error:', e.message); 
      taskLocks = [];
    }
    try { diskDetails = await hanaService.execute(diskDetailSql); } catch (e) { 
      console.log('DISK_DETAIL query error:', e.message); 
      try { diskDetails = await hanaService.execute(diskDetailAltSql); } catch { diskDetails = []; }
    }

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
      diskDetails: diskDetails?.length > 0 ? diskDetails : (diskRows[0] ? [{
        VOLUME_ID: 'DATA',
        FILE_TYPE: 'DATA',
        USED_GB: diskRows[0]?.USED_GB || 0,
        TOTAL_GB: diskRows[0]?.TOTAL_GB || 0,
        USAGE_PCT: diskRows[0]?.DISK_PCT || 0
      }] : []),
      connections: connRows,
      expensiveStatements: expRows,
      taskLogs: taskLogs || [],
      taskSchedules: taskSchedules || [],
      taskErrors: taskErrors || [],
      taskLocks: taskLocks || [],
    });
  } catch (err) { next(err); }
});

router.get('/profile/:schema/:table', async (req, res, next) => {
  try {
    if (!hanaService.connection) {
      return res.status(401).json({ success: false, message: 'Not connected.' });
    }
    const { schema, table } = req.params;

    // 1. Get Column Metadata
    const columns = await hanaService.getColumns(schema, table);
    if (!columns || columns.length === 0) {
      return res.status(404).json({ success: false, message: 'Table not found or no columns.' });
    }

    // 2. Build Dynamic Aggregation Query
    // We want: TOTAL_ROWS, for each col: NULL_COUNT, DISTINCT_COUNT, MIN_VAL, MAX_VAL
    // Doing 4 aggs per column might be heavy for wide tables, but OK for "Profiler".
    // We'll select COUNT(*) once, then for each col:
    // COUNT("Col") (non-nulls), MIN("Col"), MAX("Col"). 
    // DISTINCT is expensive, maybe skip or use separate query? Let's try basic stats first.
    
    // To avoid huge SQL, let's limit to top 20 columns or similar if needed? 
    // No, let's try all. If it fails, user can see error.
    
    // Safety: table name is from params, columns from metadata.
    const safeSchema = schema.replace(/"/g, '""');
    const safeTable = table.replace(/"/g, '""');

    // First get total count
    const countSql = `SELECT COUNT(*) AS TOTAL FROM "${safeSchema}"."${safeTable}"`;
    const countRes = await hanaService.execute(countSql);
    const totalRows = countRes[0]?.TOTAL || 0;

    // Now loop through columns to build stats
    // We'll do it in chunks or one big query? 
    // One big query for Min/Max/Nulls is usually fine.
    // Distinct count is the heavy one. Let's exclude Distinct for now to be fast, 
    // or do it only for low-cardinality types? 
    // User asked for "Distinct %". We need it.
    // Let's generate individual small queries or one medium one?
    // HANA can handle it.
    
    const statsPromises = columns.map(async (col) => {
      const colName = col.COLUMN_NAME.replace(/"/g, '""');
      // Skip BLOB/CLOB/TEXT for distinct/min/max
      const isLob = ['BLOB', 'CLOB', 'NCLOB', 'TEXT', 'BINTEXT'].some(t => col.DATA_TYPE_NAME.includes(t));
      
      let sql = '';
      if (isLob) {
        sql = `SELECT 
                 COUNT("${colName}") as NON_NULL_COUNT, 
                 0 as DISTINCT_COUNT, 
                 NULL as MIN_VAL, 
                 NULL as MAX_VAL 
               FROM "${safeSchema}"."${safeTable}"`;
      } else {
        // Use ESTIMATE for distinct if table is huge? No, user wants real profile.
        // We'll use exact COUNT(DISTINCT).
        sql = `SELECT 
                 COUNT("${colName}") as NON_NULL_COUNT, 
                 COUNT(DISTINCT "${colName}") as DISTINCT_COUNT, 
                 MIN("${colName}") as MIN_VAL, 
                 MAX("${colName}") as MAX_VAL 
               FROM "${safeSchema}"."${safeTable}"`;
      }

      try {
        const rows = await hanaService.execute(sql);
        const r = rows[0];
        return {
          column: col.COLUMN_NAME,
          dataType: col.DATA_TYPE_NAME,
          length: col.LENGTH,
          nonNullCount: r.NON_NULL_COUNT,
          distinctCount: r.DISTINCT_COUNT,
          min: r.MIN_VAL,
          max: r.MAX_VAL,
          nullCount: totalRows - r.NON_NULL_COUNT
        };
      } catch (e) {
        return {
          column: col.COLUMN_NAME,
          dataType: col.DATA_TYPE_NAME,
          error: e.message
        };
      }
    });

    const columnStats = await Promise.all(statsPromises);

    res.json({
      schema,
      table,
      totalRows,
      columns: columnStats
    });

  } catch (err) { next(err); }
});

module.exports = router;
