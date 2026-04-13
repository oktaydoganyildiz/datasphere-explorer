const request = require('supertest');
const express = require('express');

jest.mock('../../services/hanaService', () => ({
  connection: { connected: true },
  getTables: jest.fn(),
  isSafeIdentifier: jest.fn(() => true)
}));

const hanaService = require('../../services/hanaService');
const tablesRoutes = require('../tables');

describe('Tables Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use('/api/tables', tablesRoutes);
    jest.clearAllMocks();
    hanaService.connection = { connected: true };
  });

  test('GET /api/tables/list returns flattened table names', async () => {
    hanaService.getTables.mockResolvedValue([
      { TABLE_NAME: 'TASK_LOGS', TYPE: 'TABLE' },
      { TABLE_NAME: 'TASK_CHAIN_RUNS', TYPE: 'VIEW' }
    ]);

    const res = await request(app).get('/api/tables/list?schema=DWC_GLOBAL');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ tables: ['TASK_LOGS', 'TASK_CHAIN_RUNS'] });
  });

  test('GET /api/tables/list rejects missing schema', async () => {
    const res = await request(app).get('/api/tables/list');

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('schema');
  });
});
