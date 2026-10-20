require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const rawKeys = (process.env.GEMINI_API_KEY || '')
  .split(',')
  .map((k) => k.trim())
  .filter((k) => k && k !== 'your_gemini_api_key_here');

const aiInstances = rawKeys.map((key) => new GoogleGenerativeAI(key));
let currentKeyIndex = 0;

const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
].filter((v, i, a) => v && a.indexOf(v) === i); // unique

/**
 * Execute a Gemini generative call with automatic model and key rotation.
 * `callFn` is `async (model) => ...`
 */
async function callGemini(callFn) {
  if (aiInstances.length === 0) {
    throw new Error('No valid GEMINI_API_KEY configured in server/.env');
  }

  let lastError = null;

  for (let attempt = 0; attempt < aiInstances.length; attempt++) {
    const keyIdx = (currentKeyIndex + attempt) % aiInstances.length;
    const genAI = aiInstances[keyIdx];

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await callFn(model, modelName);
        currentKeyIndex = keyIdx;
        return result;
      } catch (err) {
        lastError = err;
        const errMsg = err.message || '';
        // If 429 quota or 404 model not found, try next model
        if (
          errMsg.includes('429') ||
          errMsg.includes('Quota exceeded') ||
          errMsg.includes('404') ||
          errMsg.includes('not found') ||
          errMsg.includes('Resource has been exhausted')
        ) {
          console.warn(`[AI Helper] Model ${modelName} failed (${errMsg.slice(0, 70)}...). Trying next candidate model...`);
          continue;
        } else {
          // If it's a parsing or prompt error, rethrow unless we want to try other models
          console.warn(`[AI Helper] Error with ${modelName}:`, errMsg.slice(0, 100));
          continue;
        }
      }
    }
  }

  throw lastError || new Error('All Gemini models and keys exhausted');
}

module.exports = {
  callGemini,
  CANDIDATE_MODELS,
};
