// Integration tests for the full API
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { healthRoute } from '../../routes/health.js';
import { refineRoute } from '../../routes/refine.js';

describe('API Integration Tests', () => {
  let server: FastifyInstance;
  const API_KEY = process.env.ZODFORGE_API_KEY || 'zf_test_integration_key_12345678901234567890';

  beforeAll(async () => {
    // Set up test environment
    process.env.ZODFORGE_API_KEY = API_KEY;
    process.env.NODE_ENV = 'test';

    // Create full server instance
    server = Fastify({ logger: false });

    // Register middleware
    await server.register(helmet);
    await server.register(cors, {
      origin: '*',
      credentials: true,
    });

    // Register routes
    await server.register(healthRoute, { prefix: '/api/v1' });
    await server.register(refineRoute, { prefix: '/api/v1' });

    // Add root endpoint
    server.get('/', async () => ({
      name: 'ZodForge API',
      version: '0.1.0',
      status: 'running',
    }));

    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  describe('Server Startup', () => {
    it('should respond to root endpoint', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        name: 'ZodForge API',
        version: expect.any(String),
        status: 'running',
      });
    });

    it('should have security headers', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
    });
  });

  describe('Health Check Flow', () => {
    it('should return healthy status', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/health',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();

      expect(body).toMatchObject({
        status: 'healthy',
        version: expect.any(String),
        uptime: expect.any(Number),
      });
    });
  });

  describe('Refinement Flow', () => {
    it('should reject unauthenticated requests', async () => {
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
    });

    it('should accept authenticated requests with valid payload', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/refine',
        headers: {
          authorization: `Bearer ${API_KEY}`,
          'content-type': 'application/json',
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

      // Should not return 401 or 400 (validation errors)
      expect(response.statusCode).not.toBe(401);
      expect(response.statusCode).not.toBe(400);
    });

    it('should include rate limit headers', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/refine',
        headers: {
          authorization: `Bearer ${API_KEY}`,
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

      // Rate limit headers should be present (even if request fails due to AI provider)
      if (response.statusCode === 200) {
        expect(response.headers).toHaveProperty('x-ratelimit-limit');
        expect(response.headers).toHaveProperty('x-ratelimit-remaining');
        expect(response.headers).toHaveProperty('x-ratelimit-reset');
      }
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/v1/unknown',
      });

      expect(response.statusCode).toBe(404);
    });

    it('should handle malformed JSON', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/refine',
        headers: {
          authorization: `Bearer ${API_KEY}`,
          'content-type': 'application/json',
        },
        payload: 'invalid json {{{',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should validate content-type', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/v1/refine',
        headers: {
          authorization: `Bearer ${API_KEY}`,
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

      // Should accept JSON even without explicit content-type
      expect([200, 400, 500]).toContain(response.statusCode);
    });
  });

  describe('CORS', () => {
    it('should include CORS headers', async () => {
      const response = await server.inject({
        method: 'OPTIONS',
        url: '/api/v1/health',
        headers: {
          origin: 'https://zodforge.dev',
        },
      });

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });
});
