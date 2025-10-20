// AI Provider factory with automatic fallback
import type { RefinementRequest, RefinementResponse } from '../../types/index.js';
import type { AIProvider, ProviderConfig } from './base.js';
import { ProviderError } from './base.js';
import { openaiProvider } from './openai-provider.js';
import { anthropicProvider } from './anthropic-provider.js';
import { securityAuditor } from '../security.js';

/**
 * Provider factory with intelligent fallback
 */
export class ProviderFactory {
  private providers: Map<string, AIProvider> = new Map();
  private config: Required<ProviderConfig>;

  constructor(config: ProviderConfig = {}) {
    // Register available providers
    this.providers.set('openai', openaiProvider);
    this.providers.set('anthropic', anthropicProvider);

    // Default configuration
    this.config = {
      primaryProvider: config.primaryProvider || 'openai',
      enableFallback: config.enableFallback ?? true,
      maxRetries: config.maxRetries || 1,
      timeout: config.timeout || 30000,
    };

    console.log('🏭 Provider factory initialized');
    console.log(`   Primary: ${this.config.primaryProvider}`);
    console.log(`   Fallback: ${this.config.enableFallback ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get a provider by name
   */
  getProvider(name: string): AIProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Refine schema with automatic fallback
   */
  async refineSchema(
    request: RefinementRequest
  ): Promise<Omit<RefinementResponse, 'success' | 'error' | 'errorCode'>> {
    // Determine which provider to use
    const requestedProvider = request.options?.provider || 'auto';
    let primaryProviderName: string;
    let fallbackProviderName: string | null = null;

    if (requestedProvider === 'auto') {
      // Auto mode: use configured primary provider with fallback
      primaryProviderName = this.config.primaryProvider;
      fallbackProviderName = this.config.enableFallback
        ? this.config.primaryProvider === 'openai'
          ? 'anthropic'
          : 'openai'
        : null;
    } else if (requestedProvider === 'openai' || requestedProvider === 'anthropic') {
      // Specific provider requested
      primaryProviderName = requestedProvider;
      fallbackProviderName = this.config.enableFallback
        ? requestedProvider === 'openai'
          ? 'anthropic'
          : 'openai'
        : null;
    } else {
      throw new Error(`Unsupported provider: ${requestedProvider}`);
    }

    const primaryProvider = this.providers.get(primaryProviderName);
    if (!primaryProvider) {
      throw new Error(`Provider not available: ${primaryProviderName}`);
    }

    // Try primary provider
    try {
      securityAuditor.log(
        'provider_attempt',
        {
          provider: primaryProviderName,
          typeName: request.schema.typeName,
          attempt: 'primary',
        },
        'low'
      );

      const result = await primaryProvider.refineSchema(request);

      securityAuditor.log(
        'provider_success',
        {
          provider: primaryProviderName,
          processingTime: result.processingTime,
        },
        'low'
      );

      return result;
    } catch (primaryError: any) {
      // Log primary provider failure
      securityAuditor.log(
        'provider_failure',
        {
          provider: primaryProviderName,
          error: primaryError instanceof ProviderError ? primaryError.message : String(primaryError),
          fallbackEnabled: !!fallbackProviderName,
        },
        'medium'
      );

      // If fallback is disabled or no fallback available, throw error
      if (!fallbackProviderName) {
        throw primaryError;
      }

      // Try fallback provider
      const fallbackProvider = this.providers.get(fallbackProviderName);
      if (!fallbackProvider) {
        console.error(`Fallback provider not available: ${fallbackProviderName}`);
        throw primaryError; // Throw original error if fallback unavailable
      }

      try {
        console.log(`⚠️  Primary provider (${primaryProviderName}) failed, trying fallback (${fallbackProviderName})...`);

        securityAuditor.log(
          'provider_fallback_attempt',
          {
            from: primaryProviderName,
            to: fallbackProviderName,
            typeName: request.schema.typeName,
          },
          'medium'
        );

        const result = await fallbackProvider.refineSchema(request);

        securityAuditor.log(
          'provider_fallback_success',
          {
            provider: fallbackProviderName,
            processingTime: result.processingTime,
          },
          'medium'
        );

        console.log(`✅ Fallback provider (${fallbackProviderName}) succeeded!`);

        return result;
      } catch (fallbackError: any) {
        // Both providers failed
        securityAuditor.log(
          'provider_fallback_failure',
          {
            primaryProvider: primaryProviderName,
            fallbackProvider: fallbackProviderName,
            primaryError: primaryError instanceof ProviderError ? primaryError.message : String(primaryError),
            fallbackError: fallbackError instanceof ProviderError ? fallbackError.message : String(fallbackError),
          },
          'high'
        );

        console.error(`❌ Both providers failed (${primaryProviderName} and ${fallbackProviderName})`);

        // Throw the original error with fallback info
        throw new ProviderError(
          'all',
          `All providers failed. Primary (${primaryProviderName}): ${primaryError.message}. Fallback (${fallbackProviderName}): ${fallbackError.message}`,
          { primaryError, fallbackError }
        );
      }
    }
  }

  /**
   * Check health of all providers
   */
  async checkAllProviders(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [name, provider] of this.providers) {
      try {
        results[name] = await provider.checkHealth();
      } catch (error) {
        results[name] = false;
      }
    }

    return results;
  }
}

// Export singleton instance
export const providerFactory = new ProviderFactory({
  primaryProvider: 'openai',
  enableFallback: true,
  maxRetries: 1,
});
