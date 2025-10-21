// Tests for provider registry
import { describe, it, expect, beforeEach } from 'vitest';
import { ProviderRegistry, type ProviderMetadata } from '../../../lib/providers/registry.js';
import { mockProvider } from '../../../lib/providers/mock-provider.js';

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;
  const mockMetadata: ProviderMetadata = {
    name: 'test-provider',
    displayName: 'Test Provider',
    description: 'Provider for testing',
    costPerInputToken: 0.001,
    costPerOutputToken: 0.002,
    maxRequestsPerMinute: 100,
    maxTokensPerRequest: 4096,
    features: {
      streaming: true,
      jsonMode: true,
      functionCalling: false,
      vision: false,
    },
    priority: 80,
    weight: 0.5,
    enabled: true,
  };

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  describe('register', () => {
    it('should register a provider', () => {
      registry.register(mockProvider, mockMetadata);

      const provider = registry.getProvider('test-provider');
      expect(provider).toBeDefined();
      expect(provider?.name).toBe('mock');
    });

    it('should allow overwriting an existing provider', () => {
      registry.register(mockProvider, mockMetadata);
      registry.register(mockProvider, { ...mockMetadata, priority: 90 });

      const metadata = registry.getMetadata('test-provider');
      expect(metadata?.priority).toBe(90);
    });
  });

  describe('unregister', () => {
    it('should unregister a provider', () => {
      registry.register(mockProvider, mockMetadata);
      const removed = registry.unregister('test-provider');

      expect(removed).toBe(true);
      expect(registry.getProvider('test-provider')).toBeUndefined();
    });

    it('should return false when unregistering non-existent provider', () => {
      const removed = registry.unregister('non-existent');
      expect(removed).toBe(false);
    });
  });

  describe('getProvider', () => {
    it('should get a registered provider', () => {
      registry.register(mockProvider, mockMetadata);
      const provider = registry.getProvider('test-provider');

      expect(provider).toBeDefined();
      expect(provider?.name).toBe('mock');
    });

    it('should return undefined for non-existent provider', () => {
      const provider = registry.getProvider('non-existent');
      expect(provider).toBeUndefined();
    });
  });

  describe('getMetadata', () => {
    it('should get provider metadata', () => {
      registry.register(mockProvider, mockMetadata);
      const metadata = registry.getMetadata('test-provider');

      expect(metadata).toBeDefined();
      expect(metadata?.displayName).toBe('Test Provider');
      expect(metadata?.priority).toBe(80);
    });
  });

  describe('getAllProviders', () => {
    it('should return all registered providers', () => {
      const metadata2 = { ...mockMetadata, name: 'test-provider-2' };

      registry.register(mockProvider, mockMetadata);
      registry.register(mockProvider, metadata2);

      const providers = registry.getAllProviders();
      expect(providers).toHaveLength(2);
    });

    it('should return empty array when no providers registered', () => {
      const providers = registry.getAllProviders();
      expect(providers).toHaveLength(0);
    });
  });

  describe('getEnabledProviders', () => {
    it('should return only enabled providers', () => {
      const enabledMetadata = { ...mockMetadata, name: 'enabled', enabled: true };
      const disabledMetadata = { ...mockMetadata, name: 'disabled', enabled: false };

      registry.register(mockProvider, enabledMetadata);
      registry.register(mockProvider, disabledMetadata);

      const enabled = registry.getEnabledProviders();
      expect(enabled).toHaveLength(1);
      expect(enabled[0].name).toBe('enabled');
    });

    it('should sort by priority (highest first)', () => {
      const lowPriority = { ...mockMetadata, name: 'low', priority: 50 };
      const highPriority = { ...mockMetadata, name: 'high', priority: 90 };

      registry.register(mockProvider, lowPriority);
      registry.register(mockProvider, highPriority);

      const enabled = registry.getEnabledProviders();
      expect(enabled[0].name).toBe('high');
      expect(enabled[1].name).toBe('low');
    });
  });

  describe('getProvidersByFeature', () => {
    it('should return providers that support a feature', () => {
      const streamingProvider = {
        ...mockMetadata,
        name: 'streaming',
        features: { ...mockMetadata.features, streaming: true },
      };
      const nonStreamingProvider = {
        ...mockMetadata,
        name: 'non-streaming',
        features: { ...mockMetadata.features, streaming: false },
      };

      registry.register(mockProvider, streamingProvider);
      registry.register(mockProvider, nonStreamingProvider);

      const providers = registry.getProvidersByFeature('streaming');
      expect(providers).toHaveLength(1);
      expect(providers[0]).toBe('streaming');
    });
  });

  describe('updateHealthStatus', () => {
    it('should update health status', () => {
      registry.register(mockProvider, mockMetadata);
      registry.updateHealthStatus('test-provider', true);

      const health = registry.getHealthStatus('test-provider');
      expect(health.isHealthy).toBe(true);
      expect(health.lastCheck).toBeInstanceOf(Date);
    });
  });

  describe('setEnabled', () => {
    it('should enable/disable a provider', () => {
      registry.register(mockProvider, mockMetadata);

      const disabled = registry.setEnabled('test-provider', false);
      expect(disabled).toBe(true);

      const metadata = registry.getMetadata('test-provider');
      expect(metadata?.enabled).toBe(false);
    });

    it('should return false for non-existent provider', () => {
      const result = registry.setEnabled('non-existent', false);
      expect(result).toBe(false);
    });
  });

  describe('setPriority', () => {
    it('should update provider priority', () => {
      registry.register(mockProvider, mockMetadata);
      registry.setPriority('test-provider', 95);

      const metadata = registry.getMetadata('test-provider');
      expect(metadata?.priority).toBe(95);
    });

    it('should clamp priority to 0-100 range', () => {
      registry.register(mockProvider, mockMetadata);

      registry.setPriority('test-provider', 150);
      expect(registry.getMetadata('test-provider')?.priority).toBe(100);

      registry.setPriority('test-provider', -10);
      expect(registry.getMetadata('test-provider')?.priority).toBe(0);
    });
  });

  describe('setWeight', () => {
    it('should update provider weight', () => {
      registry.register(mockProvider, mockMetadata);
      registry.setWeight('test-provider', 0.8);

      const metadata = registry.getMetadata('test-provider');
      expect(metadata?.weight).toBe(0.8);
    });

    it('should clamp weight to 0-1 range', () => {
      registry.register(mockProvider, mockMetadata);

      registry.setWeight('test-provider', 2.5);
      expect(registry.getMetadata('test-provider')?.weight).toBe(1);

      registry.setWeight('test-provider', -0.5);
      expect(registry.getMetadata('test-provider')?.weight).toBe(0);
    });
  });

  describe('getProviderCount', () => {
    it('should return correct provider count', () => {
      expect(registry.getProviderCount()).toBe(0);

      registry.register(mockProvider, mockMetadata);
      expect(registry.getProviderCount()).toBe(1);

      registry.register(mockProvider, { ...mockMetadata, name: 'test-2' });
      expect(registry.getProviderCount()).toBe(2);
    });
  });

  describe('clear', () => {
    it('should clear all providers', () => {
      registry.register(mockProvider, mockMetadata);
      registry.register(mockProvider, { ...mockMetadata, name: 'test-2' });

      registry.clear();
      expect(registry.getProviderCount()).toBe(0);
    });
  });
});
