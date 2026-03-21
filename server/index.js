const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const connectionRoutes = require('./routes/connection');
const tablesRoutes = require('./routes/tables');
const exportRoutes = require('./routes/export');
const importRoutes = require('./routes/import');   // ← YENİ

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));          // CSV için limit artırıldı
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/connection', connectionRoutes);
app.use('/api/tables', tablesRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/import', importRoutes);              // ← YENİ
app.use('/api/stats', require('./routes/stats'));
app.use('/api/ai', require('./routes/ai'));

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

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});