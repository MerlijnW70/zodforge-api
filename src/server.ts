// ZodForge API Server - Secured entry point
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import { env, getMaskedEnv } from './config/env.js';
import { healthRoute } from './routes/health.js';
import { refineRoute } from './routes/refine.js';
import { usageRoute } from './routes/usage.js';
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
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// Routes
await server.register(healthRoute, { prefix: '/api/v1' });
await server.register(refineRoute, { prefix: '/api/v1' });
await server.register(usageRoute, { prefix: '/api/v1' });

// Root endpoint
server.get('/', async (_request, _reply) => {
  return {
    name: 'ZodForge API',
    version: '0.1.0',
    status: 'running',
    docs: '/api/v1/health',
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
║   🚀 ZodForge API Server (MVP) - SECURED                  ║
║                                                           ║
║   Status:  Running                                        ║
║   Version: 0.1.0                                          ║
║   Port:    ${env.PORT}                                            ║
║   Env:     ${env.NODE_ENV}                                    ║
║                                                           ║
║   Endpoints:                                              ║
║   GET  /                       - API info                 ║
║   GET  /api/v1/health          - Health check             ║
║   POST /api/v1/refine          - Schema refinement (🔒)   ║
║   GET  /api/v1/usage           - Usage statistics (🔒)    ║
║                                                           ║
║   Security:                                               ║
║   🔐 OpenAI API Key:  Protected ✓                         ║
║   🔒 Rate Limiting:   ${env.RATE_LIMIT_MAX} req/15min ✓                    ║
║   🛡️  Helmet:         Enabled ✓                           ║
║   🔑 API Auth:        Required ✓                          ║
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
