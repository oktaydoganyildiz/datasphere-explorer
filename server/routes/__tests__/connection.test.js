const request = require('supertest');
const express = require('express');
const connectionRoutes = require('../connection');
const hanaService = require('../../services/hanaService');

// Mock hanaService
jest.mock('../../services/hanaService', () => ({
  connect: jest.fn(),
  connection: null,
  currentConfig: null,
  disconnect: jest.fn(),
}));

describe('Connection Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/connection', connectionRoutes);
    jest.clearAllMocks();
  });

  describe('POST /api/connection/connect', () => {
    test('should reject with missing fields', async () => {
      const res = await request(app)
        .post('/api/connection/connect')
        .send({ host: 'localhost' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('All fields are required');
    });

    test('should reject whitespace-only credentials', async () => {
      const res = await request(app)
        .post('/api/connection/connect')
        .send({
          host: 'localhost',
          port: 3050,
          user: '   ',
          password: 'password',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('required and cannot be empty');
    });

    test('should accept valid IPv4', async () => {
      hanaService.connect.mockResolvedValue({ success: true, message: 'Connected' });

      const res = await request(app)
        .post('/api/connection/connect')
        .send({
          host: '192.168.1.1',
          port: 3050,
          user: 'SYSTEM',
          password: 'password',
        });

      expect(res.status).toBe(200);
      expect(hanaService.connect).toHaveBeenCalled();
    });

    test('should accept valid IPv6', async () => {
      hanaService.connect.mockResolvedValue({ success: true, message: 'Connected' });

      const res = await request(app)
        .post('/api/connection/connect')
        .send({
          host: '2001:db8::1',
          port: 3050,
          user: 'SYSTEM',
          password: 'password',
        });

      expect(res.status).toBe(200);
      expect(hanaService.connect).toHaveBeenCalled();
    });

    test('should reject invalid host', async () => {
      const res = await request(app)
        .post('/api/connection/connect')
        .send({
          host: 'invalid@host',
          port: 3050,
          user: 'SYSTEM',
          password: 'password',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid host');
    });

    test('should reject invalid port', async () => {
      const res = await request(app)
        .post('/api/connection/connect')
        .send({
          host: 'localhost',
          port: '3050abc',
          user: 'SYSTEM',
          password: 'password',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Port must be a valid integer');
    });

    test('should reject port out of range', async () => {
      const res = await request(app)
        .post('/api/connection/connect')
        .send({
          host: 'localhost',
          port: 99999,
          user: 'SYSTEM',
          password: 'password',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Port must be between 1 and 65535');
    });

    test('should trim and normalize port to number', async () => {
      hanaService.connect.mockResolvedValue({ success: true, message: 'Connected' });

      const res = await request(app)
        .post('/api/connection/connect')
        .send({
          host: 'localhost',
          port: ' 3050 ',
          user: ' SYSTEM ',
          password: 'password',
        });

      expect(res.status).toBe(200);
      const callArgs = hanaService.connect.mock.calls[0][0];
      expect(callArgs.port).toBe(3050);
      expect(callArgs.user).toBe('SYSTEM');
    });
  });

  describe('GET /api/connection/status', () => {
    test('should return disconnected status when no connection', async () => {
      hanaService.connection = null;

      const res = await request(app).get('/api/connection/status');

      expect(res.status).toBe(200);
      expect(res.body.connected).toBe(false);
    });

    test('should return connected status with config', async () => {
      hanaService.connection = { connected: true };
      hanaService.currentConfig = {
        host: 'localhost',
        port: 3050,
        user: 'SYSTEM',
      };

      const res = await request(app).get('/api/connection/status');

      expect(res.status).toBe(200);
      expect(res.body.connected).toBe(true);
      expect(res.body.config.host).toBe('localhost');
    });
  });
});
