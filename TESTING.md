# ZodForge API Testing Guide

## 📊 Current Test Coverage

**Last Updated**: October 20, 2025

| Category | Coverage |
|----------|----------|
| **Overall** | 38.16% |
| **Routes** | 44.36% ✅ |
| **Security** | 63.85% ✅ |
| **Middleware** | 21.26% |
| **Providers** | 48.51% |

### Test Suite Stats
- **Total Tests**: 42 passing
- **Test Files**: 4
- **Test Duration**: ~11-14 seconds
- **Status**: ✅ All passing

---

## 🧪 Test Structure

```
src/__tests__/
├── routes/
│   ├── health.test.ts          (4 tests)  - Health endpoint
│   └── refine.test.ts          (11 tests) - Refinement endpoint
├── lib/
│   └── security.test.ts        (17 tests) - Security utilities
└── integration/
    └── api.test.ts             (10 tests) - Full API integration
```

---

## 🚀 Running Tests

### Basic Commands

```bash
# Run all tests
npm test

# Watch mode (re-run on file changes)
npm run test:watch

# Coverage report
npm run test:coverage

# UI dashboard
npm run test:ui

# Type checking only
npm run type-check
```

### Example Output

```
✓ src/__tests__/lib/security.test.ts (17 tests) 12ms
✓ src/__tests__/routes/health.test.ts (4 tests) 1907ms
✓ src/__tests__/routes/refine.test.ts (11 tests) 13025ms
✓ src/__tests__/integration/api.test.ts (10 tests) 11356ms

Test Files  4 passed (4)
     Tests  42 passed (42)
  Duration  13.84s
```

---

## 📝 Test Coverage Details

### ✅ Well-Covered (>60%)

| File | Coverage | Status |
|------|----------|--------|
| `routes/health.ts` | 100% | ✅ Excellent |
| `routes/refine.ts` | 74.5% | ✅ Good |
| `lib/security.ts` | 63.85% | ✅ Good |
| `config/env.ts` | 66.66% | ✅ Good |
| `providers/openai-provider.ts` | 86.82% | ✅ Excellent |
| `middleware/auth.ts` | 78.08% | ✅ Good |

### ⚠️ Needs Improvement (<40%)

| File | Coverage | Reason |
|------|----------|--------|
| `server.ts` | 0% | Entry point (tested via integration) |
| `openai.ts` | 0% | Legacy file (replaced by providers) |
| `usage-tracker.ts` | 0% | Supabase integration (needs mocking) |
| `routes/usage.ts` | 0% | Requires Supabase setup |
| `providers/anthropic-provider.ts` | 13.24% | AI provider (needs mocking) |

---

## 🎯 What's Tested

### Health Endpoint (`GET /health`)
✅ Returns 200 OK with status
✅ Includes service/provider status
✅ Has version number
✅ Reports positive uptime

### Refine Endpoint (`POST /refine`)

**Authentication**:
✅ Rejects missing Authorization header (401)
✅ Rejects invalid API key (401)

**Request Validation**:
✅ Rejects missing schema (400)
✅ Rejects missing samples (400)
✅ Rejects empty samples array (400)
✅ Rejects schema code >50KB (400)
✅ Rejects >100 samples (400)

**Valid Requests**:
✅ Accepts valid refinement request
✅ Accepts optional provider option
✅ Accepts optional model and temperature

**Response Format**:
✅ Returns proper error structure on validation failure

### Security Utilities

**maskApiKey**:
✅ Masks OpenAI API keys (shows first 7 + last 4)
✅ Masks ZodForge API keys
✅ Handles short keys (returns `[INVALID]`)

**hashApiKey**:
✅ Generates consistent SHA-256 hash
✅ Generates different hashes for different keys
✅ Is case-sensitive

**validateApiKeyFormat**:
✅ Validates correct OpenAI key format
✅ Validates correct ZodForge key format
✅ Rejects short OpenAI keys
✅ Rejects short ZodForge keys
✅ Rejects unknown key format
✅ Rejects missing keys

**RateLimiter**:
✅ Allows requests within limit
✅ Tracks remaining requests
✅ Provides reset timestamp
✅ Enforces limit after max requests

### Integration Tests

**Server Startup**:
✅ Responds to root endpoint
✅ Has security headers (helmet)

**Health Check Flow**:
✅ Returns healthy status

**Refinement Flow**:
✅ Rejects unauthenticated requests
✅ Accepts authenticated requests with valid payload
✅ Includes rate limit headers

**Error Handling**:
✅ Returns 404 for unknown routes
✅ Handles malformed JSON
✅ Validates content-type

**CORS**:
✅ Includes CORS headers

---

## 🔧 Testing Best Practices

### Writing New Tests

1. **Add tests alongside features** - Don't leave testing for later
2. **Use descriptive test names** - "should reject invalid API key" is better than "test 1"
3. **Test both success and failure cases** - Don't just test the happy path
4. **Use Fastify's inject()** - Faster than supertest, built-in to Fastify

### Example Test Structure

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { myRoute } from '../../routes/my-route.js';

describe('My Route', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = Fastify({ logger: false });
    await server.register(myRoute, { prefix: '/api/v1' });
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  it('should do something', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/my-route',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ success: true });
  });
});
```

---

## 🎯 Coverage Goals

### Current Target: 70%

We're aiming for **70% coverage** on:
- Lines
- Functions
- Branches
- Statements

### Roadmap to 70%

**Phase 1** (Complete ✅): Basic route and security tests (38%)
**Phase 2** (Next): Usage tracking and provider tests (Target: 55%)
**Phase 3** (Future): Server lifecycle and edge cases (Target: 70%+)

---

## 🐛 Common Testing Issues

### Issue: Tests fail with "process.exit unexpectedly called"
**Solution**: Ensure `NODE_ENV=test` or `NODE_ENV=development` is set in `.env`

### Issue: "Environment variable validation failed"
**Solution**: Create `.env` file with required variables:
```env
NODE_ENV=test
OPENAI_API_KEY=sk-proj-test-key-40-chars-minimum-12345678901234567890
ZODFORGE_API_KEY=zf_test_key_minimum_20_characters_1234567890
```

### Issue: Tests timeout after 10 seconds
**Solution**: Increase timeout in vitest.config.ts or use longer `testTimeout`

---

## 📚 Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [Fastify Testing](https://fastify.dev/docs/latest/Guides/Testing/)
- [Test Coverage Thresholds](https://vitest.dev/config/#coverage-thresholds)

---

## 🤝 Contributing

Before submitting a PR:
1. ✅ All tests must pass: `npm test`
2. ✅ Coverage should not decrease: `npm run test:coverage`
3. ✅ Types must check: `npm run type-check`
4. ✅ Add tests for new features

---

**Last Test Run**: October 20, 2025
**Status**: ✅ 42/42 passing
**Version**: 0.2.0
