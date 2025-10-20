import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getUsageStats } from '../middleware/usage-tracker.js';
import { logSecurityEvent } from '../lib/security.js';

/**
 * Usage statistics route
 * GET /api/v1/usage - Returns usage statistics for the authenticated API key
 */
export async function usageRoute(fastify: FastifyInstance) {
  fastify.get('/usage', async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    // Extract API key from Authorization header
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logSecurityEvent('unauthorized', 'Missing or invalid Authorization header', 'medium');
      reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid Authorization header. Please provide: Authorization: Bearer YOUR_API_KEY',
      });
      return;
    }

    const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Get usage statistics
    const stats = await getUsageStats(apiKey);

    if (!stats) {
      logSecurityEvent('unauthorized', 'Invalid API key or usage tracking not configured', 'medium');
      reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid API key or inactive subscription',
      });
      return;
    }

    // Return usage statistics
    reply.status(200).send({
      success: true,
      data: {
        tier: stats.tier,
        currentPeriod: {
          used: stats.currentPeriod.used,
          limit: stats.currentPeriod.limit === Infinity ? 'unlimited' : stats.currentPeriod.limit,
          remaining: stats.currentPeriod.remaining === Infinity ? 'unlimited' : stats.currentPeriod.remaining,
          resetDate: stats.currentPeriod.resetDate,
          percentUsed:
            stats.currentPeriod.limit === Infinity
              ? 0
              : Math.round((stats.currentPeriod.used / stats.currentPeriod.limit) * 100),
        },
        lastWeek: {
          totalRequests: stats.lastWeek.totalRequests,
          successfulRequests: stats.lastWeek.successfulRequests,
          failedRequests: stats.lastWeek.failedRequests,
          successRate:
            stats.lastWeek.totalRequests > 0
              ? Math.round((stats.lastWeek.successfulRequests / stats.lastWeek.totalRequests) * 100)
              : 0,
          avgProcessingTimeMs: stats.lastWeek.avgProcessingTimeMs,
        },
      },
    });

    // Log successful request (optional - can be removed if too verbose)
    console.info(`[Usage API] Stats requested for tier: ${stats.tier}`);
  } catch (error) {
    console.error('[Usage API] Error fetching usage stats:', error);
    logSecurityEvent('suspicious_activity', 'Exception in usage endpoint', 'high');

    reply.status(500).send({
      error: 'Internal Server Error',
      message: 'An error occurred while fetching usage statistics',
    });
  }
  });
}
