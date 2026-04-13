// server/routes/ai.js
const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const hanaService = require('../services/hanaService');
const tableValidationService = require('../services/tableValidationService');

router.post('/generate-sql', async (req, res, next) => {
  try {
    const { apiKey, prompt, schema, context, tableList = [] } = req.body;

    const key = typeof apiKey === 'string' ? apiKey.trim() : '';
    
    // Debug log (mask key for security)
    console.log('[AI] Received request - Key starts with:', key ? key.substring(0, 10) + '...' : 'MISSING');
    console.log('[AI] Prompt:', prompt?.substring(0, 50));
    
    if (!key) {
      return res.status(400).json({ 
        success: false, 
        message: "API Key required. Enter your Groq API key from Smart Query settings.",
        hint: "Get a free API key at https://console.groq.com/keys"
      });
    }

    if (!prompt || prompt.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "Please enter a question or command.",
        hint: "Example: 'Show failed tasks in the last 7 days'"
      });
    }
    
    const targetSchema = schema || 'DWC_GLOBAL';

    // Initialize AI
    aiService.init(key);

    // Use provided context or fetch tables from DB (if connected)
    let schemaContext = context;
    if (!schemaContext && hanaService.connection) {
      try {
        const tables = await hanaService.getTables(targetSchema);
        schemaContext = tables.map(t => t.TABLE_NAME).join(", ");
      } catch (err) {
        console.log('[AI] Could not fetch tables:', err.message);
      }
    }
    if (!schemaContext) {
      // Default context for DWC_GLOBAL if no DB connection
      schemaContext = 'TASK_LOGS (TASK_LOG_ID, SPACE_ID, APPLICATION_ID, OBJECT_ID, STATUS, "USER", START_TIME, END_TIME), TASK_CHAIN_RUNS, TASK_CHAIN_RUN_NODES, TASK_LOG_MESSAGES';
    }
    
    const result = await aiService.generateSql(prompt, {
      schema: targetSchema,
      context: schemaContext,
      tableList
    });

    const referencedTables = tableValidationService.extractTableNames(result.sql);
    const invalidTables = hanaService.connection
      ? await tableValidationService.validateTables(
          referencedTables,
          targetSchema,
          hanaService,
          aiService
        )
      : [];
    
    res.json({ 
      success: true, 
      sql: result.sql,
      explanation: result.explanation,
      invalidTables
    });

  } catch (err) {
    console.error('[AI] Error:', err.message);
    
    // Better error messages for users
    let userMessage = 'An error occurred. Please try again.';
    let hint = '';

    if (err.status === 429 || err.message.includes('429')) {
      userMessage = 'Rate limit exceeded. Please wait 10-15 seconds and try again.';
      hint = 'This can happen with the free Groq tier.';
    } else if (err.status === 401) {
      userMessage = 'Invalid API Key. Please check it.';
      hint = 'Get a new key at https://console.groq.com/keys';
    } else if (err.message.toLowerCase().includes('not understood')) {
      userMessage = 'Could not understand your query. Please be more specific.';
      hint = 'Example: "Show failed tasks in the last 7 days" or "List running tasks"';
    }
    
    res.status(err.status || 500).json({
      success: false,
      message: userMessage,
      hint: hint,
      debug: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

module.exports = router;
