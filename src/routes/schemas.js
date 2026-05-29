const express = require('express');
const router = express.Router();
const { getDB } = require('../database');
const { buildZodSchema } = require('../services/validator');

router.get('/', (req, res) => {
  const db = getDB();
  res.json({ schemas: db.getSchemas() });
});

router.post('/', (req, res) => {
  const { name, definition, example } = req.body;
  if (!name || !definition) return res.status(400).json({ error: 'name and definition are required' });
  try { buildZodSchema(definition); } catch (err) {
    return res.status(400).json({ error: `Invalid schema: ${err.message}` });
  }
  try {
    const db = getDB();
    db.insertSchema({ name, definition: JSON.stringify(definition), example: example ? JSON.stringify(example) : null });
    res.json({ success: true, message: `Schema "${name}" registered successfully` });
  } catch (err) {
    if (err.message.includes('UNIQUE') || err.message.includes('already exists')) {
      return res.status(409).json({ error: `Schema "${name}" already exists` });
    }
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:name', (req, res) => {
  const db = getDB();
  const deleted = db.deleteSchema(req.params.name);
  if (!deleted) return res.status(404).json({ error: 'Schema not found' });
  res.json({ success: true });
});

module.exports = router;