// server/routes/stats.js
const express = require('express');
const router = express.Router();
const hanaService = require('../services/hanaService');

router.get('/dashboard', async (req, res, next) => {
  try {
    if (!hanaService.connection) {
      return res.status(401).json({ success: false, message: "Not connected." });
    }

    const config = hanaService.currentConfig;
    const schema = config.schema || 'ANALYTICSTR'; // Default or from config? Use param?
    // Note: Better to pass schema as query param

    // 1. Total Tables & Views
    // We can reuse getTables but let's do a lightweight aggregate
    const statsSql = `
      SELECT 'TABLE' as TYPE, COUNT(*) as COUNT FROM SYS.M_TABLES WHERE SCHEMA_NAME = ?
      UNION ALL
      SELECT 'VIEW' as TYPE, COUNT(*) as COUNT FROM SYS.VIEWS WHERE SCHEMA_NAME = ?
    `;
    const counts = await hanaService.execute(statsSql, [schema, schema]);
    
    const totalTables = counts.find(c => c.TYPE === 'TABLE')?.COUNT || 0;
    const totalViews = counts.find(c => c.TYPE === 'VIEW')?.COUNT || 0;

    // 2. Top 5 Largest Tables (by Record Count)
    const topTablesSql = `
      SELECT TOP 5 TABLE_NAME, RECORD_COUNT 
      FROM SYS.M_TABLES 
      WHERE SCHEMA_NAME = ? 
      ORDER BY RECORD_COUNT DESC
    `;
    const topTables = await hanaService.execute(topTablesSql, [schema]);

    // 3. Active Connections (Dynamic)
    const connSql = `SELECT COUNT(*) AS COUNT FROM SYS.M_CONNECTIONS WHERE CONNECTION_STATUS = 'RUNNING'`;
    const connResult = await hanaService.execute(connSql);
    const activeConnections = connResult[0]?.COUNT || 0;

    res.json({
      schema,
      totalTables,
      totalViews,
      topTables,
      activeConnections
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;
