// server/services/aiService.js
const OpenAI = require("openai");

class AiService {
  constructor() {
    this.openai = null;
  }

  // Initialize with API Key (we'll pass this from the request to avoid storing it)
  init(apiKey) {
    this.openai = new OpenAI({
      apiKey: apiKey,
      baseURL: "https://api.groq.com/openai/v1"
    });
  }

  // Retry logic for rate limiting
  async retryWithBackoff(fn, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        // If it's a rate limit error and we have retries left
        if (error.status === 429 && i < maxRetries - 1) {
          const waitTime = Math.pow(2, i) * 3000; // 3s, 6s, 12s
          console.log(`[AI] Rate limit hit, waiting ${waitTime/1000}s before retry ${i + 1}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        throw error;
      }
    }
  }

  // Enhance user prompt to make it clearer for the AI
  enhancePrompt(userPrompt) {
    const lowerPrompt = userPrompt.toLowerCase();
    
    // Common Turkish to clearer prompt mappings
    const enhancements = {
      // Time-related
      'bugün': 'today (last 24 hours)',
      'dün': 'yesterday',
      'bu hafta': 'this week (last 7 days)',
      'geçen hafta': 'last week',
      'bu ay': 'this month',
      'son': 'last',
      
      // Status-related
      'hatalı': 'failed or error status',
      'başarısız': 'failed status',
      'çalışan': 'running status',
      'tamamlanan': 'completed status',
      
      // Actions
      'göster': 'show me',
      'listele': 'list',
      'bul': 'find',
      'getir': 'get',
      'say': 'count'
    };

    let enhanced = userPrompt;
    
    // Add context hints
    if (lowerPrompt.includes('task') || lowerPrompt.includes('görev') || lowerPrompt.includes('iş')) {
      enhanced += ' (from TASK_LOGS table)';
    }
    
    if (lowerPrompt.includes('user') || lowerPrompt.includes('kullanıcı')) {
      enhanced += ' (use "USER" column with quotes)';
    }
    
    // If asking for time period but no specific time mentioned
    if ((lowerPrompt.includes('son') || lowerPrompt.includes('last')) && 
        !lowerPrompt.match(/\d+\s*(gün|gun|day|saat|hour|hafta|week)/)) {
      enhanced += ' (last 7 days)';
    }

    return enhanced;
  }

  async generateSql(userPrompt, schemaInfo) {
    if (!this.openai) {
      throw new Error("AI Model not initialized. Please provide an API Key.");
    }

    // Enhance the user prompt for better understanding
    const enhancedPrompt = this.enhancePrompt(userPrompt);
    console.log(`[AI] Original: "${userPrompt}"`);
    console.log(`[AI] Enhanced: "${enhancedPrompt}"`);

    const systemPrompt = `You are an expert SAP HANA SQL developer specializing in SAP DataSphere monitoring.
      
Schema: "${schemaInfo.schema}"
Available Tables/Views: ${schemaInfo.context}

IMPORTANT INSTRUCTIONS:
1. User asks questions in Turkish or English - understand BOTH languages
2. Return ONLY a JSON object with exactly two fields: "sql" and "explanation"
3. "explanation" must be in Turkish (brief, 1-2 sentences)
4. Use double quotes for SQL identifiers: "COLUMN_NAME"
5. Use single quotes for string literals: 'value'
6. For USER column, ALWAYS use "USER" with quotes (it's a reserved word)
7. Common STATUS values: 'COMPLETED', 'FAILED', 'RUNNING', 'CANCELLED'
8. Always exclude system tasks: SPACE_ID != '$$global$$' (unless explicitly asked)
9. For date filtering: START_TIME > ADD_DAYS(CURRENT_TIMESTAMP, -N)
10. Order by time DESC for recent results

Common Queries:
- "başarısız görevler" = STATUS = 'FAILED'
- "son X gün" = START_TIME > ADD_DAYS(CURRENT_TIMESTAMP, -X)
- "en uzun süren" = ORDER BY SECONDS_BETWEEN(START_TIME, END_TIME) DESC

Example output format (MUST be valid JSON):
{
  "sql": "SELECT TOP 10 TASK_LOG_ID, SPACE_ID, OBJECT_ID, STATUS, START_TIME, END_TIME FROM DWC_GLOBAL.TASK_LOGS WHERE STATUS = 'FAILED' AND SPACE_ID != '$$global$$' AND START_TIME > ADD_DAYS(CURRENT_TIMESTAMP, -7) ORDER BY START_TIME DESC",
  "explanation": "Son 7 gündeki başarısız görevleri en yeniden eskiye doğru listeler"
}

Return ONLY the JSON object, no markdown, no explanations outside JSON.`;

    const generateFn = async () => {
      const completion = await this.openai.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: enhancedPrompt }
        ],
        temperature: 0.2, // Lower for more consistent SQL
        max_tokens: 800
      });

      let text = completion.choices[0].message.content;
      
      // Clean up markdown if present
      text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Remove any text before the first {
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
        text = text.substring(jsonStart, jsonEnd + 1);
      }
      
      try {
        const parsed = JSON.parse(text);
        
        // Validate that we have the required fields
        if (!parsed.sql || !parsed.explanation) {
          throw new Error('Invalid response format');
        }
        
        return {
          sql: parsed.sql.trim(),
          explanation: parsed.explanation.trim()
        };
      } catch (parseError) {
        console.error('[AI] Failed to parse response:', text);
        
        // Try to extract SQL even if JSON parsing fails
        const sqlMatch = text.match(/SELECT[\s\S]+?(?=\n\n|$)/i);
        if (sqlMatch) {
          return {
            sql: sqlMatch[0].trim(),
            explanation: 'SQL sorgusu oluşturuldu (otomatik çıkarım)'
          };
        }
        
        throw new Error('AI yanıtı anlaşılamadı. Lütfen sorunuzu daha açık bir şekilde yazın.');
      }
    };

    // Use retry logic
    return await this.retryWithBackoff(generateFn);
  }
}

module.exports = new AiService();
