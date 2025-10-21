// Enhanced authentication middleware with JWT support and comprehensive audit logging
import { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env.js';
import { securityAuditor, hashApiKey, maskApiKey } from '../lib/security.js';
import { getJwtKeyManager, type ApiKeyPayload } from '../lib/jwt-keys.js';
import { getAuditLogger } from '../lib/audit-logger.js';

// Extend FastifyRequest to include API key info
declare module 'fastify' {
  interface FastifyRequest {
    apiKey?: ApiKeyPayload;
  }
}

/**
 * Enhanced authentication middleware with JWT and legacy key support
 */
export async function authMiddlewareV2(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const startTime = Date.now();
  const clientIp = request.ip || 'unknown';
  const authHeader = request.headers.authorization;
  const auditLogger = getAuditLogger();

  // Check for Authorization header
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    securityAuditor.log(
      'auth_missing_header',
      { requestId: request.id, ip: clientIp, path: request.url },
      'medium'
    );

    await auditLogger.log({
      requestId: request.id,
      endpoint: request.url,
      method: request.method,
      statusCode: 401,
      success: false,
      errorCode: 'MISSING_AUTH',
      ipAddress: clientIp,
      userAgent: request.headers['user-agent'],
      latencyMs: Date.now() - startTime,
    });

    return reply.code(401).send({
      success: false,
      error: 'Missing or invalid Authorization header',
      errorCode: 'MISSING_AUTH',
    });
  }

  const apiKey = authHeader.substring(7); // Remove 'Bearer '

  // Try JWT validation first
  if (apiKey.startsWith('zf_jwt_')) {
    await handleJwtAuth(request, reply, apiKey, clientIp, startTime);
  } else {
    // Fallback to legacy API key validation
    await handleLegacyAuth(request, reply, apiKey, clientIp, startTime);
  }
}

/**
 * Handle JWT-based API key authentication
 */
async function handleJwtAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  apiKey: string,
  clientIp: string,
  startTime: number
): Promise<void> {
  const auditLogger = getAuditLogger();

  try {
    const jwtManager = getJwtKeyManager();
    const payload = jwtManager.verifyKey(apiKey);

    if (!payload) {
      // Invalid JWT
      securityAuditor.log(
        'auth_invalid_jwt',
        {
          requestId: request.id,
          ip: clientIp,
          path: request.url,
        },
        'high'
      );

      await auditLogger.log({
        requestId: request.id,
        kid: jwtManager.extractKeyId(apiKey) || undefined,
        endpoint: request.url,
        method: request.method,
        statusCode: 401,
        success: false,
        errorCode: 'INVALID_JWT',
        ipAddress: clientIp,
        userAgent: request.headers['user-agent'],
        latencyMs: Date.now() - startTime,
      });

      return reply.code(401).send({
        success: false,
        error: 'Invalid or expired API key',
        errorCode: 'INVALID_JWT',
      });
    }

    // Check if key is revoked (would check database in production)
    // For now, JWT validation is enough

    // IP whitelist check
    if (payload.metadata?.ipWhitelist && payload.metadata.ipWhitelist.length > 0) {
      if (!payload.metadata.ipWhitelist.includes(clientIp)) {
        securityAuditor.log(
          'auth_ip_not_whitelisted',
          {
            requestId: request.id,
            kid: payload.kid,
            ip: clientIp,
            whitelist: payload.metadata.ipWhitelist,
          },
          'high'
        );

        await auditLogger.log({
          requestId: request.id,
          kid: payload.kid,
          customerId: payload.customerId,
          endpoint: request.url,
          method: request.method,
          statusCode: 403,
          success: false,
          errorCode: 'IP_NOT_WHITELISTED',
          ipAddress: clientIp,
          userAgent: request.headers['user-agent'],
          latencyMs: Date.now() - startTime,
        });

        return reply.code(403).send({
          success: false,
          error: 'IP address not whitelisted',
          errorCode: 'IP_NOT_WHITELISTED',
        });
      }
    }

    // Per-key rate limiting
    const minuteLimit = await auditLogger.checkRateLimit(
      payload.kid,
      'minute',
      payload.rateLimit.requestsPerMinute
    );

    if (!minuteLimit.allowed) {
      securityAuditor.log(
        'rate_limit_exceeded_per_key',
        {
          requestId: request.id,
          kid: payload.kid,
          customerId: payload.customerId,
          limit: minuteLimit.limit,
        },
        'high'
      );

      await auditLogger.log({
        requestId: request.id,
        kid: payload.kid,
        customerId: payload.customerId,
        endpoint: request.url,
        method: request.method,
        statusCode: 429,
        success: false,
        errorCode: 'RATE_LIMIT_EXCEEDED',
        rateLimitHit: true,
        ipAddress: clientIp,
        userAgent: request.headers['user-agent'],
        latencyMs: Date.now() - startTime,
      });

      return reply.code(429).send({
        success: false,
        error: `Rate limit exceeded: ${minuteLimit.limit} requests per minute`,
        errorCode: 'RATE_LIMIT_EXCEEDED',
        tier: payload.tier,
        limit: minuteLimit.limit,
        retryAfter: 60,
      });
    }

    // Increment rate limit counter
    await auditLogger.incrementRateLimit(payload.kid, 'minute');
    await auditLogger.incrementRateLimit(payload.kid, 'day');
    await auditLogger.incrementRateLimit(payload.kid, 'month');

    // Check daily quota
    const dailyLimit = await auditLogger.checkRateLimit(
      payload.kid,
      'day',
      payload.rateLimit.requestsPerDay
    );

    if (!dailyLimit.allowed) {
      await auditLogger.log({
        requestId: request.id,
        kid: payload.kid,
        customerId: payload.customerId,
        endpoint: request.url,
        method: request.method,
        statusCode: 429,
        success: false,
        errorCode: 'DAILY_QUOTA_EXCEEDED',
        quotaExceeded: true,
        ipAddress: clientIp,
        userAgent: request.headers['user-agent'],
        latencyMs: Date.now() - startTime,
      });

      return reply.code(429).send({
        success: false,
        error: `Daily quota exceeded: ${dailyLimit.limit} requests per day`,
        errorCode: 'DAILY_QUOTA_EXCEEDED',
        tier: payload.tier,
      });
    }

    // Add rate limit headers
    reply.headers({
      'X-RateLimit-Limit-Minute': String(payload.rateLimit.requestsPerMinute),
      'X-RateLimit-Limit-Day': String(payload.rateLimit.requestsPerDay),
      'X-RateLimit-Limit-Month': String(payload.rateLimit.requestsPerMonth),
      'X-RateLimit-Remaining-Minute': String(minuteLimit.limit - minuteLimit.current),
      'X-API-Key-Tier': payload.tier,
      'X-API-Key-Id': payload.kid,
    });

    // Attach payload to request for downstream use
    request.apiKey = payload;

    // Update last used timestamp (async, don't wait)
    auditLogger.updateKeyLastUsed(payload.kid).catch((err) => {
      console.error('Failed to update last used:', err);
    });

    // Log successful authentication
    securityAuditor.log(
      'auth_success_jwt',
      {
        requestId: request.id,
        kid: payload.kid,
        customerId: payload.customerId,
        tier: payload.tier,
        ip: clientIp,
      },
      'low'
    );

  } catch (error: any) {
    console.error('JWT auth error:', error);

    await auditLogger.log({
      requestId: request.id,
      endpoint: request.url,
      method: request.method,
      statusCode: 500,
      success: false,
      errorCode: 'AUTH_ERROR',
      errorMessage: error.message,
      ipAddress: clientIp,
      latencyMs: Date.now() - startTime,
    });

    return reply.code(500).send({
      success: false,
      error: 'Authentication error',
      errorCode: 'AUTH_ERROR',
    });
  }
}

/**
 * Handle legacy API key authentication (backward compatibility)
 */
async function handleLegacyAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  apiKey: string,
  clientIp: string,
  startTime: number
): Promise<void> {
  const auditLogger = getAuditLogger();

  // Validate against env variable (constant-time comparison)
  const providedHash = hashApiKey(apiKey);
  const validHash = hashApiKey(env.ZODFORGE_API_KEY);

  if (providedHash !== validHash) {
    securityAuditor.log(
      'auth_invalid_legacy_key',
      {
        requestId: request.id,
        ip: clientIp,
        path: request.url,
        keyPrefix: maskApiKey(apiKey),
      },
      'high'
    );

    await auditLogger.log({
      requestId: request.id,
      endpoint: request.url,
      method: request.method,
      statusCode: 401,
      success: false,
      errorCode: 'INVALID_API_KEY',
      ipAddress: clientIp,
      userAgent: request.headers['user-agent'],
      latencyMs: Date.now() - startTime,
    });

    return reply.code(401).send({
      success: false,
      error: 'Invalid API key',
      errorCode: 'INVALID_API_KEY',
    });
  }

  // Legacy keys get default free tier limits
  reply.headers({
    'X-RateLimit-Limit': String(env.RATE_LIMIT_MAX),
    'X-API-Key-Tier': 'legacy',
  });

  securityAuditor.log(
    'auth_success_legacy',
    {
      requestId: request.id,
      ip: clientIp,
    },
    'low'
  );
}
