# 🚀 Production Deployment Guide - Railway

Complete guide to deploying ZodForge API to production on Railway.

---

## 📋 Prerequisites

- [x] Railway account: https://railway.app
- [x] GitHub account with zodforge-api repository
- [x] OpenAI API key: https://platform.openai.com/api-keys
- [x] Generated ZodForge API key (see below)

---

## ⚡ Quick Deploy (5 minutes)

### Step 1: Connect GitHub to Railway

1. Go to https://railway.app
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose `zodforge-api` repository
5. Railway will auto-detect Node.js project

### Step 2: Configure Environment Variables

In Railway dashboard, go to **Variables** tab and add:

```env
# Required
NODE_ENV=production
OPENAI_API_KEY=sk-proj-YOUR_ACTUAL_KEY_HERE
ZODFORGE_API_KEY=zf_YOUR_GENERATED_KEY_HERE

# Optional (use defaults)
PORT=3000
HOST=0.0.0.0
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000
LOG_LEVEL=info
```

**Generate ZodForge API Key**:
```bash
node -e "console.log('zf_' + require('crypto').randomBytes(32).toString('hex'))"
```

### Step 3: Deploy

1. Railway automatically builds and deploys
2. Wait for build to complete (~2-3 minutes)
3. Get your public URL: `https://zodforge-api-production.up.railway.app`

### Step 4: Verify Deployment

```bash
# Test health endpoint
curl https://your-app.up.railway.app/api/v1/health

# Expected response:
{
  "status": "healthy",
  "version": "0.1.0",
  "uptime": 42,
  "services": { "openai": "up" }
}
```

---

## 🎯 Detailed Setup

### 1. Create Railway Project

**Option A: Via Dashboard**
1. Go to https://railway.app/new
2. Click "Deploy from GitHub repo"
3. Authorize Railway to access your GitHub
4. Select `zodforge-api` repository
5. Click "Deploy"

**Option B: Via CLI**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project
cd zodforge-api
railway init

# Link to new project
railway link

# Deploy
railway up
```

### 2. Configure Build Settings

Railway auto-detects configuration from:
- `railway.json` ✅ (already created)
- `nixpacks.toml` ✅ (already created)
- `Procfile` ✅ (already created)

**Build Process**:
1. Install dependencies: `npm ci`
2. Build TypeScript: `npm run build`
3. Start server: `npm start`

**Verify Configuration**:
- Go to **Settings** → **Build & Deploy**
- Build Command: `npm run build`
- Start Command: `npm start`
- Root Directory: `/`

### 3. Set Environment Variables

**Required Variables**:

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `OPENAI_API_KEY` | OpenAI API key | `sk-proj-...` |
| `ZODFORGE_API_KEY` | User auth key | `zf_a1b2c3...` |

**Optional Variables** (with defaults):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Server host |
| `RATE_LIMIT_MAX` | `100` | Max requests per window |
| `RATE_LIMIT_WINDOW` | `900000` | Rate limit window (15 min) |
| `REQUEST_TIMEOUT` | `30000` | Request timeout (30s) |
| `MAX_REQUEST_SIZE` | `1048576` | Max body size (1MB) |
| `LOG_LEVEL` | `info` | Logging level |
| `ENABLE_REQUEST_LOGGING` | `true` | Enable request logs |
| `MASK_SENSITIVE_DATA` | `true` | Mask API keys in logs |

**How to Add Variables**:
1. Go to your project in Railway
2. Click **Variables** tab
3. Click "New Variable"
4. Add name and value
5. Click "Add"
6. Railway auto-redeploys

### 4. Custom Domain (Optional)

**Add Custom Domain**:
1. Go to **Settings** → **Networking**
2. Click "Generate Domain" (get free railway.app subdomain)
3. Or click "Custom Domain" and add your domain:
   - `api.zodforge.com`
   - Add CNAME record in your DNS:
     - Name: `api`
     - Value: `your-app.up.railway.app`
4. Wait for SSL certificate (automatic, ~5 minutes)

**Update CLI**:
```env
# In CLI's .env
ZODFORGE_API_URL=https://api.zodforge.com
```

---

## 🔍 Monitoring & Logs

### View Logs

**Via Dashboard**:
1. Go to your project
2. Click **Deployments** tab
3. Click latest deployment
4. View real-time logs

**Via CLI**:
```bash
railway logs
```

**What to Monitor**:
- ✅ Server startup successful
- ✅ OpenAI API key masked in logs
- ✅ Security features enabled
- ✅ No errors on startup

**Example Good Startup Log**:
```
✅ Environment variables validated successfully
🔐 OpenAI API Key: sk-proj********************abcd
🔑 ZodForge API Key: zf_a1b2********************xyz
📊 Rate Limit: 100 req/900000ms

╔═══════════════════════════════════════════════════════════╗
║   🚀 ZodForge API Server (MVP) - SECURED                  ║
║   Status:  Running                                        ║
║   Port:    3000                                            ║
║   Env:     production                                     ║
╚═══════════════════════════════════════════════════════════╝
```

### Health Checks

Railway automatically monitors your app at `/`.

**Manual Health Check**:
```bash
curl https://your-app.up.railway.app/api/v1/health
```

**Set Up Alerts** (Optional):
1. Go to **Settings** → **Monitoring**
2. Add health check URL: `/api/v1/health`
3. Configure alert email

---

## 🧪 Testing Production

### Test Authentication

```bash
# Replace with your production URL and API key
export API_URL="https://your-app.up.railway.app"
export API_KEY="zf_your_actual_key"

# Test refine endpoint
curl -X POST $API_URL/api/v1/refine \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "schema": {
      "code": "z.object({})",
      "typeName": "User",
      "fields": {
        "email": "z.string()",
        "age": "z.number()"
      }
    },
    "samples": [
      { "email": "test@example.com", "age": 25 }
    ]
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "refinedSchema": {
    "code": "z.object({...})",
    "improvements": [...],
    "confidence": 0.9
  },
  "creditsUsed": 1,
  "processingTime": 1842
}
```

### Test Rate Limiting

```bash
# Make 101 requests quickly
for i in {1..101}; do
  curl -X POST $API_URL/api/v1/refine \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d '{"schema":{},"samples":[{}]}' \
    -w "Request $i: %{http_code}\n" \
    -s -o /dev/null
done

# 101st request should return: 429
```

### Update CLI to Use Production

**In your ZodForge CLI project**:
```env
# .env or environment variables
ZODFORGE_API_URL=https://your-app.up.railway.app
ZODFORGE_API_KEY=zf_your_production_key
```

**Test CLI**:
```bash
zodforge test-data/user.json --ai-refine
```

---

## 💰 Costs

**Railway Pricing**:
- **Hobby Plan**: $5/month (500 hours execution)
- **Pro Plan**: $20/month (unlimited execution)
- **Pay-as-you-go**: $0.000231/minute after free tier

**OpenAI Costs** (GPT-4 Turbo):
- ~$0.002 per refinement request
- $20/month = ~10,000 refinements
- Set billing limits in OpenAI dashboard

**Total Estimated Cost**:
- Low usage: $5-10/month (Railway + OpenAI)
- Medium usage: $20-50/month
- High usage: $50-200/month

---

## 🔧 Troubleshooting

### Build Fails

**Error**: `Cannot find module 'typescript'`

**Solution**: TypeScript is in devDependencies, Railway needs it in dependencies
```bash
# Move TypeScript to dependencies
npm install --save typescript
npm install --save-dev @types/node
git commit -am "fix: Move typescript to dependencies for Railway"
git push
```

### Environment Variable Errors

**Error**: `❌ Environment variable validation failed`

**Solution**: Check all required variables are set in Railway:
1. Go to **Variables** tab
2. Verify `OPENAI_API_KEY` and `ZODFORGE_API_KEY` are present
3. Check keys start with `sk-` and `zf_` respectively
4. Redeploy after adding variables

### Port Binding Issues

**Error**: `EADDRINUSE: address already in use`

**Solution**: Railway sets `$PORT` environment variable automatically
- Our server already uses `env.PORT` ✅
- Default: 3000
- Railway overrides if needed

### OpenAI API Errors

**Error**: `OpenAI API error: 401 Unauthorized`

**Solution**: Invalid or expired OpenAI API key
1. Go to https://platform.openai.com/api-keys
2. Generate new key
3. Update in Railway variables
4. Redeploy

---

## 🚀 CI/CD Setup (Optional)

Railway automatically deploys on every push to `main` branch.

**Customize Deployment**:
1. Go to **Settings** → **Build & Deploy**
2. Configure:
   - Branch: `main` (or your preferred branch)
   - Auto Deploy: ON
   - Health Check Path: `/api/v1/health`

**GitHub Actions** (Optional for testing):
```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - run: npm run type-check
```

---

## 📊 Production Checklist

Before going live:

### Security
- [ ] OpenAI API key set in Railway (not in code)
- [ ] ZodForge API key generated and secured
- [ ] Rate limiting configured appropriately
- [ ] CORS origins restricted (or accepting all for now)
- [ ] Helmet security headers enabled ✅
- [ ] Error messages sanitized ✅

### Monitoring
- [ ] Health check endpoint working
- [ ] Logs visible in Railway dashboard
- [ ] OpenAI billing alerts configured
- [ ] Railway alerts configured (optional)

### Performance
- [ ] Build completes successfully
- [ ] Server starts in <30 seconds
- [ ] Health check responds in <1 second
- [ ] AI refinement completes in <20 seconds

### Documentation
- [ ] Production URL documented
- [ ] API keys stored securely (password manager)
- [ ] Team knows how to access logs
- [ ] Incident response plan created

---

## 🔗 Next Steps

After deployment:

1. **Monitor for 24 hours**
   - Check logs for errors
   - Verify OpenAI usage in dashboard
   - Test from CLI

2. **Share with beta users**
   - Provide production API key
   - Update documentation
   - Gather feedback

3. **Phase 2: Add Anthropic fallback**
   - See main roadmap
   - Adds reliability

4. **Phase 3: Monetization**
   - Supabase for user management
   - Stripe for billing
   - User dashboard

---

## 🆘 Support

**Issues during deployment?**
- Railway Docs: https://docs.railway.app
- Railway Discord: https://discord.gg/railway
- OpenAI Support: https://help.openai.com

**Common Issues**:
- Build failures → Check `railway logs` and TypeScript compilation
- Env var errors → Verify all required variables in Railway dashboard
- OpenAI errors → Check API key validity and billing

---

**Deployment Guide Version**: 1.0.0
**Last Updated**: 2025-10-20

🚀 Generated with [Claude Code](https://claude.com/claude-code)
