const express = require('express');
const router = express.Router();
const hanaService = require('../services/hanaService');
const { validateHost } = require('../services/validationService');

// Test Connection
router.post('/connect', async (req, res, next) => {
  try {
    const { host, port, user, password } = req.body;
    if (!host || !port || !user || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    // Validate host parameter
    const hostValidation = validateHost(host);
    if (!hostValidation.valid) {
      return res.status(400).json({ success: false, message: hostValidation.error });
    }

    // Validate port (must be a number between 1 and 65535)
    const portNum = parseInt(port, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return res.status(400).json({ success: false, message: 'Port must be a number between 1 and 65535.' });
    }

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
