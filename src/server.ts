// ZodForge API Server - Secured entry point
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { env, getMaskedEnv } from './config/env.js';
import { healthRoute } from './routes/health.js';
import { refineRoute } from './routes/refine.js';
import { usageRoute } from './routes/usage.js';
import { adminRoute } from './routes/admin.js';
import { versionRoute } from './routes/version.js';
import { apiKeysRoute } from './routes/api-keys.js';
import { versioningMiddleware } from './middleware/versioning.js';
import { securityAuditor } from './lib/security.js';

const server = Fastify({
  logger: {
    level: env.LOG_LEVEL || 'info',
  },
  bodyLimit: env.MAX_REQUEST_SIZE,
  requestIdLogLabel: 'reqId',
});

// Security headers with helmet
await server.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
});

// CORS configuration
await server.register(cors, {
  origin: env.NODE_ENV === 'production' ? process.env.ALLOWED_ORIGINS?.split(',') || false : '*',
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Version'],
  exposedHeaders: ['X-API-Version', 'X-API-Min-Version', 'X-API-Deprecation', 'X-API-Sunset', 'X-API-Changelog'],
});

// Global versioning middleware - adds version headers to all responses
server.addHook('preHandler', versioningMiddleware);

// Routes
await server.register(healthRoute, { prefix: '/api/v1' });
await server.register(refineRoute, { prefix: '/api/v1' });
await server.register(usageRoute, { prefix: '/api/v1' });
await server.register(adminRoute, { prefix: '/api/v1' });
await server.register(versionRoute, { prefix: '/api/v1' });
await server.register(apiKeysRoute, { prefix: '/api/v1' });

// Root endpoint
server.get('/', async (_request, _reply) => {
  return {
    name: 'ZodForge API',
    version: '1.2.0',
    status: 'running',
    endpoints: {
      health: '/api/v1/health',
      version: '/api/v1/version',
      refine: '/api/v1/refine',
      admin: '/api/v1/admin/dashboard',
      apiKeys: {
        create: 'POST /api/v1/api-keys',
        rotate: 'POST /api/v1/api-keys/:kid/rotate',
        me: 'GET /api/v1/api-keys/me',
        tiers: 'GET /api/v1/api-keys/tiers',
      },
    },
    docs: 'https://docs.zodforge.com',
    changelog: 'https://github.com/MerlijnW70/zodforge-api/blob/main/CHANGELOG.md',
  };
});

// Global error handler
server.setErrorHandler((error, request, reply) => {
  // Security audit log
  securityAuditor.log(
    'server_error',
    {
      error: error.message,
      code: error.code,
      path: request.url,
      method: request.method,
    },
    'high'
  );

  // Don't expose internal errors in production
  const isDev = env.NODE_ENV === 'development';
  reply.status(error.statusCode || 500).send({
    success: false,
    error: isDev ? error.message : 'Internal server error',
    errorCode: error.code || 'INTERNAL_ERROR',
  });
});

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    console.log(`\n🛑 ${signal} received, shutting down gracefully...`);
    securityAuditor.log('server_shutdown', { signal }, 'medium');

    await server.close();
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Start server
const start = async () => {
  try {
    await server.listen({
      port: env.PORT,
      host: env.HOST,
    });

    // Log startup with security info
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 ZodForge API Server V2 - SECURITY ENHANCED           ║
║                                                           ║
║   Status:  Running                                        ║
║   Version: 1.2.0 (stable)                                 ║
║   Port:    ${env.PORT}                                            ║
║   Env:     ${env.NODE_ENV}                                    ║
║                                                           ║
║   Core Endpoints:                                         ║
║   GET  /                       - API info                 ║
║   GET  /api/v1/version         - Version info             ║
║   GET  /api/v1/health          - Health check             ║
║   POST /api/v1/refine          - Schema refinement (🔒)   ║
║   GET  /api/v1/usage           - Usage statistics (🔒)    ║
║   GET  /api/v1/admin/dashboard - Admin dashboard (🔒)     ║
║                                                           ║
║   API Key Management:                                     ║
║   POST /api/v1/api-keys        - Create API key (admin)   ║
║   POST /api/v1/api-keys/:kid/rotate - Rotate key          ║
║   GET  /api/v1/api-keys/me     - Key info + usage         ║
║   GET  /api/v1/api-keys/tiers  - Tier information         ║
║                                                           ║
║   Enhanced Features:                                      ║
║   💾 Response Cache:  Enabled ✓                           ║
║   ⏱️  Rate Limiting:   Per-Key + Provider ✓               ║
║   💰 Cost Tracking:   Enabled ✓                           ║
║   📊 Metrics:         Enabled ✓                           ║
║   🏷️  Versioning:     Semantic (1.2.0) ✓                  ║
║                                                           ║
║   Security (NEW):                                         ║
║   🔐 JWT Keys:        ${env.JWT_SECRET ? 'Enabled ✓' : 'Disabled ⚠️'}                        ║
║   📝 Audit Logging:   ${env.AUDIT_LOGGING_ENABLED ? 'Enabled ✓' : 'Disabled'}                        ║
║   🔒 Secrets Mgr:     ${env.SECRETS_PROVIDER} ✓                          ║
║   🛡️  Helmet:         Enabled ✓                           ║
║   🔑 API Auth:        Required ✓                          ║
║   📋 Changelog:       /CHANGELOG.md ✓                     ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
    `);

    // Log masked environment (safe to display)
    if (env.NODE_ENV === 'development') {
      console.log('📊 Configuration:', getMaskedEnv());
      console.log('');
    }

    // Security audit: Server started
    securityAuditor.log(
      'server_started',
      {
        port: env.PORT,
        env: env.NODE_ENV,
        rateLimit: env.RATE_LIMIT_MAX,
      },
      'medium'
    );
  } catch (err) {
    console.error('❌ Server failed to start:', err);
    securityAuditor.log('server_start_failed', { error: String(err) }, 'critical');
    process.exit(1);
  }
};

start();
