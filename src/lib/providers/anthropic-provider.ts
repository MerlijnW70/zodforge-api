// Anthropic (Claude) provider implementation
import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env.js';
import { sanitizeError, securityAuditor, maskApiKey } from '../security.js';
import type { RefinementRequest, RefinementResponse } from '../../types/index.js';
import type { AIProvider } from './base.js';
import { ProviderError } from './base.js';

// Initialize Anthropic client (only if API key is provided)
let anthropicClient: Anthropic | null = null;

if (env.ANTHROPIC_API_KEY) {
  anthropicClient = new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    maxRetries: 2,
    timeout: env.REQUEST_TIMEOUT,
  });
  console.log('🔐 Anthropic client initialized with key:', maskApiKey(env.ANTHROPIC_API_KEY));
} else {
  console.log('⚠️  Anthropic API key not provided - Claude fallback disabled');
}

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

Provide improvements in JSON format. Return ONLY valid JSON, no markdown.`;
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
 * Anthropic (Claude) provider implementation
 */
export class AnthropicProvider implements AIProvider {
  readonly name = 'anthropic';

  async refineSchema(
    request: RefinementRequest
  ): Promise<Omit<RefinementResponse, 'success' | 'error' | 'errorCode'>> {
    if (!anthropicClient) {
      throw new ProviderError(
        'anthropic',
        'Anthropic API key not configured. Set ANTHROPIC_API_KEY environment variable.'
      );
    }

    const startTime = Date.now();

    try {
      // Security audit: Log API call (without sensitive data)
      securityAuditor.log(
        'anthropic_refinement_request',
        {
          typeName: request.schema.typeName,
          fieldCount: Object.keys(request.schema.fields).length,
          sampleCount: request.samples.length,
          model: request.options?.model || 'claude-3-5-sonnet-20241022',
        },
        'low'
      );

      const prompt = buildPrompt(request);

      const message = await anthropicClient.messages.create({
        model: request.options?.model || 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        temperature: request.options?.temperature || 0.2,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const response = message.content[0];
      if (!response || response.type !== 'text') {
        securityAuditor.log('anthropic_empty_response', { model: request.options?.model }, 'medium');
        throw new ProviderError('anthropic', 'Empty or invalid response from Anthropic');
      }

      // Claude may wrap JSON in markdown code blocks, so strip them
      let jsonText = response.text.trim();
      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
      }

      const parsed = JSON.parse(jsonText);
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
        'anthropic_refinement_success',
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
        aiProvider: 'anthropic',
      };
    } catch (error: any) {
      // Security audit: Log error (sanitized)
      const sanitizedMessage = sanitizeError(error);
      securityAuditor.log(
        'anthropic_refinement_error',
        {
          error: sanitizedMessage,
          model: request.options?.model,
        },
        'high'
      );

      // Throw ProviderError for fallback logic
      throw new ProviderError('anthropic', `Anthropic API error: ${sanitizedMessage}`, error);
    }
  }

  async checkHealth(): Promise<boolean> {
    if (!anthropicClient) {
      return false;
    }

    try {
      // Simple health check: try to create a minimal message
      const message = await anthropicClient.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 5,
        messages: [{ role: 'user', content: 'ping' }],
      });

      return !!message.content[0];
    } catch (error) {
      console.error('Anthropic health check failed:', sanitizeError(error));
      return false;
    }
  }
}

// Export singleton instance
export const anthropicProvider = new AnthropicProvider();
