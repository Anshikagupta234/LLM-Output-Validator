require('dotenv').config();
const express = require('express');
const router = express.Router();

const { callLLM } = require('../services/llm');
const { buildSystemPrompt } = require('../services/injection');
const { z } = require('zod');

function extractJSON(text) {
  let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) cleaned = match[0];
  return JSON.parse(cleaned);
}

router.post('/', async (req, res) => {
  try {
    const { schema_name, prompt, strategy = 'json_instruction' } = req.body;
    if (!schema_name || !prompt) {
      return res.status(400).json({ error: 'schema_name and prompt are required' });
    }

    // Load schema from db.json
    const fs = require('fs');
    const path = require('path');
    const dbFile = path.join(__dirname, '../../db.json');
    let schemas = [];
    try {
      const raw = fs.readFileSync(dbFile, 'utf8');
      schemas = JSON.parse(raw).schemas || [];
    } catch(e) {
      return res.status(500).json({ error: 'Could not read db.json. Register a schema first.' });
    }

    const schemaRow = schemas.find(s => s.name === schema_name);
    if (!schemaRow) {
      return res.status(404).json({ error: `Schema "${schema_name}" not found. Go to Schemas tab and register it.` });
    }

    const schemaDef = JSON.parse(schemaRow.definition);
    const systemPrompt = buildSystemPrompt(strategy, schemaDef, null);

    let attempts = 0;
    let correctionNeeded = false;
    let totalLatency = 0;
    let totalTokens = 0;
    let lastError = '';
    let result = null;

    for (let i = 1; i <= 3; i++) {
      attempts = i;
      try {
        const llmResult = await callLLM({ systemPrompt, userPrompt: prompt });
        totalLatency += llmResult.latency || 0;
        totalTokens += llmResult.tokens || 0;

        const parsed = extractJSON(llmResult.text);
        result = parsed;
        break;
      } catch(err) {
        lastError = err.message;
        correctionNeeded = true;
        if (i < 3) console.log(`Attempt ${i} failed, retrying...`);
      }
    }

    if (result) {
      return res.json({
        success: true,
        output: result,
        attempts,
        correctionNeeded,
        latency: totalLatency,
        tokens: totalTokens,
        strategy
      });
    } else {
      return res.status(422).json({
        success: false,
        error: 'All 3 attempts failed: ' + lastError,
        attempts: 3,
        latency: totalLatency,
        tokens: totalTokens,
        strategy
      });
    }
  } catch(err) {
    console.error('ERROR in /call:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

router.get('/history', (req, res) => res.json({ calls: [] }));

module.exports = router;