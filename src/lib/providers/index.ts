// Enhanced Provider System - Main Exports
// Import bootstrap to auto-register providers
import './bootstrap.js';

// Export factory
export { providerFactoryV2 } from './factory-v2.js';

// Export base interfaces
export type { AIProvider, StreamChunk } from './base.js';
export { ProviderError } from './base.js';

// Export registry
export { providerRegistry, type ProviderMetadata } from './registry.js';

// Export cache
export { responseCache, type CacheStats } from './cache.js';

// Export rate limiter
export { rateLimiter, type RateLimitConfig } from './rate-limiter.js';

// Export cost tracker
export { costTracker, type CostEntry, type CostSummary } from './cost-tracker.js';

// Export metrics
export { metricsCollector, type ProviderMetrics } from './metrics.js';

// Export config manager
export { configManager, type ProviderStrategy, type GlobalConfig } from './config-manager.js';

// Export providers
export { openaiProvider, OpenAIProvider } from './openai-provider.js';
export { anthropicProvider, AnthropicProvider } from './anthropic-provider.js';
export { mockProvider, MockProvider, createMockProvider } from './mock-provider.js';

// Export bootstrap
export { bootstrapProviders } from './bootstrap.js';
