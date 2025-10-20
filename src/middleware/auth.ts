// API key authentication middleware with security auditing
import { FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../config/env.js';
import { securityAuditor, rateLimiter, hashApiKey, maskApiKey } from '../lib/security.js';

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const clientIp = request.ip || 'unknown';
  const authHeader = request.headers.authorization;

  // Check for Authorization header
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    securityAuditor.log(
      'auth_missing_header',
      { ip: clientIp, path: request.url },
      'medium'
    );

    return reply.code(401).send({
      success: false,
      error: 'Missing or invalid Authorization header',
      errorCode: 'MISSING_AUTH',
    });
  }

  const apiKey = authHeader.substring(7); // Remove 'Bearer '

  // Validate API key (constant-time comparison for security)
  const providedHash = hashApiKey(apiKey);
  const validHash = hashApiKey(env.ZODFORGE_API_KEY);

  if (providedHash !== validHash) {
    // Log failed authentication attempt
    securityAuditor.log(
      'auth_invalid_key',
      {
        ip: clientIp,
        path: request.url,
        keyPrefix: maskApiKey(apiKey),
      },
      'high'
    );

    return reply.code(401).send({
      success: false,
      error: 'Invalid API key',
      errorCode: 'INVALID_API_KEY',
    });
  }

  // Rate limiting check
  const identifier = `${clientIp}:${apiKey.substring(0, 10)}`;
  const rateLimit = rateLimiter.checkLimit(identifier);

  if (!rateLimit.allowed) {
    securityAuditor.log(
      'rate_limit_exceeded',
      {
        ip: clientIp,
        path: request.url,
        resetTime: new Date(rateLimit.resetTime).toISOString(),
      },
      'high'
    );

    return reply.code(429).send({
      success: false,
      error: 'Rate limit exceeded',
      errorCode: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000),
    });
  }

  // Add rate limit headers
  reply.headers({
    'X-RateLimit-Limit': String(env.RATE_LIMIT_MAX),
    'X-RateLimit-Remaining': String(rateLimit.remaining),
    'X-RateLimit-Reset': String(Math.ceil(rateLimit.resetTime / 1000)),
  });

  // Log successful authentication (low severity - normal operation)
  securityAuditor.log(
    'auth_success',
    {
      ip: clientIp,
      path: request.url,
      remaining: rateLimit.remaining,
    },
    'low'
  );

  // In MVP, we don't track user info
  // In production, this would query database and attach user info to request
}
