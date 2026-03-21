const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const connectionRoutes = require('./routes/connection');
const tablesRoutes = require('./routes/tables');
const exportRoutes = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors()); // Allow all origins for simplicity in local dev
app.use(express.json());

// Routes
app.use('/api/connection', connectionRoutes);
app.use('/api/tables', tablesRoutes);
app.use('/api/export', exportRoutes);
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
