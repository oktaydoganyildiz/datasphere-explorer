const express = require('express');
const router = express.Router();
const hanaService = require('../services/hanaService');

/**
 * POST /api/import/csv
 * Body: { schema, tableName, headers, types, rows }
 */
router.post('/csv', async (req, res, next) => {
  try {
    if (!hanaService.connection) {
      return res.status(401).json({ success: false, message: 'Not connected to HANA.' });
    }

    const { schema, tableName, headers, types, rows } = req.body;

    if (!schema || !tableName || !headers?.length || !rows?.length) {
      return res.status(400).json({ success: false, message: 'Missing required parameters.' });
    }

    // Validate schema and table name
    if (!hanaService.isSafeIdentifier(schema) || !hanaService.isSafeIdentifier(tableName)) {
      return res.status(400).json({ success: false, message: 'Invalid schema or table name.' });
    }

    // Validate headers
    if (!Array.isArray(headers) || headers.some(h => !hanaService.isSafeIdentifier(h))) {
      return res.status(400).json({ success: false, message: 'Invalid column names.' });
    }

    const safeSchema = schema.replace(/"/g, '""');
    const safeTable = tableName.replace(/"/g, '""');
    const fullName = `"${safeSchema}"."${safeTable}"`;

    // Column definitions with validated headers
    const colDefs = headers
      .map((h, i) => {
        const safeHeader = h.replace(/"/g, '""');
        const type = types?.[i] || 'NVARCHAR(255)';
        return `"${safeHeader}" ${type}`;
      })
      .join(', ');

    // Drop existing table if it exists
    try {
      await hanaService.execute(`DROP TABLE ${fullName}`);
    } catch (err) {
      // Ignore if table doesn't exist
    }

    // Create new table
    await hanaService.execute(`CREATE COLUMN TABLE ${fullName} (${colDefs})`);

    // Batch insert (100 rows per batch)
    const BATCH_SIZE = 100;
    let inserted = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const placeholders = batch.map(() => `(${headers.map(() => '?').join(',')})`).join(',');
      const values = batch.flat();

      await hanaService.execute(`INSERT INTO ${fullName} VALUES ${placeholders}`, values);
      inserted += batch.length;
    }

    res.json({ success: true, rowsInserted: inserted, tableName });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
