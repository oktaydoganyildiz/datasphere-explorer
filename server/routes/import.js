const express = require('express');
const router = express.Router();
const hanaService = require('../services/hanaService');

/**
 * POST /api/import/csv
 * Body: { schema, tableName, headers, types, rows }
 */
router.post('/csv', async (req, res) => {
  const conn = hanaService.connection;
  if (!conn) return res.status(503).json({ success: false, message: 'HANA bağlantısı yok' });

  const { schema, tableName, headers, types, rows } = req.body;

  if (!schema || !tableName || !headers?.length || !rows?.length) {
    return res.status(400).json({ success: false, message: 'Eksik parametre' });
  }

  const fullName = `"${schema.replace(/"/g, '')}"."${tableName.replace(/"/g, '')}"`;

  try {
    // 1. Sütun tanımları
    const colDefs = headers.map((h, i) => {
      const cleanHeader = h ? h.replace(/"/g, '').trim() : `COL_${i}`;
      const colType = (types && types[i]) ? types[i] : 'NVARCHAR(5000)';
      return `"${cleanHeader}" ${colType}`;
    }).join(', ');

    // 2. Tabloyu Hazırla
    try {
      await hanaService.execute(`DROP TABLE ${fullName}`);
    } catch (e) { /* Tablo yoksa devam et */ }

    const createSql = `CREATE COLUMN TABLE ${fullName} (${colDefs})`;
    await hanaService.execute(createSql);

    // 3. Veriyi Yükle (Prepared Statement + Batch)
    const placeholders = headers.map(() => '?').join(', ');
    const insertSql = `INSERT INTO ${fullName} VALUES (${placeholders})`;

    // Prepare statement
    const stmt = await new Promise((resolve, reject) => {
      conn.prepare(insertSql, (err, statement) => {
        if (err) reject(err);
        else resolve(statement);
      });
    });

    // Batch insert loop
    const BATCH_SIZE = 5000;
    let totalInserted = 0;

    try {
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batchRows = rows.slice(i, i + BATCH_SIZE);
        
        await new Promise((resolve, reject) => {
          stmt.execBatch(batchRows, (err, rowsAffected) => {
            if (err) reject(err);
            else resolve(rowsAffected);
          });
        });
        
        totalInserted += batchRows.length;
      }
    } finally {
      // Her durumda statement'ı temizle
      stmt.drop();
    }

    res.json({ success: true, rowsInserted: totalInserted, tableName });

  } catch (err) {
    console.error('[CSV Import Error]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
