const express = require('express');
const router = express.Router();
const { getDB } = require('../database');

router.get('/', (req, res) => {
  const db = getDB();
  const calls = db.getCalls(1000);
  const total = calls.length;
  const successful = calls.filter(c => c.success).length;
  const avgLatency = total ? Math.round(calls.reduce((s, c) => s + c.latency_ms, 0) / total) : 0;
  const avgTokens = total ? Math.round(calls.reduce((s, c) => s + c.total_tokens, 0) / total) : 0;

  const byStrategy = {};
  calls.forEach(c => {
    if (!byStrategy[c.strategy]) byStrategy[c.strategy] = { strategy: c.strategy, total: 0, successes: 0, first_attempt: 0, tokens: 0, latency: 0 };
    byStrategy[c.strategy].total++;
    if (c.success) byStrategy[c.strategy].successes++;
    if (c.success && c.attempts === 1) byStrategy[c.strategy].first_attempt++;
    byStrategy[c.strategy].tokens += c.total_tokens;
    byStrategy[c.strategy].latency += c.latency_ms;
  });

  res.json({
    overall: { total_calls: total, successful_calls: successful, success_rate: total ? ((successful/total)*100).toFixed(1)+'%' : '0%', avg_latency_ms: avgLatency, avg_tokens: avgTokens },
    strategy_performance: Object.values(byStrategy).map(s => ({
      ...s,
      success_rate: s.total ? ((s.successes/s.total)*100).toFixed(1)+'%' : '0%',
      first_attempt_rate: s.total ? ((s.first_attempt/s.total)*100).toFixed(1)+'%' : '0%',
      avg_tokens: s.total ? Math.round(s.tokens/s.total) : 0
    }))
  });
});

module.exports = router;