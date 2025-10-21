// Admin dashboard endpoint for monitoring provider system
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import {
  providerFactoryV2,
  responseCache,
  rateLimiter,
  costTracker,
  metricsCollector,
  configManager,
  providerRegistry,
} from '../lib/providers/index.js';

// Admin auth middleware (could be extended with admin-specific auth)
const adminAuthMiddleware = authMiddleware; // For now, same as regular auth

/**
 * Admin routes for provider system monitoring and management
 */
export async function adminRoute(fastify: FastifyInstance) {
  // Apply authentication middleware
  fastify.addHook('preHandler', adminAuthMiddleware);

  /**
   * GET /admin/dashboard - Complete system overview
   */
  fastify.get('/admin/dashboard', async (request, reply) => {
    try {
      const allProviders = providerFactoryV2.getAllProviders();
      const config = configManager.getConfig();

      const dashboard = {
        timestamp: new Date().toISOString(),
        system: {
          config: {
            strategy: config.strategy,
            enableFallback: config.enableFallback,
            enableCache: config.enableCache,
            enableRateLimiting: config.enableRateLimiting,
            enableCostTracking: config.enableCostTracking,
            enableMetrics: config.enableMetrics,
            requestTimeout: config.requestTimeout,
            dailyBudgetLimit: config.dailyBudgetLimit,
          },
          providers: allProviders.map((p) => ({
            name: p.name,
            displayName: p.metadata.displayName,
            enabled: p.metadata.enabled,
            priority: p.metadata.priority,
            weight: p.metadata.weight,
            health: providerRegistry.getHealthStatus(p.name),
            features: p.metadata.features,
          })),
        },
        cache: responseCache.getStats(),
        rateLimits: rateLimiter.getAllStatuses(),
        costs: {
          overall: costTracker.getSummary(),
          today: costTracker.getSummary(getTodayStart()),
        },
        metrics: {
          overall: metricsCollector.getAllMetrics(),
          topProviders: metricsCollector.getTopProviders(5),
          fastestProviders: metricsCollector.getFastestProviders(5),
        },
      };

      reply.code(200).send(dashboard);
    } catch (error: any) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to fetch dashboard data',
      });
    }
  });

  /**
   * GET /admin/providers - List all providers with details
   */
  fastify.get('/admin/providers', async (request, reply) => {
    try {
      const providers = providerFactoryV2.getAllProviders();

      const providerDetails = providers.map((p) => ({
        name: p.name,
        displayName: p.metadata.displayName,
        description: p.metadata.description,
        enabled: p.metadata.enabled,
        priority: p.metadata.priority,
        weight: p.metadata.weight,
        health: providerRegistry.getHealthStatus(p.name),
        metadata: {
          costPerInputToken: p.metadata.costPerInputToken,
          costPerOutputToken: p.metadata.costPerOutputToken,
          maxRequestsPerMinute: p.metadata.maxRequestsPerMinute,
          maxTokensPerRequest: p.metadata.maxTokensPerRequest,
          features: p.metadata.features,
        },
        metrics: metricsCollector.getMetrics(p.name),
      }));

      reply.code(200).send({
        success: true,
        providers: providerDetails,
      });
    } catch (error: any) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to fetch providers',
      });
    }
  });

  /**
   * POST /admin/providers/:name/enable - Enable/disable a provider
   */
  fastify.post<{ Params: { name: string }; Body: { enabled: boolean } }>(
    '/admin/providers/:name/enable',
    async (request, reply) => {
      try {
        const { name } = request.params;
        const { enabled } = z.object({ enabled: z.boolean() }).parse(request.body);

        const success = providerFactoryV2.setProviderEnabled(name, enabled);

        if (success) {
          reply.code(200).send({
            success: true,
            message: `Provider ${name} ${enabled ? 'enabled' : 'disabled'}`,
          });
        } else {
          reply.code(404).send({
            success: false,
            error: `Provider ${name} not found`,
          });
        }
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          reply.code(400).send({
            success: false,
            error: 'Invalid request body',
          });
        } else {
          fastify.log.error(error);
          reply.code(500).send({
            success: false,
            error: 'Failed to update provider',
          });
        }
      }
    }
  );

  /**
   * POST /admin/providers/:name/priority - Update provider priority
   */
  fastify.post<{ Params: { name: string }; Body: { priority: number } }>(
    '/admin/providers/:name/priority',
    async (request, reply) => {
      try {
        const { name } = request.params;
        const { priority } = z.object({ priority: z.number().min(0).max(100) }).parse(request.body);

        const success = providerFactoryV2.setProviderPriority(name, priority);

        if (success) {
          reply.code(200).send({
            success: true,
            message: `Provider ${name} priority set to ${priority}`,
          });
        } else {
          reply.code(404).send({
            success: false,
            error: `Provider ${name} not found`,
          });
        }
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          reply.code(400).send({
            success: false,
            error: 'Invalid request body. Priority must be between 0 and 100',
          });
        } else {
          fastify.log.error(error);
          reply.code(500).send({
            success: false,
            error: 'Failed to update provider priority',
          });
        }
      }
    }
  );

  /**
   * POST /admin/config - Update system configuration
   */
  fastify.post('/admin/config', async (request, reply) => {
    try {
      const ConfigUpdateSchema = z.object({
        strategy: z.enum(['priority', 'cost', 'performance', 'round-robin', 'weighted', 'manual']).optional(),
        enableFallback: z.boolean().optional(),
        maxFallbackAttempts: z.number().min(0).max(10).optional(),
        enableCache: z.boolean().optional(),
        cacheTTL: z.number().min(0).optional(),
        enableRateLimiting: z.boolean().optional(),
        enableCostTracking: z.boolean().optional(),
        enableMetrics: z.boolean().optional(),
        requestTimeout: z.number().min(1000).max(120000).optional(),
        dailyBudgetLimit: z.number().min(0).optional(),
      });

      const updates = ConfigUpdateSchema.parse(request.body);
      configManager.updateConfig(updates);

      reply.code(200).send({
        success: true,
        message: 'Configuration updated',
        config: configManager.getConfig(),
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        reply.code(400).send({
          success: false,
          error: 'Invalid configuration',
          details: error.errors,
        });
      } else {
        fastify.log.error(error);
        reply.code(500).send({
          success: false,
          error: 'Failed to update configuration',
        });
      }
    }
  });

  /**
   * GET /admin/cache/stats - Get cache statistics
   */
  fastify.get('/admin/cache/stats', async (request, reply) => {
    try {
      const stats = responseCache.getStats();
      reply.code(200).send({
        success: true,
        stats,
      });
    } catch (error: any) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to fetch cache stats',
      });
    }
  });

  /**
   * POST /admin/cache/clear - Clear response cache
   */
  fastify.post('/admin/cache/clear', async (request, reply) => {
    try {
      providerFactoryV2.clearCache();
      reply.code(200).send({
        success: true,
        message: 'Cache cleared',
      });
    } catch (error: any) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to clear cache',
      });
    }
  });

  /**
   * GET /admin/costs - Get cost analytics
   */
  fastify.get('/admin/costs', async (request, reply) => {
    try {
      const { period } = z.object({
        period: z.enum(['overall', 'today', 'week', 'month']).optional().default('overall'),
      }).parse(request.query);

      let since: Date | undefined;
      if (period === 'today') {
        since = getTodayStart();
      } else if (period === 'week') {
        since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      } else if (period === 'month') {
        since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      }

      const summary = costTracker.getSummary(since);

      reply.code(200).send({
        success: true,
        period,
        summary,
      });
    } catch (error: any) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to fetch cost data',
      });
    }
  });

  /**
   * GET /admin/costs/export - Export costs as CSV
   */
  fastify.get('/admin/costs/export', async (request, reply) => {
    try {
      const csv = costTracker.exportCSV();
      reply
        .code(200)
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', 'attachment; filename="costs.csv"')
        .send(csv);
    } catch (error: any) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to export costs',
      });
    }
  });

  /**
   * GET /admin/metrics - Get provider metrics
   */
  fastify.get('/admin/metrics', async (request, reply) => {
    try {
      const { provider, period } = z.object({
        provider: z.string().optional(),
        period: z.enum(['overall', 'today', 'week', 'month']).optional().default('overall'),
      }).parse(request.query);

      let since: Date | undefined;
      if (period === 'today') {
        since = getTodayStart();
      } else if (period === 'week') {
        since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      } else if (period === 'month') {
        since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      }

      if (provider) {
        const metrics = metricsCollector.getMetrics(provider, since);
        const errorBreakdown = metricsCollector.getErrorBreakdown(provider, since);
        const timeline = metricsCollector.getTimeline(provider, 3600000, since); // 1 hour intervals

        reply.code(200).send({
          success: true,
          provider,
          period,
          metrics,
          errorBreakdown,
          timeline,
        });
      } else {
        const allMetrics = metricsCollector.getAllMetrics(since);
        const topProviders = metricsCollector.getTopProviders(5, since);
        const fastestProviders = metricsCollector.getFastestProviders(5, since);

        reply.code(200).send({
          success: true,
          period,
          metrics: allMetrics,
          topProviders,
          fastestProviders,
        });
      }
    } catch (error: any) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to fetch metrics',
      });
    }
  });

  /**
   * POST /admin/rate-limits/reset - Reset rate limits
   */
  fastify.post('/admin/rate-limits/reset', async (request, reply) => {
    try {
      const { provider } = z.object({
        provider: z.string().optional(),
      }).parse(request.body);

      if (provider) {
        rateLimiter.reset(provider);
        reply.code(200).send({
          success: true,
          message: `Rate limit reset for ${provider}`,
        });
      } else {
        providerFactoryV2.resetRateLimits();
        reply.code(200).send({
          success: true,
          message: 'All rate limits reset',
        });
      }
    } catch (error: any) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to reset rate limits',
      });
    }
  });

  /**
   * GET /admin/health - Health check for all providers
   */
  fastify.get('/admin/health', async (request, reply) => {
    try {
      const health = await providerFactoryV2.checkAllProviders();
      const allHealthy = Object.values(health).every((h) => h === true);

      reply.code(200).send({
        success: true,
        healthy: allHealthy,
        providers: health,
      });
    } catch (error: any) {
      fastify.log.error(error);
      reply.code(500).send({
        success: false,
        error: 'Failed to check provider health',
      });
    }
  });
}

/**
 * Helper: Get start of today (00:00:00)
 */
function getTodayStart(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}
