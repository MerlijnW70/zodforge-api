// Type definitions for ZodForge Cloud SDK
// These types match the API types from zodforge-api

/**
 * Schema refinement request payload
 */
export interface RefinementRequest {
  schema: {
    code: string;           // Generated Zod schema code
    typeName: string;       // Schema name (e.g., "User")
    fields: Record<string, string>; // Field name → Zod type mapping
  };
  samples: any[];           // Sample data from JSON (max 100 samples)
  options?: {
    provider?: 'openai' | 'anthropic' | 'auto';  // Default: openai
    model?: string;         // Default: gpt-4-turbo-preview
    temperature?: number;   // Default: 0.2
  };
}

/**
 * Individual field improvement suggestion
 */
export interface FieldImprovement {
  field: string;
  before: string;       // Original Zod type
  after: string;        // Improved Zod type
  reason: string;       // Explanation
  confidence: number;   // 0-1
  // Enhanced explainability (NEW)
  sourceSnippet?: string;      // Sample value that triggered change
  detectedPattern?: string;    // Pattern identifier (e.g., "email_format")
  ruleApplied?: string;        // Validation rule (e.g., "RFC5322_email")
}

/**
 * Detected field relationship (semantic analysis)
 */
export interface FieldRelationship {
  fields: string[];        // Related field names (e.g., ["price", "currency"])
  pattern: string;         // Pattern identifier (e.g., "monetary_value")
  suggestion: string;      // Composite schema suggestion
  confidence: number;      // 0-1
}

/**
 * Refined schema with improvements
 */
export interface RefinedSchema {
  code: string;                         // Improved Zod schema code
  improvements: FieldImprovement[];     // Field-level improvements
  confidence: number;                   // Overall confidence score
  relationships?: FieldRelationship[];  // Detected field relationships (NEW)
}

/**
 * API response for schema refinement
 */
export interface RefinementResponse {
  success: boolean;
  refinedSchema?: RefinedSchema;
  suggestions?: string[];   // Additional recommendations
  creditsUsed?: number;     // Credits consumed
  creditsRemaining?: number; // Remaining monthly credits
  processingTime?: number;  // Milliseconds
  aiProvider?: 'openai' | 'anthropic' | 'mock';
  cached?: boolean;         // True if returned from cache
  error?: string;
  errorCode?: string;
}

/**
 * Service health status
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'down';
  version: string;
  uptime: number;         // seconds
  services: Record<string, 'up' | 'down'>; // Dynamic providers
}

/**
 * Usage statistics for API key
 */
export interface UsageStats {
  success: boolean;
  data?: {
    tier: string;
    currentPeriod: {
      used: number;
      limit: number | 'unlimited';
      remaining: number | 'unlimited';
      resetDate: string;
      percentUsed: number;
    };
    lastWeek: {
      totalRequests: number;
      successfulRequests: number;
      failedRequests: number;
      successRate: number;
      avgProcessingTimeMs: number;
    };
  };
  error?: string;
  message?: string;
}

/**
 * ZodForge client configuration options
 */
export interface ZodForgeClientOptions {
  apiKey: string;
  baseUrl?: string;       // Default: https://api.zodforge.com
  timeout?: number;       // Request timeout in ms (default: 30000)
  retries?: number;       // Number of retries (default: 2)
}

/**
 * Error thrown by ZodForge SDK
 */
export class ZodForgeError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public errorCode?: string,
    public response?: any
  ) {
    super(message);
    this.name = 'ZodForgeError';
  }
}
