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

    const taskChainsSql = `
      SELECT TOP 10
        TASK_CHAIN_NAME,
        STATUS,
        LAST_RUN_START_TIME,
        LAST_RUN_END_TIME,
        LAST_RUN_STATUS
      FROM SYS.M_TASK_CHAINS
      ORDER BY LAST_RUN_START_TIME DESC
    `;
    
    const altTaskChainsSql = `
      SELECT TOP 10
        TASK_NAME AS TASK_CHAIN_NAME,
        STATUS,
        START_TIME AS LAST_RUN_START_TIME,
        END_TIME AS LAST_RUN_END_TIME,
        RUN_STATUS AS LAST_RUN_STATUS
      FROM _SYS_TASK.TASK_RUNS
      ORDER BY START_TIME DESC
    `;
    
    let recentDataLoads = [];
    try {
      recentDataLoads = await hanaService.execute(taskChainsSql);
      console.log('Task chains (M_TASK_CHAINS):', recentDataLoads);
      if (!recentDataLoads || recentDataLoads.length === 0) {
        console.log('Trying alternative task runs query...');
        recentDataLoads = await hanaService.execute(altTaskChainsSql);
        console.log('Task runs (TASK_RUNS):', recentDataLoads);
      }
      recentDataLoads = recentDataLoads.map(tc => ({
        task: tc.TASK_CHAIN_NAME || tc.TASK_NAME,
        time: tc.LAST_RUN_START_TIME || tc.START_TIME ? new Date(tc.LAST_RUN_START_TIME || tc.START_TIME).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '-',
        status: (tc.LAST_RUN_STATUS || tc.RUN_STATUS) === 'COMPLETED' ? 'success' : (tc.LAST_RUN_STATUS || tc.RUN_STATUS) === 'FAILED' ? 'failed' : 'running'
      }));
    } catch (e) {
      console.error('Task chains error:', e.message);
      recentDataLoads = [];
    }

    res.json({ schema, totalTables, totalViews, topTables, activeConnections, recentDataLoads });
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
