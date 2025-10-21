// Tests for response cache
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ResponseCache } from '../../../lib/providers/cache.js';
import type { RefinementRequest } from '../../../types/index.js';

describe('ResponseCache', () => {
  let cache: ResponseCache;

  const mockRequest: RefinementRequest = {
    schema: {
      code: 'z.object({ name: z.string() })',
      typeName: 'User',
      fields: { name: 'z.string()' },
    },
    samples: [{ name: 'John' }],
  };

  const mockResponse = {
    refinedSchema: {
      code: 'z.object({ name: z.string().min(1) })',
      improvements: [],
      confidence: 0.9,
    },
    suggestions: [],
    creditsUsed: 1,
    creditsRemaining: 99,
    processingTime: 100,
    aiProvider: 'openai' as const,
  };

  beforeEach(() => {
    cache = new ResponseCache({
      maxEntries: 10,
      defaultTTL: 1000,
      enabled: true,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('set and get', () => {
    it('should cache and retrieve a response', () => {
      cache.set(mockRequest, mockResponse);
      const result = cache.get(mockRequest);

      expect(result).toEqual(mockResponse);
    });

    it('should return null for cache miss', () => {
      const result = cache.get(mockRequest);
      expect(result).toBeNull();
    });

    it('should differentiate requests by content', () => {
      const request1 = { ...mockRequest };
      const request2 = {
        ...mockRequest,
        samples: [{ name: 'Jane' }],
      };

      cache.set(request1, mockResponse);

      expect(cache.get(request1)).toEqual(mockResponse);
      expect(cache.get(request2)).toBeNull();
    });

    it('should respect TTL', async () => {
      cache.set(mockRequest, mockResponse, 100);

      expect(cache.get(mockRequest)).toEqual(mockResponse);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(cache.get(mockRequest)).toBeNull();
    });
  });

  describe('eviction', () => {
    it('should evict oldest entry when max entries reached', () => {
      const cache = new ResponseCache({ maxEntries: 3, defaultTTL: 10000, enabled: true });

      // Add 3 entries
      for (let i = 0; i < 3; i++) {
        const request = {
          ...mockRequest,
          schema: { ...mockRequest.schema, typeName: `User${i}` },
        };
        cache.set(request, mockResponse);
      }

      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(3);

      // Add 4th entry - should evict first
      const request4 = {
        ...mockRequest,
        schema: { ...mockRequest.schema, typeName: 'User3' },
      };
      cache.set(request4, mockResponse);

      expect(cache.getStats().totalEntries).toBe(3);
    });
  });

  describe('stats', () => {
    it('should track hits and misses', () => {
      cache.set(mockRequest, mockResponse);

      cache.get(mockRequest); // hit
      cache.get(mockRequest); // hit
      cache.get({ ...mockRequest, samples: [{ name: 'Jane' }] }); // miss

      const stats = cache.getStats();
      expect(stats.totalHits).toBe(2);
      expect(stats.totalMisses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(2 / 3);
    });

    it('should calculate correct hit rate', () => {
      cache.set(mockRequest, mockResponse);

      // 7 hits
      for (let i = 0; i < 7; i++) {
        cache.get(mockRequest);
      }

      // 3 misses
      for (let i = 0; i < 3; i++) {
        cache.get({ ...mockRequest, samples: [{ name: `User${i}` }] });
      }

      const stats = cache.getStats();
      expect(stats.hitRate).toBeCloseTo(0.7);
    });

    it('should return 0 hit rate when no requests', () => {
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('invalidate', () => {
    it('should invalidate cached entry', () => {
      cache.set(mockRequest, mockResponse);

      expect(cache.get(mockRequest)).toEqual(mockResponse);

      const invalidated = cache.invalidate(mockRequest);
      expect(invalidated).toBe(true);
      expect(cache.get(mockRequest)).toBeNull();
    });

    it('should return false when invalidating non-existent entry', () => {
      const invalidated = cache.invalidate(mockRequest);
      expect(invalidated).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all entries', () => {
      cache.set(mockRequest, mockResponse);
      cache.set({ ...mockRequest, samples: [{ name: 'Jane' }] }, mockResponse);

      cache.clear();

      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.totalHits).toBe(0);
      expect(stats.totalMisses).toBe(0);
    });
  });

  describe('setEnabled', () => {
    it('should disable caching', () => {
      cache.setEnabled(false);
      cache.set(mockRequest, mockResponse);

      expect(cache.get(mockRequest)).toBeNull();
    });

    it('should enable caching', () => {
      cache.setEnabled(false);
      cache.setEnabled(true);
      cache.set(mockRequest, mockResponse);

      expect(cache.get(mockRequest)).toEqual(mockResponse);
    });
  });

  describe('prune', () => {
    it('should remove expired entries', async () => {
      cache.set(mockRequest, mockResponse, 100);
      cache.set({ ...mockRequest, samples: [{ name: 'Jane' }] }, mockResponse, 10000);

      await new Promise((resolve) => setTimeout(resolve, 150));

      const pruned = cache.prune();
      expect(pruned).toBe(1);

      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(1);
    });

    it('should not remove unexpired entries', () => {
      cache.set(mockRequest, mockResponse, 10000);

      const pruned = cache.prune();
      expect(pruned).toBe(0);

      const stats = cache.getStats();
      expect(stats.totalEntries).toBe(1);
    });
  });

  describe('updateConfig', () => {
    it('should update cache configuration', () => {
      cache.updateConfig({
        maxEntries: 20,
        defaultTTL: 5000,
      });

      // Config is updated (internal state)
      cache.set(mockRequest, mockResponse);
      expect(cache.getStats().totalEntries).toBe(1);
    });
  });

  describe('LRU behavior', () => {
    it('should move accessed entry to end (most recent)', () => {
      const cache = new ResponseCache({ maxEntries: 2, defaultTTL: 10000, enabled: true });

      const request1 = { ...mockRequest, schema: { ...mockRequest.schema, typeName: 'User1' } };
      const request2 = { ...mockRequest, schema: { ...mockRequest.schema, typeName: 'User2' } };

      cache.set(request1, mockResponse);
      cache.set(request2, mockResponse);

      // Access request1 (moves to end)
      cache.get(request1);

      // Add new entry - should evict request2 (oldest)
      const request3 = { ...mockRequest, schema: { ...mockRequest.schema, typeName: 'User3' } };
      cache.set(request3, mockResponse);

      expect(cache.get(request1)).toEqual(mockResponse); // Still in cache
      expect(cache.get(request2)).toBeNull(); // Evicted
      expect(cache.get(request3)).toEqual(mockResponse); // New entry
    });
  });
});
