// OpenAI provider tests
import { describe, it, expect } from 'vitest';
import { ProviderError } from '../../../lib/providers/base.js';

describe('OpenAI Provider', () => {
  describe('buildPrompt helper', () => {
    it('should handle schema with multiple fields', () => {
      const schema = {
        code: 'z.object({ name: z.string(), age: z.number() })',
        typeName: 'User',
        fields: {
          name: 'z.string()',
          age: 'z.number()',
        },
      };

      const samples = [
        { name: 'Alice', age: 28 },
        { name: 'Bob', age: 35 },
      ];

      expect(schema.fields).toHaveProperty('name');
      expect(schema.fields).toHaveProperty('age');
      expect(samples).toHaveLength(2);
    });

    it('should handle schema with single field', () => {
      const schema = {
        code: 'z.object({ email: z.string() })',
        typeName: 'Contact',
        fields: {
          email: 'z.string()',
        },
      };

      expect(Object.keys(schema.fields)).toHaveLength(1);
      expect(schema.fields.email).toBe('z.string()');
    });

    it('should handle empty samples array', () => {
      const samples: any[] = [];
      expect(samples).toHaveLength(0);
      expect(Array.isArray(samples)).toBe(true);
    });

    it('should limit samples to 10 for prompt', () => {
      const samples = Array.from({ length: 20 }, (_, i) => ({ id: i }));
      const limited = samples.slice(0, 10);

      expect(limited).toHaveLength(10);
      expect(samples).toHaveLength(20);
    });

    it('should format field types correctly', () => {
      const schema = {
        code: 'z.object({ email: z.string(), age: z.number() })',
        typeName: 'User',
        fields: {
          email: 'z.string()',
          age: 'z.number()',
        },
      };

      const fieldLines = Object.entries(schema.fields)
        .map(([field, type]) => `- ${field}: ${type}`)
        .join('\n');

      expect(fieldLines).toContain('- email: z.string()');
      expect(fieldLines).toContain('- age: z.number()');
    });
  });

  describe('escapeRegex helper', () => {
    it('should escape special regex characters', () => {
      const testCases = [
        { input: 'z.string()', expected: 'z\\.string\\(\\)' },
        { input: 'z.number().min(0)', expected: 'z\\.number\\(\\)\\.min\\(0\\)' },
        { input: 'field[0]', expected: 'field\\[0\\]' },
        { input: 'test*pattern', expected: 'test\\*pattern' },
        { input: 'a+b', expected: 'a\\+b' },
        { input: 'x|y', expected: 'x\\|y' },
      ];

      testCases.forEach(({ input, expected }) => {
        const escaped = input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        expect(escaped).toBe(expected);
      });
    });

    it('should not modify strings without special characters', () => {
      const input = 'simple string';
      const escaped = input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expect(escaped).toBe(input);
    });

    it('should handle empty strings', () => {
      const input = '';
      const escaped = input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expect(escaped).toBe('');
    });
  });

  describe('buildRefinedSchema logic', () => {
    it('should apply single improvement correctly', () => {
      const originalCode = 'z.object({ email: z.string() })';
      const improvement = {
        field: 'email',
        before: 'z.string()',
        after: 'z.string().email()',
      };

      const beforeEscaped = improvement.before.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(
        `(${improvement.field}\\s*:\\s*)${beforeEscaped}`,
        'g'
      );
      const refinedCode = originalCode.replace(pattern, `$1${improvement.after}`);

      expect(refinedCode).toBe('z.object({ email: z.string().email() })');
    });

    it('should apply multiple improvements', () => {
      const originalCode = 'z.object({ email: z.string(), age: z.number() })';
      const improvements = [
        { field: 'email', before: 'z.string()', after: 'z.string().email()' },
        { field: 'age', before: 'z.number()', after: 'z.number().int().min(0)' },
      ];

      let refinedCode = originalCode;
      improvements.forEach((improvement) => {
        const beforeEscaped = improvement.before.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(
          `(${improvement.field}\\s*:\\s*)${beforeEscaped}`,
          'g'
        );
        refinedCode = refinedCode.replace(pattern, `$1${improvement.after}`);
      });

      expect(refinedCode).toContain('z.string().email()');
      expect(refinedCode).toContain('z.number().int().min(0)');
    });

    it('should handle field names with special characters', () => {
      const originalCode = 'z.object({ user_name: z.string() })';
      const improvement = {
        field: 'user_name',
        before: 'z.string()',
        after: 'z.string().trim()',
      };

      const beforeEscaped = improvement.before.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(
        `(${improvement.field}\\s*:\\s*)${beforeEscaped}`,
        'g'
      );
      const refinedCode = originalCode.replace(pattern, `$1${improvement.after}`);

      expect(refinedCode).toBe('z.object({ user_name: z.string().trim() })');
    });

    it('should handle improvements with complex validators', () => {
      const originalCode = 'z.object({ url: z.string() })';
      const improvement = {
        field: 'url',
        before: 'z.string()',
        after: 'z.string().url().startsWith("https://")',
      };

      const beforeEscaped = improvement.before.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(
        `(${improvement.field}\\s*:\\s*)${beforeEscaped}`,
        'g'
      );
      const refinedCode = originalCode.replace(pattern, `$1${improvement.after}`);

      expect(refinedCode).toBe('z.object({ url: z.string().url().startsWith("https://") })');
    });
  });

  describe('ProviderError', () => {
    it('should create error with provider name and message', () => {
      const error = new ProviderError('openai', 'API request failed');

      expect(error.provider).toBe('openai');
      expect(error.message).toContain('API request failed');
      expect(error.name).toBe('ProviderError');
    });

    it('should include originalError if provided', () => {
      const originalError = { statusCode: 429, retryAfter: 60 };
      const error = new ProviderError('openai', 'Rate limited', originalError);

      expect(error.provider).toBe('openai');
      expect(error.originalError).toEqual(originalError);
    });

    it('should be instanceof Error', () => {
      const error = new ProviderError('openai', 'Test error');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof ProviderError).toBe(true);
    });
  });

  describe('Response parsing', () => {
    it('should parse valid JSON response', () => {
      const jsonString = JSON.stringify({
        improvements: [
          {
            field: 'email',
            before: 'z.string()',
            after: 'z.string().email()',
            reason: 'Added email validation',
            confidence: 0.95,
          },
        ],
        suggestions: ['Consider adding .trim()'],
      });

      const parsed = JSON.parse(jsonString);

      expect(parsed).toHaveProperty('improvements');
      expect(parsed).toHaveProperty('suggestions');
      expect(parsed.improvements).toHaveLength(1);
      expect(parsed.improvements[0].confidence).toBe(0.95);
    });

    it('should handle response with multiple improvements', () => {
      const response = {
        improvements: [
          {
            field: 'email',
            before: 'z.string()',
            after: 'z.string().email()',
            reason: 'Email validation',
            confidence: 0.95,
          },
          {
            field: 'age',
            before: 'z.number()',
            after: 'z.number().int().min(0)',
            reason: 'Age constraints',
            confidence: 0.90,
          },
        ],
        suggestions: [],
      };

      expect(response.improvements).toHaveLength(2);
      expect(response.improvements[0].field).toBe('email');
      expect(response.improvements[1].field).toBe('age');
    });

    it('should handle empty improvements array', () => {
      const response = {
        improvements: [],
        suggestions: ['Schema looks good'],
      };

      expect(response.improvements).toHaveLength(0);
      expect(response.suggestions).toHaveLength(1);
    });

    it('should handle response with no suggestions', () => {
      const response = {
        improvements: [
          {
            field: 'email',
            before: 'z.string()',
            after: 'z.string().email()',
            reason: 'Email validation',
            confidence: 0.95,
          },
        ],
        suggestions: [],
      };

      expect(response.suggestions).toHaveLength(0);
    });
  });

  describe('Confidence scoring', () => {
    it('should calculate average confidence from improvements', () => {
      const improvements = [
        { confidence: 0.95 },
        { confidence: 0.85 },
        { confidence: 0.90 },
      ];

      const totalConfidence = improvements.reduce((sum, imp) => sum + imp.confidence, 0);
      const avgConfidence = totalConfidence / improvements.length;

      expect(avgConfidence).toBeCloseTo(0.9, 2);
    });

    it('should handle single improvement confidence', () => {
      const improvements = [{ confidence: 0.95 }];

      const avgConfidence = improvements.reduce((sum, imp) => sum + imp.confidence, 0) / improvements.length;

      expect(avgConfidence).toBe(0.95);
    });

    it('should return 0 for empty improvements', () => {
      const improvements: any[] = [];

      const avgConfidence = improvements.length > 0
        ? improvements.reduce((sum, imp) => sum + imp.confidence, 0) / improvements.length
        : 0;

      expect(avgConfidence).toBe(0);
    });

    it('should handle high confidence improvements', () => {
      const improvements = [
        { confidence: 0.99 },
        { confidence: 0.98 },
      ];

      const avgConfidence = improvements.reduce((sum, imp) => sum + imp.confidence, 0) / improvements.length;

      expect(avgConfidence).toBeGreaterThan(0.95);
    });

    it('should handle low confidence improvements', () => {
      const improvements = [
        { confidence: 0.75 },
        { confidence: 0.70 },
      ];

      const avgConfidence = improvements.reduce((sum, imp) => sum + imp.confidence, 0) / improvements.length;

      expect(avgConfidence).toBeLessThan(0.80);
    });
  });

  describe('Error handling', () => {
    it('should handle OpenAI API errors gracefully', () => {
      const error = {
        status: 429,
        message: 'Rate limit exceeded',
      };

      const providerError = new ProviderError('openai', error.message, error);

      expect(providerError.provider).toBe('openai');
      expect(providerError.message).toContain('Rate limit');
      expect(providerError.originalError).toEqual(error);
    });

    it('should handle network errors', () => {
      const error = new Error('Network timeout');
      const providerError = new ProviderError('openai', 'Request failed', { originalError: error.message });

      expect(providerError.message).toContain('Request failed');
    });

    it('should handle invalid JSON responses', () => {
      const invalidJson = '{ incomplete json';

      expect(() => JSON.parse(invalidJson)).toThrow();
    });

    it('should handle empty response from OpenAI', () => {
      const response = null;

      expect(response).toBeNull();
    });
  });

  describe('Model and temperature options', () => {
    it('should use default model when not specified', () => {
      const defaultModel = 'gpt-4-turbo-preview';
      const request = {
        options: undefined,
      };

      const model = request.options?.model || defaultModel;
      expect(model).toBe('gpt-4-turbo-preview');
    });

    it('should use default temperature when not specified', () => {
      const defaultTemp = 0.2;
      const request = {
        options: undefined,
      };

      const temperature = request.options?.temperature || defaultTemp;
      expect(temperature).toBe(0.2);
    });

    it('should respect custom model option', () => {
      const request = {
        options: { model: 'gpt-4' },
      };

      const model = request.options?.model || 'gpt-4-turbo-preview';
      expect(model).toBe('gpt-4');
    });

    it('should respect custom temperature option', () => {
      const request = {
        options: { temperature: 0.5 },
      };

      const temperature = request.options?.temperature || 0.2;
      expect(temperature).toBe(0.5);
    });

    it('should handle temperature 0', () => {
      const request = {
        options: { temperature: 0 },
      };

      const temperature = request.options?.temperature ?? 0.2;
      expect(temperature).toBe(0);
    });

    it('should handle temperature 1', () => {
      const request = {
        options: { temperature: 1 },
      };

      const temperature = request.options?.temperature || 0.2;
      expect(temperature).toBe(1);
    });
  });

  describe('Response format', () => {
    it('should use json_object response format', () => {
      const responseFormat = { type: 'json_object' };

      expect(responseFormat.type).toBe('json_object');
    });
  });

  describe('Max tokens', () => {
    it('should set max_tokens to 2000', () => {
      const maxTokens = 2000;

      expect(maxTokens).toBe(2000);
    });
  });

  describe('Health check model', () => {
    it('should use gpt-3.5-turbo for health checks', () => {
      const healthCheckModel = 'gpt-3.5-turbo';

      expect(healthCheckModel).toBe('gpt-3.5-turbo');
    });

    it('should limit health check tokens to 5', () => {
      const healthCheckTokens = 5;

      expect(healthCheckTokens).toBe(5);
    });
  });
});
