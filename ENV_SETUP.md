# 🔐 Environment Variables Setup Guide

Quick reference for configuring environment variables in Railway.

---

## ⚡ Quick Setup (2 minutes)

### Step 1: Generate API Keys

**ZodForge API Key** (for user authentication):
```bash
node -e "console.log('zf_' + require('crypto').randomBytes(32).toString('hex'))"
```

Example output: `zf_a1b2c3d4e5f6...` (keep this secret!)

### Step 2: Get OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Click "Create new secret key"
3. Copy the key (starts with `sk-proj-` or `sk-`)
4. Save it securely (you won't see it again!)

### Step 3: Add to Railway

In Railway dashboard → **Variables** tab → **New Variable**:

```env
NODE_ENV=production
OPENAI_API_KEY=sk-proj-YOUR_ACTUAL_KEY_HERE
ZODFORGE_API_KEY=zf_YOUR_GENERATED_KEY_HERE
```

**That's it!** Railway will auto-redeploy with these settings.

---

## 📋 Required Variables

| Variable | Description | How to Get | Example |
|----------|-------------|------------|---------|
| `NODE_ENV` | Environment mode | Set to `production` | `production` |
| `OPENAI_API_KEY` | OpenAI API key | https://platform.openai.com/api-keys | `sk-proj-abc123...` |
| `ZODFORGE_API_KEY` | User auth key | Generate with command above | `zf_a1b2c3d4...` |

### Validation Rules

✅ `OPENAI_API_KEY`:
- Must be at least 40 characters
- Must start with `sk-` or `sk-proj-`
- Must be a valid OpenAI key format

✅ `ZODFORGE_API_KEY`:
- Must be at least 20 characters
- Must start with `zf_`
- Recommend 64 hex characters (32 bytes)

---

## 🎛️ Optional Variables (with defaults)

Only add these if you need to customize default behavior:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port (Railway auto-sets) |
| `HOST` | `0.0.0.0` | Server host |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |
| `RATE_LIMIT_WINDOW` | `900000` | Rate limit window (15 min in ms) |
| `REQUEST_TIMEOUT` | `30000` | Request timeout (30s in ms) |
| `MAX_REQUEST_SIZE` | `1048576` | Max body size (1MB in bytes) |
| `LOG_LEVEL` | `info` | Logging level: `debug`, `info`, `warn`, `error` |
| `ENABLE_REQUEST_LOGGING` | `true` | Enable request logs |
| `MASK_SENSITIVE_DATA` | `true` | Mask API keys in logs |
| `ALLOWED_ORIGINS` | `*` | CORS origins (comma-separated in prod) |

### Example with Optional Variables

```env
# Required
NODE_ENV=production
OPENAI_API_KEY=sk-proj-abc123xyz
ZODFORGE_API_KEY=zf_a1b2c3d4e5f6

# Optional customization
RATE_LIMIT_MAX=200
RATE_LIMIT_WINDOW=600000
LOG_LEVEL=warn
ALLOWED_ORIGINS=https://app.example.com,https://dashboard.example.com
```

---

## 🔒 Security Best Practices

### ✅ DO:
- ✅ Use Railway's **Variables** tab (not hard-coded in code)
- ✅ Generate strong ZodForge API keys (32+ bytes)
- ✅ Rotate API keys regularly
- ✅ Set up OpenAI billing limits
- ✅ Keep keys in password manager
- ✅ Use different keys for dev/staging/prod

### ❌ DON'T:
- ❌ Commit `.env` files to git
- ❌ Share API keys via Slack/email
- ❌ Use same key for multiple environments
- ❌ Hard-code keys in source code
- ❌ Log keys in plain text
- ❌ Store keys in frontend code

---

## 🧪 Testing Variables

### Verify Configuration

After setting variables in Railway, check the deployment logs:

**Good startup:**
```
✅ Environment variables validated successfully
🔐 OpenAI API Key: sk-proj********************abcd
🔑 ZodForge API Key: zf_a1b2********************xyz
📊 Rate Limit: 100 req/900000ms

╔═══════════════════════════════════════════════════════════╗
║   🚀 ZodForge API Server (MVP) - SECURED                  ║
║   Status:  Running                                        ║
╚═══════════════════════════════════════════════════════════╝
```

**Bad startup (missing variables):**
```
❌ Environment variable validation failed:
  - OPENAI_API_KEY: Required
  - ZODFORGE_API_KEY: Required

💡 Check your .env file and compare with .env.example
```

### Test Health Endpoint

```bash
curl https://your-app.up.railway.app/api/v1/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "version": "0.1.0",
  "uptime": 42,
  "services": { "openai": "up" }
}
```

If OpenAI key is invalid, `"openai"` will be `"down"`.

---

## 🔧 Troubleshooting

### Error: "Environment variable validation failed"

**Problem**: Railway doesn't have required variables set.

**Solution**:
1. Go to Railway dashboard → **Variables** tab
2. Verify `OPENAI_API_KEY` and `ZODFORGE_API_KEY` are present
3. Check keys match format requirements (see validation rules above)
4. Click "Redeploy" if variables were just added

### Error: "Invalid OpenAI API key format"

**Problem**: OpenAI key doesn't start with `sk-` or is too short.

**Solution**:
1. Go to https://platform.openai.com/api-keys
2. Generate a new key
3. Update in Railway variables
4. Redeploy

### Error: "OpenAI API error: 401 Unauthorized"

**Problem**: OpenAI key is expired, invalid, or billing issues.

**Solution**:
1. Check OpenAI account at https://platform.openai.com
2. Verify API key is active
3. Check billing/usage limits
4. Generate new key if needed
5. Update in Railway variables

### Server responds with 503 (degraded)

**Problem**: OpenAI service is down or key is invalid.

**Solution**:
1. Check `/api/v1/health` endpoint
2. Look at `"services": { "openai": "down" }`
3. Verify OpenAI API key in Railway variables
4. Check OpenAI status at https://status.openai.com

### Rate limiting too strict/loose

**Problem**: Need to adjust rate limits for your use case.

**Solution** - Add these to Railway variables:
```env
# More lenient (200 requests per 10 minutes)
RATE_LIMIT_MAX=200
RATE_LIMIT_WINDOW=600000

# More strict (50 requests per 15 minutes)
RATE_LIMIT_MAX=50
RATE_LIMIT_WINDOW=900000
```

---

## 🔄 Updating Variables

### In Railway Dashboard

1. Go to your project
2. Click **Variables** tab
3. Click variable to edit
4. Update value
5. Click "Save"
6. Railway auto-redeploys (takes ~2 minutes)

### Via Railway CLI

```bash
# Install CLI
npm install -g @railway/cli

# Login
railway login

# Link to project
railway link

# Add/update variable
railway variables set RATE_LIMIT_MAX=200

# View all variables
railway variables
```

---

## 📊 Variable Cheat Sheet

### Minimal Production Setup
```env
NODE_ENV=production
OPENAI_API_KEY=sk-proj-YOUR_KEY
ZODFORGE_API_KEY=zf_YOUR_KEY
```

### Recommended Production Setup
```env
NODE_ENV=production
OPENAI_API_KEY=sk-proj-YOUR_KEY
ZODFORGE_API_KEY=zf_YOUR_KEY
RATE_LIMIT_MAX=100
LOG_LEVEL=info
MASK_SENSITIVE_DATA=true
ALLOWED_ORIGINS=https://your-app.com
```

### Development Setup (Local)
```env
NODE_ENV=development
OPENAI_API_KEY=sk-proj-YOUR_DEV_KEY
ZODFORGE_API_KEY=zf_YOUR_DEV_KEY
RATE_LIMIT_MAX=1000
LOG_LEVEL=debug
ENABLE_REQUEST_LOGGING=true
```

---

## 🆘 Need Help?

- **Railway Docs**: https://docs.railway.app/guides/variables
- **OpenAI Support**: https://help.openai.com
- **Main Deployment Guide**: See `DEPLOYMENT.md`
- **Security Guide**: See `SECURITY.md`

---

**Last Updated**: 2025-10-20
**Version**: 1.0.0

🚀 Generated with [Claude Code](https://claude.com/claude-code)
