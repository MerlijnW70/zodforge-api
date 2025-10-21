// Mock provider for testing
import type { RefinementRequest, RefinementResponse } from '../../types/index.js';
import type { AIProvider, StreamChunk } from './base.js';
import { ProviderError } from './base.js';

export interface MockProviderConfig {
  /**
   * Simulated response time (ms)
   */
  responseTime?: number;

  /**
   * Success rate (0-1)
   */
  successRate?: number;

  /**
   * Simulated error message
   */
  errorMessage?: string;

  /**
   * Should stream responses
   */
  enableStreaming?: boolean;

  /**
   * Predefined response
   */
  mockResponse?: Omit<RefinementResponse, 'success' | 'error' | 'errorCode'>;
}

/**
 * Mock provider for testing and development
 */
export class MockProvider implements AIProvider {
  readonly name = 'mock';
  private config: MockProviderConfig;
  private requestCount = 0;

  constructor(config: MockProviderConfig = {}) {
    this.config = {
      responseTime: 100,
      successRate: 1.0,
      enableStreaming: false,
      ...config,
    };
  }

  async refineSchema(
    request: RefinementRequest
  ): Promise<Omit<RefinementResponse, 'success' | 'error' | 'errorCode'>> {
    this.requestCount++;

    // Simulate response time
    await this.delay(this.config.responseTime || 100);

    // Simulate failure based on success rate
    if (Math.random() > (this.config.successRate || 1.0)) {
      throw new ProviderError(
        'mock',
        this.config.errorMessage || 'Simulated mock provider failure'
      );
    }

    // Return mock response or generate one
    if (this.config.mockResponse) {
      return this.config.mockResponse;
    }

    return this.generateMockResponse(request);
  }

  async *refineSchemaStream(request: RefinementRequest): AsyncIterableIterator<StreamChunk> {
    if (!this.config.enableStreaming) {
      throw new Error('Streaming not enabled for this mock provider');
    }

    this.requestCount++;

    const mockText = 'Mock streaming response';
    const chunkSize = 5;

    for (let i = 0; i < mockText.length; i += chunkSize) {
      await this.delay(50);
      yield {
        delta: mockText.slice(i, i + chunkSize),
        done: i + chunkSize >= mockText.length,
        metadata: { chunkIndex: i / chunkSize },
      };
    }
  }

  async checkHealth(): Promise<boolean> {
    return this.config.successRate !== 0;
  }

  getCapabilities() {
    return {
      supportsStreaming: this.config.enableStreaming || false,
      supportsJsonMode: true,
      supportsFunctionCalling: false,
      supportsVision: false,
    };
  }

  /**
   * Generate a mock refinement response
   */
  private generateMockResponse(
    request: RefinementRequest
  ): Omit<RefinementResponse, 'success' | 'error' | 'errorCode'> {
    const improvements = Object.keys(request.schema.fields).map((field) => ({
      field,
      before: request.schema.fields[field],
      after: `${request.schema.fields[field]}.optional()`,
      reason: 'Mock improvement - made field optional',
      confidence: 0.85,
    }));

    return {
      refinedSchema: {
        code: request.schema.code.replace(/z\./g, 'z.optional().'),
        improvements,
        confidence: 0.85,
      },
      suggestions: ['Mock suggestion: Consider adding validation', 'Mock suggestion: Add defaults'],
      creditsUsed: 1,
      creditsRemaining: -1,
      processingTime: this.config.responseTime || 100,
      aiProvider: 'mock',
    };
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get request count (for testing)
   */
  getRequestCount(): number {
    return this.requestCount;
  }

  /**
   * Reset request count (for testing)
   */
  resetRequestCount(): void {
    this.requestCount = 0;
  }

  /**
   * Update mock configuration
   */
  updateConfig(config: Partial<MockProviderConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Export factory function for creating mock providers
export function createMockProvider(config?: MockProviderConfig): MockProvider {
  return new MockProvider(config);
}

// Export singleton instance (for testing)
export const mockProvider = new MockProvider({
  responseTime: 100,
  successRate: 1.0,
  enableStreaming: true,
});
