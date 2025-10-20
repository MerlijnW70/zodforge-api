// Health check endpoint
import { FastifyInstance } from 'fastify';
import { openai } from '../lib/openai.js';
import type { HealthCheckResponse } from '../types/index.js';

const startTime = Date.now();

export async function healthRoute(fastify: FastifyInstance) {
  fastify.get('/health', async (_request, reply) => {
    // Check OpenAI availability
    let openaiStatus: 'up' | 'down' | 'unknown' = 'unknown';
    try {
      await openai.models.list();
      openaiStatus = 'up';
    } catch {
      openaiStatus = 'down';
    }

    const uptime = Math.floor((Date.now() - startTime) / 1000);
    const overallStatus = openaiStatus === 'up' ? 'healthy' : 'degraded';

    const response: HealthCheckResponse = {
      status: overallStatus,
      version: '0.1.0',
      uptime,
      services: {
        openai: openaiStatus,
      },
    };

    reply.code(overallStatus === 'healthy' ? 200 : 503).send(response);
  });
}
