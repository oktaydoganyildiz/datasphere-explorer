const request = require('supertest');
const express = require('express');

jest.mock('../../services/aiService', () => ({
  init: jest.fn(),
  generateSql: jest.fn(),
  suggestTableMatch: jest.fn()
}));

jest.mock('../../services/hanaService', () => ({
  connection: { connected: true },
  getTables: jest.fn()
}));

jest.mock('../../services/tableValidationService', () => ({
  extractTableNames: jest.fn(),
  validateTables: jest.fn()
}));

const aiRoutes = require('../ai');
const aiService = require('../../services/aiService');
const hanaService = require('../../services/hanaService');
const tableValidationService = require('../../services/tableValidationService');

describe('AI Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/ai', aiRoutes);
    jest.clearAllMocks();
    hanaService.connection = { connected: true };
  });

  test('returns invalidTables when generated SQL references a missing table', async () => {
    aiService.generateSql.mockResolvedValue({
      sql: 'SELECT * FROM DWC_GLOBAL.TASK_LOG',
      explanation: 'test'
    });
    tableValidationService.extractTableNames.mockReturnValue(['TASK_LOG']);
    tableValidationService.validateTables.mockResolvedValue([
      {
        name: 'TASK_LOG',
        suggestions: [{ table: 'TASK_LOGS', source: 'fuzzy', score: 0.89 }]
      }
    ]);

    const res = await request(app)
      .post('/api/ai/generate-sql')
      .send({
        apiKey: 'secret',
        prompt: 'failed tasklari goster',
        schema: 'DWC_GLOBAL',
        tableList: ['TASK_LOGS', 'TASK_CHAIN_RUNS']
      });

    expect(res.status).toBe(200);
    expect(aiService.generateSql).toHaveBeenCalledWith(
      'failed tasklari goster',
      expect.objectContaining({
        schema: 'DWC_GLOBAL',
        tableList: ['TASK_LOGS', 'TASK_CHAIN_RUNS']
      })
    );
    expect(tableValidationService.validateTables).toHaveBeenCalledWith(
      ['TASK_LOG'],
      'DWC_GLOBAL',
      hanaService,
      aiService
    );
    expect(res.body.invalidTables).toEqual([
      {
        name: 'TASK_LOG',
        suggestions: [{ table: 'TASK_LOGS', source: 'fuzzy', score: 0.89 }]
      }
    ]);
  });
});
