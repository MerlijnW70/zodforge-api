# 🚀 ZodForge Cloud API

<div align="center">

**AI-powered schema refinement microservice for ZodForge CLI - Production-ready REST API built with Fastify + TypeScript**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5.0-black?logo=fastify)](https://fastify.dev/)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4-green?logo=openai)](https://openai.com)
[![Deployed](https://img.shields.io/badge/Deployed-Railway-purple)](https://railway.app)

[Quick Start](#-quick-start) · [API Documentation](#-api-endpoints) · [Architecture](#-architecture) · [Deployment](#-deployment)

</div>

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Quick Start](#-quick-start)
- [API Endpoints](#-api-endpoints)
- [Authentication](#-authentication)
- [Architecture](#-architecture)
- [Deployment](#-deployment)
- [Development](#-development)
- [Testing](#-testing)
- [Monitoring](#-monitoring)
- [Security](#-security)

---

## 🎯 Overview

ZodForge Cloud API is the backend microservice that powers AI-driven schema refinement in ZodForge CLI. It analyzes Zod schemas and sample data to suggest intelligent improvements using GPT-4 and Claude AI models.

### What It Does

```
Input Schema (Basic):
z.object({
  email: z.string(),
  age: z.number()
})

↓ AI Analysis ↓

Output Schema (Enhanced):
z.object({
  email: z.string().email().toLowerCase(),  // ✨ Added validation + transform
  age: z.number().int().min(0).max(150)     // ✨ Added realistic constraints
})
```

### Use Cases

- **CLI Integration**: Powers `zodforge --cloud` command
- **Landing Page**: Backend for paid API access
- **Schema Optimization**: Improves existing Zod schemas
- **Pattern Detection**: Identifies common validation patterns

---

## ✨ Features

### 🤖 AI-Powered Analysis
- **GPT-4 Integration**: Primary AI provider for refinement
- **Claude Fallback**: Automatic fallback for reliability
- **Smart Pattern Detection**: Identifies emails, UUIDs, URLs, etc.
- **Constraint Inference**: Suggests realistic min/max values

### 🔐 Authentication & Security
- **API Key Authentication**: Secure Bearer token auth
- **Request Validation**: Zod-based input validation
- **Rate Limiting**: Prevent abuse (coming soon)
- **CORS Protection**: Configurable origins

### ⚡ Performance
- **Fast Response Times**: <2s average
- **Async Processing**: Non-blocking I/O
- **Error Handling**: Graceful degradation
- **Health Checks**: Kubernetes-ready endpoints

### 📊 Monitoring
- **Health Endpoint**: Service status monitoring
- **Usage Tracking**: API call metrics
- **Error Logging**: Structured logging
- **Performance Metrics**: Response times

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **npm** or **pnpm**
- **OpenAI API Key** ([Get one](https://platform.openai.com/api-keys))

### 1. Clone & Install

```bash
# Clone repository
git clone https://github.com/yourusername/zodforge-api.git
cd zodforge-api

# Install dependencies
npm install
```

### 2. Configure Environment

```bash
# Copy template
cp .env.example .env
```

Edit `.env`:

```env
# Required
OPENAI_API_KEY=sk-proj-your-openai-key-here
ZODFORGE_API_KEY=zf_your_test_api_key

# Optional
PORT=3000
NODE_ENV=development
ANTHROPIC_API_KEY=sk-ant-your-key-here  # Optional fallback
```

**Generate Test API Key**:
```bash
node -e "console.log('zf_' + require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Run Server

```bash
# Development (hot reload)
npm run dev

# Production
npm run build
npm start
```

Server runs at: **http://localhost:3000**

### 4. Test API

```bash
# Health check
curl http://localhost:3000/api/v1/health

# Refine schema
curl -X POST http://localhost:3000/api/v1/refine \
  -H "Authorization: Bearer zf_your_test_api_key" \
  -H "Content-Type: application/json" \
  -d @test-request.json
```

---

## 📡 API Endpoints

### GET /api/v1/health

**Health check endpoint** - No authentication required

```bash
curl http://localhost:3000/api/v1/health
```

**Response (200)**:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 12345,
  "timestamp": "2025-10-20T17:30:00.000Z",
  "services": {
    "openai": "up",
    "anthropic": "up"
  }
}
```

---

### POST /api/v1/refine

**AI-powered schema refinement** - Requires authentication

#### Request

```bash
curl -X POST https://api.zodforge.dev/api/v1/refine \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "schema": {
      "code": "z.object({ email: z.string(), age: z.number() })",
      "typeName": "User",
      "fields": {
        "email": "z.string()",
        "age": "z.number()"
      }
    },
    "samples": [
      { "email": "alice@example.com", "age": 28 },
      { "email": "bob@test.org", "age": 35 }
    ]
  }'
```

#### Request Schema

```typescript
{
  schema: {
    code: string;           // Original Zod schema code
    typeName: string;       // Schema name (e.g., "User")
    fields: {               // Individual field definitions
      [key: string]: string;
    }
  };
  samples: Array<Record<string, unknown>>;  // Sample data
}
```

#### Response (200)

```json
{
  "success": true,
  "refinedSchema": {
    "code": "z.object({\n  email: z.string().email().toLowerCase(),\n  age: z.number().int().min(0).max(150)\n})",
    "improvements": [
      {
        "field": "email",
        "before": "z.string()",
        "after": "z.string().email().toLowerCase()",
        "reason": "Detected email pattern. Added validation and normalization.",
        "confidence": 0.98
      },
      {
        "field": "age",
        "before": "z.number()",
        "after": "z.number().int().min(0).max(150)",
        "reason": "Age should be realistic integer. Added constraints.",
        "confidence": 0.95
      }
    ],
    "confidence": 0.96
  },
  "suggestions": [
    "Consider adding .trim() to email for better normalization",
    "You might want .describe() for better documentation"
  ],
  "metadata": {
    "creditsUsed": 1,
    "creditsRemaining": 4999,
    "processingTime": 1247,
    "aiProvider": "openai",
    "modelUsed": "gpt-4-turbo"
  }
}
```

#### Error Responses

**401 Unauthorized**:
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing API key"
}
```

**400 Bad Request**:
```json
{
  "error": "Validation Error",
  "message": "Invalid request body",
  "details": [
    {
      "field": "schema.code",
      "issue": "Required field missing"
    }
  ]
}
```

**429 Too Many Requests**:
```json
{
  "error": "Rate Limit Exceeded",
  "message": "Too many requests. Please try again later.",
  "retryAfter": 60
}
```

**500 Internal Server Error**:
```json
{
  "error": "Internal Server Error",
  "message": "AI refinement failed",
  "fallback": true
}
```

---

## 🔑 Authentication

All endpoints except `/health` require authentication.

### Bearer Token

Include API key in `Authorization` header:

```bash
Authorization: Bearer zf_your_api_key_here
```

### Getting an API Key

**For Development**:
```bash
# Generate test key
node -e "console.log('zf_' + require('crypto').randomBytes(32).toString('hex'))"

# Add to .env
ZODFORGE_API_KEY=zf_generated_key_here
```

**For Production**:
- Visit: https://zodforge.dev
- Purchase subscription (Pro or Enterprise)
- Receive API key via email
- Use in CLI: `zodforge --cloud --api-key YOUR_KEY`

---

## 🏗️ Architecture

### Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Server** | Fastify 5.0 | High-performance HTTP server |
| **Language** | TypeScript 5.0 | Type safety |
| **AI** | OpenAI GPT-4 | Primary AI provider |
| **Fallback** | Anthropic Claude | Reliability |
| **Validation** | Zod | Request/response validation |
| **Hosting** | Railway | Cloud deployment |

### System Design

```
┌─────────────┐
│   Client    │ (ZodForge CLI or Landing Page)
└──────┬──────┘
       │ HTTP POST /api/v1/refine
       │ Authorization: Bearer zf_...
       ▼
┌────────────────────────────┐
│   Fastify Server           │
│   - CORS Middleware        │
│   - Auth Middleware        │
│   - Request Validation     │
└──────┬─────────────────────┘
       │
       ▼
┌────────────────────────────┐
│   Refinement Handler       │
│   - Parse schema           │
│   - Analyze samples        │
│   - Build AI prompt        │
└──────┬─────────────────────┘
       │
       ├──► OpenAI GPT-4 API
       │    (Primary)
       │
       └──► Anthropic Claude
            (Fallback if GPT-4 fails)
       │
       ▼
┌────────────────────────────┐
│   Response Builder         │
│   - Format improvements    │
│   - Calculate confidence   │
│   - Return JSON            │
└────────────────────────────┘
```

### Request Flow

1. **Client sends request** → Fastify receives POST
2. **Auth middleware** → Validates API key
3. **Request validation** → Zod schema check
4. **AI refinement** → OpenAI/Claude analysis
5. **Response formatting** → JSON with improvements
6. **Client receives** → Enhanced schema

---

## 🚀 Deployment

### Railway (Recommended)

**Live URL**: https://web-production-f15d.up.railway.app

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Deploy
railway up

# Set environment variables
railway variables set OPENAI_API_KEY=sk-...
railway variables set ZODFORGE_API_KEY=zf_...

# View logs
railway logs
```

**Automatic Deployments**:
- Connects to GitHub repo
- Auto-deploys on push to `main`
- Zero-downtime deployments

### Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Set environment variables
vercel env add OPENAI_API_KEY
vercel env add ZODFORGE_API_KEY

# Production
vercel --prod
```

### Docker

```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

```bash
# Build
docker build -t zodforge-api .

# Run
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=sk-... \
  -e ZODFORGE_API_KEY=zf_... \
  zodforge-api
```

---

## 💻 Development

### Project Structure

```
zodforge-api/
├── src/
│   ├── server.ts           # Main entry point
│   ├── config/
│   │   └── env.ts          # Environment config (Zod validation)
│   ├── routes/
│   │   ├── health.ts       # Health check endpoint
│   │   └── refine.ts       # Refinement endpoint
│   ├── lib/
│   │   ├── openai.ts       # OpenAI integration
│   │   └── anthropic.ts    # Anthropic integration
│   ├── middleware/
│   │   ├── auth.ts         # API key authentication
│   │   ├── cors.ts         # CORS configuration
│   │   └── error.ts        # Error handling
│   └── types/
│       └── index.ts        # TypeScript types
├── dist/                   # Compiled JavaScript
├── .env.example            # Environment template
├── tsconfig.json           # TypeScript config
└── package.json
```

### Scripts

```bash
# Development
npm run dev              # Start with hot reload
npm run type-check       # TypeScript checking
npm run lint             # ESLint

# Production
npm run build            # Compile TypeScript
npm start                # Run compiled code

# Testing
npm test                 # Run tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report
```

### Adding a New Endpoint

1. **Create route file**:
```typescript
// src/routes/validate.ts
import { FastifyPluginAsync } from 'fastify';

export const validateRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/v1/validate', {
    schema: {
      body: {
        type: 'object',
        required: ['schema'],
        properties: {
          schema: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    // Implementation
    return { valid: true };
  });
};
```

2. **Register in server**:
```typescript
// src/server.ts
import { validateRoute } from './routes/validate';
await fastify.register(validateRoute);
```

3. **Add tests**:
```typescript
// src/routes/validate.test.ts
test('POST /api/v1/validate', async () => {
  // Test implementation
});
```

---

## 🧪 Testing

### Unit Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

### Integration Tests

```bash
# Test against local server
npm run test:integration
```

### Manual Testing

```bash
# Start server
npm run dev

# Test health
curl http://localhost:3000/api/v1/health

# Test refinement
curl -X POST http://localhost:3000/api/v1/refine \
  -H "Authorization: Bearer zf_test_key" \
  -H "Content-Type: application/json" \
  -d @test-request.json
```

---

## 📊 Monitoring

### Health Checks

**Endpoint**: `GET /api/v1/health`

```json
{
  "status": "healthy",
  "services": {
    "openai": "up",      // AI service status
    "anthropic": "up"
  }
}
```

### Metrics

- **Response Times**: Track via logs
- **Error Rates**: Monitor 5xx responses
- **AI Provider Status**: Check fallback usage
- **API Key Usage**: Track per-key requests

### Logging

```typescript
// Structured logging
fastify.log.info({
  endpoint: '/api/v1/refine',
  duration: 1247,
  provider: 'openai',
  success: true
});
```

---

## 🔒 Security

### Security Features

- ✅ **API Key Authentication**: Bearer token required
- ✅ **Request Validation**: Zod schemas prevent injection
- ✅ **CORS Protection**: Configured allowed origins
- ✅ **Rate Limiting**: Coming soon
- ✅ **HTTPS Only**: Enforced in production
- ✅ **Environment Variables**: Secrets never committed
- ✅ **Error Sanitization**: No sensitive data in responses

### Best Practices

**API Keys**:
- Never commit to Git
- Use environment variables
- Rotate regularly
- Revoke compromised keys

**Production Checklist**:
- [ ] Environment variables set
- [ ] HTTPS enforced
- [ ] CORS configured
- [ ] Rate limiting enabled
- [ ] Logging configured
- [ ] Monitoring set up
- [ ] Error tracking enabled

---

## 📚 Additional Resources

- [Fastify Documentation](https://fastify.dev/)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Zod Documentation](https://zod.dev/)

---

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

## 📄 License

MIT License - Same as ZodForge CLI

---

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/zodforge-api/issues)
- **Email**: support@zodforge.dev
- **Documentation**: [docs.zodforge.dev](https://docs.zodforge.dev)

---

<div align="center">

**Built with ❤️ for the TypeScript community**

Made with [Claude Code](https://claude.com/claude-code)

</div>
