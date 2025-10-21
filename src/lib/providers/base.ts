// AI Provider abstraction layer
import type { RefinementRequest, RefinementResponse } from '../../types/index.js';

/**
 * Streaming chunk for real-time responses
 */
export interface StreamChunk {
  delta: string;
  done: boolean;
  metadata?: Record<string, any>;
}

/**
 * Base interface for all AI providers (OpenAI, Anthropic, etc.)
 */
export interface AIProvider {
  /**
   * Provider name (e.g., 'openai', 'anthropic')
   */
  readonly name: string;

  /**
   * Refine a Zod schema using the AI provider
   *
   * @param request - Schema refinement request with samples
   * @returns Refined schema with improvements and suggestions
   * @throws Error if the provider fails to refine the schema
   */
  refineSchema(
    request: RefinementRequest
  ): Promise<Omit<RefinementResponse, 'success' | 'error' | 'errorCode'>>;

  /**
   * Refine a schema with streaming support (optional)
   *
   * @param request - Schema refinement request with samples
   * @returns Async iterator of streaming chunks
   */
  refineSchemaStream?(
    request: RefinementRequest
  ): AsyncIterableIterator<StreamChunk>;

  /**
   * Check if the provider is available and healthy
   *
   * @returns True if provider is operational, false otherwise
   */
  checkHealth(): Promise<boolean>;

  /**
   * Get provider capabilities
   */
  getCapabilities?(): {
    supportsStreaming: boolean;
    supportsJsonMode: boolean;
    supportsFunctionCalling: boolean;
    supportsVision: boolean;
  };
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  /**
   * Primary provider to use (default: 'openai')
   */
  primaryProvider?: 'openai' | 'anthropic';

  /**
   * Enable automatic fallback to secondary provider
   */
  enableFallback?: boolean;

  /**
   * Maximum retries before falling back
   */
  maxRetries?: number;

  /**
   * Timeout for each request (ms)
   */
  timeout?: number;
}

/**
 * Provider error with provider name for fallback logic
 */
export class ProviderError extends Error {
  constructor(
    public provider: string,
    message: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
