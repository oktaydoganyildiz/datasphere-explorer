const express = require('express');
const router = express.Router();
const hanaService = require('../services/hanaService');

/**
 * POST /api/query/execute
 * Body: { sql }
 * Description: Executes a raw SQL query.
 */
router.post('/execute', async (req, res, next) => {
  try {
    const { sql } = req.body;
    if (!sql) {
      return res.status(400).json({ success: false, message: 'SQL query is required' });
    }

    if (!hanaService.connection) {
      return res.status(401).json({ success: false, message: 'Not connected to database.' });
    }

    const startTime = Date.now();
    const rows = await hanaService.execute(sql);
    const duration = Date.now() - startTime;

    let limitedRows = [];
    let rowCount = 0;
    let limitReached = false;

    if (Array.isArray(rows)) {
      rowCount = rows.length;
      limitReached = rows.length > 500;
      limitedRows = rows.slice(0, 500);
    } else if (typeof rows === 'number') {
      // DML result (affected rows)
      rowCount = 1;
      limitedRows = [{ "Affected Rows": rows }];
    } else if (rows && typeof rows === 'object') {
      // Single object result or other structure
      rowCount = 1;
      limitedRows = [rows];
    } else {
      // Unknown or null
      rowCount = 0;
      limitedRows = [];
    }

    res.json({
      success: true,
      rows: limitedRows,
      rowCount: rowCount,
      limitReached: limitReached,
      duration
    });
  } catch (err) {
    // Return the specific HANA error message
    res.status(500).json({ success: false, message: err.message || 'Query execution failed' });
  }
});

module.exports = router;
