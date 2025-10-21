# Security Setup Guide - JWT Keys, Audit Logging & Secrets Manager

## 🔐 Overview

ZodForge API V1.2.0 introduces enhanced security features:

- **JWT-based API Keys** - Stateless validation with embedded permissions
- **Per-Key Rate Limiting** - Individual limits per customer/tier
- **Comprehensive Audit Logging** - Full request tracking in Supabase
- **Secrets Manager Integration** - Secure storage for provider API keys
- **Quota Tracking** - Token and cost limits per key

---

## 🚀 Quick Start

### 1. Environment Variables

Update your `.env` file:

```bash
# JWT Secret (REQUIRED - generate with: openssl rand -base64 32)
JWT_SECRET=your-super-secret-jwt-signing-key-here

# Supabase (for audit logging & rate limiting)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Enable audit logging (default: true)
AUDIT_LOGGING_ENABLED=true

# Secrets Manager (optional - defaults to environment variables)
SECRETS_PROVIDER=env  # Options: env, aws, google, azure

# If using AWS Secrets Manager
# AWS_REGION=us-east-1
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...

# If using Google Secret Manager
# GCP_PROJECT_ID=your-project-id
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# If using Azure Key Vault
# AZURE_KEY_VAULT_URL=https://your-vault.vault.azure.net/

# AI Provider Keys (can be in secrets manager)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Legacy API key (backward compatibility)
ZODFORGE_API_KEY=zf_legacy_key_here
```

### 2. Generate JWT Secret

```bash
# Generate a secure random secret
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. Run Supabase Migration

```bash
# Apply the database schema
cd supabase
supabase db push

# Or manually execute the migration
psql $DATABASE_URL < migrations/002_api_keys_and_audit.sql
```

### 4. Install Dependencies

```bash
npm install

# Optional: Install secrets manager SDKs
npm install @aws-sdk/client-secrets-manager  # AWS
npm install @google-cloud/secret-manager     # Google
npm install @azure/keyvault-secrets @azure/identity  # Azure
```

---

## 🔑 API Key Types

### Legacy Keys (Backward Compatible)

```
Format: zf_random_string_here
Validation: Environment variable comparison
Rate Limit: Global (shared)
Tier: Legacy (free tier limits)
```

### JWT Keys (New)

```
Format: zf_jwt_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Validation: Stateless (JWT signature)
Rate Limit: Per-key
Tier: Free, Pro, or Enterprise
```

**JWT Payload Structure:**
```json
{
  "kid": "unique-key-id",
  "customerId": "customer_123",
  "name": "Production API Key",
  "tier": "pro",
  "rateLimit": {
    "requestsPerMinute": 60,
    "requestsPerDay": 5000,
    "requestsPerMonth": 100000
  },
  "quota": {
    "tokensPerMonth": 10000000,
    "costLimitPerMonth": 100.00
  },
  "permissions": ["refine", "admin"],
  "iat": 1730000000,
  "exp": 1735000000,
  "metadata": {
    "environment": "production",
    "ipWhitelist": ["192.168.1.1"]
  }
}
```

---

## 📊 Tier Limits

### Free Tier
```json
{
  "rateLimit": {
    "requestsPerMinute": 10,
    "requestsPerDay": 100,
    "requestsPerMonth": 1000
  },
  "quota": {
    "tokensPerMonth": 100000,
    "costLimitPerMonth": 5.00
  }
}
```

### Pro Tier
```json
{
  "rateLimit": {
    "requestsPerMinute": 60,
    "requestsPerDay": 5000,
    "requestsPerMonth": 100000
  },
  "quota": {
    "tokensPerMonth": 10000000,
    "costLimitPerMonth": 100.00
  }
}
```

### Enterprise Tier
```json
{
  "rateLimit": {
    "requestsPerMinute": 1000,
    "requestsPerDay": 100000,
    "requestsPerMonth": -1  // Unlimited
  },
  "quota": {
    "tokensPerMonth": -1,  // Unlimited
    "costLimitPerMonth": -1  // Unlimited
  }
}
```

---

## 🛠️ Creating API Keys

### Using the API

```bash
# Create a new Pro tier key (requires admin permissions)
curl -X POST https://api.zodforge.com/api/v1/api-keys \
  -H "Authorization: Bearer YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "customer_123",
    "name": "Production Key",
    "tier": "pro",
    "permissions": ["refine"],
    "metadata": {
      "environment": "production",
      "ipWhitelist": ["203.0.113.0"]
    }
  }'
```

### Programmatically

```typescript
import { createApiKey } from './lib/jwt-keys.js';

const apiKey = createApiKey(
  'customer_123',
  'My API Key',
  'pro',
  {
    permissions: ['refine'],
    metadata: {
      environment: 'production',
      ipWhitelist: ['203.0.113.0']
    }
  }
);

console.log(apiKey);
// zf_jwt_eyJhbGciOiJIUzI1NiIs...
```

---

## 📝 Audit Logging

### What Gets Logged

Every request logs:
- **Request Info**: endpoint, method, request ID, timestamp
- **API Key**: kid, customer ID, tier
- **AI Usage**: provider, model, tokens (input/output), cost
- **Performance**: latency, processing time, cache hit
- **Client**: IP address, user agent, version
- **Rate Limiting**: whether limit was hit, quota status
- **Response**: status code, success, error codes

### Querying Audit Logs

```sql
-- Get all requests for a customer
SELECT *
FROM audit_log
WHERE customer_id = 'customer_123'
ORDER BY timestamp DESC
LIMIT 100;

-- Get requests with errors
SELECT *
FROM audit_log
WHERE success = FALSE
ORDER BY timestamp DESC;

-- Get cost breakdown by provider
SELECT
  ai_provider,
  COUNT(*) as requests,
  SUM(cost) as total_cost,
  AVG(latency_ms) as avg_latency
FROM audit_log
WHERE customer_id = 'customer_123'
  AND timestamp > NOW() - INTERVAL '30 days'
GROUP BY ai_provider;

-- Get quota usage for a key
SELECT
  period_start,
  request_count,
  total_tokens,
  total_cost
FROM api_key_usage
WHERE kid = 'your-key-id'
  AND period_type = 'month'
ORDER BY period_start DESC;
```

### Audit Log Dashboard (Supabase)

1. Go to Supabase Dashboard → Table Editor
2. Select `audit_log` table
3. Add filters (customer_id, timestamp, etc.)
4. Export as CSV for analysis

---

## 🔒 Secrets Manager Setup

### Environment Variables (Default)

No additional setup needed. Keys are read from `.env`:

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=your-secret
```

### AWS Secrets Manager

```bash
# 1. Install AWS CLI
aws configure

# 2. Store secrets
aws secretsmanager create-secret \
  --name OPENAI_API_KEY \
  --secret-string "sk-your-openai-key"

aws secretsmanager create-secret \
  --name ANTHROPIC_API_KEY \
  --secret-string "sk-ant-your-anthropic-key"

aws secretsmanager create-secret \
  --name JWT_SECRET \
  --secret-string "your-jwt-secret"

# 3. Set environment variable
export SECRETS_PROVIDER=aws
export AWS_REGION=us-east-1
```

### Google Secret Manager

```bash
# 1. Install gcloud CLI
gcloud auth login

# 2. Store secrets
echo -n "sk-your-openai-key" | gcloud secrets create OPENAI_API_KEY --data-file=-
echo -n "sk-ant-your-anthropic-key" | gcloud secrets create ANTHROPIC_API_KEY --data-file=-
echo -n "your-jwt-secret" | gcloud secrets create JWT_SECRET --data-file=-

# 3. Set environment variables
export SECRETS_PROVIDER=google
export GCP_PROJECT_ID=your-project-id
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

### Azure Key Vault

```bash
# 1. Install Azure CLI
az login

# 2. Create Key Vault
az keyvault create \
  --name your-vault-name \
  --resource-group your-resource-group \
  --location eastus

# 3. Store secrets
az keyvault secret set --vault-name your-vault-name --name OPENAI-API-KEY --value "sk-..."
az keyvault secret set --vault-name your-vault-name --name ANTHROPIC-API-KEY --value "sk-ant-..."
az keyvault secret set --vault-name your-vault-name --name JWT-SECRET --value "your-secret"

# 4. Set environment variable
export SECRETS_PROVIDER=azure
export AZURE_KEY_VAULT_URL=https://your-vault.vault.azure.net/
```

---

## 🎯 Rate Limiting & Quotas

### Per-Key Rate Limiting

Rate limits are enforced at three levels:

1. **Per Minute** - Short-term burst protection
2. **Per Day** - Daily usage limits
3. **Per Month** - Monthly quota

**Response Headers:**
```http
X-RateLimit-Limit-Minute: 60
X-RateLimit-Limit-Day: 5000
X-RateLimit-Limit-Month: 100000
X-RateLimit-Remaining-Minute: 45
X-API-Key-Tier: pro
X-API-Key-Id: abc123...
```

**Rate Limit Exceeded Response (429):**
```json
{
  "success": false,
  "error": "Rate limit exceeded: 60 requests per minute",
  "errorCode": "RATE_LIMIT_EXCEEDED",
  "tier": "pro",
  "limit": 60,
  "retryAfter": 60
}
```

### Quota Tracking

Token and cost quotas are tracked in Supabase:

```sql
-- Check current month usage
SELECT
  request_count,
  total_tokens,
  total_cost,
  quota_tokens_per_month,
  quota_cost_limit_per_month
FROM api_keys k
JOIN api_key_usage u ON k.kid = u.kid
WHERE k.kid = 'your-key-id'
  AND u.period_type = 'month'
  AND u.period_start = DATE_TRUNC('month', NOW());
```

---

## 📈 Monitoring & Alerts

### Supabase Dashboard

Monitor usage in real-time:

```sql
-- Real-time usage dashboard
SELECT
  ak.name,
  ak.tier,
  aku.request_count,
  aku.total_cost,
  aku.avg_latency_ms,
  (aku.success_count::FLOAT / aku.request_count) * 100 as success_rate
FROM api_keys ak
JOIN api_key_usage aku ON ak.kid = aku.kid
WHERE aku.period_type = 'day'
  AND aku.period_start = CURRENT_DATE
ORDER BY aku.total_cost DESC;
```

### Budget Alerts

Set up alerts for cost overruns:

```typescript
import { getAuditLogger } from './lib/audit-logger.js';

const auditLogger = getAuditLogger();

// Check if budget exceeded
const usage = await auditLogger.getUsageSummary('key-id', 'month');

if (usage && usage.totalCost > BUDGET_LIMIT) {
  // Send alert email/Slack notification
  sendAlert(`Budget exceeded: $${usage.totalCost} / $${BUDGET_LIMIT}`);
}
```

---

## 🔐 Best Practices

1. **Rotate Keys Regularly** - Use `/api-keys/:kid/rotate` endpoint
2. **Use Secrets Manager** - Don't store keys in code/env files
3. **Enable IP Whitelisting** - Restrict keys to specific IPs
4. **Monitor Audit Logs** - Set up alerts for suspicious activity
5. **Set Budget Limits** - Configure cost limits per key
6. **Use Least Privilege** - Only grant necessary permissions
7. **Separate Environments** - Use different keys for dev/staging/prod

---

## 🧪 Testing

```bash
# Test JWT key creation
curl -X POST http://localhost:3000/api/v1/api-keys \
  -H "Authorization: Bearer YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"customerId": "test", "name": "Test Key", "tier": "free"}'

# Test API with JWT key
curl http://localhost:3000/api/v1/api-keys/me \
  -H "Authorization: Bearer zf_jwt_eyJhbGci..."

# Check rate limits
curl -v http://localhost:3000/api/v1/refine \
  -H "Authorization: Bearer zf_jwt_eyJhbGci..." \
  -H "Content-Type: application/json" \
  -d '{"schema": {...}}'
# Look for X-RateLimit-* headers
```

---

## 🐛 Troubleshooting

### JWT Verification Failed

```
Error: Invalid or expired API key
```

**Solution:**
- Check JWT_SECRET is set correctly
- Verify key hasn't expired
- Ensure key format is `zf_jwt_...`

### Rate Limit Issues

```
Error: check_rate_limit function does not exist
```

**Solution:**
- Run Supabase migration
- Check Supabase connection
- Verify SUPABASE_SERVICE_KEY has proper permissions

### Secrets Manager Errors

```
Error: Required secret not found: OPENAI_API_KEY
```

**Solution:**
- Check secrets exist in your secrets manager
- Verify AWS/Google/Azure credentials
- Fallback to `SECRETS_PROVIDER=env` for local dev

---

## 📚 API Reference

### Endpoints

```
POST   /api/v1/api-keys          - Create new API key (admin)
POST   /api/v1/api-keys/:kid/rotate - Rotate API key
GET    /api/v1/api-keys/me       - Get current key info + usage
GET    /api/v1/api-keys/tiers    - Get available tiers
```

### Database Tables

- `api_keys` - JWT key metadata
- `api_key_usage` - Aggregated usage metrics
- `audit_log` - Comprehensive request logs
- `rate_limit_state` - Real-time rate limit tracking

---

## 🚨 Security Considerations

- **JWT Secret**: Must be at least 32 characters, cryptographically random
- **Supabase RLS**: Enable Row Level Security policies
- **IP Whitelisting**: Use for production keys
- **Key Rotation**: Rotate every 90 days
- **Audit Retention**: Keep logs for compliance (30-90 days)
- **Cost Monitoring**: Set up alerts at 80% of budget

---

For more information, see:
- [CHANGELOG.md](./CHANGELOG.md)
- [src/lib/providers/README.md](./src/lib/providers/README.md)
- [Supabase Documentation](https://supabase.com/docs)
