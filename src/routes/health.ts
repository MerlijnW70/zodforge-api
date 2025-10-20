// Health check endpoint
import { FastifyInstance } from 'fastify';
import { providerFactory } from '../lib/providers/factory.js';
import type { HealthCheckResponse } from '../types/index.js';

const startTime = Date.now();

export async function healthRoute(fastify: FastifyInstance) {
  fastify.get('/health', async (_request, reply) => {
    // Check all AI providers
    const providerStatuses = await providerFactory.checkAllProviders();

    const uptime = Math.floor((Date.now() - startTime) / 1000);

    // System is healthy if at least one provider is up
    const hasAnyProviderUp = Object.values(providerStatuses).some((status) => status === true);
    const overallStatus = hasAnyProviderUp ? 'healthy' : 'degraded';

    // Convert boolean statuses to 'up' | 'down'
    const services: Record<string, 'up' | 'down'> = {};
    for (const [provider, isUp] of Object.entries(providerStatuses)) {
      services[provider] = isUp ? 'up' : 'down';
    }

    const response: HealthCheckResponse = {
      status: overallStatus,
      version: '0.2.0', // Phase 2 with multi-provider support
      uptime,
      services,
    };

    reply.code(overallStatus === 'healthy' ? 200 : 503).send(response);
  });
}
