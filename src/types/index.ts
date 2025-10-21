// Type definitions for ZodForge API

export interface RefinementRequest {
  schema: {
    code: string;           // Generated Zod schema code
    typeName: string;       // Schema name (e.g., "User")
    fields: Record<string, string>; // Field name → Zod type mapping
  };
  samples: any[];           // Sample data from JSON (max 100 samples)
  options?: {
    provider?: 'openai' | 'anthropic' | 'auto';  // Default: openai (MVP: only openai)
    model?: string;         // Default: gpt-4-turbo-preview
    temperature?: number;   // Default: 0.2
  };
}

export interface RefinementResponse {
  success: boolean;
  refinedSchema?: {
    code: string;           // Improved Zod schema code
    improvements: Array<{
      field: string;
      before: string;       // Original Zod type
      after: string;        // Improved Zod type
      reason: string;       // Explanation
      confidence: number;   // 0-1
    }>;
    confidence: number;     // Overall confidence score
  };
  suggestions?: string[];   // Additional recommendations
  creditsUsed?: number;     // Credits consumed (1 per request for MVP)
  creditsRemaining?: number; // Remaining monthly credits (unlimited for MVP)
  processingTime?: number;  // Milliseconds
  aiProvider?: 'openai' | 'anthropic' | 'mock';
  error?: string;
  errorCode?: string;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'down';
  version: string;
  uptime: number;         // seconds
  services: Record<string, 'up' | 'down'>; // Dynamic providers (openai, anthropic, etc.)
}
