// server/routes/ai.js
const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const hanaService = require('../services/hanaService');
const tableValidationService = require('../services/tableValidationService');

router.post('/generate-sql', async (req, res, next) => {
  try {
    const { apiKey, prompt, schema, context, tableList = [] } = req.body;

    // API key optional - use env if not provided
    const key = apiKey || process.env.OPENAI_API_KEY;
    
    // Debug log (mask key for security)
    console.log('[AI] Received request - Key starts with:', key ? key.substring(0, 10) + '...' : 'MISSING');
    console.log('[AI] Prompt:', prompt?.substring(0, 50));
    
    if (!key) {
      return res.status(400).json({ 
        success: false, 
        message: "API Key gerekli. Lütfen ayarlardan OpenRouter API anahtarınızı girin.",
        hint: "https://openrouter.ai/keys adresinden ücretsiz API key alabilirsiniz."
      });
    }

    if (!prompt || prompt.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "Lütfen bir soru veya komut girin.",
        hint: "Örnek: 'Son 7 gündeki başarısız görevleri göster'"
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
    let userMessage = 'Bir hata oluştu. Lütfen tekrar deneyin.';
    let hint = '';
    
    if (err.status === 429 || err.message.includes('429')) {
      userMessage = 'Rate limit aşıldı. Lütfen 10-15 saniye bekleyip tekrar deneyin.';
      hint = 'OpenRouter ücretsiz tier kullanıldığında bazen bu hata oluşabilir.';
    } else if (err.status === 401) {
      userMessage = 'API Key geçersiz. Lütfen kontrol edin.';
      hint = 'https://openrouter.ai/keys adresinden yeni key alabilirsiniz.';
    } else if (err.message.includes('anlaşılamadı')) {
      userMessage = 'Sorunuz anlaşılamadı. Lütfen daha açık bir şekilde yazın.';
      hint = 'Örnek: "Son 7 gündeki başarısız görevleri göster" veya "Show failed tasks"';
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
