const tableValidationService = require('../tableValidationService');

describe('tableValidationService', () => {
  describe('extractTableNames', () => {
    test('extracts table names from FROM and JOIN clauses', () => {
      const sql = `
        SELECT *
        FROM DWC_GLOBAL.TASK_LOGS tl
        JOIN DWC_GLOBAL.TASK_CHAIN_RUNS cr ON cr.CHAIN_TASK_LOG_ID = tl.TASK_LOG_ID
      `;

      expect(tableValidationService.extractTableNames(sql)).toEqual([
        'TASK_LOGS',
        'TASK_CHAIN_RUNS'
      ]);
    });

    test('deduplicates repeated table references and strips quotes', () => {
      const sql = `
        SELECT *
        FROM "DWC_GLOBAL"."TASK_LOGS"
        JOIN "DWC_GLOBAL"."TASK_LOGS" t2 ON 1 = 1
      `;

      expect(tableValidationService.extractTableNames(sql)).toEqual(['TASK_LOGS']);
    });
  });

  describe('fuzzyMatch', () => {
    test('returns top matches over threshold ordered by score', () => {
      const matches = tableValidationService.fuzzyMatch('SATIS_VERILERI', [
        'SATIS_DATA',
        'MUSTERI',
        'SATIS_VERISI',
        'SATIS_OZET'
      ]);

      expect(matches).toHaveLength(3);
      expect(matches[0]).toMatchObject({ table: 'SATIS_VERISI', source: 'fuzzy' });
      expect(matches[0].score).toBeGreaterThan(matches[1].score);
      expect(matches[1].score).toBeGreaterThan(matches[2].score);
    });
  });

  describe('validateTables', () => {
    test('marks missing tables and returns fuzzy suggestions', async () => {
      const hanaService = {
        getTables: jest.fn().mockResolvedValue([
          { TABLE_NAME: 'TASK_LOGS' },
          { TABLE_NAME: 'TASK_CHAIN_RUNS' }
        ])
      };

      const result = await tableValidationService.validateTables(
        ['TASK_LOGS', 'TASK_LOG'],
        'DWC_GLOBAL',
        hanaService
      );

      expect(result).toEqual([
        {
          name: 'TASK_LOG',
          suggestions: expect.arrayContaining([
            expect.objectContaining({ table: 'TASK_LOGS', source: 'fuzzy' })
          ])
        }
      ]);
      expect(hanaService.getTables).toHaveBeenCalledWith('DWC_GLOBAL');
    });
  });

  describe('buildInvalidTableReport', () => {
    test('uses AI fallback only when fuzzy is empty', async () => {
      const aiService = {
        suggestTableMatch: jest.fn().mockResolvedValue([
          { table: 'REVENUE_FACTS', source: 'ai' }
        ])
      };

      const report = await tableValidationService.buildInvalidTableReport({
        invalidTables: ['TASK_LOG', 'UNKNOWN_ALIAS'],
        validTables: ['TASK_LOGS', 'CUSTOMER_DIM'],
        aiService
      });

      expect(report).toEqual([
        {
          name: 'TASK_LOG',
          suggestions: [
            expect.objectContaining({ table: 'TASK_LOGS', source: 'fuzzy' })
          ]
        },
        {
          name: 'UNKNOWN_ALIAS',
          suggestions: [{ table: 'REVENUE_FACTS', source: 'ai' }]
        }
      ]);
      expect(aiService.suggestTableMatch).toHaveBeenCalledTimes(1);
      expect(aiService.suggestTableMatch).toHaveBeenCalledWith(
        'UNKNOWN_ALIAS',
        ['TASK_LOGS', 'CUSTOMER_DIM']
      );
    });
  });
});
