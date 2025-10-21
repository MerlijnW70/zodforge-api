// Bootstrap providers with metadata
import { providerFactoryV2 } from './factory-v2.js';
import { openaiProvider } from './openai-provider.js';
import { anthropicProvider } from './anthropic-provider.js';
import { mockProvider } from './mock-provider.js';
import type { ProviderMetadata } from './registry.js';

/**
 * OpenAI provider metadata
 * Pricing as of 2024: GPT-4 Turbo
 */
const openaiMetadata: ProviderMetadata = {
  name: 'openai',
  displayName: 'OpenAI GPT-4',
  description: 'OpenAI GPT-4 Turbo with JSON mode support',
  costPerInputToken: 0.01, // $0.01 per 1K input tokens
  costPerOutputToken: 0.03, // $0.03 per 1K output tokens
  maxRequestsPerMinute: 500,
  maxTokensPerRequest: 4096,
  features: {
    streaming: true,
    jsonMode: true,
    functionCalling: true,
    vision: false,
  },
  priority: 90,
  weight: 0.7,
  enabled: true,
};

/**
 * Anthropic (Claude) provider metadata
 * Pricing as of 2024: Claude 3.5 Sonnet
 */
const anthropicMetadata: ProviderMetadata = {
  name: 'anthropic',
  displayName: 'Anthropic Claude 3.5',
  description: 'Anthropic Claude 3.5 Sonnet with vision support',
  costPerInputToken: 0.003, // $0.003 per 1K input tokens
  costPerOutputToken: 0.015, // $0.015 per 1K output tokens
  maxRequestsPerMinute: 1000,
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
};

/**
 * Mock provider metadata (for testing)
 */
const mockMetadata: ProviderMetadata = {
  name: 'mock',
  displayName: 'Mock Provider',
  description: 'Mock provider for testing and development',
  costPerInputToken: 0,
  costPerOutputToken: 0,
  maxRequestsPerMinute: 10000,
  maxTokensPerRequest: 100000,
  features: {
    streaming: true,
    jsonMode: true,
    functionCalling: false,
    vision: false,
  },
  priority: 0,
  weight: 0,
  enabled: false, // Disabled by default
};

/**
 * Bootstrap all providers
 */
export function bootstrapProviders(): void {
  console.log('🚀 Bootstrapping providers...');

  // Register OpenAI
  try {
    providerFactoryV2.registerProvider(openaiProvider, openaiMetadata);
  } catch (error) {
    console.error('Failed to register OpenAI provider:', error);
  }

  // Register Anthropic (if available)
  try {
    providerFactoryV2.registerProvider(anthropicProvider, anthropicMetadata);
  } catch (error) {
    console.error('Failed to register Anthropic provider:', error);
  }

  // Register Mock provider (for testing)
  try {
    providerFactoryV2.registerProvider(mockProvider, mockMetadata);
  } catch (error) {
    console.error('Failed to register Mock provider:', error);
  }

  console.log('✅ Providers bootstrapped successfully');
}

// Auto-bootstrap on import
bootstrapProviders();

// Export for re-bootstrapping if needed
export { providerFactoryV2 } from './factory-v2.js';
