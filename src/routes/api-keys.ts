// API Key management endpoints
import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createApiKey, getJwtKeyManager, JwtKeyManager } from '../lib/jwt-keys.js';
import { getAuditLogger } from '../lib/audit-logger.js';
import { authMiddlewareV2 } from '../middleware/auth-v2.js';

/**
 * API key management routes (admin only)
 */
export async function apiKeysRoute(fastify: FastifyInstance) {
  // Apply authentication
  fastify.addHook('preHandler', authMiddlewareV2);

  /**
   * POST /api-keys - Create a new API key
   */
  fastify.post('/api-keys', async (request, reply) => {
    try {
      const CreateKeySchema = z.object({
        customerId: z.string().min(1),
        name: z.string().min(1).max(255),
        tier: z.enum(['free', 'pro', 'enterprise']),
        permissions: z.array(z.string()).optional(),
        expiresIn: z.number().optional(),
        metadata: z.object({
          createdBy: z.string().optional(),
          environment: z.enum(['development', 'production']).optional(),
          ipWhitelist: z.array(z.string()).optional(),
        }).optional(),
      });

      const body = CreateKeySchema.parse(request.body);

      // Only admins can create keys (check request.apiKey.permissions)
      if (!request.apiKey || !request.apiKey.permissions.includes('admin')) {
        return reply.code(403).send({
          success: false,
          error: 'Insufficient permissions. Admin access required.',
          errorCode: 'FORBIDDEN',
        });
      }

      const apiKey = createApiKey(
        body.customerId,
        body.name,
        body.tier,
        {
          permissions: body.permissions,
          expiresIn: body.expiresIn,
          metadata: body.metadata,
        }
      );

      // Extract payload for response
      const manager = getJwtKeyManager();
      const payload = manager.verifyKey(apiKey);

      if (!payload) {
        throw new Error('Failed to verify generated key');
      }

      reply.code(201).send({
        success: true,
        apiKey,
        payload: {
          kid: payload.kid,
          customerId: payload.customerId,
          name: payload.name,
          tier: payload.tier,
          rateLimit: payload.rateLimit,
          quota: payload.quota,
          permissions: payload.permissions,
          createdAt: new Date(payload.iat * 1000).toISOString(),
          ...(payload.exp ? { expiresAt: new Date(payload.exp * 1000).toISOString() } : {}),
        },
        warning: 'Save this API key securely. It will not be shown again.',
      });

    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return reply.code(400).send({
          success: false,
          error: 'Invalid request body',
          details: error.issues,
          errorCode: 'VALIDATION_ERROR',
        });
      }

      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to create API key',
        errorCode: 'INTERNAL_ERROR',
      });
    }
  });

  /**
   * POST /api-keys/:kid/rotate - Rotate an API key
   */
  fastify.post<{ Params: { kid: string } }>('/api-keys/:kid/rotate', async (request, reply) => {
    try {
      const { kid } = request.params;

      // Only owner or admin can rotate
      if (
        !request.apiKey ||
        (request.apiKey.kid !== kid && !request.apiKey.permissions.includes('admin'))
      ) {
        return reply.code(403).send({
          success: false,
          error: 'Insufficient permissions',
          errorCode: 'FORBIDDEN',
        });
      }

      // Get current key (from request if same kid, otherwise need to fetch from DB)
      // For now, we require the current key to be used
      if (request.apiKey.kid !== kid) {
        return reply.code(400).send({
          success: false,
          error: 'Can only rotate your own API key',
          errorCode: 'BAD_REQUEST',
        });
      }

      const manager = getJwtKeyManager();
      const currentKeyString = request.headers.authorization?.substring(7);

      if (!currentKeyString) {
        throw new Error('Missing authorization header');
      }

      const newKey = manager.rotateKey(currentKeyString);

      if (!newKey) {
        return reply.code(400).send({
          success: false,
          error: 'Failed to rotate key',
          errorCode: 'ROTATION_FAILED',
        });
      }

      const payload = manager.verifyKey(newKey);

      reply.code(200).send({
        success: true,
        apiKey: newKey,
        payload: {
          kid: payload?.kid,
          customerId: payload?.customerId,
          name: payload?.name,
          tier: payload?.tier,
          rotatedAt: new Date().toISOString(),
        },
        warning: 'Old key is now invalid. Update your applications.',
      });

    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({
        success: false,
        error: 'Failed to rotate key',
        errorCode: 'INTERNAL_ERROR',
      });
    }
  });

  /**
   * GET /api-keys/me - Get current API key info
   */
  fastify.get('/api-keys/me', async (request, reply) => {
    if (!request.apiKey) {
      return reply.code(401).send({
        success: false,
        error: 'Not authenticated',
        errorCode: 'UNAUTHORIZED',
      });
    }

    const auditLogger = getAuditLogger();

    // Get usage summary
    const monthlyUsage = await auditLogger.getUsageSummary(request.apiKey.kid, 'month');
    const dailyUsage = await auditLogger.getUsageSummary(request.apiKey.kid, 'day');

    reply.code(200).send({
      success: true,
      key: {
        kid: request.apiKey.kid,
        customerId: request.apiKey.customerId,
        name: request.apiKey.name,
        tier: request.apiKey.tier,
        rateLimit: request.apiKey.rateLimit,
        quota: request.apiKey.quota,
        permissions: request.apiKey.permissions,
        createdAt: new Date(request.apiKey.iat * 1000).toISOString(),
        ...(request.apiKey.exp ? { expiresAt: new Date(request.apiKey.exp * 1000).toISOString() } : {}),
        ...(request.apiKey.metadata ? { metadata: request.apiKey.metadata } : {}),
      },
      usage: {
        monthly: monthlyUsage ? {
          requests: monthlyUsage.requestCount,
          successRate: monthlyUsage.successCount / monthlyUsage.requestCount,
          totalTokens: monthlyUsage.totalTokens,
          totalCost: monthlyUsage.totalCost,
          avgLatency: monthlyUsage.avgLatencyMs,
        } : null,
        daily: dailyUsage ? {
          requests: dailyUsage.requestCount,
          successRate: dailyUsage.successCount / dailyUsage.requestCount,
          totalTokens: dailyUsage.totalTokens,
          totalCost: dailyUsage.totalCost,
        } : null,
      },
    });
  });

  /**
   * GET /api-keys/tiers - Get available tiers with limits
   */
  fastify.get('/api-keys/tiers', async (_request, reply) => {
    reply.code(200).send({
      success: true,
      tiers: {
        free: JwtKeyManager.getTierDefaults('free'),
        pro: JwtKeyManager.getTierDefaults('pro'),
        enterprise: JwtKeyManager.getTierDefaults('enterprise'),
      },
    });
  });
}
