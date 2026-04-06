const express = require('express');
const router = express.Router();
const hanaService = require('../services/hanaService');
const { validateHost } = require('../services/validationService');

// Test Connection
router.post('/connect', async (req, res, next) => {
  try {
    let { host, port, user, password } = req.body;

    // Trim whitespace from all fields
    host = host?.trim() || '';
    user = user?.trim() || '';
    password = password?.trim() || '';

    // Validate non-empty after trimming
    if (!host || !port || !user || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required and cannot be empty.' });
    }

    // Validate host parameter
    const hostValidation = validateHost(host);
    if (!hostValidation.valid) {
      return res.status(400).json({ success: false, message: hostValidation.error });
    }

    // Strict port validation - must be numeric string or number
    let portNum;
    if (typeof port === 'number') {
      portNum = port;
    } else if (typeof port === 'string' && /^\d+$/.test(port.trim())) {
      // Only accept pure numeric strings
      portNum = parseInt(port, 10);
    } else {
      return res.status(400).json({ success: false, message: 'Port must be a valid integer.' });
    }

    if (portNum < 1 || portNum > 65535) {
      return res.status(400).json({ success: false, message: 'Port must be between 1 and 65535.' });
    }

    const result = await hanaService.connect({ host, port: portNum, user, password });
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
