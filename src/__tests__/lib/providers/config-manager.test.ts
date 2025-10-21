// Tests for configuration manager
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfigManager, type GlobalConfig } from '../../../lib/providers/config-manager.js';
import type { ProviderMetadata } from '../../../lib/providers/registry.js';

describe('ConfigManager', () => {
  let manager: ConfigManager;

  beforeEach(() => {
    manager = new ConfigManager();
  });

  describe('initialization', () => {
    it('should initialize with default config', () => {
      const config = manager.getConfig();

      expect(config.strategy).toBe('priority');
      expect(config.enableFallback).toBe(true);
      expect(config.enableCache).toBe(true);
      expect(config.enableRateLimiting).toBe(true);
      expect(config.enableCostTracking).toBe(true);
      expect(config.enableMetrics).toBe(true);
    });

    it('should accept initial config', () => {
      const custom = new ConfigManager({
        strategy: 'cost',
        enableCache: false,
      });

      const config = custom.getConfig();
      expect(config.strategy).toBe('cost');
      expect(config.enableCache).toBe(false);
      expect(config.enableFallback).toBe(true); // Default
    });
  });

  describe('updateConfig', () => {
    it('should update configuration', () => {
      manager.updateConfig({
        strategy: 'round-robin',
        cacheTTL: 7200000,
      });

      const config = manager.getConfig();
      expect(config.strategy).toBe('round-robin');
      expect(config.cacheTTL).toBe(7200000);
    });

    it('should preserve unmodified fields', () => {
      const originalConfig = manager.getConfig();

      manager.updateConfig({
        strategy: 'cost',
      });

      const newConfig = manager.getConfig();
      expect(newConfig.strategy).toBe('cost');
      expect(newConfig.enableCache).toBe(originalConfig.enableCache);
    });
  });

  describe('setStrategy', () => {
    it('should change strategy', () => {
      manager.setStrategy('weighted');

      expect(manager.getConfig().strategy).toBe('weighted');
    });
  });

  describe('selectProvider', () => {
    const mockProviders: Array<{ name: string; metadata: ProviderMetadata }> = [
      {
        name: 'high-priority',
        metadata: {
          name: 'high-priority',
          displayName: 'High Priority',
          description: 'Test',
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
          priority: 90,
          weight: 0.5,
          enabled: true,
        },
      },
      {
        name: 'low-priority',
        metadata: {
          name: 'low-priority',
          displayName: 'Low Priority',
          description: 'Test',
          costPerInputToken: 0.001,
          costPerOutputToken: 0.002,
          maxRequestsPerMinute: 100,
          maxTokensPerRequest: 4096,
          features: {
            streaming: false,
            jsonMode: true,
            functionCalling: false,
            vision: false,
          },
          priority: 50,
          weight: 0.8,
          enabled: true,
        },
      },
    ];

    it('should select by priority', () => {
      manager.setStrategy('priority');

      const selected = manager.selectProvider(mockProviders);
      expect(selected).toBe('high-priority');
    });

    it('should select by cost', () => {
      manager.setStrategy('cost');

      const selected = manager.selectProvider(mockProviders, 1000, 500);
      expect(selected).toBe('low-priority'); // Cheaper
    });

    it('should use round-robin', () => {
      manager.setStrategy('round-robin');

      const first = manager.selectProvider(mockProviders);
      const second = manager.selectProvider(mockProviders);

      expect(first).not.toBe(second);
    });

    it('should use weighted selection', () => {
      manager.setStrategy('weighted');

      const selected = manager.selectProvider(mockProviders);
      expect(['high-priority', 'low-priority']).toContain(selected);
    });

    it('should return null for empty provider list', () => {
      const selected = manager.selectProvider([]);
      expect(selected).toBeNull();
    });

    it('should respect preferred providers', () => {
      manager.updateConfig({
        preferredProviders: ['low-priority'],
      });

      const selected = manager.selectProvider(mockProviders);
      expect(selected).toBe('low-priority');
    });
  });

  describe('getFallbackProviders', () => {
    const mockProviders: Array<{ name: string; metadata: ProviderMetadata }> = [
      {
        name: 'provider1',
        metadata: {
          name: 'provider1',
          displayName: 'Provider 1',
          description: 'Test',
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
          priority: 90,
          weight: 0.5,
          enabled: true,
        },
      },
      {
        name: 'provider2',
        metadata: {
          name: 'provider2',
          displayName: 'Provider 2',
          description: 'Test',
          costPerInputToken: 0.005,
          costPerOutputToken: 0.015,
          maxRequestsPerMinute: 100,
          maxTokensPerRequest: 4096,
          features: {
            streaming: true,
            jsonMode: false,
            functionCalling: true,
            vision: true,
          },
          priority: 80,
          weight: 0.3,
          enabled: true,
        },
      },
      {
        name: 'provider3',
        metadata: {
          name: 'provider3',
          displayName: 'Provider 3',
          description: 'Test',
          costPerInputToken: 0.002,
          costPerOutputToken: 0.008,
          maxRequestsPerMinute: 100,
          maxTokensPerRequest: 4096,
          features: {
            streaming: false,
            jsonMode: true,
            functionCalling: false,
            vision: false,
          },
          priority: 70,
          weight: 0.2,
          enabled: true,
        },
      },
    ];

    it('should return fallback providers sorted by priority', () => {
      const fallbacks = manager.getFallbackProviders('provider1', mockProviders);

      expect(fallbacks).toHaveLength(2);
      expect(fallbacks[0]).toBe('provider2'); // Priority 80
      expect(fallbacks[1]).toBe('provider3'); // Priority 70
    });

    it('should exclude current provider', () => {
      const fallbacks = manager.getFallbackProviders('provider2', mockProviders);

      expect(fallbacks).not.toContain('provider2');
    });

    it('should respect maxFallbackAttempts', () => {
      manager.updateConfig({ maxFallbackAttempts: 1 });

      const fallbacks = manager.getFallbackProviders('provider1', mockProviders);
      expect(fallbacks).toHaveLength(1);
    });

    it('should return empty array when fallback disabled', () => {
      manager.updateConfig({ enableFallback: false });

      const fallbacks = manager.getFallbackProviders('provider1', mockProviders);
      expect(fallbacks).toHaveLength(0);
    });
  });

  describe('isEnabled', () => {
    it('should check if feature is enabled', () => {
      expect(manager.isEnabled('enableCache')).toBe(true);
      expect(manager.isEnabled('enableMetrics')).toBe(true);

      manager.updateConfig({ enableCache: false });
      expect(manager.isEnabled('enableCache')).toBe(false);
    });
  });

  describe('listeners', () => {
    it('should notify listeners on config change', () => {
      const listener = vi.fn();
      manager.addListener(listener);

      manager.updateConfig({ strategy: 'cost' });

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ strategy: 'cost' })
      );
    });

    it('should remove listeners', () => {
      const listener = vi.fn();
      manager.addListener(listener);
      manager.removeListener(listener);

      manager.updateConfig({ strategy: 'cost' });

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', () => {
      const badListener = () => {
        throw new Error('Listener error');
      };
      manager.addListener(badListener);

      // Should not throw
      expect(() => {
        manager.updateConfig({ strategy: 'cost' });
      }).not.toThrow();
    });
  });

  describe('reset', () => {
    it('should reset to default configuration', () => {
      manager.updateConfig({
        strategy: 'cost',
        enableCache: false,
        cacheTTL: 9999,
      });

      manager.reset();

      const config = manager.getConfig();
      expect(config.strategy).toBe('priority');
      expect(config.enableCache).toBe(true);
      expect(config.cacheTTL).toBe(3600000);
    });

    it('should notify listeners on reset', () => {
      const listener = vi.fn();
      manager.addListener(listener);

      manager.reset();

      expect(listener).toHaveBeenCalled();
    });
  });

  describe('exportConfig and importConfig', () => {
    it('should export configuration as JSON', () => {
      manager.updateConfig({
        strategy: 'weighted',
        dailyBudgetLimit: 100,
      });

      const json = manager.exportConfig();
      const config = JSON.parse(json);

      expect(config.strategy).toBe('weighted');
      expect(config.dailyBudgetLimit).toBe(100);
    });

    it('should import configuration from JSON', () => {
      const configJson = JSON.stringify({
        strategy: 'round-robin',
        enableCache: false,
        cacheTTL: 5000,
      });

      manager.importConfig(configJson);

      const config = manager.getConfig();
      expect(config.strategy).toBe('round-robin');
      expect(config.enableCache).toBe(false);
      expect(config.cacheTTL).toBe(5000);
    });

    it('should throw on invalid JSON', () => {
      expect(() => {
        manager.importConfig('invalid json {');
      }).toThrow('Invalid configuration JSON');
    });
  });
});
