const express = require('express');
const router = express.Router();
const { getDB } = require('../database');

router.get('/', (req, res) => {
  const db = getDB();
  const recent_failures = db.getFailures();
  const top_failing_schemas = db.getFailureSummary();
  res.json({
    summary: { total_failures: recent_failures.length, schemas_with_failures: top_failing_schemas.length },
    top_failing_schemas,
    recent_failures
  });
});

module.exports = router;