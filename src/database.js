// Simple in-memory + JSON file storage (no native modules needed)
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '../db.json');

function load() {
  try {
    if (fs.existsSync(FILE)) return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch(e) {}
  return { schemas: [], calls: [], failures: [], id: 1 };
}

function save(data) {
  try { fs.writeFileSync(FILE, JSON.stringify(data, null, 2)); } catch(e) {}
}

function getDB() {
  return {
    getSchemas() { return load().schemas.reverse(); },
    getSchema(name) { return load().schemas.find(s => s.name === name) || null; },
    insertSchema({ name, definition, example }) {
      const data = load();
      if (data.schemas.find(s => s.name === name)) throw new Error(`Schema "${name}" already exists`);
      data.schemas.push({ id: data.id++, name, definition, example: example||null, created_at: new Date().toISOString() });
      save(data);
    },
    deleteSchema(name) {
      const data = load();
      const before = data.schemas.length;
      data.schemas = data.schemas.filter(s => s.name !== name);
      save(data);
      return data.schemas.length < before;
    },
    insertCall(fields) {
      const data = load();
      const id = data.id++;
      data.calls.push({ id, ...fields, success: 0, attempts: 0, correction_needed: 0, latency_ms: 0, total_tokens: 0, output: null, created_at: new Date().toISOString() });
      save(data);
      return id;
    },
    updateCall(id, fields) {
      const data = load();
      const c = data.calls.find(c => c.id === id);
      if (c) Object.assign(c, fields);
      save(data);
    },
    getCalls(limit=20) { return load().calls.reverse().slice(0, limit); },
    insertFailure(fields) {
      const data = load();
      data.failures.push({ id: data.id++, ...fields, created_at: new Date().toISOString() });
      save(data);
    },
    getFailures(limit=50) { return load().failures.reverse().slice(0, limit); },
    getFailureSummary() {
      const failures = load().failures;
      const map = {};
      failures.forEach(f => {
        if (!map[f.schema_name]) map[f.schema_name] = { schema_name: f.schema_name, failure_count: 0, errors: [] };
        map[f.schema_name].failure_count++;
        map[f.schema_name].errors.push(f.error_message);
      });
      return Object.values(map).sort((a,b) => b.failure_count - a.failure_count);
    }
  };
}

module.exports = { getDB };