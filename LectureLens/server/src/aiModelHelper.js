require('dotenv').config();
const { getDefaultKeyManager, isQuotaError } = require('./geminiKeyManager');

const CANDIDATE_MODELS = [
  process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
].filter((v, i, a) => v && a.indexOf(v) === i); // unique

/**
 * Execute a Gemini generative call with automatic model and quota-aware key rotation.
 * `callFn` is `async (model, modelName) => ...`
 * Accepts optional customManager for testing.
 */
async function callGemini(callFn, customManager = null) {
  const manager = customManager || getDefaultKeyManager();

  return await manager.executeWithRotation(async (client, keyIndex) => {
    let lastModelError = null;

    for (const modelName of CANDIDATE_MODELS) {
      try {
        const model = client.getGenerativeModel({ model: modelName });
        const result = await callFn(model, modelName);
        return result;
      } catch (err) {
        lastModelError = err;
        // If it's a quota or rate-limit error, abort model loop on this key immediately so manager rotates keys
        if (isQuotaError(err)) {
          throw err;
        }

        const errMsg = String(err.message || '');
        // If model not found (404), try next model name on this key
        if (errMsg.includes('404') || errMsg.includes('not found')) {
          console.warn(`[AI Helper] Model ${modelName} on Key #${keyIndex + 1} not found. Trying next candidate model...`);
          continue;
        }

        // For non-retryable or auth errors, throw to manager
        throw err;
      }
    }

    throw lastModelError || new Error(`All candidate models failed on Key #${keyIndex + 1}`);
  });
}

module.exports = {
  callGemini,
  CANDIDATE_MODELS,
  getDefaultKeyManager,
};
