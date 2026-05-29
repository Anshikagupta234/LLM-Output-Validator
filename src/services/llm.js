require('dotenv').config();

async function callLLM({ systemPrompt, userPrompt }) {
  const startTime = Date.now();
  const key = process.env.GEMINI_API_KEY;

  if (!key) throw new Error('GEMINI_API_KEY is missing in .env file');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }]
  };

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (networkErr) {
    throw new Error('Network error reaching Gemini API: ' + networkErr.message);
  }

  const data = await response.json();

  if (!response.ok) {
    const msg = data?.error?.message || JSON.stringify(data);
    throw new Error(`Gemini API error ${response.status}: ${msg}`);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const latency = Date.now() - startTime;
  const usage = data.usageMetadata || {};
  const tokens = (usage.promptTokenCount || 0) + (usage.candidatesTokenCount || 0);

  return { text, latency, tokens };
}

module.exports = { callLLM };