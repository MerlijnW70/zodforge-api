# ZodForge API (MVP)

AI-powered schema refinement service for ZodForge CLI.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
# Required
OPENAI_API_KEY=sk-your-openai-key-here
ZODFORGE_API_KEY=zf_test_key_for_mvp

# Optional
PORT=3000
NODE_ENV=development
```

Generate a test API key:

```bash
node -e "console.log('zf_' + require('crypto').randomBytes(16).toString('hex'))"
```

### 3. Run Server

```bash
# Development mode (with hot reload)
npm run dev

# Production build
npm run build
npm start
```

## 📡 API Endpoints

### Health Check (No Auth)

```bash
curl http://localhost:3000/api/v1/health
```

Response:
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "uptime": 123,
  "services": {
    "openai": "up"
  }
}
```

### Schema Refinement (Requires Auth)

```bash
curl -X POST http://localhost:3000/api/v1/refine \
  -H "Authorization: Bearer zf_your_api_key" \
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
      { "email": "alice@test.com", "age": 28 },
      { "email": "bob@example.org", "age": 35 }
    ]
  }'
```

Response:
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
        "reason": "Field contains email addresses. Added validation and normalization.",
        "confidence": 0.98
      },
      {
        "field": "age",
        "before": "z.number()",
        "after": "z.number().int().min(0).max(150)",
        "reason": "Age should be a realistic integer between 0-150.",
        "confidence": 0.95
      }
    ],
    "confidence": 0.96
  },
  "suggestions": [
    "Consider making email required with .email() validation"
  ],
  "creditsUsed": 1,
  "creditsRemaining": -1,
  "processingTime": 1247,
  "aiProvider": "openai"
}
```

## 🔑 Authentication

All endpoints except `/health` require authentication via Bearer token:

```
Authorization: Bearer zf_your_api_key_here
```

In MVP, the API key is validated against `ZODFORGE_API_KEY` in `.env`.

## 🏗️ Project Structure

```
zodforge-api/
├── src/
│   ├── server.ts           # Main server entry point
│   ├── config/
│   │   └── env.ts          # Environment validation (Zod)
│   ├── routes/
│   │   ├── health.ts       # GET /api/v1/health
│   │   └── refine.ts       # POST /api/v1/refine
│   ├── lib/
│   │   └── openai.ts       # OpenAI integration
│   ├── middleware/
│   │   └── auth.ts         # API key authentication
│   └── types/
│       └── index.ts        # TypeScript types
├── .env.example            # Environment template
├── tsconfig.json           # TypeScript configuration
└── package.json
```

## 🛠️ Development

```bash
# Run with hot reload
npm run dev

# Type checking
npm run type-check

# Build
npm run build
```

## 📊 What's Working (MVP)

✅ Fastify server with TypeScript
✅ OpenAI integration for schema refinement
✅ Simple API key authentication
✅ Health check endpoint
✅ Schema refinement endpoint
✅ Request validation with Zod
✅ Error handling

## ⏭️ What's Next (Post-MVP)

- [ ] Supabase database for users & API keys
- [ ] Usage tracking & rate limiting (Redis)
- [ ] Anthropic fallback
- [ ] Stripe billing integration
- [ ] Response caching
- [ ] Comprehensive tests
- [ ] Production deployment (Vercel/Railway)

## 🔒 Security Notes

**MVP is NOT production-ready**:
- API key stored in env variable (no database)
- No rate limiting
- No usage tracking
- CORS allows all origins

For production, implement:
- Database-backed API keys
- Redis rate limiting
- Usage limits per user
- Restricted CORS
- Logging & monitoring

## 📝 Testing with ZodForge CLI

Update the CLI's environment to use local API:

```bash
# In main zodforge project
export ZODFORGE_API_URL=http://localhost:3000
export ZODFORGE_API_KEY=zf_your_test_key

# Test refinement
zodforge test-data/user.json --ai-refine
```

## 📖 License

MIT - Same as ZodForge CLI
