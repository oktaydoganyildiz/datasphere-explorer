const validationService = require('../validationService');

describe('validationService', () => {
  describe('validateHost', () => {
    test('should reject empty host', () => {
      const result = validationService.validateHost('');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject host exceeding 255 characters', () => {
      const longHost = 'a'.repeat(256);
      const result = validationService.validateHost(longHost);
      expect(result.valid).toBe(false);
    });

    test('should accept valid IPv4 address', () => {
      const result = validationService.validateHost('192.168.1.1');
      expect(result.valid).toBe(true);
    });

    test('should accept valid domain name', () => {
      const result = validationService.validateHost('example.com');
      expect(result.valid).toBe(true);
    });

    test('should accept localhost', () => {
      const result = validationService.validateHost('localhost');
      expect(result.valid).toBe(true);
    });

    test('should reject invalid IP address', () => {
      const result = validationService.validateHost('999.999.999.999');
      expect(result.valid).toBe(false);
    });

    test('should accept subdomain', () => {
      const result = validationService.validateHost('db.example.com');
      expect(result.valid).toBe(true);
    });

    test('should reject single-label domain without localhost', () => {
      const result = validationService.validateHost('servername');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject domain with single-letter TLD', () => {
      const result = validationService.validateHost('example.a');
      expect(result.valid).toBe(false);
    });

    test('should accept domain with 2-letter TLD', () => {
      const result = validationService.validateHost('example.co');
      expect(result.valid).toBe(true);
    });

    test('should reject domain with trailing dot', () => {
      const result = validationService.validateHost('example.com.');
      expect(result.valid).toBe(false);
    });

    test('should reject domain with leading dot', () => {
      const result = validationService.validateHost('.example.com');
      expect(result.valid).toBe(false);
    });

    test('should accept domain with uppercase letters', () => {
      const result = validationService.validateHost('Example.COM');
      expect(result.valid).toBe(true);
    });

    test('should reject null input', () => {
      const result = validationService.validateHost(null);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject undefined input', () => {
      const result = validationService.validateHost(undefined);
      expect(result.valid).toBe(false);
    });

    test('should reject number input', () => {
      const result = validationService.validateHost(12345);
      expect(result.valid).toBe(false);
    });
  });
});
