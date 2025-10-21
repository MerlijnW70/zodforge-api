// Provider registry with metadata and dynamic registration
import type { AIProvider } from './base.js';

/**
 * Provider metadata for cost tracking, rate limiting, and feature support
 */
export interface ProviderMetadata {
  /**
   * Provider name (unique identifier)
   */
  name: string;

  /**
   * Display name for UI
   */
  displayName: string;

  /**
   * Provider description
   */
  description: string;

  /**
   * Cost per 1K tokens (input)
   */
  costPerInputToken: number;

  /**
   * Cost per 1K tokens (output)
   */
  costPerOutputToken: number;

  /**
   * Maximum requests per minute
   */
  maxRequestsPerMinute: number;

  /**
   * Maximum tokens per request
   */
  maxTokensPerRequest: number;

  /**
   * Supported features
   */
  features: {
    streaming: boolean;
    jsonMode: boolean;
    functionCalling: boolean;
    vision: boolean;
  };

  /**
   * Priority (higher = preferred, 0-100)
   */
  priority: number;

  /**
   * Weight for load balancing (0-1)
   */
  weight: number;

  /**
   * Is provider currently enabled?
   */
  enabled: boolean;

  /**
   * Provider-specific configuration
   */
  config?: Record<string, any>;
}

/**
 * Provider registry entry
 */
interface ProviderEntry {
  provider: AIProvider;
  metadata: ProviderMetadata;
  lastHealthCheck?: Date;
  isHealthy?: boolean;
}

/**
 * Provider registry for dynamic provider management
 */
export class ProviderRegistry {
  private providers: Map<string, ProviderEntry> = new Map();

  /**
   * Register a new provider
   */
  register(provider: AIProvider, metadata: ProviderMetadata): void {
    if (this.providers.has(metadata.name)) {
      console.warn(`⚠️  Provider '${metadata.name}' is already registered. Overwriting...`);
    }

    this.providers.set(metadata.name, {
      provider,
      metadata,
      isHealthy: undefined,
    });

    console.log(`✅ Provider registered: ${metadata.displayName} (${metadata.name})`);
  }

  /**
   * Unregister a provider
   */
  unregister(name: string): boolean {
    const removed = this.providers.delete(name);
    if (removed) {
      console.log(`🗑️  Provider unregistered: ${name}`);
    }
    return removed;
  }

  /**
   * Get a provider by name
   */
  getProvider(name: string): AIProvider | undefined {
    return this.providers.get(name)?.provider;
  }

  /**
   * Get provider metadata
   */
  getMetadata(name: string): ProviderMetadata | undefined {
    return this.providers.get(name)?.metadata;
  }

  /**
   * Get all registered providers
   */
  getAllProviders(): Array<{ name: string; provider: AIProvider; metadata: ProviderMetadata }> {
    return Array.from(this.providers.entries()).map(([name, entry]) => ({
      name,
      provider: entry.provider,
      metadata: entry.metadata,
    }));
  }

  /**
   * Get enabled providers sorted by priority
   */
  getEnabledProviders(): Array<{ name: string; provider: AIProvider; metadata: ProviderMetadata }> {
    return this.getAllProviders()
      .filter((entry) => entry.metadata.enabled)
      .sort((a, b) => b.metadata.priority - a.metadata.priority);
  }

  /**
   * Get providers by feature support
   */
  getProvidersByFeature(feature: keyof ProviderMetadata['features']): string[] {
    return Array.from(this.providers.entries())
      .filter(([_, entry]) => entry.metadata.enabled && entry.metadata.features[feature])
      .map(([name]) => name);
  }

  /**
   * Update provider health status
   */
  updateHealthStatus(name: string, isHealthy: boolean): void {
    const entry = this.providers.get(name);
    if (entry) {
      entry.isHealthy = isHealthy;
      entry.lastHealthCheck = new Date();
    }
  }

  /**
   * Get provider health status
   */
  getHealthStatus(name: string): { isHealthy?: boolean; lastCheck?: Date } {
    const entry = this.providers.get(name);
    return {
      isHealthy: entry?.isHealthy,
      lastCheck: entry?.lastHealthCheck,
    };
  }

  /**
   * Enable/disable a provider
   */
  setEnabled(name: string, enabled: boolean): boolean {
    const entry = this.providers.get(name);
    if (entry) {
      entry.metadata.enabled = enabled;
      console.log(`${enabled ? '✅' : '❌'} Provider ${name} ${enabled ? 'enabled' : 'disabled'}`);
      return true;
    }
    return false;
  }

  /**
   * Update provider priority
   */
  setPriority(name: string, priority: number): boolean {
    const entry = this.providers.get(name);
    if (entry) {
      entry.metadata.priority = Math.max(0, Math.min(100, priority));
      return true;
    }
    return false;
  }

  /**
   * Update provider weight
   */
  setWeight(name: string, weight: number): boolean {
    const entry = this.providers.get(name);
    if (entry) {
      entry.metadata.weight = Math.max(0, Math.min(1, weight));
      return true;
    }
    return false;
  }

  /**
   * Get provider count
   */
  getProviderCount(): number {
    return this.providers.size;
  }

  /**
   * Clear all providers
   */
  clear(): void {
    this.providers.clear();
    console.log('🗑️  All providers cleared from registry');
  }
}

// Export singleton instance
export const providerRegistry = new ProviderRegistry();
