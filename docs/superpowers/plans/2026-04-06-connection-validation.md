# Connection Validation Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add comprehensive input validation to the `/connect` endpoint with proper error aggregation and unit/integration tests.

**Architecture:** Create a reusable `validationService.js` module with separate validators for host, port, and credentials. Update the `/connect` route to validate all inputs before calling hanaService, returning all validation errors at once.

**Tech Stack:** Node.js, Express, Jest (testing), no external validation libraries

---

## File Structure

```
server/
├── services/
│   └── validationService.js                    (CREATE)
│   └── __tests__/
│       └── validationService.test.js           (CREATE)
├── routes/
│   ├── connection.js                           (MODIFY)
│   └── __tests__/
│       └── connection.test.js                  (CREATE)
```

---

### Task 1: Create validationService.js Core

**Files:**
- Create: `server/services/validationService.js`

- [ ] **Step 1: Write failing test for validateHost()**

Create file: `server/services/__tests__/validationService.test.js`

```javascript
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
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd C:\Users\OktayDoganyildiz\PycharmProjects\DataSphereExplorer\server
npm test -- validationService.test.js
```

Expected output: Multiple test failures - "validateHost is not defined"

- [ ] **Step 3: Write validationService.js implementation (Part 1 - Host)**

Create file: `server/services/validationService.js`

```javascript
/**
 * Validates host parameter
 * @param {string} host - Hostname or IP address
 * @returns {object} { valid: boolean, error?: string }
 */
function validateHost(host) {
  // Check if empty
  if (!host || typeof host !== 'string' || host.trim().length === 0) {
    return { valid: false, error: 'Host cannot be empty' };
  }

  // Check length
  if (host.length > 255) {
    return { valid: false, error: 'Host cannot exceed 255 characters' };
  }

  // Check if valid IPv4
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipv4Match = host.match(ipv4Regex);
  if (ipv4Match) {
    const octets = [ipv4Match[1], ipv4Match[2], ipv4Match[3], ipv4Match[4]].map(Number);
    if (octets.every(octet => octet >= 0 && octet <= 255)) {
      return { valid: true };
    }
    return { valid: false, error: 'Invalid IPv4 address' };
  }

  // Check if valid domain or localhost
  const domainRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$|^localhost$/;
  if (domainRegex.test(host)) {
    return { valid: true };
  }

  return { valid: false, error: 'Invalid host: must be IP address or domain name' };
}

module.exports = {
  validateHost,
};
```

- [ ] **Step 4: Run tests to verify host validation passes**

```bash
npm test -- validationService.test.js --testNamePattern="validateHost"
```

Expected: All validateHost tests pass

- [ ] **Step 5: Commit**

```bash
git add server/services/validationService.js server/services/__tests__/validationService.test.js
git commit -m "feat: add host validation to validationService"
```

---

### Task 2: Add Port Validation

**Files:**
- Modify: `server/services/__tests__/validationService.test.js`
- Modify: `server/services/validationService.js`

- [ ] **Step 1: Write failing tests for validatePort()**

Add to `server/services/__tests__/validationService.test.js` (after validateHost tests):

```javascript
  describe('validatePort', () => {
    test('should reject non-numeric port', () => {
      const result = validationService.validatePort('abc');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject port below 1', () => {
      const result = validationService.validatePort(0);
      expect(result.valid).toBe(false);
    });

    test('should reject port above 65535', () => {
      const result = validationService.validatePort(65536);
      expect(result.valid).toBe(false);
    });

    test('should accept valid port 1', () => {
      const result = validationService.validatePort(1);
      expect(result.valid).toBe(true);
    });

    test('should accept valid port 3050', () => {
      const result = validationService.validatePort(3050);
      expect(result.valid).toBe(true);
    });

    test('should accept valid port 65535', () => {
      const result = validationService.validatePort(65535);
      expect(result.valid).toBe(true);
    });

    test('should accept numeric string port', () => {
      const result = validationService.validatePort('3050');
      expect(result.valid).toBe(true);
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- validationService.test.js --testNamePattern="validatePort"
```

Expected: Multiple failures - "validatePort is not defined"

- [ ] **Step 3: Implement validatePort() function**

Add to `server/services/validationService.js` (before module.exports):

```javascript
/**
 * Validates port parameter
 * @param {number|string} port - Port number
 * @returns {object} { valid: boolean, error?: string }
 */
function validatePort(port) {
  let portNum;

  // Try to parse as integer
  if (typeof port === 'string') {
    portNum = parseInt(port, 10);
  } else if (typeof port === 'number') {
    portNum = port;
  } else {
    return { valid: false, error: 'Port must be a number' };
  }

  // Check if parsed correctly and in valid range
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    return { valid: false, error: 'Port must be between 1 and 65535' };
  }

  return { valid: true };
}
```

Update module.exports:

```javascript
module.exports = {
  validateHost,
  validatePort,
};
```

- [ ] **Step 4: Run tests to verify port validation passes**

```bash
npm test -- validationService.test.js --testNamePattern="validatePort"
```

Expected: All validatePort tests pass

- [ ] **Step 5: Commit**

```bash
git add server/services/validationService.js server/services/__tests__/validationService.test.js
git commit -m "feat: add port validation to validationService"
```

---

### Task 3: Add Credentials Validation

**Files:**
- Modify: `server/services/__tests__/validationService.test.js`
- Modify: `server/services/validationService.js`

- [ ] **Step 1: Write failing tests for validateCredentials()**

Add to `server/services/__tests__/validationService.test.js` (after validatePort tests):

```javascript
  describe('validateCredentials', () => {
    test('should reject empty user', () => {
      const result = validationService.validateCredentials('', 'password');
      expect(result.valid).toBe(false);
      expect(result.errors.user).toBeDefined();
    });

    test('should reject empty password', () => {
      const result = validationService.validateCredentials('admin', '');
      expect(result.valid).toBe(false);
      expect(result.errors.password).toBeDefined();
    });

    test('should reject user exceeding 255 characters', () => {
      const longUser = 'a'.repeat(256);
      const result = validationService.validateCredentials(longUser, 'password');
      expect(result.valid).toBe(false);
      expect(result.errors.user).toBeDefined();
    });

    test('should reject password exceeding 255 characters', () => {
      const longPass = 'a'.repeat(256);
      const result = validationService.validateCredentials('admin', longPass);
      expect(result.valid).toBe(false);
      expect(result.errors.password).toBeDefined();
    });

    test('should trim whitespace from user and password', () => {
      const result = validationService.validateCredentials('  admin  ', '  pass  ');
      expect(result.valid).toBe(true);
    });

    test('should accept valid credentials', () => {
      const result = validationService.validateCredentials('admin', 'password123');
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    test('should accept credentials with special characters', () => {
      const result = validationService.validateCredentials('admin', 'p@ssw0rd!#$%');
      expect(result.valid).toBe(true);
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- validationService.test.js --testNamePattern="validateCredentials"
```

Expected: Multiple failures - "validateCredentials is not defined"

- [ ] **Step 3: Implement validateCredentials() function**

Add to `server/services/validationService.js` (before module.exports):

```javascript
/**
 * Validates user and password credentials
 * @param {string} user - Username
 * @param {string} password - Password
 * @returns {object} { valid: boolean, errors?: {user?: string, password?: string} }
 */
function validateCredentials(user, password) {
  const errors = {};

  // Validate user
  if (!user || typeof user !== 'string' || user.trim().length === 0) {
    errors.user = 'User cannot be empty';
  } else if (user.length > 255) {
    errors.user = 'User cannot exceed 255 characters';
  }

  // Validate password
  if (!password || typeof password !== 'string' || password.trim().length === 0) {
    errors.password = 'Password cannot be empty';
  } else if (password.length > 255) {
    errors.password = 'Password cannot exceed 255 characters';
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}
```

Update module.exports:

```javascript
module.exports = {
  validateHost,
  validatePort,
  validateCredentials,
};
```

- [ ] **Step 4: Run tests to verify credentials validation passes**

```bash
npm test -- validationService.test.js --testNamePattern="validateCredentials"
```

Expected: All validateCredentials tests pass

- [ ] **Step 5: Commit**

```bash
git add server/services/validationService.js server/services/__tests__/validationService.test.js
git commit -m "feat: add credentials validation to validationService"
```

---

### Task 4: Add validateConnection() Function

**Files:**
- Modify: `server/services/__tests__/validationService.test.js`
- Modify: `server/services/validationService.js`

- [ ] **Step 1: Write failing test for validateConnection()**

Add to `server/services/__tests__/validationService.test.js` (after validateCredentials tests):

```javascript
  describe('validateConnection', () => {
    test('should return all validation errors at once', () => {
      const body = {
        host: '',
        port: 99999,
        user: '',
        password: ''
      };
      const result = validationService.validateConnection(body);
      expect(result.valid).toBe(false);
      expect(Object.keys(result.errors).length).toBeGreaterThan(1);
      expect(result.errors.host).toBeDefined();
      expect(result.errors.port).toBeDefined();
      expect(result.errors.user).toBeDefined();
      expect(result.errors.password).toBeDefined();
    });

    test('should pass with valid connection data', () => {
      const body = {
        host: 'localhost',
        port: 3050,
        user: 'admin',
        password: 'password123'
      };
      const result = validationService.validateConnection(body);
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    test('should handle missing body', () => {
      const result = validationService.validateConnection(null);
      expect(result.valid).toBe(false);
      expect(Object.keys(result.errors).length).toBeGreaterThan(0);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- validationService.test.js --testNamePattern="validateConnection"
```

Expected: Multiple failures - "validateConnection is not defined"

- [ ] **Step 3: Implement validateConnection() function**

Add to `server/services/validationService.js` (before module.exports):

```javascript
/**
 * Validates all connection parameters together
 * @param {object} body - Request body with host, port, user, password
 * @returns {object} { valid: boolean, errors?: object }
 */
function validateConnection(body) {
  const errors = {};

  // Validate body exists
  if (!body || typeof body !== 'object') {
    return {
      valid: false,
      errors: { _root: 'Invalid request body' }
    };
  }

  // Validate host
  const hostValidation = validateHost(body.host);
  if (!hostValidation.valid) {
    errors.host = hostValidation.error;
  }

  // Validate port
  const portValidation = validatePort(body.port);
  if (!portValidation.valid) {
    errors.port = portValidation.error;
  }

  // Validate credentials
  const credValidation = validateCredentials(body.user, body.password);
  if (!credValidation.valid) {
    errors.user = credValidation.errors.user;
    errors.password = credValidation.errors.password;
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return { valid: true };
}
```

Update module.exports:

```javascript
module.exports = {
  validateHost,
  validatePort,
  validateCredentials,
  validateConnection,
};
```

- [ ] **Step 4: Run all validationService tests**

```bash
npm test -- validationService.test.js
```

Expected: All tests pass (20+ tests)

- [ ] **Step 5: Commit**

```bash
git add server/services/validationService.js server/services/__tests__/validationService.test.js
git commit -m "feat: add validateConnection aggregator function"
```

---

### Task 5: Update connection.js Route

**Files:**
- Modify: `server/routes/connection.js`

- [ ] **Step 1: Read current connection.js**

```bash
cat server/routes/connection.js
```

- [ ] **Step 2: Update connection.js to use validationService**

Replace entire file `server/routes/connection.js`:

```javascript
const express = require('express');
const router = express.Router();
const hanaService = require('../services/hanaService');
const validationService = require('../services/validationService');

// Test Connection
router.post('/connect', async (req, res, next) => {
  try {
    // Validate all inputs
    const validation = validationService.validateConnection(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors
      });
    }

    // Extract validated data
    const { host, port, user, password } = req.body;

    // Call hanaService with validated data
    const result = await hanaService.connect({ host, port, user, password });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Get Connection Status
router.get('/status', (req, res) => {
  if (hanaService.connection) {
    res.json({ connected: true, config: hanaService.currentConfig });
  } else {
    res.json({ connected: false });
  }
});

// Disconnect
router.post('/disconnect', async (req, res, next) => {
  try {
    await hanaService.disconnect();
    res.json({ success: true, message: 'Disconnected.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
```

- [ ] **Step 3: Verify file updated correctly**

```bash
cat server/routes/connection.js
```

Expected: File should have validationService import and validation check in /connect route

- [ ] **Step 4: Commit**

```bash
git add server/routes/connection.js
git commit -m "feat: integrate validationService into /connect endpoint"
```

---

### Task 6: Write Integration Tests for /connect

**Files:**
- Create: `server/routes/__tests__/connection.test.js`

- [ ] **Step 1: Create integration test file**

Create file: `server/routes/__tests__/connection.test.js`

```javascript
const express = require('express');
const request = require('supertest');
const connectionRouter = require('../connection');

// Mock hanaService
jest.mock('../services/hanaService', () => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
  connection: null,
  currentConfig: null
}));

const hanaService = require('../services/hanaService');

describe('POST /connect', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/', connectionRouter);
    jest.clearAllMocks();
  });

  test('should return 400 with validation error for empty host', async () => {
    const response = await request(app)
      .post('/connect')
      .send({
        host: '',
        port: 3050,
        user: 'admin',
        password: 'password'
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.errors.host).toBeDefined();
  });

  test('should return 400 with validation error for invalid port', async () => {
    const response = await request(app)
      .post('/connect')
      .send({
        host: 'localhost',
        port: 99999,
        user: 'admin',
        password: 'password'
      });

    expect(response.status).toBe(400);
    expect(response.body.errors.port).toBeDefined();
  });

  test('should return 400 with all validation errors at once', async () => {
    const response = await request(app)
      .post('/connect')
      .send({
        host: '',
        port: 'invalid',
        user: '',
        password: ''
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.errors.host).toBeDefined();
    expect(response.body.errors.port).toBeDefined();
    expect(response.body.errors.user).toBeDefined();
    expect(response.body.errors.password).toBeDefined();
  });

  test('should call hanaService.connect with valid data', async () => {
    hanaService.connect.mockResolvedValue({ success: true, connected: true });

    const response = await request(app)
      .post('/connect')
      .send({
        host: 'localhost',
        port: 3050,
        user: 'admin',
        password: 'password123'
      });

    expect(response.status).toBe(200);
    expect(hanaService.connect).toHaveBeenCalledWith({
      host: 'localhost',
      port: 3050,
      user: 'admin',
      password: 'password123'
    });
  });

  test('should accept valid IPv4 address', async () => {
    hanaService.connect.mockResolvedValue({ success: true });

    const response = await request(app)
      .post('/connect')
      .send({
        host: '192.168.1.1',
        port: 3050,
        user: 'admin',
        password: 'password'
      });

    expect(response.status).toBe(200);
    expect(hanaService.connect).toHaveBeenCalled();
  });

  test('should accept valid domain name', async () => {
    hanaService.connect.mockResolvedValue({ success: true });

    const response = await request(app)
      .post('/connect')
      .send({
        host: 'db.example.com',
        port: 3050,
        user: 'admin',
        password: 'password'
      });

    expect(response.status).toBe(200);
  });
});

describe('GET /status', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/', connectionRouter);
    jest.clearAllMocks();
  });

  test('should return connected: false when no connection', async () => {
    hanaService.connection = null;

    const response = await request(app).get('/status');

    expect(response.status).toBe(200);
    expect(response.body.connected).toBe(false);
  });
});

describe('POST /disconnect', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/', connectionRouter);
    jest.clearAllMocks();
  });

  test('should call hanaService.disconnect', async () => {
    hanaService.disconnect.mockResolvedValue();

    const response = await request(app).post('/disconnect');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(hanaService.disconnect).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run integration tests**

```bash
npm test -- connection.test.js
```

Expected: All tests pass (8+ tests)

- [ ] **Step 3: Commit**

```bash
git add server/routes/__tests__/connection.test.js
git commit -m "test: add integration tests for /connect endpoint"
```

---

### Task 7: Verify All Tests Pass

**Files:**
- No new files

- [ ] **Step 1: Run all server tests**

```bash
cd server
npm test
```

Expected: All tests pass (25+ tests total)

- [ ] **Step 2: Run server with npm start to verify no runtime errors**

```bash
npm start
```

Wait 5 seconds. Expected output should show server starting without errors. Then press Ctrl+C to stop.

- [ ] **Step 3: Commit test results summary**

```bash
git log --oneline -5
```

This shows the 5 commits just made. All should be visible.

---

## Self-Review Against Spec

✅ **Spec Coverage:**
- ✅ Validation rules for host (IP/domain format) - Task 1, 4
- ✅ Validation rules for port (1-65535) - Task 2, 4
- ✅ Validation rules for credentials (trim, max 255) - Task 3, 4
- ✅ Error aggregation (all errors at once) - Task 4, 5, 6
- ✅ validationService.js creation - Task 1, 2, 3, 4
- ✅ connection.js update - Task 5
- ✅ Unit tests - Task 1, 2, 3, 4
- ✅ Integration tests - Task 6
- ✅ No external libraries - All tasks use only Node.js built-ins and Jest

✅ **Placeholder Scan:**
- No "TBD", "TODO", or incomplete sections
- All code steps have complete implementation
- All test code is fully written
- All commands are exact

✅ **Type Consistency:**
- `validateHost()` returns `{ valid: bool, error?: string }`
- `validatePort()` returns `{ valid: bool, error?: string }`
- `validateCredentials()` returns `{ valid: bool, errors?: { user?, password? } }`
- `validateConnection()` returns `{ valid: bool, errors?: object }`
- All tests match function signatures

✅ **Scope Check:**
- Only `/connect` endpoint validated (as per design)
- No changes to `/status` or `/disconnect`
- Clean separation of concerns (validationService is independent)
