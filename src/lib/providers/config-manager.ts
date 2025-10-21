// Configuration management system for AI providers
import type { ProviderMetadata } from './registry.js';

/**
 * Provider selection strategy
 */
export type ProviderStrategy =
  | 'priority' // Use highest priority provider
  | 'cost' // Use cheapest provider
  | 'performance' // Use fastest provider
  | 'round-robin' // Rotate between providers
  | 'weighted' // Use weighted random selection
  | 'manual'; // Manual provider selection

/**
 * Global provider configuration
 */
export interface GlobalConfig {
  /**
   * Provider selection strategy
   */
  strategy: ProviderStrategy;

  /**
   * Enable automatic fallback
   */
  enableFallback: boolean;

  /**
   * Maximum fallback attempts
   */
  maxFallbackAttempts: number;

  /**
   * Enable caching
   */
  enableCache: boolean;

  /**
   * Cache TTL in milliseconds
   */
  cacheTTL: number;

  /**
   * Enable rate limiting
   */
  enableRateLimiting: boolean;

  /**
   * Enable cost tracking
   */
  enableCostTracking: boolean;

  /**
   * Enable metrics collection
   */
  enableMetrics: boolean;

  /**
   * Request timeout in milliseconds
   */
  requestTimeout: number;

  /**
   * Budget limit (USD per day)
   */
  dailyBudgetLimit?: number;

  /**
   * Auto-disable provider on consecutive failures
   */
  autoDisableThreshold?: number;

  /**
   * Preferred providers (in order)
   */
  preferredProviders?: string[];
}

/**
 * Configuration manager for provider system
 */
export class ConfigManager {
  private config: GlobalConfig;
  private roundRobinIndex = 0;
  private listeners: Array<(config: GlobalConfig) => void> = [];

  constructor(initialConfig?: Partial<GlobalConfig>) {
    this.config = {
      strategy: 'priority',
      enableFallback: true,
      maxFallbackAttempts: 2,
      enableCache: true,
      cacheTTL: 3600000, // 1 hour
      enableRateLimiting: true,
      enableCostTracking: true,
      enableMetrics: true,
      requestTimeout: 30000,
      ...initialConfig,
    };

    console.log('⚙️  Configuration manager initialized');
    console.log(`   Strategy: ${this.config.strategy}`);
    console.log(`   Fallback: ${this.config.enableFallback}`);
    console.log(`   Cache: ${this.config.enableCache}`);
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<GlobalConfig> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<GlobalConfig>): void {
    this.config = { ...this.config, ...updates };
    console.log('⚙️  Configuration updated:', Object.keys(updates).join(', '));

    // Notify listeners
    this.notifyListeners();
  }

  /**
   * Set provider selection strategy
   */
  setStrategy(strategy: ProviderStrategy): void {
    this.config.strategy = strategy;
    console.log(`⚙️  Strategy changed to: ${strategy}`);
    this.notifyListeners();
  }

  /**
   * Select provider based on current strategy
   */
  selectProvider(
    availableProviders: Array<{ name: string; metadata: ProviderMetadata }>,
    estimatedInputTokens = 1000,
    estimatedOutputTokens = 1000
  ): string | null {
    if (availableProviders.length === 0) {
      return null;
    }

    // Filter preferred providers if configured
    let providers = availableProviders;
    if (this.config.preferredProviders && this.config.preferredProviders.length > 0) {
      const preferred = availableProviders.filter((p) =>
        this.config.preferredProviders!.includes(p.name)
      );
      if (preferred.length > 0) {
        providers = preferred;
      }
    }

    switch (this.config.strategy) {
      case 'priority':
        // Already sorted by priority in registry.getEnabledProviders()
        return providers[0].name;

      case 'cost': {
        // Calculate cost for each provider
        const withCosts = providers.map((p) => ({
          name: p.name,
          cost:
            (estimatedInputTokens / 1000) * p.metadata.costPerInputToken +
            (estimatedOutputTokens / 1000) * p.metadata.costPerOutputToken,
        }));
        withCosts.sort((a, b) => a.cost - b.cost);
        return withCosts[0].name;
      }

      case 'performance':
        // Would need metrics data - fallback to priority for now
        console.warn('⚠️  Performance strategy requires metrics data, falling back to priority');
        return providers[0].name;

      case 'round-robin':
        const selected = providers[this.roundRobinIndex % providers.length];
        this.roundRobinIndex++;
        return selected.name;

      case 'weighted': {
        // Weighted random selection
        const totalWeight = providers.reduce((sum, p) => sum + p.metadata.weight, 0);
        let random = Math.random() * totalWeight;

        for (const provider of providers) {
          random -= provider.metadata.weight;
          if (random <= 0) {
            return provider.name;
          }
        }

        return providers[0].name; // Fallback
      }

      case 'manual':
        // Return first available (manual selection done elsewhere)
        return providers[0].name;

      default:
        return providers[0].name;
    }
  }

  /**
   * Get fallback providers
   */
  getFallbackProviders(
    currentProvider: string,
    availableProviders: Array<{ name: string; metadata: ProviderMetadata }>
  ): string[] {
    if (!this.config.enableFallback) {
      return [];
    }

    const fallbacks = availableProviders
      .filter((p) => p.name !== currentProvider)
      .sort((a, b) => b.metadata.priority - a.metadata.priority)
      .slice(0, this.config.maxFallbackAttempts)
      .map((p) => p.name);

    return fallbacks;
  }

  /**
   * Check if a feature is enabled
   */
  isEnabled(feature: keyof Pick<GlobalConfig, 'enableCache' | 'enableRateLimiting' | 'enableCostTracking' | 'enableMetrics'>): boolean {
    return this.config[feature];
  }

  /**
   * Add configuration change listener
   */
  addListener(listener: (config: GlobalConfig) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove configuration change listener
   */
  removeListener(listener: (config: GlobalConfig) => void): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  /**
   * Notify all listeners of configuration change
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.config);
      } catch (error) {
        console.error('Error in config listener:', error);
      }
    }
  }

  /**
   * Reset to default configuration
   */
  reset(): void {
    this.config = {
      strategy: 'priority',
      enableFallback: true,
      maxFallbackAttempts: 2,
      enableCache: true,
      cacheTTL: 3600000,
      enableRateLimiting: true,
      enableCostTracking: true,
      enableMetrics: true,
      requestTimeout: 30000,
    };
    this.roundRobinIndex = 0;
    console.log('⚙️  Configuration reset to defaults');
    this.notifyListeners();
  }

  /**
   * Export configuration as JSON
   */
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Import configuration from JSON
   */
  importConfig(json: string): void {
    try {
      const imported = JSON.parse(json);
      this.updateConfig(imported);
      console.log('⚙️  Configuration imported successfully');
    } catch (error) {
      console.error('Failed to import configuration:', error);
      throw new Error('Invalid configuration JSON');
    }
  }
}

// Export singleton instance
export const configManager = new ConfigManager({
  strategy: 'priority',
  enableFallback: true,
  maxFallbackAttempts: 2,
  enableCache: true,
  cacheTTL: 3600000,
  enableRateLimiting: true,
  enableCostTracking: true,
  enableMetrics: true,
  requestTimeout: 30000,
});
