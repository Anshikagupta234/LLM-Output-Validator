require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const schemasRouter = require('./routes/schemas');
const callRouter = require('./routes/call');
const failuresRouter = require('./routes/failures');
const metricsRouter = require('./routes/metrics');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/schemas', schemasRouter);
app.use('/call', callRouter);
app.use('/failures', failuresRouter);
app.use('/metrics', metricsRouter);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 LLM Validator running at http://localhost:${PORT}`);
  console.log(`📊 Frontend UI:  http://localhost:${PORT}`);
  console.log(`🔌 API Base:     http://localhost:${PORT}/schemas\n`);
});