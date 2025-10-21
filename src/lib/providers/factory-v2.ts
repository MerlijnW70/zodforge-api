// Enhanced AI Provider factory with plugin system, caching, rate limiting, and cost tracking
import type { RefinementRequest, RefinementResponse } from '../../types/index.js';
import type { AIProvider } from './base.js';
import { ProviderError } from './base.js';
import { providerRegistry, type ProviderMetadata } from './registry.js';
import { responseCache } from './cache.js';
import { rateLimiter } from './rate-limiter.js';
import { costTracker } from './cost-tracker.js';
import { metricsCollector } from './metrics.js';
import { configManager, type ProviderStrategy } from './config-manager.js';
import { securityAuditor } from '../security.js';

/**
 * Enhanced provider factory with advanced features
 */
export class ProviderFactoryV2 {
  constructor() {
    console.log('🏭 Enhanced Provider Factory V2 initialized');
    console.log(`   Strategy: ${configManager.getConfig().strategy}`);
    console.log(`   Features: cache=${configManager.isEnabled('enableCache')}, rate-limit=${configManager.isEnabled('enableRateLimiting')}, metrics=${configManager.isEnabled('enableMetrics')}`);
  }

  /**
   * Register a provider with metadata
   */
  registerProvider(provider: AIProvider, metadata: ProviderMetadata): void {
    providerRegistry.register(provider, metadata);

    // Setup rate limiting for this provider
    if (configManager.isEnabled('enableRateLimiting')) {
      rateLimiter.setLimit(provider.name, {
        maxRequests: metadata.maxRequestsPerMinute,
        windowMs: 60000, // 1 minute
        enabled: true,
      });
    }

    console.log(`✅ Provider ${metadata.displayName} registered with factory`);
  }

  /**
   * Unregister a provider
   */
  unregisterProvider(name: string): boolean {
    return providerRegistry.unregister(name);
  }

  /**
   * Refine schema with automatic provider selection, caching, and fallback
   */
  async refineSchema(
    request: RefinementRequest
  ): Promise<Omit<RefinementResponse, 'success' | 'error' | 'errorCode'>> {
    const startTime = Date.now();

    // Check cache first
    if (configManager.isEnabled('enableCache')) {
      const cached = responseCache.get(request);
      if (cached) {
        securityAuditor.log('cache_hit', { typeName: request.schema.typeName }, 'low');
        return cached;
      }
    }

    // Get available providers
    const availableProviders = providerRegistry.getEnabledProviders();
    if (availableProviders.length === 0) {
      throw new Error('No providers available');
    }

    // Determine provider selection
    const requestedProvider = request.options?.provider;
    let primaryProviderName: string | null = null;

    if (requestedProvider && requestedProvider !== 'auto') {
      // Specific provider requested
      primaryProviderName = requestedProvider;
    } else {
      // Use strategy to select provider
      primaryProviderName = configManager.selectProvider(
        availableProviders,
        this.estimateTokens(request.schema.code),
        500 // Estimated output tokens
      );
    }

    if (!primaryProviderName) {
      throw new Error('Failed to select a provider');
    }

    // Get fallback providers
    const fallbackProviders = configManager.getFallbackProviders(
      primaryProviderName,
      availableProviders
    );

    // Try primary provider
    const result = await this.tryProvider(
      primaryProviderName,
      request,
      'primary',
      fallbackProviders
    );

    // Cache successful result
    if (configManager.isEnabled('enableCache') && result) {
      responseCache.set(request, result, configManager.getConfig().cacheTTL);
    }

    const totalTime = Date.now() - startTime;
    console.log(`✅ Request completed in ${totalTime}ms`);

    return result;
  }

  /**
   * Try a provider with rate limiting, metrics, and cost tracking
   */
  private async tryProvider(
    providerName: string,
    request: RefinementRequest,
    attemptType: 'primary' | 'fallback',
    fallbackProviders: string[] = []
  ): Promise<Omit<RefinementResponse, 'success' | 'error' | 'errorCode'>> {
    const provider = providerRegistry.getProvider(providerName);
    const metadata = providerRegistry.getMetadata(providerName);

    if (!provider || !metadata) {
      throw new Error(`Provider not found: ${providerName}`);
    }

    // Check rate limit
    if (configManager.isEnabled('enableRateLimiting')) {
      const limitCheck = await rateLimiter.checkLimit(providerName);
      if (!limitCheck.allowed) {
        console.warn(
          `⏱️  Rate limit exceeded for ${providerName}, retry after ${limitCheck.retryAfter}s`
        );

        // Try fallback instead
        if (fallbackProviders.length > 0) {
          console.log(`🔄 Trying fallback due to rate limit...`);
          return this.tryProvider(
            fallbackProviders[0],
            request,
            'fallback',
            fallbackProviders.slice(1)
          );
        }

        throw new ProviderError(
          providerName,
          `Rate limit exceeded. Retry after ${limitCheck.retryAfter}s`
        );
      }
    }

    const requestStartTime = Date.now();

    try {
      securityAuditor.log(
        'provider_attempt',
        {
          provider: providerName,
          typeName: request.schema.typeName,
          attempt: attemptType,
        },
        'low'
      );

      const result = await provider.refineSchema(request);
      const responseTime = Date.now() - requestStartTime;

      // Record metrics
      if (configManager.isEnabled('enableMetrics')) {
        metricsCollector.record(providerName, true, responseTime);
      }

      // Track cost
      if (configManager.isEnabled('enableCostTracking')) {
        const inputTokens = this.estimateTokens(request.schema.code);
        const outputTokens = this.estimateTokens(result.refinedSchema?.code || '');
        const cost = costTracker.calculateCost(
          providerName,
          inputTokens,
          outputTokens,
          metadata.costPerInputToken,
          metadata.costPerOutputToken
        );

        costTracker.track({
          provider: providerName,
          inputTokens,
          outputTokens,
          cost,
          model: request.options?.model,
        });

        // Check daily budget
        const config = configManager.getConfig();
        if (config.dailyBudgetLimit) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const exceeded = costTracker.checkBudget(config.dailyBudgetLimit, today);
          if (exceeded) {
            console.warn('⚠️  Daily budget limit exceeded!');
          }
        }
      }

      securityAuditor.log(
        'provider_success',
        {
          provider: providerName,
          processingTime: responseTime,
        },
        'low'
      );

      // Update health status
      providerRegistry.updateHealthStatus(providerName, true);

      return result;
    } catch (error: any) {
      const responseTime = Date.now() - requestStartTime;

      // Record failed metrics
      if (configManager.isEnabled('enableMetrics')) {
        metricsCollector.record(providerName, false, responseTime, error.message);
      }

      // Update health status
      providerRegistry.updateHealthStatus(providerName, false);

      securityAuditor.log(
        'provider_failure',
        {
          provider: providerName,
          error: error instanceof ProviderError ? error.message : String(error),
          hasFallback: fallbackProviders.length > 0,
        },
        'medium'
      );

      // Try fallback if available
      if (fallbackProviders.length > 0) {
        const nextFallback = fallbackProviders[0];
        console.log(
          `⚠️  Provider ${providerName} failed (${attemptType}), trying fallback ${nextFallback}...`
        );

        securityAuditor.log(
          'provider_fallback_attempt',
          {
            from: providerName,
            to: nextFallback,
            typeName: request.schema.typeName,
          },
          'medium'
        );

        return this.tryProvider(nextFallback, request, 'fallback', fallbackProviders.slice(1));
      }

      // No fallbacks available
      throw error;
    }
  }

  /**
   * Estimate token count (rough approximation)
   */
  private estimateTokens(text: string): number {
    // Rough estimate: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Check health of all providers
   */
  async checkAllProviders(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    const providers = providerRegistry.getAllProviders();

    for (const { name, provider } of providers) {
      try {
        const isHealthy = await provider.checkHealth();
        results[name] = isHealthy;
        providerRegistry.updateHealthStatus(name, isHealthy);
      } catch (error) {
        results[name] = false;
        providerRegistry.updateHealthStatus(name, false);
      }
    }

    return results;
  }

  /**
   * Get provider by name
   */
  getProvider(name: string): AIProvider | undefined {
    return providerRegistry.getProvider(name);
  }

  /**
   * Get all registered providers
   */
  getAllProviders(): Array<{ name: string; provider: AIProvider; metadata: ProviderMetadata }> {
    return providerRegistry.getAllProviders();
  }

  /**
   * Enable/disable a provider
   */
  setProviderEnabled(name: string, enabled: boolean): boolean {
    return providerRegistry.setEnabled(name, enabled);
  }

  /**
   * Update provider priority
   */
  setProviderPriority(name: string, priority: number): boolean {
    return providerRegistry.setPriority(name, priority);
  }

  /**
   * Update provider weight
   */
  setProviderWeight(name: string, weight: number): boolean {
    return providerRegistry.setWeight(name, weight);
  }

  /**
   * Change provider selection strategy
   */
  setStrategy(strategy: ProviderStrategy): void {
    configManager.setStrategy(strategy);
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return configManager.getConfig();
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Parameters<typeof configManager.updateConfig>[0]): void {
    configManager.updateConfig(updates);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return responseCache.getStats();
  }

  /**
   * Get rate limit statuses
   */
  getRateLimitStatuses() {
    return rateLimiter.getAllStatuses();
  }

  /**
   * Get cost summary
   */
  getCostSummary(since?: Date) {
    return costTracker.getSummary(since);
  }

  /**
   * Get provider metrics
   */
  getProviderMetrics(provider: string, since?: Date) {
    return metricsCollector.getMetrics(provider, since);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(since?: Date) {
    return metricsCollector.getAllMetrics(since);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    responseCache.clear();
  }

  /**
   * Reset rate limits
   */
  resetRateLimits(): void {
    rateLimiter.resetAll();
  }
}

// Export singleton instance
export const providerFactoryV2 = new ProviderFactoryV2();
