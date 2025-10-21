// Tests for mock provider
import { describe, it, expect, beforeEach } from 'vitest';
import { MockProvider, createMockProvider } from '../../../lib/providers/mock-provider.js';
import type { RefinementRequest } from '../../../types/index.js';

describe('MockProvider', () => {
  let provider: MockProvider;

  const mockRequest: RefinementRequest = {
    schema: {
      code: 'z.object({ name: z.string() })',
      typeName: 'User',
      fields: { name: 'z.string()' },
    },
    samples: [{ name: 'John' }],
  };

  beforeEach(() => {
    provider = new MockProvider({
      responseTime: 10,
      successRate: 1.0,
      enableStreaming: true,
    });
  });

  describe('refineSchema', () => {
    it('should return mock response', async () => {
      const result = await provider.refineSchema(mockRequest);

      expect(result).toBeDefined();
      expect(result.refinedSchema).toBeDefined();
      expect(result.suggestions).toBeDefined();
      expect(result.processingTime).toBeDefined();
      expect(result.aiProvider).toBe('mock');
    });

    it('should simulate response time', async () => {
      const slowProvider = new MockProvider({ responseTime: 100 });

      const start = Date.now();
      await slowProvider.refineSchema(mockRequest);
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(90);
    });

    it('should simulate failures based on success rate', async () => {
      const unreliableProvider = new MockProvider({
        responseTime: 10,
        successRate: 0,
      });

      await expect(unreliableProvider.refineSchema(mockRequest)).rejects.toThrow(
        'Simulated mock provider failure'
      );
    });

    it('should use custom error message', async () => {
      const customProvider = new MockProvider({
        responseTime: 10,
        successRate: 0,
        errorMessage: 'Custom error',
      });

      await expect(customProvider.refineSchema(mockRequest)).rejects.toThrow('Custom error');
    });

    it('should use predefined response if provided', async () => {
      const customResponse = {
        refinedSchema: {
          code: 'z.object({ name: z.string().min(3) })',
          improvements: [],
          confidence: 1.0,
        },
        suggestions: ['Custom suggestion'],
        creditsUsed: 5,
        creditsRemaining: 95,
        processingTime: 100,
        aiProvider: 'mock' as const,
      };

      const customProvider = new MockProvider({
        responseTime: 10,
        mockResponse: customResponse,
      });

      const result = await customProvider.refineSchema(mockRequest);
      expect(result.suggestions).toEqual(['Custom suggestion']);
      expect(result.creditsUsed).toBe(5);
    });

    it('should track request count', async () => {
      expect(provider.getRequestCount()).toBe(0);

      await provider.refineSchema(mockRequest);
      expect(provider.getRequestCount()).toBe(1);

      await provider.refineSchema(mockRequest);
      expect(provider.getRequestCount()).toBe(2);
    });
  });

  describe('refineSchemaStream', () => {
    it('should stream mock responses', async () => {
      const chunks: string[] = [];

      for await (const chunk of provider.refineSchemaStream(mockRequest)) {
        chunks.push(chunk.delta);

        if (chunk.done) {
          break;
        }
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toBe('Mock streaming response');
    });

    it('should throw when streaming not enabled', async () => {
      const nonStreamingProvider = new MockProvider({ enableStreaming: false });

      await expect(async () => {
        for await (const _ of nonStreamingProvider.refineSchemaStream(mockRequest)) {
          // Should not reach here
        }
      }).rejects.toThrow('Streaming not enabled');
    });

    it('should track request count for streaming', async () => {
      expect(provider.getRequestCount()).toBe(0);

      for await (const chunk of provider.refineSchemaStream(mockRequest)) {
        if (chunk.done) break;
      }

      expect(provider.getRequestCount()).toBe(1);
    });
  });

  describe('checkHealth', () => {
    it('should return true for healthy provider', async () => {
      const health = await provider.checkHealth();
      expect(health).toBe(true);
    });

    it('should return false for unhealthy provider', async () => {
      const unhealthyProvider = new MockProvider({ successRate: 0 });
      const health = await unhealthyProvider.checkHealth();
      expect(health).toBe(false);
    });
  });

  describe('getCapabilities', () => {
    it('should return capabilities', () => {
      const capabilities = provider.getCapabilities();

      expect(capabilities.supportsStreaming).toBe(true);
      expect(capabilities.supportsJsonMode).toBe(true);
      expect(capabilities.supportsFunctionCalling).toBe(false);
      expect(capabilities.supportsVision).toBe(false);
    });

    it('should reflect streaming config', () => {
      const nonStreaming = new MockProvider({ enableStreaming: false });
      expect(nonStreaming.getCapabilities().supportsStreaming).toBe(false);
    });
  });

  describe('resetRequestCount', () => {
    it('should reset request counter', async () => {
      await provider.refineSchema(mockRequest);
      await provider.refineSchema(mockRequest);

      expect(provider.getRequestCount()).toBe(2);

      provider.resetRequestCount();
      expect(provider.getRequestCount()).toBe(0);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', async () => {
      provider.updateConfig({
        responseTime: 50,
        successRate: 0.5,
      });

      // New config should be used
      const start = Date.now();
      try {
        await provider.refineSchema(mockRequest);
      } catch {
        // May fail due to lower success rate
      }
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(40);
    });
  });

  describe('createMockProvider factory', () => {
    it('should create mock provider with config', () => {
      const created = createMockProvider({
        responseTime: 200,
        successRate: 0.8,
      });

      expect(created).toBeInstanceOf(MockProvider);
      expect(created.name).toBe('mock');
    });

    it('should create with default config', () => {
      const created = createMockProvider();
      expect(created).toBeInstanceOf(MockProvider);
    });
  });

  describe('generated mock response', () => {
    it('should generate improvements for all fields', async () => {
      const multiFieldRequest: RefinementRequest = {
        schema: {
          code: 'z.object({ name: z.string(), age: z.number() })',
          typeName: 'User',
          fields: { name: 'z.string()', age: 'z.number()' },
        },
        samples: [{ name: 'John', age: 30 }],
      };

      const result = await provider.refineSchema(multiFieldRequest);

      expect(result.refinedSchema?.improvements).toHaveLength(2);
      expect(result.refinedSchema?.improvements.map((i) => i.field)).toContain('name');
      expect(result.refinedSchema?.improvements.map((i) => i.field)).toContain('age');
    });

    it('should include mock suggestions', async () => {
      const result = await provider.refineSchema(mockRequest);

      expect(result.suggestions).toEqual([
        'Mock suggestion: Consider adding validation',
        'Mock suggestion: Add defaults',
      ]);
    });

    it('should have consistent confidence', async () => {
      const result = await provider.refineSchema(mockRequest);

      expect(result.refinedSchema?.confidence).toBe(0.85);
      result.refinedSchema?.improvements.forEach((improvement) => {
        expect(improvement.confidence).toBe(0.85);
      });
    });
  });
});
