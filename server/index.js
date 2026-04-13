const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const connectionRoutes = require('./routes/connection');
const tablesRoutes = require('./routes/tables');
const exportRoutes = require('./routes/export');
const importRoutes = require('./routes/import');   // ← NEW
const hanaService = require('./services/hanaService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));          // Increased limit for CSV
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/connection', connectionRoutes);
app.use('/api/tables', tablesRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/import', importRoutes);              // ← NEW
app.use('/api/stats', require('./routes/stats'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/query', require('./routes/query'));

// Health Check
app.get('/', (req, res) => {
  res.send('DataSphere Explorer API is running.');
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Auto-connect to HANA on startup if credentials are available
async function startServer() {
  try {
    // Check if HANA credentials are in environment
    if (process.env.HANA_HOST && process.env.HANA_USER && process.env.HANA_PASSWORD) {
      console.log('Attempting to connect to HANA...');
      const config = {
        host: process.env.HANA_HOST,
        port: process.env.HANA_PORT || '443',
        user: process.env.HANA_USER,
        password: process.env.HANA_PASSWORD,
        sslValidateCertificate: process.env.HANA_SSL_VALIDATE_CERT
          ? process.env.HANA_SSL_VALIDATE_CERT.toLowerCase() !== 'false'
          : true
      };
      
      await hanaService.connect(config);
      console.log('✅ Connected to HANA successfully');
    } else {
      console.log('⚠️  HANA credentials not found in .env - manual connection required');
    }
  } catch (err) {
    console.error('❌ HANA auto-connect failed:', err.message);
    console.log('Server will start anyway - connect manually via UI');
  }

  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

startServer();
