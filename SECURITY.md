# 🔐 Security Documentation - ZodForge API

## Overview

This document outlines the comprehensive security measures implemented to protect your OpenAI API key and ensure the ZodForge API operates safely in production.

---

## 🛡️ Security Features Implemented

### 1. Environment Variable Protection ✅

**Files**: `src/config/env.ts`, `.gitignore`, `.env.example`

- ✅ **Zod Validation**: All environment variables validated at startup
- ✅ **API Key Masking**: Keys masked in all logs (shows first 7 + last 4 chars only)
- ✅ **Fail-Fast**: Server won't start with invalid/missing keys
- ✅ **Git Protection**: Multiple `.env` patterns in `.gitignore`
- ✅ **Format Validation**: Keys must match expected format (sk-*, zf_*)

**Example**:
```
Original:  sk-proj-CHZb6RamOgaqgD...1bm2EvqdRT2DOplKY7T3BlbkFJn
Masked:    sk-proj********************KY7T
```

### 2. Rate Limiting ✅

**Files**: `src/lib/security.ts`, `src/middleware/auth.ts`

- ✅ **Prevents Abuse**: 100 requests per 15 min (configurable)
- ✅ **Per IP + API Key**: Tracks unique combinations
- ✅ **HTTP 429 Response**: With `retryAfter` time
- ✅ **Rate Limit Headers**: `X-RateLimit-Limit/Remaining/Reset`
- ✅ **Security Audit**: Logs all rate limit violations

**Configuration** (`.env`):
```env
RATE_LIMIT_MAX=100              # Requests per window
RATE_LIMIT_WINDOW=900000        # 15 minutes in ms
```

### 3. Security Auditing ✅

**Files**: `src/lib/security.ts`

Comprehensive logging of all security events with severity levels:

| Severity | Events | Example |
|----------|--------|---------|
| **low** | Normal operations | Successful auth |
| **medium** | Warnings | Missing headers, shutdown |
| **high** | Security concerns | Invalid keys, rate limits |
| **critical** | System failures | Startup failure |

**Events Logged**:
- `auth_success` / `auth_missing_header` / `auth_invalid_key`
- `rate_limit_exceeded`
- `openai_refinement_request` / `openai_refinement_success` / `openai_refinement_error`
- `server_started` / `server_shutdown` / `server_error`

### 4. API Key Sanitization ✅

**Files**: `src/lib/security.ts`

All errors and logs automatically sanitized:
- ✅ Removes OpenAI keys (`sk-*`)
- ✅ Removes ZodForge keys (`zf_*`)
- ✅ Redacts Bearer tokens
- ✅ Masks Authorization headers
- ✅ Sanitizes sensitive patterns

**Functions**:
- `maskApiKey()`: Shows only safe portions
- `sanitizeError()`: Removes keys from error messages
- `redactSensitiveData()`: Removes keys from objects
- `containsSensitiveData()`: Detects sensitive patterns

### 5. Constant-Time Comparison ✅

**Files**: `src/middleware/auth.ts`

Prevents timing attacks using SHA-256 hashing:

```typescript
const providedHash = hashApiKey(apiKey);
const validHash = hashApiKey(env.ZODFORGE_API_KEY);

if (providedHash !== validHash) {
  // Timing-attack resistant
}
```

### 6. Helmet Security Headers ✅

**Files**: `src/server.ts`

- ✅ Content Security Policy (CSP)
- ✅ HTTP Strict Transport Security (HSTS - 1 year)
- ✅ X-Frame-Options
- ✅ X-Content-Type-Options
- ✅ Referrer-Policy

### 7. Request Validation ✅

**Files**: `src/routes/refine.ts`

- ✅ **Zod Schema Validation**: All incoming requests validated
- ✅ **Size Limits**: Max 1MB request body (configurable)
- ✅ **Type Safety**: TypeScript + Zod for complete safety
- ✅ **Sample Limits**: 1-100 samples per request

### 8. Error Handling ✅

**Files**: `src/server.ts`, `src/lib/openai.ts`

- ✅ **Production Mode**: Hides internal errors from clients
- ✅ **Development Mode**: Shows detailed errors for debugging
- ✅ **Sanitized Errors**: All error messages sanitized
- ✅ **Global Handler**: Catches all unhandled errors

### 9. CORS Configuration ✅

**Files**: `src/server.ts`

- **Development**: Allows all origins (`*`)
- **Production**: Restricted to `ALLOWED_ORIGINS` env variable
- **Methods**: Only GET, POST, OPTIONS
- **Headers**: Only Content-Type, Authorization

### 10. Graceful Shutdown ✅

**Files**: `src/server.ts`

- ✅ Handles SIGINT/SIGTERM signals
- ✅ Logs shutdown events
- ✅ Closes server gracefully
- ✅ Cleans up resources

---

## 🔑 OpenAI API Key Protection

Your OpenAI API key is **NEVER**:
- ❌ Logged in plain text
- ❌ Sent to clients
- ❌ Exposed in error messages
- ❌ Committed to git
- ❌ Shown in server startup

Your OpenAI API key **IS**:
- ✅ Stored only in `.env` file
- ✅ Validated at startup
- ✅ Masked when displayed (`sk-proj********************abcd`)
- ✅ Protected by `.gitignore`
- ✅ Used only for OpenAI API calls
- ✅ Timeout-protected (30s max)

---

## 🚀 Setup Instructions

### 1. Copy Environment Template

```bash
cd zodforge-api
cp .env.example .env
```

### 2. Generate Secure API Key

```bash
node -e "console.log('zf_' + require('crypto').randomBytes(32).toString('hex'))"
```

Output: `zf_a1b2c3d4...` (64 hex characters)

### 3. Get OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Create new secret key
3. Copy the key (starts with `sk-proj-` or `sk-`)
4. **IMPORTANT**: Save it immediately (can't view again!)

### 4. Update `.env` File

```env
NODE_ENV=development
PORT=3000
HOST=0.0.0.0

# Get from https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE

# Generate with: node -e "console.log('zf_' + require('crypto').randomBytes(32).toString('hex'))"
ZODFORGE_API_KEY=zf_YOUR_GENERATED_KEY_HERE

# Optional security settings
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000
```

### 5. Verify Security

```bash
npm run dev
```

You should see:
```
✅ Environment variables validated successfully
🔐 OpenAI API Key: sk-proj********************abcd
🔑 ZodForge API Key: zf_a1b2********************xyz
📊 Rate Limit: 100 req/900000ms
```

---

## 🔒 Production Deployment

### Option A: Platform Environment Variables (RECOMMENDED)

**Vercel**:
```bash
vercel env add OPENAI_API_KEY
vercel env add ZODFORGE_API_KEY
```

**Railway**:
```bash
railway variables set OPENAI_API_KEY=sk-...
railway variables set ZODFORGE_API_KEY=zf_...
```

**Heroku**:
```bash
heroku config:set OPENAI_API_KEY=sk-...
heroku config:set ZODFORGE_API_KEY=zf_...
```

### Option B: Docker Secrets

```yaml
# docker-compose.yml
services:
  api:
    image: zodforge-api
    environment:
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ZODFORGE_API_KEY=${ZODFORGE_API_KEY}
    env_file:
      - .env.production
```

### Production Checklist

- [ ] HTTPS enabled (SSL certificate)
- [ ] `NODE_ENV=production`
- [ ] CORS restricted to allowed origins
- [ ] Rate limits configured appropriately
- [ ] OpenAI billing alerts set up
- [ ] External logging service configured
- [ ] Security monitoring enabled
- [ ] Backup keys stored securely
- [ ] Incident response plan documented

---

## 🚨 Security Best Practices

### DO ✅

1. **Rotate keys regularly** (every 90 days recommended)
2. **Use separate keys for dev/staging/production**
3. **Monitor OpenAI usage dashboard**
4. **Set up billing alerts**
5. **Review security audit logs weekly**
6. **Keep packages updated** (`npm audit fix`)
7. **Use strong, unique API keys**
8. **Enable 2FA on OpenAI account**

### DON'T ❌

1. **NEVER commit `.env` files to git**
2. **NEVER share API keys in chat/email/slack**
3. **NEVER log API keys in plain text**
4. **NEVER hardcode API keys in source code**
5. **NEVER use production keys in development**
6. **NEVER expose keys in client-side code**
7. **NEVER reuse API keys across projects**
8. **NEVER ignore security audit logs**

---

## 🔍 Monitoring & Alerts

### OpenAI Usage Monitoring

1. **Set up billing alerts**:
   - Go to https://platform.openai.com/account/billing
   - Set threshold: e.g., $50/month
   - Add email notifications

2. **Monitor usage dashboard**:
   - Daily: Check usage trends
   - Weekly: Review costs
   - Monthly: Analyze patterns

3. **Track API errors**:
   - Check security audit logs for `openai_refinement_error`
   - Investigate HIGH severity events

### Security Audit Logs

Access programmatically:
```typescript
import { securityAuditor } from './lib/security.js';

// Get last 100 logs
const logs = securityAuditor.getLogs(100);

// Filter by severity
const criticalEvents = logs.filter(log => log.severity === 'critical');

// Export for analysis
console.log(JSON.stringify(logs, null, 2));
```

---

## 🆘 Incident Response

### Suspected Key Leak

**IMMEDIATE ACTIONS**:

1. **Revoke the key immediately**:
   - Go to https://platform.openai.com/api-keys
   - Find the compromised key
   - Click "Revoke"

2. **Generate new key**:
   - Create new secret key
   - Update production environment variables
   - Restart server

3. **Investigate**:
   - Check OpenAI usage for anomalies
   - Review security audit logs
   - Identify source of leak

4. **Prevent recurrence**:
   - Update security procedures
   - Train team on security
   - Implement additional monitoring

### Rate Limit Abuse

**SIGNS**:
- Multiple `rate_limit_exceeded` logs
- Same IP hitting limits repeatedly
- Unexpected spike in requests

**ACTIONS**:

1. **Review security logs**:
   ```typescript
   const rateLimitEvents = securityAuditor
     .getLogs(1000)
     .filter(log => log.event === 'rate_limit_exceeded');
   ```

2. **Identify source IPs**

3. **If legitimate traffic**:
   - Increase rate limits temporarily
   - Contact user to discuss usage

4. **If malicious**:
   - Block IPs at infrastructure level
   - Report to hosting provider
   - Consider implementing IP whitelist

---

## 📚 Security Tools & Functions

### Available Functions

```typescript
// API Key Management
maskApiKey(key: string): string
validateApiKeyFormat(key: string): { valid: boolean; error?: string }
hashApiKey(key: string): string
generateApiKey(): string

// Error Sanitization
sanitizeError(error: any): string
containsSensitiveData(str: string): boolean
redactSensitiveData(obj: any): any

// Encryption (Optional)
encryptData(data: string, key: string): string
decryptData(encrypted: string, key: string): string

// Rate Limiting
rateLimiter.checkLimit(identifier: string): { allowed, remaining, resetTime }
rateLimiter.clear(): void

// Security Auditing
securityAuditor.log(event, details, severity): void
securityAuditor.getLogs(limit): Array
securityAuditor.clear(): void
```

---

## 🎯 Security Metrics

Track these KPIs:

| Metric | Target | Check |
|--------|--------|-------|
| API key rotation | Every 90 days | ⏰ Set calendar reminder |
| Failed auth attempts | < 10/day | 📊 Review logs |
| Rate limit hits | < 5/day | 📊 Review logs |
| OpenAI errors | < 1% | 📊 Monitor dashboard |
| Security alerts | 0 high/critical | 🚨 Daily check |
| Package vulnerabilities | 0 high/critical | 🔍 `npm audit` weekly |

---

## ✅ Security Verification

Run this checklist after setup:

```bash
# 1. Check .env is in .gitignore
git check-ignore .env
# Should output: .env

# 2. Verify no secrets in git history
git log --all --full-history --source -- '*.env'
# Should be empty

# 3. Check packages for vulnerabilities
npm audit
# Should show 0 vulnerabilities

# 4. Test server starts with masked keys
npm run dev | grep "🔐"
# Should show: 🔐 OpenAI API Key: sk-proj********************abcd

# 5. Test rate limiting
curl -X POST http://localhost:3000/api/v1/refine \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
# Check X-RateLimit-* headers in response
```

---

## 📖 Additional Resources

- **OpenAI Security**: https://platform.openai.com/docs/guides/safety-best-practices
- **OWASP API Security**: https://owasp.org/www-project-api-security/
- **Node.js Security**: https://nodejs.org/en/docs/guides/security/
- **Fastify Security**: https://www.fastify.io/docs/latest/Guides/Getting-Started/#security

---

**Last Updated**: 2025-10-20
**Version**: 1.0.0
**Status**: ✅ Production Ready

🚀 Generated with [Claude Code](https://claude.com/claude-code)
