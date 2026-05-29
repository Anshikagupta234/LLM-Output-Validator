# LLM Output Validator & Schema Enforcer

A middleware layer that guarantees LLM responses match your expected schema — or automatically fixes them until they do.

# What This Project Does
Every production LLM integration hits the same problem: you ask the model for JSON, and it gives you JSON wrapped in a markdown code block, or with an extra explanation, or with a field name slightly wrong. Your app breaks.
This project solves that with a validation and auto-correction layer that sits between your LLM call and your application logic.

# Features

Schema Registry — register named JSON schemas using Zod
Validated LLM Calls — every response is parsed and validated automatically
Auto-Correction — if the LLM returns bad JSON, the system retries up to 3 times with a correction prompt
Failure Logging — every failed attempt is logged with the error, schema, and prompt
3 Injection Strategies — JSON instruction, few-shot example, function calling
Metrics Dashboard — see which strategy has the highest first-attempt pass rate
Beautiful UI — full web interface to register schemas, make calls, and view failures

# Tech Stack

Backend — Node.js + Express
Validation — Zod
LLM — Google Gemini API (gemini-2.0-flash)
Database — JSON file storage (db.json)
Frontend — Vanilla HTML, CSS, JavaScript

# Project Structure

llm-validator/
├── src/
│   ├── server.js              # Express entry point
│   ├── database.js            # JSON file storage
│   ├── routes/
│   │   ├── schemas.js         # GET/POST /schemas
│   │   ├── call.js            # POST /call
│   │   ├── failures.js        # GET /failures
│   │   └── metrics.js         # GET /metrics
│   └── services/
│       ├── llm.js             # Gemini API calls
│       ├── validator.js       # Zod validation + retry logic
│       └── injection.js       # 3 schema injection strategies
├── public/
│   ├── index.html             # Frontend UI
│   ├── style.css              # Styles
│   └── app.js                 # Frontend logic
├── .env.example
├── package.json
└── README.md

# Setup & Installation
Prerequisites

Node.js v18 or higher
Google Gemini API key (free at https://aistudio.google.com/apikey)

# Steps
1. Install dependencies
bashnpm install
2. Create your .env file
bashcp .env.example .env
Open .env and add your Gemini API key:
GEMINI_API_KEY=AIzaSy_your_key_here
PORT=3000
3. Start the server
bashnpm run dev
4. Open the app
http://localhost:3000

# How to Use

Step 1 — Register a Schema
Go to the Schemas tab and register a schema. Example:
json{
  "properties": {
    "title": { "type": "string" },
    "rating": { "type": "number", "minimum": 1, "maximum": 10 },
    "genre": { "type": "string", "enum": ["action", "drama", "comedy", "sci-fi", "horror"] },
    "summary": { "type": "string", "minLength": 20 },
    "recommended": { "type": "boolean" }
  },
  "required": ["title", "rating", "genre", "summary", "recommended"]
}
Step 2 — Make a Validated Call
Go to the Make a Call tab:

Schema Name: movie_review
Prompt: Write a review for the movie Inception
Strategy: JSON Instruction
Model: gemini-2.0-flash

Step 3 — View Results
The response panel shows:

Validated — LLM returned correct JSON on first try
Auto-corrected — system had to retry with correction prompt
Failed — all 3 attempts failed (rare)

# Correction Prompt Design

When validation fails, the system sends this correction prompt:
Your previous response failed validation with this error: [error]
The expected schema is: [schema]
Please try again and return ONLY valid JSON that matches the schema exactly.

This pattern works because it:
1.Tells the LLM exactly what went wrong
2.Reminds it of the expected format
3.Strongly instructs it to return only JSON

# Failure Logging
Every failed attempt is logged with:
Schema name
Prompt used
Model used
Attempt number
Raw LLM response
Exact validation error

This data is visible in the Failures tab and helps identify:

Which schemas are hardest to enforce
What error patterns appear most often
Which prompts need improvement

# Reflection
Which schemas are hardest to enforce reliably?
1.Enum fields — LLMs sometimes return values close to but not in the enum (e.g. "Sci-Fi" instead of "sci-fi")
2.Nested objects — deeper nesting increases chance of structural errors
3.Number ranges — LLMs occasionally return numbers outside specified min/max
4.Arrays with typed items — LLMs sometimes return a string instead of a single-item array

# What happens when the LLM fundamentally cannot produce the required output?
After 3 failed attempts, the system returns a structured error response with:

All 3 failed attempt outputs
The specific validation error for each attempt
Total latency and token usage

The system never returns an unvalidated response as if it were valid — it fails loudly with full diagnostic information so the developer can improve the schema or prompt.

# Example Schemas
Three example schemas are included:
movie_review — string, number, enum, boolean fields
person_info — string, integer, array of strings
product — string, number, enum, boolean, array fields
