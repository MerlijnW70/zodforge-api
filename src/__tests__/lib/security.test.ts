// Security utilities tests
import { describe, it, expect } from 'vitest';
import { maskApiKey, hashApiKey, validateApiKeyFormat, rateLimiter } from '../../lib/security.js';

describe('Security Utilities', () => {
  describe('maskApiKey', () => {
    it('should mask OpenAI API key', () => {
      const key = 'sk-proj-abc123def456ghi789jkl012mno345pqr678stu901vwx234';
      const masked = maskApiKey(key);

      // Format: first 7 chars + asterisks + last 4 chars
      // Regex needs to escape the asterisk literal: \*+
      expect(masked).toMatch(/^sk-proj.{1}\*+[a-z0-9]{4}$/);
      expect(masked).not.toContain('abc123');
      expect(masked.endsWith('x234')).toBe(true);
      expect(masked.startsWith('sk-proj')).toBe(true);
    });

    it('should mask ZodForge API key', () => {
      const key = 'zf_1234567890abcdefghijklmnopqrstuvwxyz';
      const masked = maskApiKey(key);

      // Format: first 7 chars + asterisks + last 4 chars
      expect(masked.startsWith('zf_1234')).toBe(true);
      expect(masked).not.toContain('567890'); // Middle part should be masked
      expect(masked.endsWith(key.slice(-4))).toBe(true);
    });

    it('should handle short keys', () => {
      const key = 'abc123';
      const masked = maskApiKey(key);

      // Keys shorter than 12 chars are marked as invalid
      expect(masked).toBe('[INVALID]');
    });

    it('should handle very short keys', () => {
      const key = 'ab';
      const masked = maskApiKey(key);

      expect(masked).toBe('[INVALID]');
    });
  });

  describe('hashApiKey', () => {
    it('should generate consistent SHA-256 hash', () => {
      const key = 'zf_test_key_12345';
      const hash1 = hashApiKey(key);
      const hash2 = hashApiKey(key);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 hex length
    });

    it('should generate different hashes for different keys', () => {
      const key1 = 'zf_test_key_12345';
      const key2 = 'zf_test_key_67890';

      const hash1 = hashApiKey(key1);
      const hash2 = hashApiKey(key2);

      expect(hash1).not.toBe(hash2);
    });

    it('should be case-sensitive', () => {
      const hash1 = hashApiKey('zf_Test_Key');
      const hash2 = hashApiKey('zf_test_key');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('validateApiKeyFormat', () => {
    it('should validate correct OpenAI key format', () => {
      const key = 'sk-proj-abc123def456ghi789jkl012mno345pqr678';
      const result = validateApiKeyFormat(key);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should validate correct ZodForge key format', () => {
      const key = 'zf_1234567890abcdefghij';
      const result = validateApiKeyFormat(key);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject short OpenAI keys', () => {
      const key = 'sk-short';
      const result = validateApiKeyFormat(key);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('incomplete');
    });

    it('should reject short ZodForge keys', () => {
      const key = 'zf_short';
      const result = validateApiKeyFormat(key);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('too short');
    });

    it('should reject unknown key format', () => {
      const key = 'unknown_format_12345678901234567890';
      const result = validateApiKeyFormat(key);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unknown API key format');
    });

    it('should reject missing keys', () => {
      const result = validateApiKeyFormat(undefined);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('missing');
    });
  });

  describe('RateLimiter', () => {
    it('should allow requests within limit', () => {
      const limiter = rateLimiter;
      const identifier = 'test-user-1';

      const result = limiter.checkLimit(identifier);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeGreaterThanOrEqual(0);
    });

    it('should track remaining requests', () => {
      const limiter = rateLimiter;
      const identifier = 'test-user-2';

      const result1 = limiter.checkLimit(identifier);
      const result2 = limiter.checkLimit(identifier);

      expect(result2.remaining).toBe(result1.remaining - 1);
    });

    it('should provide reset timestamp', () => {
      const limiter = rateLimiter;
      const identifier = 'test-user-3';

      const result = limiter.checkLimit(identifier);

      expect(result.resetTime).toBeGreaterThan(Date.now());
    });

    it('should enforce limit after max requests', () => {
      const limiter = rateLimiter;
      const identifier = 'test-user-4';
      const maxRequests = 100; // From env.RATE_LIMIT_MAX

      // Make max requests
      for (let i = 0; i < maxRequests; i++) {
        limiter.checkLimit(identifier);
      }

      // Next request should be denied
      const result = limiter.checkLimit(identifier);
      expect(result.allowed).toBe(false);
    });
  });
});
