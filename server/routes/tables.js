const express = require('express');
const router = express.Router();
const hanaService = require('../services/hanaService');

// Middleware to check connection
const checkConnection = (req, res, next) => {
  if (!hanaService.connection) {
    return res.status(401).json({ success: false, message: 'Not connected to HANA.' });
  }
  next();
};

// Get Schemas
router.get('/schemas', checkConnection, async (req, res, next) => {
  try {
    const schemas = await hanaService.getSchemas();
    res.json(schemas);
  } catch (err) {
    next(err);
  }
});

// Get Tables for a Schema
router.get('/:schema', checkConnection, async (req, res, next) => {
  try {
    const tables = await hanaService.getTables(req.params.schema);
    res.json(tables);
  } catch (err) {
    next(err);
  }
});

// Get Preview Data
router.get('/:schema/:table/preview', checkConnection, async (req, res, next) => {
  try {
    const { schema, table } = req.params;
    const data = await hanaService.getPreview(schema, table);
    let columns = await hanaService.getColumns(schema, table);

    // Fallback: If metadata query returns empty but we have data, infer columns from first row
    if ((!columns || columns.length === 0) && data && data.length > 0) {
      columns = Object.keys(data[0]).map(key => ({
        COLUMN_NAME: key,
        DATA_TYPE_NAME: 'UNKNOWN', // We don't know the type, but at least we can show the data
        LENGTH: null,
        IS_NULLABLE: 'TRUE'
      }));
    }

    res.json({ columns, data });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
