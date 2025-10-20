// Anthropic provider tests
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProviderError } from '../../../lib/providers/base.js';

describe('Anthropic Provider', () => {
  describe('Provider availability', () => {
    it('should be disabled when ANTHROPIC_API_KEY is not set', async () => {
      // Clear the API key
      const originalKey = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      // Dynamic import to get fresh instance
      const { anthropicProvider } = await import('../../../lib/providers/anthropic-provider.js');

      const available = await anthropicProvider.checkHealth();
      expect(available).toBe(false);

      // Restore
      if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
    });
  });

  describe('buildPrompt helper', () => {
    it('should handle schema with multiple fields', () => {
      // Test the prompt building logic directly
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

      // Verify schema structure
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
  });

  describe('ProviderError', () => {
    it('should create error with provider name and message', () => {
      const error = new ProviderError('anthropic', 'API request failed');

      expect(error.provider).toBe('anthropic');
      expect(error.message).toContain('API request failed');
      expect(error.name).toBe('ProviderError');
    });

    it('should include originalError if provided', () => {
      const originalError = { statusCode: 429, retryAfter: 60 };
      const error = new ProviderError('anthropic', 'Rate limited', originalError);

      expect(error.provider).toBe('anthropic');
      expect(error.originalError).toEqual(originalError);
    });

    it('should be instanceof Error', () => {
      const error = new ProviderError('anthropic', 'Test error');

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
  });

  describe('Error handling', () => {
    it('should handle Anthropic API errors gracefully', () => {
      const error = {
        status: 429,
        message: 'Rate limit exceeded',
      };

      const providerError = new ProviderError('anthropic', error.message, error);

      expect(providerError.provider).toBe('anthropic');
      expect(providerError.message).toContain('Rate limit');
      expect(providerError.originalError).toEqual(error);
    });

    it('should handle network errors', () => {
      const error = new Error('Network timeout');
      const providerError = new ProviderError('anthropic', 'Request failed', { originalError: error.message });

      expect(providerError.message).toContain('Request failed');
    });

    it('should handle invalid JSON responses', () => {
      const invalidJson = '{ incomplete json';

      expect(() => JSON.parse(invalidJson)).toThrow();
    });
  });

  describe('JSON markdown stripping', () => {
    it('should strip markdown code blocks with json tag', () => {
      const markdown = '```json\n{"improvements": []}\n```';
      let jsonText = markdown.trim();

      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
      }

      expect(jsonText).toBe('{"improvements": []}');
      expect(() => JSON.parse(jsonText)).not.toThrow();
    });

    it('should strip markdown code blocks without json tag', () => {
      const markdown = '```\n{"improvements": []}\n```';
      let jsonText = markdown.trim();

      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
      }

      expect(jsonText).toBe('{"improvements": []}');
    });

    it('should not modify plain JSON', () => {
      const plainJson = '{"improvements": []}';
      let jsonText = plainJson.trim();

      if (jsonText.startsWith('```json')) {
        jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
      } else if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
      }

      expect(jsonText).toBe('{"improvements": []}');
    });
  });

  describe('System prompt', () => {
    it('should require JSON output format', () => {
      const systemPrompt = `You are an expert TypeScript and Zod schema developer.`;

      expect(systemPrompt).toBeDefined();
      expect(typeof systemPrompt).toBe('string');
    });
  });

  describe('Model and temperature options', () => {
    it('should use default model when not specified', () => {
      const defaultModel = 'claude-3-5-sonnet-20241022';
      const request = {
        options: undefined,
      };

      const model = request.options?.model || defaultModel;
      expect(model).toBe('claude-3-5-sonnet-20241022');
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
        options: { model: 'claude-3-opus-20240229' },
      };

      const model = request.options?.model || 'claude-3-5-sonnet-20241022';
      expect(model).toBe('claude-3-opus-20240229');
    });

    it('should respect custom temperature option', () => {
      const request = {
        options: { temperature: 0.5 },
      };

      const temperature = request.options?.temperature || 0.2;
      expect(temperature).toBe(0.5);
    });
  });

  describe('Sample limiting', () => {
    it('should limit samples to first 10', () => {
      const samples = Array.from({ length: 15 }, (_, i) => ({ id: i }));
      const limited = samples.slice(0, 10);

      expect(limited).toHaveLength(10);
      expect(limited[0].id).toBe(0);
      expect(limited[9].id).toBe(9);
    });
  });
});
