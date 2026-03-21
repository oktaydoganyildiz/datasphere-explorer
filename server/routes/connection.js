const express = require('express');
const router = express.Router();
const hanaService = require('../services/hanaService');

// Test Connection
router.post('/connect', async (req, res, next) => {
  try {
    const { host, port, user, password } = req.body;
    if (!host || !port || !user || !password) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
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
