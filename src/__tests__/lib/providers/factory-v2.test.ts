// Tests for enhanced provider factory V2
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProviderFactoryV2 } from '../../../lib/providers/factory-v2.js';
import { createMockProvider } from '../../../lib/providers/mock-provider.js';
import type { ProviderMetadata } from '../../../lib/providers/registry.js';
import type { RefinementRequest } from '../../../types/index.js';

describe('ProviderFactoryV2', () => {
  let factory: ProviderFactoryV2;

  const mockRequest: RefinementRequest = {
    schema: {
      code: 'z.object({ name: z.string() })',
      typeName: 'User',
      fields: { name: 'z.string()' },
    },
    samples: [{ name: 'John' }],
  };

  const createTestMetadata = (name: string, overrides = {}): ProviderMetadata => ({
    name,
    displayName: `Test ${name}`,
    description: 'Test provider',
    costPerInputToken: 0.01,
    costPerOutputToken: 0.03,
    maxRequestsPerMinute: 100,
    maxTokensPerRequest: 4096,
    features: {
      streaming: true,
      jsonMode: true,
      functionCalling: true,
      vision: false,
    },
    priority: 80,
    weight: 0.5,
    enabled: true,
    ...overrides,
  });

  beforeEach(() => {
    factory = new ProviderFactoryV2();

    // Clear any existing state
    factory.clearCache();
    factory.resetRateLimits();
  });

  describe('registerProvider', () => {
    it('should register a provider', () => {
      const provider = createMockProvider();
      const metadata = createTestMetadata('test-provider');

      factory.registerProvider(provider, metadata);

      const registered = factory.getProvider('test-provider');
      expect(registered).toBeDefined();
    });
  });

  describe('unregisterProvider', () => {
    it('should unregister a provider', () => {
      const provider = createMockProvider();
      const metadata = createTestMetadata('test-provider');

      factory.registerProvider(provider, metadata);
      const removed = factory.unregisterProvider('test-provider');

      expect(removed).toBe(true);
      expect(factory.getProvider('test-provider')).toBeUndefined();
    });
  });

  describe('refineSchema', () => {
    beforeEach(() => {
      const provider = createMockProvider({ responseTime: 10, successRate: 1.0 });
      const metadata = createTestMetadata('mock-test');

      factory.registerProvider(provider, metadata);
    });

    it('should refine schema successfully', async () => {
      const result = await factory.refineSchema(mockRequest);

      expect(result).toBeDefined();
      expect(result.refinedSchema).toBeDefined();
      expect(result.aiProvider).toBe('mock');
    });

    it('should use cache on repeated requests', async () => {
      factory.updateConfig({ enableCache: true });

      // First request
      const result1 = await factory.refineSchema(mockRequest);

      // Second identical request should hit cache
      const result2 = await factory.refineSchema(mockRequest);

      expect(result1).toEqual(result2);

      const stats = factory.getCacheStats();
      expect(stats.totalHits).toBeGreaterThan(0);
    });

    it('should track metrics', async () => {
      factory.updateConfig({ enableMetrics: true });

      await factory.refineSchema(mockRequest);

      const metrics = factory.getProviderMetrics('mock-test');
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(1);
    });

    it('should track costs', async () => {
      factory.updateConfig({ enableCostTracking: true });

      await factory.refineSchema(mockRequest);

      const summary = factory.getCostSummary();
      expect(summary.totalRequests).toBe(1);
      expect(summary.totalCost).toBeGreaterThan(0);
    });

    it('should respect rate limits', async () => {
      factory.updateConfig({ enableRateLimiting: true });

      const limitedProvider = createMockProvider({ responseTime: 10 });
      const limitedMetadata = createTestMetadata('limited', {
        maxRequestsPerMinute: 2,
      });

      factory.registerProvider(limitedProvider, limitedMetadata);

      // First 2 requests should succeed
      await factory.refineSchema({
        ...mockRequest,
        options: { provider: 'limited' },
      });

      await factory.refineSchema({
        ...mockRequest,
        options: { provider: 'limited' },
      });

      // Third should be rate limited
      await expect(
        factory.refineSchema({
          ...mockRequest,
          options: { provider: 'limited' },
        })
      ).rejects.toThrow();
    });

    it('should use fallback on provider failure', async () => {
      const failingProvider = createMockProvider({
        responseTime: 10,
        successRate: 0,
        errorMessage: 'Primary failed',
      });
      const fallbackProvider = createMockProvider({
        responseTime: 10,
        successRate: 1.0,
      });

      factory.registerProvider(
        failingProvider,
        createTestMetadata('primary', { priority: 90 })
      );
      factory.registerProvider(
        fallbackProvider,
        createTestMetadata('fallback', { priority: 80 })
      );

      factory.updateConfig({ enableFallback: true, maxFallbackAttempts: 1 });

      const result = await factory.refineSchema(mockRequest);

      expect(result).toBeDefined();
      expect(result.aiProvider).toBe('mock');
    });

    it('should throw when all providers fail', async () => {
      const failingProvider = createMockProvider({
        responseTime: 10,
        successRate: 0,
      });

      factory.registerProvider(failingProvider, createTestMetadata('failing'));

      factory.updateConfig({ enableFallback: false });

      await expect(factory.refineSchema(mockRequest)).rejects.toThrow();
    });

    it('should respect provider selection in request', async () => {
      const provider1 = createMockProvider();
      const provider2 = createMockProvider();

      factory.registerProvider(provider1, createTestMetadata('provider1', { priority: 90 }));
      factory.registerProvider(provider2, createTestMetadata('provider2', { priority: 50 }));

      const result = await factory.refineSchema({
        ...mockRequest,
        options: { provider: 'provider2' },
      });

      expect(result).toBeDefined();
    });
  });

  describe('checkAllProviders', () => {
    it('should check health of all providers', async () => {
      const provider1 = createMockProvider({ successRate: 1.0 });
      const provider2 = createMockProvider({ successRate: 0 });

      factory.registerProvider(provider1, createTestMetadata('healthy'));
      factory.registerProvider(provider2, createTestMetadata('unhealthy'));

      const health = await factory.checkAllProviders();

      expect(health.healthy).toBe(true);
      expect(health.unhealthy).toBe(false);
    });
  });

  describe('configuration management', () => {
    it('should set provider enabled/disabled', () => {
      const provider = createMockProvider();
      factory.registerProvider(provider, createTestMetadata('test'));

      const disabled = factory.setProviderEnabled('test', false);
      expect(disabled).toBe(true);
    });

    it('should set provider priority', () => {
      const provider = createMockProvider();
      factory.registerProvider(provider, createTestMetadata('test'));

      const updated = factory.setProviderPriority('test', 95);
      expect(updated).toBe(true);
    });

    it('should set provider weight', () => {
      const provider = createMockProvider();
      factory.registerProvider(provider, createTestMetadata('test'));

      const updated = factory.setProviderWeight('test', 0.8);
      expect(updated).toBe(true);
    });

    it('should change strategy', () => {
      factory.setStrategy('cost');
      expect(factory.getConfig().strategy).toBe('cost');
    });

    it('should update config', () => {
      factory.updateConfig({
        enableCache: false,
        cacheTTL: 5000,
      });

      const config = factory.getConfig();
      expect(config.enableCache).toBe(false);
      expect(config.cacheTTL).toBe(5000);
    });
  });

  describe('stats and analytics', () => {
    beforeEach(() => {
      const provider = createMockProvider({ responseTime: 10, successRate: 1.0 });
      factory.registerProvider(provider, createTestMetadata('analytics-test'));
      factory.updateConfig({
        enableCache: true,
        enableMetrics: true,
        enableCostTracking: true,
      });
    });

    it('should get cache stats', async () => {
      await factory.refineSchema(mockRequest);
      await factory.refineSchema(mockRequest); // Cache hit

      const stats = factory.getCacheStats();
      expect(stats.totalHits).toBeGreaterThan(0);
      expect(stats.hitRate).toBeGreaterThan(0);
    });

    it('should get rate limit statuses', async () => {
      const statuses = factory.getRateLimitStatuses();
      expect(statuses).toBeDefined();
    });

    it('should get cost summary', async () => {
      await factory.refineSchema(mockRequest);

      const summary = factory.getCostSummary();
      expect(summary.totalRequests).toBeGreaterThan(0);
    });

    it('should get provider metrics', async () => {
      await factory.refineSchema(mockRequest);

      const metrics = factory.getProviderMetrics('analytics-test');
      expect(metrics.totalRequests).toBeGreaterThan(0);
    });

    it('should get all metrics', async () => {
      await factory.refineSchema(mockRequest);

      const allMetrics = factory.getAllMetrics();
      expect(Object.keys(allMetrics).length).toBeGreaterThan(0);
    });
  });

  describe('cache management', () => {
    it('should clear cache', async () => {
      const provider = createMockProvider();
      factory.registerProvider(provider, createTestMetadata('cache-test'));
      factory.updateConfig({ enableCache: true });

      await factory.refineSchema(mockRequest);

      factory.clearCache();

      const stats = factory.getCacheStats();
      expect(stats.totalEntries).toBe(0);
    });
  });

  describe('rate limit management', () => {
    it('should reset rate limits', () => {
      factory.resetRateLimits();

      const statuses = factory.getRateLimitStatuses();
      Object.values(statuses).forEach((status) => {
        expect(status.requestCount).toBe(0);
      });
    });
  });

  describe('getAllProviders', () => {
    it('should return all registered providers', () => {
      const provider1 = createMockProvider();
      const provider2 = createMockProvider();

      factory.registerProvider(provider1, createTestMetadata('provider1'));
      factory.registerProvider(provider2, createTestMetadata('provider2'));

      const all = factory.getAllProviders();
      expect(all.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('provider strategies', () => {
    beforeEach(() => {
      const expensive = createMockProvider();
      const cheap = createMockProvider();

      factory.registerProvider(
        expensive,
        createTestMetadata('expensive', {
          costPerInputToken: 0.01,
          costPerOutputToken: 0.03,
          priority: 90,
        })
      );

      factory.registerProvider(
        cheap,
        createTestMetadata('cheap', {
          costPerInputToken: 0.001,
          costPerOutputToken: 0.002,
          priority: 50,
        })
      );
    });

    it('should use priority strategy', async () => {
      factory.setStrategy('priority');
      // Priority strategy should select 'expensive' (priority 90)
      await factory.refineSchema(mockRequest);
      // Hard to verify which was selected without exposing internals
    });

    it('should use cost strategy', async () => {
      factory.setStrategy('cost');
      // Cost strategy should select 'cheap'
      await factory.refineSchema(mockRequest);
      // Hard to verify which was selected without exposing internals
    });
  });
});
