/**
 * gemini_rotation.test.js
 * 
 * Automated unit and failover tests for quota-aware Gemini API key rotation.
 * Validates:
 * 1. Safe parsing of comma-separated keys without logging sensitive secrets.
 * 2. Individual key injection into each client instance.
 * 3. Failover from Key 1 (HTTP 429) to Key 2.
 * 4. Multi-key failover: Keys 1 & 2 quota exhausted -> Key 3 succeeds.
 * 5. All keys exhausted -> controlled QUOTA_EXHAUSTED error.
 * 6. Auth errors (HTTP 401/403) disable the failing key without infinite looping.
 * 7. Non-retryable validation / safety errors fail immediately without burning keys.
 * 8. Respect for per-key cooldown timers.
 * 9. Integration with aiModelHelper.callGemini.
 */

const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert');
const {
  GeminiKeyManager,
  parseGeminiKeys,
  isQuotaError,
  isAuthError,
  isNonRetryableError,
  getDefaultKeyManager,
} = require('../src/geminiKeyManager');
const { callGemini } = require('../src/aiModelHelper');

describe('Gemini API Quota-Aware Key Rotation Test Suite', () => {
  // Test dummy keys (safe test placeholders)
  const DUMMY_KEYS = ['test-key-alpha-1111', 'test-key-beta-2222', 'test-key-gamma-3333'];
  const COMMA_SEPARATED = DUMMY_KEYS.join(',');

  // =========================================================================
  // 1. Key Parsing & Zero Secret Leakage
  // =========================================================================
  describe('Key Parsing & Zero Secret Exposure', () => {
    test('parses comma-separated GEMINI_API_KEY into exactly three non-empty keys', () => {
      const parsed = parseGeminiKeys('  key_one ,  key_two , key_three  ');
      assert.strictEqual(parsed.length, 3);
      assert.strictEqual(parsed[0], 'key_one');
      assert.strictEqual(parsed[1], 'key_two');
      assert.strictEqual(parsed[2], 'key_three');
    });

    test('ignores placeholders and empty fragments in key string', () => {
      const parsed = parseGeminiKeys('key_1, your_gemini_api_key_here, , key_2 ,');
      assert.strictEqual(parsed.length, 2);
      assert.strictEqual(parsed[0], 'key_1');
      assert.strictEqual(parsed[1], 'key_2');
    });

    test('getStatus() does not reveal raw key strings or secret fragments', () => {
      const manager = new GeminiKeyManager({ keys: DUMMY_KEYS });
      const status = manager.getStatus();

      assert.strictEqual(status.totalKeys, 3);
      assert.strictEqual(status.activeKeys, 3);

      const jsonStr = JSON.stringify(status);
      DUMMY_KEYS.forEach((secret) => {
        assert.strictEqual(
          jsonStr.includes(secret),
          false,
          'Key secret string must never be present in getStatus() output'
        );
      });
    });

    test('validates that production .env parses into exactly 3 active keys', () => {
      const defaultManager = getDefaultKeyManager();
      assert.strictEqual(defaultManager.getKeyCount(), 3, 'Must load exactly 3 keys from server/.env');
    });
  });

  // =========================================================================
  // 2. Individual Client Injection
  // =========================================================================
  describe('Client Isolation', () => {
    test('each client instance receives exactly one individual key', () => {
      const capturedKeys = [];
      const manager = new GeminiKeyManager({
        keys: DUMMY_KEYS,
        clientFactory: (k) => {
          capturedKeys.push(k);
          return { customClient: true, keyId: capturedKeys.length };
        },
      });

      assert.strictEqual(capturedKeys.length, 3);
      assert.strictEqual(capturedKeys[0], DUMMY_KEYS[0]);
      assert.strictEqual(capturedKeys[1], DUMMY_KEYS[1]);
      assert.strictEqual(capturedKeys[2], DUMMY_KEYS[2]);
    });
  });

  // =========================================================================
  // 3. Quota Failover (HTTP 429) Scenarios
  // =========================================================================
  describe('Quota (HTTP 429) Failover', () => {
    test('Key 1 receives HTTP 429; Key 2 succeeds', async () => {
      const callLog = [];
      const manager = new GeminiKeyManager({
        keys: DUMMY_KEYS,
        cooldownMs: 30000,
        clientFactory: (k) => ({ key: k }),
      });

      const result = await manager.executeWithRotation(async (client, keyIndex) => {
        callLog.push(keyIndex);
        if (keyIndex === 0) {
          const err = new Error('Resource has been exhausted (e.g. check quota).');
          err.status = 429;
          throw err;
        }
        return { text: 'Success from Key 2' };
      });

      assert.deepStrictEqual(callLog, [0, 1], 'Should try Key 0 then Key 1');
      assert.strictEqual(result.text, 'Success from Key 2');
      assert.strictEqual(manager.isKeyInCooldown(0), true, 'Key 0 must be in cooldown');
      assert.strictEqual(manager.isKeyInCooldown(1), false, 'Key 1 must not be in cooldown');
      assert.strictEqual(manager.currentIndex, 1, 'Current active index must point to Key 1');
    });

    test('Keys 1 and 2 receive quota errors; Key 3 succeeds', async () => {
      const callLog = [];
      const manager = new GeminiKeyManager({
        keys: DUMMY_KEYS,
        cooldownMs: 30000,
        clientFactory: (k) => ({ key: k }),
      });

      const result = await manager.executeWithRotation(async (client, keyIndex) => {
        callLog.push(keyIndex);
        if (keyIndex === 0 || keyIndex === 1) {
          const err = new Error('Quota exceeded for quota metric');
          err.statusCode = 429;
          throw err;
        }
        return { text: 'Success from Key 3' };
      });

      assert.deepStrictEqual(callLog, [0, 1, 2], 'Should try Keys 0, 1, then succeed on 2');
      assert.strictEqual(result.text, 'Success from Key 3');
      assert.strictEqual(manager.isKeyInCooldown(0), true, 'Key 0 must be in cooldown');
      assert.strictEqual(manager.isKeyInCooldown(1), true, 'Key 1 must be in cooldown');
      assert.strictEqual(manager.isKeyInCooldown(2), false, 'Key 2 must be healthy');
      assert.strictEqual(manager.currentIndex, 2, 'Active index must advance to Key 2');
    });

    test('All keys receive quota errors; operation fails with controlled QUOTA_EXHAUSTED error', async () => {
      const callLog = [];
      const manager = new GeminiKeyManager({
        keys: DUMMY_KEYS,
        cooldownMs: 30000,
        clientFactory: (k) => ({ key: k }),
      });

      await assert.rejects(
        async () => {
          await manager.executeWithRotation(async (client, keyIndex) => {
            callLog.push(keyIndex);
            const err = new Error('Rate limit 429: Too many requests');
            err.status = 429;
            throw err;
          });
        },
        (err) => {
          assert.strictEqual(err.code, 'QUOTA_EXHAUSTED');
          assert.strictEqual(err.status, 429);
          assert.ok(err.message.includes('rate-limited (HTTP 429)'));
          return true;
        }
      );

      assert.deepStrictEqual(callLog, [0, 1, 2], 'Must attempt all 3 keys before giving up');
      assert.strictEqual(manager.isKeyInCooldown(0), true);
      assert.strictEqual(manager.isKeyInCooldown(1), true);
      assert.strictEqual(manager.isKeyInCooldown(2), true);
    });
  });

  // =========================================================================
  // 4. Authentication (HTTP 401/403) Safety
  // =========================================================================
  describe('Authentication Failure Safety', () => {
    test('HTTP 401/403 disables failing key and rotates without infinite loops', async () => {
      const callLog = [];
      const manager = new GeminiKeyManager({
        keys: DUMMY_KEYS,
        clientFactory: (k) => ({ key: k }),
      });

      const result = await manager.executeWithRotation(async (client, keyIndex) => {
        callLog.push(keyIndex);
        if (keyIndex === 0) {
          const err = new Error('API key not valid. Please pass a valid API key.');
          err.status = 401;
          throw err;
        }
        return { text: 'Key 2 Success' };
      });

      assert.deepStrictEqual(callLog, [0, 1]);
      assert.strictEqual(result.text, 'Key 2 Success');

      const status = manager.getStatus();
      assert.strictEqual(status.keys[0].disabled, true, 'Key 0 must be disabled');
      assert.strictEqual(status.activeKeys, 2, 'Active keys count must decrement to 2');

      // Subsequent call should skip Key 0 completely
      callLog.length = 0;
      await manager.executeWithRotation(async (client, keyIndex) => {
        callLog.push(keyIndex);
        return { text: 'Next call' };
      });
      assert.strictEqual(callLog.includes(0), false, 'Disabled Key 0 must not be called again');
    });

    test('All keys returning HTTP 401/403 terminates gracefully without looping', async () => {
      const callLog = [];
      const manager = new GeminiKeyManager({
        keys: DUMMY_KEYS,
        clientFactory: (k) => ({ key: k }),
      });

      await assert.rejects(
        async () => {
          await manager.executeWithRotation(async (client, keyIndex) => {
            callLog.push(keyIndex);
            const err = new Error('Permission denied: invalid API key');
            err.status = 403;
            throw err;
          });
        },
        /All configured Gemini API keys have been disabled due to invalid credentials/
      );

      assert.strictEqual(callLog.length, 3, 'Must attempt each key exactly once');
      assert.strictEqual(manager.getActiveKeyCount(), 0);
    });
  });

  // =========================================================================
  // 5. Non-Retryable Validation & Safety Errors
  // =========================================================================
  describe('Non-Retryable Errors', () => {
    test('HTTP 400 and safety blocks fail immediately without rotating additional keys', async () => {
      const callLog = [];
      const manager = new GeminiKeyManager({
        keys: DUMMY_KEYS,
        clientFactory: (k) => ({ key: k }),
      });

      await assert.rejects(
        async () => {
          await manager.executeWithRotation(async (client, keyIndex) => {
            callLog.push(keyIndex);
            const err = new Error('INVALID_ARGUMENT: Prompt was blocked by safety filters');
            err.status = 400;
            throw err;
          });
        },
        /blocked by safety filters/
      );

      // Must NOT attempt Key 1 or Key 2 because error is input/safety related
      assert.deepStrictEqual(callLog, [0], 'Must fail on Key 0 without trying other keys');
    });
  });

  // =========================================================================
  // 6. Cooldown Timing & Skip Logic
  // =========================================================================
  describe('Cooldown Behavior', () => {
    test('skips keys that are within their active cooldown window', async () => {
      const manager = new GeminiKeyManager({
        keys: DUMMY_KEYS,
        cooldownMs: 60000,
        clientFactory: (k) => ({ key: k }),
      });

      // Manually set Key 0 in cooldown
      manager.keyStates[0].cooldownUntil = Date.now() + 50000;

      const callLog = [];
      const res = await manager.executeWithRotation(async (client, keyIndex) => {
        callLog.push(keyIndex);
        return { ok: true };
      });

      assert.deepStrictEqual(callLog, [1], 'Should immediately skip Key 0 and execute on Key 1');
      assert.strictEqual(res.ok, true);
    });
  });

  // =========================================================================
  // 7. Integration with aiModelHelper.callGemini
  // =========================================================================
  describe('Integration with callGemini', () => {
    test('callGemini failover operates transparently across multiple keys', async () => {
      const keysUsed = [];
      const customManager = new GeminiKeyManager({
        keys: DUMMY_KEYS,
        cooldownMs: 30000,
        clientFactory: (k) => ({
          getGenerativeModel: ({ model }) => ({
            generateContent: async () => {
              keysUsed.push(k);
              if (k === DUMMY_KEYS[0]) {
                const err = new Error('Quota exceeded 429');
                err.status = 429;
                throw err;
              }
              return {
                response: {
                  text: () => 'Transcribed lecture text from Key 2',
                },
              };
            },
          }),
        }),
      });

      const response = await callGemini(async (model) => {
        return await model.generateContent('test prompt');
      }, customManager);

      assert.strictEqual(response.response.text(), 'Transcribed lecture text from Key 2');
      assert.strictEqual(keysUsed.length, 2, 'Should fail on Key 1 and succeed on Key 2');
      assert.strictEqual(keysUsed[0], DUMMY_KEYS[0]);
      assert.strictEqual(keysUsed[1], DUMMY_KEYS[1]);
    });
  });
});
