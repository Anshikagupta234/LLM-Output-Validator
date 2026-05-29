// Three strategies for injecting schema instructions into LLM prompts
 
function buildSystemPrompt(strategy, schemaDefinition, example) {
  switch (strategy) {
    case 'json_instruction':
      return jsonInstruction(schemaDefinition);
    case 'few_shot':
      return fewShot(schemaDefinition, example);
    case 'function_calling':
      return functionCalling(schemaDefinition);
    default:
      return jsonInstruction(schemaDefinition);
  }
}
 
// Strategy 1: Simple JSON instruction appended to system prompt
function jsonInstruction(schemaDefinition) {
  return `You are a helpful assistant that always responds with valid JSON.
 
IMPORTANT: Respond ONLY with valid JSON matching this schema. No markdown, no explanation, no code blocks.
 
Schema:
${JSON.stringify(schemaDefinition, null, 2)}
 
Rules:
- Return ONLY raw JSON, nothing else
- Do not wrap in markdown code blocks
- Do not add extra explanation
- Match the exact field names and types in the schema`;
}
 
// Strategy 2: Few-shot example included in the system prompt
function fewShot(schemaDefinition, example) {
  const sampleOutput = example || generateSampleFromSchema(schemaDefinition);
  return `You are a helpful assistant that always responds with valid JSON.
 
Here is exactly the format you must follow:
 
EXAMPLE OUTPUT:
${JSON.stringify(sampleOutput, null, 2)}
 
You must return JSON in that exact structure. No markdown, no code blocks, no extra text.`;
}
 
// Strategy 3: Tell the model to use its function-calling behavior
function functionCalling(schemaDefinition) {
  return `You are a helpful assistant. You will respond by calling the "respond" function with structured data.
Always use the respond function to return your answer.
Schema for the function:
${JSON.stringify(schemaDefinition, null, 2)}`;
}
 
// Helper: generate a simple sample from a schema definition
function generateSampleFromSchema(schema) {
  if (!schema || !schema.properties) return { example: 'value' };
  const sample = {};
  for (const [key, val] of Object.entries(schema.properties)) {
    if (val.type === 'string') sample[key] = val.enum ? val.enum[0] : 'example string';
    else if (val.type === 'number') sample[key] = val.minimum ?? 42;
    else if (val.type === 'integer') sample[key] = 1;
    else if (val.type === 'boolean') sample[key] = true;
    else if (val.type === 'array') sample[key] = [];
    else if (val.type === 'object') sample[key] = {};
    else sample[key] = null;
  }
  return sample;
}
 
// Build a correction prompt when the LLM output fails validation
function buildCorrectionPrompt(originalResponse, validationError, schemaDefinition) {
  return `Your previous response failed validation with this error:
 
ERROR: ${validationError}
 
Your bad response was:
${originalResponse}
 
The expected schema is:
${JSON.stringify(schemaDefinition, null, 2)}
 
Please try again and return ONLY valid JSON that matches the schema exactly. No markdown, no explanation.`;
}
 
module.exports = { buildSystemPrompt, buildCorrectionPrompt };