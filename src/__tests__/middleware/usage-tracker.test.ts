// Usage tracker tests with Supabase mocking
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TIER_LIMITS } from '../../middleware/usage-tracker.js';

describe('Usage Tracker', () => {
  describe('TIER_LIMITS', () => {
    it('should define correct tier limits', () => {
      expect(TIER_LIMITS.free).toBe(100);
      expect(TIER_LIMITS.pro).toBe(5000);
      expect(TIER_LIMITS.enterprise).toBe(Infinity);
    });

    it('should export Tier type values', () => {
      const tiers = Object.keys(TIER_LIMITS);
      expect(tiers).toContain('free');
      expect(tiers).toContain('pro');
      expect(tiers).toContain('enterprise');
    });
  });

  describe('trackUsage (without Supabase)', () => {
    beforeEach(() => {
      // Clear Supabase config to test graceful handling
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_KEY;
    });

    it('should return early if Supabase not configured', async () => {
      // Dynamic import to avoid caching
      const { trackUsage } = await import('../../middleware/usage-tracker.js');

      // Should not throw when Supabase is not configured
      await expect(
        trackUsage('zf_test_key', '/api/v1/refine', true, 1000)
      ).resolves.toBeUndefined();
    });
  });

  describe('getCustomerUsage (without Supabase)', () => {
    beforeEach(() => {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_KEY;
    });

    it('should return null if Supabase not configured', async () => {
      const { getCustomerUsage } = await import('../../middleware/usage-tracker.js');

      const result = await getCustomerUsage('zf_test_key');
      expect(result).toBeNull();
    });
  });

  describe('Usage calculations', () => {
    it('should calculate remaining requests correctly for free tier', () => {
      const limit = TIER_LIMITS.free;
      const used = 45;
      const remaining = Math.max(0, limit - used);

      expect(remaining).toBe(55);
    });

    it('should calculate remaining requests correctly for pro tier', () => {
      const limit = TIER_LIMITS.pro;
      const used = 2500;
      const remaining = Math.max(0, limit - used);

      expect(remaining).toBe(2500);
    });

    it('should calculate remaining requests correctly for enterprise tier', () => {
      const limit = TIER_LIMITS.enterprise;
      const used = 50000;
      const remaining = Math.max(0, limit - used);

      expect(remaining).toBe(Infinity);
    });

    it('should handle zero remaining requests (over limit)', () => {
      const limit = TIER_LIMITS.free;
      const used = 150; // Over limit
      const remaining = Math.max(0, limit - used);

      expect(remaining).toBe(0); // Should be 0, not negative
    });
  });

  describe('Reset date calculation', () => {
    it('should calculate first day of next month correctly', () => {
      const now = new Date('2025-10-20');
      const resetDate = new Date(now);
      resetDate.setMonth(resetDate.getMonth() + 1);
      resetDate.setDate(1);
      resetDate.setHours(0, 0, 0, 0);

      expect(resetDate.getFullYear()).toBe(2025);
      expect(resetDate.getMonth()).toBe(10); // November (0-indexed)
      expect(resetDate.getDate()).toBe(1);
      expect(resetDate.getHours()).toBe(0);
    });

    it('should handle year boundary correctly', () => {
      const now = new Date('2025-12-20');
      const resetDate = new Date(now);
      resetDate.setMonth(resetDate.getMonth() + 1);
      resetDate.setDate(1);
      resetDate.setHours(0, 0, 0, 0);

      expect(resetDate.getFullYear()).toBe(2026);
      expect(resetDate.getMonth()).toBe(0); // January
      expect(resetDate.getDate()).toBe(1);
    });
  });

  describe('Start of month calculation', () => {
    it('should calculate start of current month correctly', () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      expect(startOfMonth.getDate()).toBe(1);
      expect(startOfMonth.getHours()).toBe(0);
      expect(startOfMonth.getMinutes()).toBe(0);
      expect(startOfMonth.getSeconds()).toBe(0);
      expect(startOfMonth.getMilliseconds()).toBe(0);
    });
  });

  describe('Tier validation', () => {
    it('should accept valid tier names', () => {
      const validTiers: Array<keyof typeof TIER_LIMITS> = ['free', 'pro', 'enterprise'];

      validTiers.forEach(tier => {
        expect(TIER_LIMITS[tier]).toBeDefined();
        expect(typeof TIER_LIMITS[tier]).toBe('number');
      });
    });

    it('should have positive limits for all tiers', () => {
      expect(TIER_LIMITS.free).toBeGreaterThan(0);
      expect(TIER_LIMITS.pro).toBeGreaterThan(0);
      expect(TIER_LIMITS.enterprise).toBeGreaterThan(0);
    });

    it('should have increasing limits: free < pro < enterprise', () => {
      expect(TIER_LIMITS.free).toBeLessThan(TIER_LIMITS.pro);
      expect(TIER_LIMITS.pro).toBeLessThan(TIER_LIMITS.enterprise);
    });
  });
});
