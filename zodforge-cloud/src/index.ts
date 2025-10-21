// ZodForge Cloud SDK - Main entry point
import { ZodForgeClient } from './client.js';
import type {
  RefinementRequest,
  RefinementResponse,
  ZodForgeClientOptions,
  FieldImprovement,
  FieldRelationship,
  RefinedSchema,
  HealthCheckResponse,
  UsageStats,
} from './types.js';
import { ZodForgeError } from './types.js';

// Re-export everything
export { ZodForgeClient, ZodForgeError };
export type {
  RefinementRequest,
  RefinementResponse,
  ZodForgeClientOptions,
  FieldImprovement,
  FieldRelationship,
  RefinedSchema,
  HealthCheckResponse,
  UsageStats,
};

/**
 * Global API key for convenience functions
 */
let globalApiKey: string | undefined;

/**
 * Set global API key for convenience functions
 *
 * @param apiKey - Your ZodForge API key
 *
 * @example
 * ```typescript
 * import { setApiKey } from '@zodforge/cloud';
 *
 * setApiKey('zf_...');
 * ```
 */
export function setApiKey(apiKey: string): void {
  globalApiKey = apiKey;
}

/**
 * Get or create client instance
 */
function getClient(apiKey?: string, baseUrl?: string): ZodForgeClient {
  const key = apiKey || globalApiKey || process.env.ZODFORGE_API_KEY;

  if (!key) {
    throw new ZodForgeError(
      'API key not provided. Either pass apiKey option, call setApiKey(), or set ZODFORGE_API_KEY environment variable.'
    );
  }

  return new ZodForgeClient({ apiKey: key, baseUrl });
}

/**
 * Convenience function to refine a Zod schema
 *
 * @param request - Schema refinement request
 * @param options - API key and base URL (optional if setApiKey() was called)
 * @returns Refined schema with improvements
 *
 * @example
 * ```typescript
 * import { refineSchema } from '@zodforge/cloud';
 *
 * const result = await refineSchema(
 *   {
 *     schema: {
 *       code: 'z.object({ email: z.string() })',
 *       typeName: 'User',
 *       fields: { email: 'z.string()' }
 *     },
 *     samples: [{ email: 'user@example.com' }]
 *   },
 *   { apiKey: 'zf_...' }
 * );
 *
 * console.log(result.refinedSchema.code);
 * // z.object({ email: z.string().email().toLowerCase() })
 * ```
 */
export async function refineSchema(
  request: RefinementRequest,
  options?: { apiKey?: string; baseUrl?: string }
): Promise<RefinementResponse> {
  const client = getClient(options?.apiKey, options?.baseUrl);
  return client.refineSchema(request);
}

/**
 * Convenience function to get API health
 *
 * @param options - API key and base URL (optional)
 * @returns Health check response
 */
export async function getHealth(
  options?: { apiKey?: string; baseUrl?: string }
): Promise<HealthCheckResponse> {
  const client = getClient(options?.apiKey, options?.baseUrl);
  return client.getHealth();
}

/**
 * Convenience function to get usage statistics
 *
 * @param options - API key and base URL (optional if setApiKey() was called)
 * @returns Usage statistics
 *
 * @example
 * ```typescript
 * import { getUsage } from '@zodforge/cloud';
 *
 * const usage = await getUsage({ apiKey: 'zf_...' });
 * console.log(`Used: ${usage.data.currentPeriod.used} / ${usage.data.currentPeriod.limit}`);
 * ```
 */
export async function getUsage(
  options?: { apiKey?: string; baseUrl?: string }
): Promise<UsageStats> {
  const client = getClient(options?.apiKey, options?.baseUrl);
  return client.getUsage();
}
