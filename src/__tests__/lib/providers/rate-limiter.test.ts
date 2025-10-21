// Tests for rate limiter
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RateLimiter } from '../../../lib/providers/rate-limiter.js';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('setLimit', () => {
    it('should set rate limit for a provider', () => {
      limiter.setLimit('test-provider', {
        maxRequests: 10,
        windowMs: 60000,
        enabled: true,
      });

      const status = limiter.getStatus('test-provider');
      expect(status).not.toBeNull();
      expect(status?.maxRequests).toBe(10);
      expect(status?.windowMs).toBe(60000);
    });
  });

  describe('checkLimit', () => {
    it('should allow requests under limit', async () => {
      limiter.setLimit('test-provider', {
        maxRequests: 5,
        windowMs: 60000,
        enabled: true,
      });

      for (let i = 0; i < 5; i++) {
        const result = await limiter.checkLimit('test-provider');
        expect(result.allowed).toBe(true);
      }
    });

    it('should block requests over limit', async () => {
      limiter.setLimit('test-provider', {
        maxRequests: 3,
        windowMs: 60000,
        enabled: true,
      });

      // Use up the limit
      for (let i = 0; i < 3; i++) {
        await limiter.checkLimit('test-provider');
      }

      // Next request should be blocked
      const result = await limiter.checkLimit('test-provider');
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should allow requests when disabled', async () => {
      limiter.setLimit('test-provider', {
        maxRequests: 1,
        windowMs: 60000,
        enabled: false,
      });

      // Should allow multiple requests even though limit is 1
      const result1 = await limiter.checkLimit('test-provider');
      const result2 = await limiter.checkLimit('test-provider');
      const result3 = await limiter.checkLimit('test-provider');

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
      expect(result3.allowed).toBe(true);
    });

    it('should allow requests when no limit configured', async () => {
      const result = await limiter.checkLimit('no-limit-provider');
      expect(result.allowed).toBe(true);
    });

    it('should respect sliding window', async () => {
      limiter.setLimit('test-provider', {
        maxRequests: 2,
        windowMs: 100,
        enabled: true,
      });

      // Use up limit
      await limiter.checkLimit('test-provider');
      await limiter.checkLimit('test-provider');

      // Should be blocked
      let result = await limiter.checkLimit('test-provider');
      expect(result.allowed).toBe(false);

      // Wait for window to pass
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should be allowed again
      result = await limiter.checkLimit('test-provider');
      expect(result.allowed).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset rate limit for a provider', async () => {
      limiter.setLimit('test-provider', {
        maxRequests: 1,
        windowMs: 60000,
        enabled: true,
      });

      await limiter.checkLimit('test-provider');

      // Should be blocked
      let result = await limiter.checkLimit('test-provider');
      expect(result.allowed).toBe(false);

      // Reset
      limiter.reset('test-provider');

      // Should be allowed again
      result = await limiter.checkLimit('test-provider');
      expect(result.allowed).toBe(true);
    });
  });

  describe('resetAll', () => {
    it('should reset all rate limits', async () => {
      limiter.setLimit('provider1', { maxRequests: 1, windowMs: 60000, enabled: true });
      limiter.setLimit('provider2', { maxRequests: 1, windowMs: 60000, enabled: true });

      await limiter.checkLimit('provider1');
      await limiter.checkLimit('provider2');

      limiter.resetAll();

      const result1 = await limiter.checkLimit('provider1');
      const result2 = await limiter.checkLimit('provider2');

      expect(result1.allowed).toBe(true);
      expect(result2.allowed).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should return current status', async () => {
      limiter.setLimit('test-provider', {
        maxRequests: 5,
        windowMs: 60000,
        enabled: true,
      });

      await limiter.checkLimit('test-provider');
      await limiter.checkLimit('test-provider');

      const status = limiter.getStatus('test-provider');
      expect(status).not.toBeNull();
      expect(status?.requestCount).toBe(2);
      expect(status?.maxRequests).toBe(5);
      expect(status?.blocked).toBe(false);
    });

    it('should return null for non-configured provider', () => {
      const status = limiter.getStatus('non-existent');
      expect(status).toBeNull();
    });
  });

  describe('getAllStatuses', () => {
    it('should return statuses for all providers', async () => {
      limiter.setLimit('provider1', { maxRequests: 10, windowMs: 60000, enabled: true });
      limiter.setLimit('provider2', { maxRequests: 20, windowMs: 60000, enabled: true });

      await limiter.checkLimit('provider1');

      const statuses = limiter.getAllStatuses();
      expect(Object.keys(statuses)).toHaveLength(2);
      expect(statuses.provider1.requestCount).toBe(1);
      expect(statuses.provider2.requestCount).toBe(0);
    });
  });

  describe('blocked state', () => {
    it('should set blocked state when limit exceeded', async () => {
      limiter.setLimit('test-provider', {
        maxRequests: 1,
        windowMs: 60000,
        enabled: true,
      });

      await limiter.checkLimit('test-provider');
      await limiter.checkLimit('test-provider');

      const status = limiter.getStatus('test-provider');
      expect(status?.blocked).toBe(true);
    });

    it('should unblock after window expires', async () => {
      limiter.setLimit('test-provider', {
        maxRequests: 1,
        windowMs: 100,
        enabled: true,
      });

      await limiter.checkLimit('test-provider');
      await limiter.checkLimit('test-provider'); // Blocked

      await new Promise((resolve) => setTimeout(resolve, 150));

      const result = await limiter.checkLimit('test-provider');
      expect(result.allowed).toBe(true);

      const status = limiter.getStatus('test-provider');
      expect(status?.blocked).toBe(false);
    });
  });
});
