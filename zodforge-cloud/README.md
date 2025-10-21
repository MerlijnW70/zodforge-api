# @zodforge/cloud

Official TypeScript SDK for [ZodForge Cloud API](https://zodforge.com) - AI-powered Zod schema refinement.

## Installation

```bash
npm install @zodforge/cloud zod
```

## Quick Start

### Method 1: Client Instance (Recommended)

```typescript
import { ZodForgeClient } from '@zodforge/cloud';

const client = new ZodForgeClient({
  apiKey: 'zf_your_api_key_here'
});

const result = await client.refineSchema({
  schema: {
    code: 'z.object({ email: z.string() })',
    typeName: 'User',
    fields: { email: 'z.string()' }
  },
  samples: [
    { email: 'user@example.com' },
    { email: 'Admin@TEST.org' }
  ]
});

console.log(result.refinedSchema.code);
// z.object({ email: z.string().email().toLowerCase().trim() })
```

### Method 2: Convenience Functions

```typescript
import { refineSchema, setApiKey } from '@zodforge/cloud';

// Option 1: Set global API key
setApiKey('zf_your_api_key_here');
const result = await refineSchema({
  schema: { /* ... */ },
  samples: [ /* ... */ ]
});

// Option 2: Pass API key per request
const result = await refineSchema(
  {
    schema: { /* ... */ },
    samples: [ /* ... */ ]
  },
  { apiKey: 'zf_your_api_key_here' }
);
```

## Features

### 🧠 Context Reasoning (Semantic Analysis)

The AI detects field relationships and suggests composite schemas:

```typescript
const result = await client.refineSchema({
  schema: {
    code: 'z.object({ price: z.number(), currency: z.string() })',
    typeName: 'Product',
    fields: {
      price: 'z.number()',
      currency: 'z.string()'
    }
  },
  samples: [
    { price: 100, currency: 'USD' },
    { price: 50, currency: 'EUR' }
  ]
});

// Check semantic relationships
console.log(result.refinedSchema.relationships);
// [
//   {
//     fields: ['price', 'currency'],
//     pattern: 'monetary_value',
//     suggestion: 'Consider creating a Money type...',
//     confidence: 0.92
//   }
// ]
```

### 🔍 Enhanced Explainability

Every improvement includes full traceability:

```typescript
result.refinedSchema.improvements.forEach(improvement => {
  console.log(`Field: ${improvement.field}`);
  console.log(`Change: ${improvement.before} → ${improvement.after}`);
  console.log(`Reason: ${improvement.reason}`);
  console.log(`Source: ${improvement.sourceSnippet}`);
  console.log(`Pattern: ${improvement.detectedPattern}`);
  console.log(`Rule: ${improvement.ruleApplied}`);
});

// Example output:
// Field: email
// Change: z.string() → z.string().email().toLowerCase().trim()
// Reason: Field contains email addresses, added validation
// Source: Admin@TEST.org
// Pattern: email_format
// Rule: RFC5322_email
```

### ⚡ Response Caching

Identical requests are cached for instant responses:

```typescript
// First call: ~9 seconds (AI processing)
const result1 = await client.refineSchema(request);

// Second call: <1ms (cached)
const result2 = await client.refineSchema(request);

console.log(result2.cached); // true
console.log(result2.processingTime); // <1ms
```

## API Reference

### `ZodForgeClient`

```typescript
class ZodForgeClient {
  constructor(options: {
    apiKey: string;
    baseUrl?: string;     // Default: https://api.zodforge.com
    timeout?: number;     // Default: 30000ms
    retries?: number;     // Default: 2
  });

  refineSchema(request: RefinementRequest): Promise<RefinementResponse>;
  getHealth(): Promise<HealthCheckResponse>;
  getUsage(): Promise<UsageStats>;
  setApiKey(apiKey: string): void;
  setBaseUrl(baseUrl: string): void;
}
```

### Convenience Functions

```typescript
// Refine schema
refineSchema(
  request: RefinementRequest,
  options?: { apiKey?: string; baseUrl?: string }
): Promise<RefinementResponse>

// Get health status
getHealth(
  options?: { apiKey?: string; baseUrl?: string }
): Promise<HealthCheckResponse>

// Get usage statistics
getUsage(
  options?: { apiKey?: string; baseUrl?: string }
): Promise<UsageStats>

// Set global API key
setApiKey(apiKey: string): void
```

## Usage Dashboard

Check your API usage and limits:

```typescript
const usage = await client.getUsage();

console.log(`Tier: ${usage.data.tier}`);
console.log(`Used: ${usage.data.currentPeriod.used} / ${usage.data.currentPeriod.limit}`);
console.log(`Remaining: ${usage.data.currentPeriod.remaining}`);
console.log(`Resets: ${usage.data.currentPeriod.resetDate}`);
console.log(`Success Rate: ${usage.data.lastWeek.successRate}%`);
console.log(`Avg Response Time: ${usage.data.lastWeek.avgProcessingTimeMs}ms`);
```

## Advanced Options

### AI Provider Selection

```typescript
const result = await client.refineSchema({
  schema: { /* ... */ },
  samples: [ /* ... */ ],
  options: {
    provider: 'openai',      // 'openai' | 'anthropic' | 'auto'
    model: 'gpt-4-turbo-preview',
    temperature: 0.2
  }
});
```

### Custom Base URL (Self-Hosted)

```typescript
const client = new ZodForgeClient({
  apiKey: 'zf_...',
  baseUrl: 'http://localhost:3000'  // For local development
});
```

### Error Handling

```typescript
import { ZodForgeError } from '@zodforge/cloud';

try {
  const result = await client.refineSchema(request);
} catch (error) {
  if (error instanceof ZodForgeError) {
    console.error(`Status: ${error.statusCode}`);
    console.error(`Code: ${error.errorCode}`);
    console.error(`Message: ${error.message}`);
  }
}
```

## Environment Variables

You can set your API key via environment variable:

```bash
export ZODFORGE_API_KEY=zf_your_api_key_here
```

Then use the SDK without passing the key:

```typescript
import { refineSchema } from '@zodforge/cloud';

// API key loaded from ZODFORGE_API_KEY env var
const result = await refineSchema({
  schema: { /* ... */ },
  samples: [ /* ... */ ]
});
```

## TypeScript Types

Full TypeScript support with comprehensive type definitions:

```typescript
import type {
  RefinementRequest,
  RefinementResponse,
  RefinedSchema,
  FieldImprovement,
  FieldRelationship,
  UsageStats,
  HealthCheckResponse,
  ZodForgeError
} from '@zodforge/cloud';
```

## Examples

### Basic Email Validation

```typescript
const result = await client.refineSchema({
  schema: {
    code: 'z.object({ email: z.string() })',
    typeName: 'User',
    fields: { email: 'z.string()' }
  },
  samples: [
    { email: 'user@example.com' },
    { email: 'ADMIN@test.ORG' }
  ]
});

// Result: z.object({ email: z.string().email().toLowerCase().trim() })
```

### Geolocation Schema

```typescript
const result = await client.refineSchema({
  schema: {
    code: 'z.object({ lat: z.number(), lng: z.number() })',
    typeName: 'Location',
    fields: {
      lat: 'z.number()',
      lng: 'z.number()'
    }
  },
  samples: [
    { lat: 51.5074, lng: -0.1278 },  // London
    { lat: 40.7128, lng: -74.0060 }  // New York
  ]
});

// Improvements:
// - lat: z.number().min(-90).max(90)
// - lng: z.number().min(-180).max(180)

// Relationships:
// - pattern: "geolocation"
// - suggestion: "Consider creating a Geolocation type..."
```

## Links

- [Website](https://zodforge.com)
- [Documentation](https://docs.zodforge.com)
- [API Reference](https://api.zodforge.com/docs)
- [GitHub](https://github.com/MerlijnW70/zodforge-api)
- [Issues](https://github.com/MerlijnW70/zodforge-api/issues)

## License

MIT © merlin white
