// OpenAI provider implementation
import OpenAI from 'openai';
import { env } from '../../config/env.js';
import { sanitizeError, securityAuditor, maskApiKey } from '../security.js';
import type { RefinementRequest, RefinementResponse } from '../../types/index.js';
import type { AIProvider } from './base.js';
import { ProviderError } from './base.js';

// Initialize OpenAI with secured API key
const openaiClient = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  maxRetries: 2,
  timeout: env.REQUEST_TIMEOUT,
});

console.log('🔐 OpenAI client initialized with key:', maskApiKey(env.OPENAI_API_KEY));

const SYSTEM_PROMPT = `You are an expert TypeScript and Zod schema developer. Your task is to analyze a Zod schema and suggest improvements based on sample data.

**Goals**:
1. Make types more accurate and specific
2. Add appropriate constraints (min, max, regex, etc.)
3. Improve validation rules based on business logic
4. Detect enums where appropriate
5. Add transformations for data normalization

**Rules**:
- Only suggest changes with high confidence (>80%)
- Preserve existing valid constraints
- Consider real-world data patterns
- Explain reasoning for each change
- Use standard Zod validators

**Output Format** (JSON only, no markdown):
{
  "improvements": [
    {
      "field": "email",
      "before": "z.string()",
      "after": "z.string().email().toLowerCase().trim()",
      "reason": "Field name and samples indicate email addresses. Added normalization.",
      "confidence": 0.95
    }
  ],
  "suggestions": [
    "Consider adding @default for optional fields",
    "Username should have length constraints"
  ]
}`;

function buildPrompt(request: RefinementRequest): string {
  const { schema, samples } = request;

  return `Analyze this Zod schema and suggest improvements:

**Schema Name**: ${schema.typeName}

**Current Schema**:
\`\`\`typescript
${schema.code}
\`\`\`

**Field Types**:
${Object.entries(schema.fields)
  .map(([field, type]) => `- ${field}: ${type}`)
  .join('\n')}

**Sample Data** (${samples.length} samples):
\`\`\`json
${JSON.stringify(samples.slice(0, 10), null, 2)}
\`\`\`

Provide improvements in JSON format.`;
}

function buildRefinedSchema(
  originalSchema: RefinementRequest['schema'],
  improvements: Array<{ field: string; before: string; after: string }>
): string {
  let refinedCode = originalSchema.code;

  // Apply each improvement by replacing before → after
  improvements.forEach((improvement) => {
    const fieldPattern = new RegExp(
      `(${improvement.field}\\s*:\\s*)${escapeRegex(improvement.before)}`,
      'g'
    );
    refinedCode = refinedCode.replace(fieldPattern, `$1${improvement.after}`);
  });

  return refinedCode;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * OpenAI provider implementation
 */
export class OpenAIProvider implements AIProvider {
  readonly name = 'openai';

  async refineSchema(
    request: RefinementRequest
  ): Promise<Omit<RefinementResponse, 'success' | 'error' | 'errorCode'>> {
    const startTime = Date.now();

    try {
      // Security audit: Log API call (without sensitive data)
      securityAuditor.log(
        'openai_refinement_request',
        {
          typeName: request.schema.typeName,
          fieldCount: Object.keys(request.schema.fields).length,
          sampleCount: request.samples.length,
          model: request.options?.model || 'gpt-4-turbo-preview',
        },
        'low'
      );

      const prompt = buildPrompt(request);

      const completion = await openaiClient.chat.completions.create({
        model: request.options?.model || 'gpt-4-turbo-preview',
        temperature: request.options?.temperature || 0.2,
        max_tokens: 2000,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        securityAuditor.log('openai_empty_response', { model: request.options?.model }, 'medium');
        throw new ProviderError('openai', 'Empty response from OpenAI');
      }

      const parsed = JSON.parse(response);
      const processingTime = Date.now() - startTime;

      // Calculate overall confidence
      const confidences = parsed.improvements?.map((imp: any) => imp.confidence) || [];
      const averageConfidence =
        confidences.length > 0
          ? confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length
          : 0.9;

      // Rebuild the refined schema code
      const refinedCode = buildRefinedSchema(request.schema, parsed.improvements || []);

      // Security audit: Log successful refinement
      securityAuditor.log(
        'openai_refinement_success',
        {
          improvementsCount: parsed.improvements?.length || 0,
          confidence: averageConfidence,
          processingTime,
        },
        'low'
      );

      return {
        refinedSchema: {
          code: refinedCode,
          improvements: parsed.improvements || [],
          confidence: averageConfidence,
        },
        suggestions: parsed.suggestions || [],
        creditsUsed: 1,
        creditsRemaining: -1, // Unlimited for MVP
        processingTime,
        aiProvider: 'openai',
      };
    } catch (error: any) {
      // Security audit: Log error (sanitized)
      const sanitizedMessage = sanitizeError(error);
      securityAuditor.log(
        'openai_refinement_error',
        {
          error: sanitizedMessage,
          model: request.options?.model,
        },
        'high'
      );

      // Throw ProviderError for fallback logic
      throw new ProviderError('openai', `OpenAI API error: ${sanitizedMessage}`, error);
    }
  }

  async checkHealth(): Promise<boolean> {
    try {
      // Simple health check: try to create a minimal completion
      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-3.5-turbo',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'ping' }],
      });

      return !!completion.choices[0]?.message;
    } catch (error) {
      console.error('OpenAI health check failed:', sanitizeError(error));
      return false;
    }
  }
}

// Export singleton instance
export const openaiProvider = new OpenAIProvider();
