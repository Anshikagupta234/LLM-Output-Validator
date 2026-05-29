const API = '';  // same origin
 
// ── TAB NAVIGATION ──
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + tab).classList.add('active');
    if (tab === 'schemas') loadSchemas();
    if (tab === 'failures') loadFailures();
    if (tab === 'metrics') loadMetrics();
  });
});
 
// ── HEALTH CHECK ──
async function checkHealth() {
  try {
    const res = await fetch(API + '/health');
    const dot = document.getElementById('statusDot');
    const txt = document.getElementById('statusText');
    if (res.ok) {
      dot.className = 'status-dot online';
      txt.textContent = 'online';
    } else {
      dot.className = 'status-dot offline';
      txt.textContent = 'offline';
    }
  } catch {
    document.getElementById('statusDot').className = 'status-dot offline';
    document.getElementById('statusText').textContent = 'offline';
  }
}
checkHealth();
setInterval(checkHealth, 10000);
 
// ── SCHEMA TEMPLATES ──
const templates = {
  movie: {
    name: 'movie_review',
    def: {
      properties: {
        title: { type: 'string' },
        rating: { type: 'number', minimum: 1, maximum: 10 },
        genre: { type: 'string', enum: ['action', 'drama', 'comedy', 'sci-fi', 'horror'] },
        summary: { type: 'string', minLength: 20 },
        recommended: { type: 'boolean' }
      },
      required: ['title', 'rating', 'genre', 'summary']
    }
  },
  person: {
    name: 'person_info',
    def: {
      properties: {
        name: { type: 'string' },
        age: { type: 'integer', minimum: 0, maximum: 150 },
        occupation: { type: 'string' },
        hobbies: { type: 'array', items: { type: 'string' } }
      },
      required: ['name', 'age', 'occupation']
    }
  },
  product: {
    name: 'product',
    def: {
      properties: {
        name: { type: 'string' },
        price: { type: 'number', minimum: 0 },
        category: { type: 'string', enum: ['electronics', 'clothing', 'food', 'other'] },
        in_stock: { type: 'boolean' },
        tags: { type: 'array', items: { type: 'string' } }
      },
      required: ['name', 'price', 'category', 'in_stock']
    }
  }
};
 
function loadTemplate(type) {
  const t = templates[type];
  document.getElementById('schemaName').value = t.name;
  document.getElementById('schemaDef').value = JSON.stringify(t.def, null, 2);
}
 
// ── REGISTER SCHEMA ──
async function registerSchema() {
  const name = document.getElementById('schemaName').value.trim();
  const defRaw = document.getElementById('schemaDef').value.trim();
  const msg = document.getElementById('schemaMsg');
 
  if (!name || !defRaw) {
    showMsg(msg, 'error', 'Schema name and definition are required');
    return;
  }
 
  let definition;
  try {
    definition = JSON.parse(defRaw);
  } catch {
    showMsg(msg, 'error', 'Invalid JSON in schema definition');
    return;
  }
 
  try {
    const res = await fetch(API + '/schemas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, definition })
    });
    const data = await res.json();
    if (res.ok) {
      showMsg(msg, 'success', `✓ Schema "${name}" registered!`);
      document.getElementById('schemaName').value = '';
      document.getElementById('schemaDef').value = '';
      loadSchemas();
    } else {
      showMsg(msg, 'error', data.error || 'Registration failed');
    }
  } catch (err) {
    showMsg(msg, 'error', 'Server error: ' + err.message);
  }
}
 
// ── LOAD SCHEMAS ──
async function loadSchemas() {
  const list = document.getElementById('schemaList');
  try {
    const res = await fetch(API + '/schemas');
    const data = await res.json();
    if (!data.schemas || data.schemas.length === 0) {
      list.innerHTML = '<div class="empty-state">No schemas yet. Register one →</div>';
      return;
    }
    list.innerHTML = data.schemas.map(s => `
      <div class="schema-item">
        <div>
          <div class="schema-name">${escHtml(s.name)}</div>
          <div class="schema-date">${new Date(s.created_at).toLocaleString()}</div>
        </div>
        <button class="schema-del" onclick="deleteSchema('${escHtml(s.name)}')" title="Delete">✕</button>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = '<div class="empty-state" style="color:var(--red)">Could not load schemas</div>';
  }
}
 
// ── DELETE SCHEMA ──
async function deleteSchema(name) {
  if (!confirm(`Delete schema "${name}"?`)) return;
  await fetch(API + '/schemas/' + encodeURIComponent(name), { method: 'DELETE' });
  loadSchemas();
}
 
// ── MAKE CALL ──
async function makeCall() {
  const schemaName = document.getElementById('callSchemaName').value.trim();
  const prompt = document.getElementById('callPrompt').value.trim();
  const strategy = document.getElementById('callStrategy').value;
  const model = document.getElementById('callModel').value.trim();
  const btn = document.getElementById('callBtn');
  const msg = document.getElementById('callMsg');
  const result = document.getElementById('callResult');
 
  if (!schemaName || !prompt) {
    showMsg(msg, 'error', 'Schema name and prompt are required');
    return;
  }
 
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Calling LLM...';
  result.innerHTML = '<div class="result-empty"><span class="result-placeholder">⏳ Waiting for LLM response...</span></div>';
  msg.className = 'msg';
  msg.textContent = '';
 
  try {
    const res = await fetch(API + '/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schema_name: schemaName, prompt, strategy, model })
    });
    const data = await res.json();
    renderCallResult(data);
  } catch (err) {
    showMsg(msg, 'error', 'Network error: ' + err.message);
    result.innerHTML = '<div class="result-empty"><span class="result-placeholder">Error :(</span></div>';
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Run Validated Call ▷';
  }
}
 
function renderCallResult(data) {
  const el = document.getElementById('callResult');
 
  const badge = data.success
    ? `<span class="result-badge badge-success">✓ Validated</span>`
    : `<span class="result-badge badge-error">✗ Failed</span>`;
 
  const corrBadge = data.correctionNeeded
    ? `<span class="result-badge badge-warn">⚡ Auto-corrected</span>`
    : '';
 
  const meta = `
    <div class="result-meta">
      <div class="meta-chip"><div class="meta-label">Attempts</div><div class="meta-value">${data.attempts}/3</div></div>
      <div class="meta-chip"><div class="meta-label">Latency</div><div class="meta-value">${data.latency}ms</div></div>
      <div class="meta-chip"><div class="meta-label">Tokens</div><div class="meta-value">${data.tokens}</div></div>
      <div class="meta-chip"><div class="meta-label">Strategy</div><div class="meta-value">${(data.strategy||'').replace('_',' ')}</div></div>
    </div>`;
 
  let body = '';
  if (data.success) {
    body = `<div class="json-output">${JSON.stringify(data.output, null, 2)}</div>`;
  } else {
    body = `
      <div class="failure-error">All 3 attempts failed: ${escHtml(data.error || '')}</div>
      ${(data.failedAttempts || []).map((a, i) => `
        <div style="margin-top:8px">
          <div class="meta-label">Attempt ${a.attempt} error:</div>
          <div class="failure-error">${escHtml(a.error)}</div>
        </div>
      `).join('')}`;
  }
 
  el.innerHTML = `<div class="result-box">
    <div style="display:flex;gap:8px;flex-wrap:wrap">${badge}${corrBadge}</div>
    ${meta}
    ${body}
  </div>`;
}
 
// ── FAILURES ──
async function loadFailures() {
  const list = document.getElementById('failureList');
  list.innerHTML = '<div class="empty-state">Loading...</div>';
  try {
    const res = await fetch(API + '/failures');
    const data = await res.json();
    const failures = data.recent_failures || [];
    if (failures.length === 0) {
      list.innerHTML = '<div class="empty-state">No failures yet 🎉</div>';
      return;
    }
    list.innerHTML = failures.map(f => `
      <div class="failure-item">
        <div class="failure-header">
          <span class="failure-schema">${escHtml(f.schema_name)}</span>
          <span class="failure-attempt">Attempt ${f.attempt_number}</span>
          <span class="failure-attempt">${new Date(f.created_at).toLocaleString()}</span>
        </div>
        <div style="font-size:0.75rem;color:var(--muted);margin-bottom:6px">Prompt: ${escHtml((f.prompt||'').slice(0,80))}${f.prompt && f.prompt.length > 80 ? '...' : ''}</div>
        <div class="failure-error">${escHtml(f.error_message)}</div>
      </div>
    `).join('');
  } catch {
    list.innerHTML = '<div class="empty-state" style="color:var(--red)">Could not load failures</div>';
  }
}
 
// ── METRICS ──
async function loadMetrics() {
  try {
    const res = await fetch(API + '/metrics');
    const data = await res.json();
    renderMetrics(data);
  } catch {
    document.getElementById('metricsContent').innerHTML = '<div class="empty-state" style="color:var(--red)">Could not load metrics</div>';
  }
}
 
function renderMetrics(data) {
  const o = data.overall || {};
  document.getElementById('overallStats').innerHTML = `
    <div class="stat-card"><div class="stat-label">Total Calls</div><div class="stat-value">${o.total_calls || 0}</div></div>
    <div class="stat-card"><div class="stat-label">Success Rate</div><div class="stat-value">${o.success_rate || '0%'}</div></div>
    <div class="stat-card"><div class="stat-label">Avg Latency</div><div class="stat-value">${Math.round(o.avg_latency_ms || 0)}ms</div></div>
    <div class="stat-card"><div class="stat-label">Avg Tokens</div><div class="stat-value">${Math.round(o.avg_tokens || 0)}</div></div>
  `;
 
  const strats = data.strategy_performance || [];
  if (strats.length === 0) {
    document.getElementById('strategyTable').innerHTML = '<div class="empty-state">No data yet. Make some calls first.</div>';
    return;
  }
  document.getElementById('strategyTable').innerHTML = `
    <table class="strategy-table">
      <thead>
        <tr>
          <th>Strategy</th>
          <th>Total</th>
          <th>Success Rate</th>
          <th>1st Attempt %</th>
          <th>Avg Tokens</th>
        </tr>
      </thead>
      <tbody>
        ${strats.map(s => `
          <tr>
            <td>${s.strategy}</td>
            <td>${s.total}</td>
            <td>${s.success_rate}</td>
            <td>${s.first_attempt_rate}</td>
            <td>${Math.round(s.avg_tokens || 0)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}
 
// ── HELPERS ──
function showMsg(el, type, text) {
  el.className = 'msg ' + type;
  el.textContent = text;
}
 
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
 
// Load schemas on startup
loadSchemas();