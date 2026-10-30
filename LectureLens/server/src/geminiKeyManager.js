/**
 * geminiKeyManager.js
 * 
 * Centralized, quota-aware Google Gemini API key manager for LectureLens:
 * - Parses comma-separated GEMINI_API_KEY into individual isolated client instances.
 * - Enforces zero secret leakage (never logs keys or key fragments).
 * - Tracks per-key quota exhaustion (HTTP 429 / RESOURCE_EXHAUSTED) with time-based cooldown.
 * - Handles authentication failures (HTTP 401 / 403) by safely disabling the affected key without infinite loops.
 * - Detects non-retryable validation / safety errors and fails fast without wasteful key rotation.
 * - Provides clean dependency injection for unit and regression testing.
 */

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Parses comma-separated key string into array of sanitized, non-empty keys.
 * Never logs or reveals keys.
 */
function parseGeminiKeys(envVal) {
  if (!envVal || typeof envVal !== 'string') return [];
  return envVal
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k && !k.toLowerCase().includes('your_gemini_api_key'));
}

/**
 * Determine if an error is a rate limit or quota exhaustion error (HTTP 429).
 */
function isQuotaError(err) {
  if (!err) return false;
  const status = err.status || err.statusCode || err.code;
  if (status === 429) return true;
  const msg = String(err.message || '').toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('quota exceeded') ||
    msg.includes('resource_exhausted') ||
    msg.includes('resource has been exhausted') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests')
  );
}

/**
 * Determine if an error is an authentication / authorization failure (HTTP 401 / 403).
 */
function isAuthError(err) {
  if (!err) return false;
  const status = err.status || err.statusCode || err.code;
  if (status === 401 || status === 403) return true;
  const msg = String(err.message || '').toLowerCase();
  return (
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('api_key_invalid') ||
    msg.includes('api key not valid') ||
    msg.includes('unauthorized') ||
    msg.includes('permission_denied') ||
    msg.includes('invalid api key') ||
    msg.includes('access_token_type_unsupported')
  );
}

/**
 * Determine if an error is non-retryable (bad request, invalid argument, prompt safety block).
 * Non-retryable errors should immediately fail without burning additional API keys.
 */
function isNonRetryableError(err) {
  if (!err) return false;
  const status = err.status || err.statusCode || err.code;
  // If it's a quota or auth error, let specialized handlers handle it
  if (isQuotaError(err) || isAuthError(err)) return false;

  const msg = String(err.message || '').toLowerCase();
  if (status === 400) {
    // 400 is typically invalid arguments or malformed request payload
    return true;
  }
  return (
    msg.includes('invalid_argument') ||
    msg.includes('prompt blocked') ||
    msg.includes('safety') ||
    msg.includes('blocked by safety filters') ||
    msg.includes('content moderation')
  );
}

class GeminiKeyManager {
  /**
   * @param {Object} options
   * @param {string[]|string} [options.keys] - Explicit array of keys or env string
   * @param {number} [options.cooldownMs] - Cooldown duration in ms upon 429 (default 60s)
   * @param {Function} [options.clientFactory] - Factory: (key) => new GoogleGenerativeAI(key)
   */
  constructor(options = {}) {
    const raw = options.keys !== undefined ? options.keys : process.env.GEMINI_API_KEY;
    this.keys = Array.isArray(raw) ? raw : parseGeminiKeys(raw);
    this.cooldownMs = Number(options.cooldownMs) || 60000; // 60s default
    this.clientFactory = options.clientFactory || ((k) => new GoogleGenerativeAI(k));

    this.keyStates = this.keys.map((key, idx) => ({
      index: idx,
      key, // retained internally for client creation, never exposed in logs
      client: this.clientFactory(key),
      cooldownUntil: 0,
      disabled: false,
      failureCount: 0,
      successCount: 0,
    }));

    this.currentIndex = 0;
  }

  /**
   * Return number of loaded keys (without exposing them)
   */
  getKeyCount() {
    return this.keyStates.length;
  }

  /**
   * Return number of active (non-disabled) keys
   */
  getActiveKeyCount() {
    return this.keyStates.filter((s) => !s.disabled).length;
  }

  /**
   * Check if a specific key index is currently in cooldown
   */
  isKeyInCooldown(idx) {
    const state = this.keyStates[idx];
    if (!state) return false;
    return Date.now() < state.cooldownUntil;
  }

  /**
   * Reset cooldowns and disabled flags (useful for tests)
   */
  resetState() {
    this.currentIndex = 0;
    this.keyStates.forEach((s) => {
      s.cooldownUntil = 0;
      s.disabled = false;
      s.failureCount = 0;
      s.successCount = 0;
    });
  }

  /**
   * Return sanitized status information without exposing keys
   */
  getStatus() {
    const now = Date.now();
    return {
      totalKeys: this.keyStates.length,
      activeKeys: this.keyStates.filter((s) => !s.disabled).length,
      currentWorkingIndex: this.currentIndex,
      keys: this.keyStates.map((s) => ({
        index: s.index,
        disabled: s.disabled,
        inCooldown: now < s.cooldownUntil,
        cooldownRemainingMs: Math.max(0, s.cooldownUntil - now),
        successCount: s.successCount,
        failureCount: s.failureCount,
      })),
    };
  }

  /**
   * Execute an operation with automatic key failover and cooldown management
   * @param {Function} operation - async (client, keyIndex) => result
   * @returns {Promise<any>}
   */
  async executeWithRotation(operation) {
    if (this.keyStates.length === 0) {
      throw new Error('No valid Gemini API keys configured. Set GEMINI_API_KEY in server/.env');
    }

    const total = this.keyStates.length;
    let lastError = null;
    let attemptsCount = 0;
    const now = Date.now();

    // Check if all keys are disabled
    const active = this.keyStates.filter((s) => !s.disabled);
    if (active.length === 0) {
      throw new Error('All configured Gemini API keys have been disabled due to invalid credentials (HTTP 401/403).');
    }

    // Try keys starting from current working index
    for (let i = 0; i < total; i++) {
      const idx = (this.currentIndex + i) % total;
      const state = this.keyStates[idx];

      if (state.disabled) {
        continue;
      }

      // Check cooldown
      if (Date.now() < state.cooldownUntil) {
        const remainingSec = Math.ceil((state.cooldownUntil - Date.now()) / 1000);
        console.warn(`[GeminiKeyManager] Key #${idx + 1} is currently in cooldown (${remainingSec}s remaining). Skipping.`);
        continue;
      }

      attemptsCount++;

      try {
        const result = await operation(state.client, idx);
        // Successful execution
        state.successCount++;
        state.cooldownUntil = 0; // Clear cooldown on success
        this.currentIndex = idx; // Keep working key as active for subsequent calls
        return result;
      } catch (err) {
        lastError = err;
        state.failureCount++;

        // 1. Non-retryable validation or safety error: fail immediately without burning more keys
        if (isNonRetryableError(err)) {
          console.warn(`[GeminiKeyManager] Key #${idx + 1} encountered non-retryable error: ${err.message || 'Validation error'}. Aborting rotation.`);
          throw err;
        }

        // 2. Auth error (401 / 403): disable this key permanently
        if (isAuthError(err)) {
          state.disabled = true;
          console.warn(`[GeminiKeyManager] Key #${idx + 1} rejected with authentication error. Key disabled from rotation pool.`);
          continue; // Rotate to next key
        }

        // 3. Quota / Rate limit error (429): enter cooldown and rotate immediately
        if (isQuotaError(err)) {
          state.cooldownUntil = Date.now() + this.cooldownMs;
          const coolSec = Math.round(this.cooldownMs / 1000);
          console.warn(`[GeminiKeyManager] Key #${idx + 1} quota exceeded (HTTP 429). Entering ${coolSec}s cooldown. Rotating to next key.`);
          continue; // Rotate to next key
        }

        // 4. Other transient error (e.g. 503 service unavailable, timeout): rotate to next key
        console.warn(`[GeminiKeyManager] Key #${idx + 1} transient failure: ${err.message || 'Transient error'}. Trying next key.`);
      }
    }

    // If all keys were examined and none succeeded:
    const allDisabled = this.keyStates.every((s) => s.disabled);
    if (allDisabled) {
      const err = new Error('All configured Gemini API keys have been disabled due to invalid credentials (HTTP 401/403).');
      err.code = 'ALL_KEYS_DISABLED';
      err.status = 401;
      throw err;
    }

    const activeKeys = this.keyStates.filter((s) => !s.disabled);
    const allActiveInCooldown = activeKeys.length > 0 && activeKeys.every((s) => Date.now() < s.cooldownUntil);
    if (allActiveInCooldown) {
      const err = new Error('All configured Gemini API keys are currently rate-limited (HTTP 429) or in active cooldown.');
      err.code = 'QUOTA_EXHAUSTED';
      err.status = 429;
      throw err;
    }

    throw lastError || new Error(`All ${total} Gemini API keys failed during rotation.`);
  }
}

// Global default singleton instance initialized from process.env
let defaultManager = null;
function getDefaultKeyManager() {
  if (!defaultManager) {
    defaultManager = new GeminiKeyManager();
  }
  return defaultManager;
}

module.exports = {
  GeminiKeyManager,
  getDefaultKeyManager,
  parseGeminiKeys,
  isQuotaError,
  isAuthError,
  isNonRetryableError,
};
