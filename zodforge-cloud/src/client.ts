// ZodForge Cloud API Client
import type {
  RefinementRequest,
  RefinementResponse,
  HealthCheckResponse,
  UsageStats,
  ZodForgeClientOptions,
} from './types.js';
import { ZodForgeError } from './types.js';

/**
 * Default configuration
 */
const DEFAULT_BASE_URL = 'https://api.zodforge.com';
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_RETRIES = 2;

/**
 * ZodForge Cloud API Client
 *
 * @example
 * ```typescript
 * import { ZodForgeClient } from '@zodforge/cloud';
 *
 * const client = new ZodForgeClient({ apiKey: 'zf_...' });
 *
 * const result = await client.refineSchema({
 *   schema: {
 *     code: 'z.object({ name: z.string() })',
 *     typeName: 'User',
 *     fields: { name: 'z.string()' }
 *   },
 *   samples: [{ name: 'John' }]
 * });
 * ```
 */
export class ZodForgeClient {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;
  private retries: number;

  constructor(options: ZodForgeClientOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl || DEFAULT_BASE_URL;
    this.timeout = options.timeout || DEFAULT_TIMEOUT;
    this.retries = options.retries ?? DEFAULT_RETRIES;

    if (!this.apiKey) {
      throw new ZodForgeError('API key is required');
    }

    if (!this.apiKey.startsWith('zf_')) {
      throw new ZodForgeError('Invalid API key format. Expected: zf_...');
    }
  }

  /**
   * Make HTTP request with retries
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': '@zodforge/cloud/1.0.0',
            ...options.headers,
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody: any = await response.json().catch(() => ({}));
          throw new ZodForgeError(
            errorBody.error || errorBody.message || `HTTP ${response.status}`,
            response.status,
            errorBody.errorCode,
            errorBody
          );
        }

        return (await response.json()) as T;
      } catch (error: any) {
        lastError = error;

        // Don't retry on client errors (4xx) or custom ZodForgeError
        if (error instanceof ZodForgeError && error.statusCode && error.statusCode < 500) {
          throw error;
        }

        // Don't retry on AbortError (timeout)
        if (error.name === 'AbortError') {
          throw new ZodForgeError(`Request timeout after ${this.timeout}ms`);
        }

        // Retry on network errors or 5xx
        if (attempt < this.retries) {
          const backoff = Math.min(1000 * Math.pow(2, attempt), 5000);
          await new Promise(resolve => setTimeout(resolve, backoff));
          continue;
        }

        throw error;
      }
    }

    throw lastError || new ZodForgeError('Request failed after retries');
  }

  /**
   * Refine a Zod schema using AI
   *
   * @param request - Schema refinement request
   * @returns Refined schema with improvements
   *
   * @example
   * ```typescript
   * const result = await client.refineSchema({
   *   schema: {
   *     code: 'z.object({ email: z.string() })',
   *     typeName: 'User',
   *     fields: { email: 'z.string()' }
   *   },
   *   samples: [
   *     { email: 'user@example.com' },
   *     { email: 'admin@test.org' }
   *   ],
   *   options: {
   *     provider: 'openai',
   *     temperature: 0.2
   *   }
   * });
   * ```
   */
  async refineSchema(request: RefinementRequest): Promise<RefinementResponse> {
    return this.request<RefinementResponse>('/api/v1/refine', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Get API health status
   *
   * @returns Health check response
   */
  async getHealth(): Promise<HealthCheckResponse> {
    return this.request<HealthCheckResponse>('/api/v1/health', {
      method: 'GET',
    });
  }

  /**
   * Get usage statistics for current API key
   *
   * @returns Usage statistics
   *
   * @example
   * ```typescript
   * const usage = await client.getUsage();
   * console.log(`Used: ${usage.data.currentPeriod.used} / ${usage.data.currentPeriod.limit}`);
   * console.log(`Resets: ${usage.data.currentPeriod.resetDate}`);
   * ```
   */
  async getUsage(): Promise<UsageStats> {
    return this.request<UsageStats>('/api/v1/usage', {
      method: 'GET',
    });
  }

  /**
   * Update API key
   */
  setApiKey(apiKey: string): void {
    if (!apiKey.startsWith('zf_')) {
      throw new ZodForgeError('Invalid API key format. Expected: zf_...');
    }
    this.apiKey = apiKey;
  }

  /**
   * Update base URL
   */
  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl;
  }
}
