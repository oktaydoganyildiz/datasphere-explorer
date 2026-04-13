const aiService = require('./aiService');

const DEFAULT_FUZZY_THRESHOLD = 0.3;

function normalizeIdentifier(identifier) {
  return String(identifier || '')
    .replace(/"/g, '')
    .split('.')
    .pop()
    .trim();
}

function levenshtein(a, b) {
  const left = a || '';
  const right = b || '';
  const dp = Array.from({ length: left.length + 1 }, () =>
    Array(right.length + 1).fill(0)
  );

  for (let i = 0; i <= left.length; i += 1) {
    dp[i][0] = i;
  }

  for (let j = 0; j <= right.length; j += 1) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[left.length][right.length];
}

function extractTableNames(sql) {
  if (!sql || typeof sql !== 'string') {
    return [];
  }

  const regex = /\b(?:FROM|JOIN)\s+((?:"[^"]+"|\w+)(?:\.(?:"[^"]+"|\w+))?)/gi;
  const seen = new Set();
  const tables = [];
  let match;

  while ((match = regex.exec(sql)) !== null) {
    const tableName = normalizeIdentifier(match[1]);
    const canonical = tableName.toUpperCase();

    if (tableName && !seen.has(canonical)) {
      seen.add(canonical);
      tables.push(tableName);
    }
  }

  return tables;
}

function fuzzyMatch(invalidName, validTableList, threshold = DEFAULT_FUZZY_THRESHOLD) {
  const invalid = String(invalidName || '').toUpperCase();
  if (!invalid || !Array.isArray(validTableList) || !validTableList.length) {
    return [];
  }

  return validTableList
    .map((table) => {
      const candidate = String(table || '');
      const canonical = candidate.toUpperCase();
      const distance = levenshtein(invalid, canonical);
      const maxLen = Math.max(invalid.length, canonical.length, 1);
      const score = Number((1 - distance / maxLen).toFixed(2));

      return {
        table: candidate,
        source: 'fuzzy',
        score
      };
    })
    .filter((item) => item.score > threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

async function buildInvalidTableReport({ invalidTables, validTables, aiService: fallbackAiService = aiService }) {
  const report = [];

  for (const invalidName of invalidTables || []) {
    const suggestions = fuzzyMatch(invalidName, validTables);
    if (suggestions.length > 0) {
      report.push({ name: invalidName, suggestions });
      continue;
    }

    const aiSuggestions = fallbackAiService && typeof fallbackAiService.suggestTableMatch === 'function'
      ? await fallbackAiService.suggestTableMatch(invalidName, validTables)
      : [];

    report.push({ name: invalidName, suggestions: aiSuggestions || [] });
  }

  return report;
}

async function validateTables(tableNames, schema, hanaService, fallbackAiService = aiService) {
  const requestedNames = Array.from(
    new Set((tableNames || []).map((name) => normalizeIdentifier(name)).filter(Boolean))
  );

  if (!requestedNames.length) {
    return [];
  }

  const rows = await hanaService.getTables(schema);
  const validTables = rows.map((row) => row.TABLE_NAME).filter(Boolean);
  const validLookup = new Set(validTables.map((name) => String(name).toUpperCase()));
  const invalidTables = requestedNames.filter((name) => !validLookup.has(String(name).toUpperCase()));

  return buildInvalidTableReport({
    invalidTables,
    validTables,
    aiService: fallbackAiService
  });
}

module.exports = {
  extractTableNames,
  fuzzyMatch,
  validateTables,
  buildInvalidTableReport
};
