const { z } = require('zod');
const { callLLM } = require('./llm');
const { buildSystemPrompt, buildCorrectionPrompt } = require('./injection');
const { getDB } = require('../database');

const MAX_ATTEMPTS = 3;

function extractJSON(text) {
  try {
    // Remove markdown code blocks
    let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    // Find JSON object or array
    const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) cleaned = jsonMatch[1];
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error('Could not parse JSON from response: ' + text.slice(0, 100));
  }
}

function buildZodField(val) {
  switch (val.type) {
    case 'string': {
      if (val.enum) return z.enum(val.enum);
      let s = z.string();
      if (val.minLength) s = s.min(val.minLength);
      if (val.maxLength) s = s.max(val.maxLength);
      return s;
    }
    case 'number':
    case 'integer': {
      let n = val.type === 'integer' ? z.number().int() : z.number();
      if (val.minimum !== undefined) n = n.min(val.minimum);
      if (val.maximum !== undefined) n = n.max(val.maximum);
      return n;
    }
    case 'boolean': return z.boolean();
    case 'array': return z.array(val.items ? buildZodField(val.items) : z.any());
    case 'object': return val.properties ? buildZodSchema(val) : z.object({}).passthrough();
    default: return z.any();
  }
}

function buildZodSchema(definition) {
  if (!definition || !definition.properties) {
    throw new Error('Schema must have a "properties" object');
  }
  const shape = {};
  const required = definition.required || [];
  for (const [key, val] of Object.entries(definition.properties)) {
    let field = buildZodField(val);
    if (!required.includes(key)) field = field.optional();
    shape[key] = field;
  }
  return z.object(shape);
}

async function validateWithRetry({ schemaName, schemaDefinition, prompt, model, strategy }) {
  const db = getDB();
  const zodSchema = buildZodSchema(schemaDefinition);
  const systemPrompt = buildSystemPrompt(strategy, schemaDefinition, null);

  let correctionNeeded = false;
  let totalTokens = 0;
  let totalLatency = 0;
  let failedAttempts = [];
  let callId;

  try {
    callId = db.insertCall({ schema_name: schemaName, prompt, model, strategy });
  } catch (e) {
    callId = null;
  }

  let currentSystemPrompt = systemPrompt;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${MAX_ATTEMPTS}...`);

      const result = await callLLM({
        systemPrompt: currentSystemPrompt,
        userPrompt: prompt
      });

      totalLatency += result.latency || 0;
      totalTokens += result.tokens || 0;

      const parsed = extractJSON(result.text);
      const validated = zodSchema.parse(parsed);

      if (callId) {
        db.updateCall(callId, {
          success: 1,
          attempts: attempt,
          correction_needed: correctionNeeded ? 1 : 0,
          latency_ms: totalLatency,
          total_tokens: totalTokens,
          output: JSON.stringify(validated)
        });
      }

      return {
        success: true,
        output: validated,
        attempts: attempt,
        correctionNeeded,
        latency: totalLatency,
        tokens: totalTokens,
        strategy
      };

    } catch (err) {
      const errorMessage = String(err.message || err);
      console.log(`Attempt ${attempt} failed:`, errorMessage.slice(0, 100));

      failedAttempts.push({ attempt, error: errorMessage });
      correctionNeeded = true;

      try {
        if (callId) {
          db.insertFailure({
            call_id: callId,
            schema_name: schemaName,
            prompt,
            model,
            attempt_number: attempt,
            raw_response: '',
            error_message: errorMessage
          });
        }
      } catch (dbErr) {
        console.error('DB error:', dbErr.message);
      }

      if (attempt < MAX_ATTEMPTS) {
        currentSystemPrompt = buildCorrectionPrompt('', errorMessage, schemaDefinition);
      }
    }
  }

  if (callId) {
    try {
      db.updateCall(callId, {
        success: 0,
        attempts: MAX_ATTEMPTS,
        correction_needed: 1,
        latency_ms: totalLatency,
        total_tokens: totalTokens
      });
    } catch (e) {}
  }

  return {
    success: false,
    error: 'All 3 attempts failed validation',
    attempts: MAX_ATTEMPTS,
    failedAttempts,
    latency: totalLatency,
    tokens: totalTokens,
    strategy
  };
}

module.exports = { validateWithRetry, buildZodSchema };