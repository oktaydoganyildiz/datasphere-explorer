// server/services/aiService.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

class AiService {
  constructor() {
    this.model = null;
  }

  // Initialize with API Key (we'll pass this from the request to avoid storing it)
  init(apiKey) {
    const genAI = new GoogleGenerativeAI(apiKey); 
    this.model = genAI.getGenerativeModel({ 
      model: "gemini-flash-latest",
    });
  }

  async generateSql(userPrompt, schemaInfo) {
    if (!this.model) {
      throw new Error("AI Model not initialized. Please provide an API Key.");
    }

    // Construct Context
    // We limit schema info to avoid token limits. Just table names + maybe key columns?
    // For now, let's just pass table names.
    const tablesList = schemaInfo.tables.map(t => t.TABLE_NAME).join(", ");
    
    const systemPrompt = `
      You are an expert SAP HANA SQL developer.
      I have a database with the following tables in schema "${schemaInfo.schema}":
      [${tablesList}]
      
      The user will ask a question in natural language. You must translate it into a valid SAP HANA SQL query.
      
      Rules:
      1. Return ONLY the SQL code. No markdown, no explanations.
      2. Use double quotes for identifiers like "Table" and "Column".
      3. Use single quotes for string literals.
      4. If the user asks for something impossible based on the table names, try your best or return a comment like "-- I could not match tables to your request".
      5. Assume standard column names (e.g. ID, NAME, DATE, AMOUNT) if you have to guess, but prefer generalized queries.
      
      User Question: "${userPrompt}"
    `;

    const result = await this.model.generateContent(systemPrompt);
    const response = await result.response;
    let text = response.text();
    
    // Clean up markdown code blocks if the model ignores Rule 1
    text = text.replace(/```sql/g, '').replace(/```/g, '').trim();
    
    return text;
  }
}

module.exports = new AiService();
