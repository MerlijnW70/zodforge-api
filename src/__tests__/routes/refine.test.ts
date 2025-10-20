// Refinement endpoint tests
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { refineRoute } from '../../routes/refine.js';
import { authMiddleware } from '../../middleware/auth.js';

describe('POST /refine', () => {
  let server: FastifyInstance;
  const VALID_API_KEY = process.env.ZODFORGE_API_KEY || 'zf_test_key_for_testing_purposes_only_12345';

  beforeAll(async () => {
    // Set test environment variable
    process.env.ZODFORGE_API_KEY = VALID_API_KEY;

    server = Fastify({ logger: false });
    await server.register(refineRoute, { prefix: '/api/v1' });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  describe('Authentication', () => {
    it('should return 401 without Authorization header', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/refine',
        payload: {
          schema: {
            code: 'z.object({ name: z.string() })',
            typeName: 'User',
            fields: { name: 'z.string()' },
          },
          samples: [{ name: 'Alice' }],
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        success: false,
        errorCode: 'MISSING_AUTH',
      });
    });

    it('should return 401 with invalid API key', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/refine',
        headers: {
          authorization: 'Bearer zf_invalid_key_12345',
        },
        payload: {
          schema: {
            code: 'z.object({ name: z.string() })',
            typeName: 'User',
            fields: { name: 'z.string()' },
          },
          samples: [{ name: 'Alice' }],
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        success: false,
        errorCode: 'INVALID_API_KEY',
      });
    });
  });

  describe('Request Validation', () => {
    it('should return 400 for missing schema', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/refine',
        headers: {
          authorization: `Bearer ${VALID_API_KEY}`,
        },
        payload: {
          samples: [{ name: 'Alice' }],
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        success: false,
        errorCode: 'INVALID_REQUEST',
      });
    });

    it('should return 400 for missing samples', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/refine',
        headers: {
          authorization: `Bearer ${VALID_API_KEY}`,
        },
        payload: {
          schema: {
            code: 'z.object({ name: z.string() })',
            typeName: 'User',
            fields: { name: 'z.string()' },
          },
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        success: false,
        errorCode: 'INVALID_REQUEST',
      });
    });

    it('should return 400 for empty samples array', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/refine',
        headers: {
          authorization: `Bearer ${VALID_API_KEY}`,
        },
        payload: {
          schema: {
            code: 'z.object({ name: z.string() })',
            typeName: 'User',
            fields: { name: 'z.string()' },
          },
          samples: [],
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        success: false,
        errorCode: 'INVALID_REQUEST',
      });
    });

    it('should return 400 for schema code exceeding max length', async () => {
      const longCode = 'z.object({ name: z.string() })'.repeat(2000); // ~60KB

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/refine',
        headers: {
          authorization: `Bearer ${VALID_API_KEY}`,
        },
        payload: {
          schema: {
            code: longCode,
            typeName: 'User',
            fields: { name: 'z.string()' },
          },
          samples: [{ name: 'Alice' }],
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for too many samples', async () => {
      const samples = Array.from({ length: 101 }, (_, i) => ({ name: `User${i}` }));

      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/refine',
        headers: {
          authorization: `Bearer ${VALID_API_KEY}`,
        },
        payload: {
          schema: {
            code: 'z.object({ name: z.string() })',
            typeName: 'User',
            fields: { name: 'z.string()' },
          },
          samples,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Valid Requests', () => {
    it('should accept valid refinement request with required fields', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/refine',
        headers: {
          authorization: `Bearer ${VALID_API_KEY}`,
        },
        payload: {
          schema: {
            code: 'z.object({ email: z.string(), age: z.number() })',
            typeName: 'User',
            fields: {
              email: 'z.string()',
              age: 'z.number()',
            },
          },
          samples: [
            { email: 'alice@example.com', age: 28 },
            { email: 'bob@test.org', age: 35 },
          ],
        },
      });

      // May return 200 (success) or 500 (AI provider error in test env)
      // We just verify the request is accepted and doesn't fail validation
      expect([200, 500]).toContain(response.statusCode);

      const body = response.json();
      expect(body).toHaveProperty('success');
    });

    it('should accept optional provider option', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/refine',
        headers: {
          authorization: `Bearer ${VALID_API_KEY}`,
        },
        payload: {
          schema: {
            code: 'z.object({ name: z.string() })',
            typeName: 'User',
            fields: { name: 'z.string()' },
          },
          samples: [{ name: 'Alice' }],
          options: {
            provider: 'openai',
          },
        },
      });

      expect([200, 500]).toContain(response.statusCode);
    });

    it('should accept optional model and temperature', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/refine',
        headers: {
          authorization: `Bearer ${VALID_API_KEY}`,
        },
        payload: {
          schema: {
            code: 'z.object({ name: z.string() })',
            typeName: 'User',
            fields: { name: 'z.string()' },
          },
          samples: [{ name: 'Alice' }],
          options: {
            model: 'gpt-4-turbo',
            temperature: 0.7,
          },
        },
      });

      expect([200, 500]).toContain(response.statusCode);
    });
  });

  describe('Response Format', () => {
    it('should return proper error structure on validation failure', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/refine',
        headers: {
          authorization: `Bearer ${VALID_API_KEY}`,
        },
        payload: {
          invalid: 'data',
        },
      });

      const body = response.json();
      expect(body).toHaveProperty('success', false);
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('errorCode');
    });
  });
});
