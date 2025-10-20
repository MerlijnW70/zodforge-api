// Health endpoint tests
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { healthRoute } from '../../routes/health.js';

describe('GET /health', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = Fastify({ logger: false });
    await server.register(healthRoute, { prefix: '/api/v1' });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  it('should return 200 OK with health status', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'healthy',
      version: expect.any(String),
      uptime: expect.any(Number),
      services: expect.any(Object),
    });
  });

  it('should include provider/service status', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    const body = response.json();
    expect(body).toHaveProperty('services');
    expect(typeof body.services).toBe('object');
  });

  it('should have version number', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    const body = response.json();
    expect(body.version).toBeDefined();
    expect(typeof body.version).toBe('string');
  });

  it('should have positive uptime', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/health',
    });

    const body = response.json();
    expect(body.uptime).toBeGreaterThan(0);
  });
});
