const express = require('express');
const router = express.Router();

/**
 * POST /api/import/csv
 * Body: { schema, tableName, headers, types, rows }
 */
router.post('/csv', async (req, res) => {
  const conn = req.app.locals.hanaConnection;
  if (!conn) return res.status(503).json({ success: false, message: 'HANA bağlantısı yok' });

  const { schema, tableName, headers, types, rows } = req.body;

  if (!schema || !tableName || !headers?.length || !rows?.length) {
    return res.status(400).json({ success: false, message: 'Eksik parametre' });
  }

  const fullName = `"${schema}"."${tableName}"`;

  try {
    // Sütun tanımları
    const colDefs = headers
      .map((h, i) => `"${h.replace(/"/g, '')}" ${types[i] || 'NVARCHAR(255)'}`)
      .join(', ');

    // Tabloyu oluştur (zaten varsa DROP et)
    await execSQL(conn, `DROP TABLE ${fullName}`).catch(() => {});
    await execSQL(conn, `CREATE COLUMN TABLE ${fullName} (${colDefs})`);

    // Toplu INSERT (100'erlik batch)
    const BATCH = 100;
    let inserted = 0;

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const placeholders = batch.map(() => `(${headers.map(() => '?').join(',')})`).join(',');
      const values = batch.flat();
      await execSQL(conn, `INSERT INTO ${fullName} VALUES ${placeholders}`, values);
      inserted += batch.length;
    }

    res.json({ success: true, rowsInserted: inserted, tableName });
  } catch (err) {
    console.error('[CSV Import]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

const execSQL = (conn, sql, params = []) =>
  new Promise((resolve, reject) => {
    conn.exec(sql, params, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });

module.exports = router;
