// server/routes/ai.js
const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const hanaService = require('../services/hanaService');

router.post('/generate-sql', async (req, res, next) => {
  try {
    const { apiKey, prompt, schema } = req.body;

    if (!apiKey) {
      return res.status(400).json({ success: false, message: "API Key is required." });
    }
    if (!hanaService.connection) {
       return res.status(400).json({ success: false, message: "Connect to database first." });
    }

    // Initialize AI
    aiService.init(apiKey);

    // Get context (tables) to help the AI
    // We cache this or fetch it fresh? Fetch fresh for now.
    const tables = await hanaService.getTables(schema);
    
    const sql = await aiService.generateSql(prompt, { schema, tables });
    
    res.json({ success: true, sql });

  } catch (err) {
    next(err);
  }
});

module.exports = router;
