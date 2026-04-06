const express = require('express');
const router = express.Router();
const hanaService = require('../services/hanaService');
const exportService = require('../services/exportService');

// Export Table to Excel
router.get('/:schema/:table', async (req, res, next) => {
  try {
    if (!hanaService.connection) {
      return res.status(401).json({ success: false, message: 'Not connected.' });
    }

    const { schema, table } = req.params;

    // Validate schema and table to prevent SQL injection via identifiers
    if (!hanaService.isSafeIdentifier(schema) || !hanaService.isSafeIdentifier(table)) {
      return res.status(400).json({ success: false, message: 'Invalid schema or table name.' });
    }
    
    // Get Data (Limit to 10k for MVP safety)
    // Note: Ideally, this should be streamed or paginated for larger datasets
    const sql = `SELECT TOP 10000 * FROM "${schema}"."${table}"`;
    const rows = await hanaService.execute(sql);
    let columns = await hanaService.getColumns(schema, table);

    // Fallback: Infer columns from first row if metadata is missing
    if ((!columns || columns.length === 0) && rows && rows.length > 0) {
      columns = Object.keys(rows[0]).map(key => ({
        COLUMN_NAME: key,
        DATA_TYPE_NAME: 'UNKNOWN',
        LENGTH: null,
        IS_NULLABLE: 'TRUE'
      }));
    }

    const buffer = await exportService.createExcel(table, columns, rows);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${table}.xlsx`);
    
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
