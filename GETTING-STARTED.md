# 🚀 Getting Started with ZodForge API (MVP)

## ✅ Setup Complete!

All dependencies are installed and your environment is configured. Let's test it!

---

## 📋 What You Have

| Item | Status | Value |
|------|--------|-------|
| **OpenAI API Key** | ✅ Configured | `sk-proj-CHZb...` |
| **Test API Key** | ✅ Generated | `zf_89f61857c56583bd9c8e65c3d058b55d` |
| **Dependencies** | ✅ Installed | 111 packages |
| **TypeScript** | ✅ Configured | Strict mode |
| **Server Port** | ✅ Set | 3000 |

---

## 🎯 Step 1: Start the API Server

```bash
cd zodforge-api
npm run dev
```

You should see:

```
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🚀 ZodForge API Server (MVP)                            ║
║                                                           ║
║   Status:  Running                                        ║
║   Version: 0.1.0                                          ║
║   Port:    3000                                           ║
║   Env:     development                                    ║
║                                                           ║
║   Endpoints:                                              ║
║   GET  /                       - API info                 ║
║   GET  /api/v1/health          - Health check             ║
║   POST /api/v1/refine          - Schema refinement (🔒)   ║
║                                                           ║
║   OpenAI:  Connected ✓                                    ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
```

---

## 🧪 Step 2: Test the API

**Option A: Use PowerShell Test Script** (Recommended)

```powershell
# Open a new terminal (keep server running in first terminal)
cd zodforge-api
.\test-api.ps1
```

**Option B: Manual Testing with curl**

```bash
# Test 1: Health Check (No auth needed)
curl http://localhost:3000/api/v1/health

# Test 2: Schema Refinement (Needs API key)
curl -X POST http://localhost:3000/api/v1/refine \
  -H "Authorization: Bearer zf_89f61857c56583bd9c8e65c3d058b55d" \
  -H "Content-Type: application/json" \
  -d @test-request.json
```

**Option C: Use Postman or Insomnia**

1. Import the request from `test-request.json`
2. Add header: `Authorization: Bearer zf_89f61857c56583bd9c8e65c3d058b55d`
3. POST to `http://localhost:3000/api/v1/refine`

---

## 📊 Expected Results

### Health Check Response

```json
{
  "status": "healthy",
  "version": "0.1.0",
  "uptime": 45,
  "services": {
    "openai": "up"
  }
}
```

### Refinement Response

```json
{
  "success": true,
  "refinedSchema": {
    "code": "z.object({\n  email: z.string().email().toLowerCase(),\n  age: z.number().int().min(0).max(150),\n  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),\n  bio: z.string().max(500),\n  website: z.string().url(),\n  status: z.enum(['active', 'inactive'])\n})",
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
        "reason": "Age should be a realistic integer.",
        "confidence": 0.95
      }
      // ... more improvements
    ],
    "confidence": 0.93
  },
  "suggestions": [
    "Consider adding .trim() to username for normalization",
    "Bio field could benefit from minlength constraint"
  ],
  "creditsUsed": 1,
  "creditsRemaining": -1,
  "processingTime": 1842,
  "aiProvider": "openai"
}
```

---

## 🔧 Troubleshooting

### Server Won't Start

**Error**: `ZodError: Invalid environment variables`

**Solution**: Check your `.env` file has valid OpenAI API key starting with `sk-`

```bash
# Verify .env file
cat .env
```

---

### OpenAI API Error

**Error**: `OpenAI API error: 401 Unauthorized`

**Solution**: Your OpenAI API key might be invalid or expired

1. Go to https://platform.openai.com/api-keys
2. Generate a new key
3. Update `.env` file with new key
4. Restart server

---

### Port Already in Use

**Error**: `Error: listen EADDRINUSE: address already in use :::3000`

**Solution**: Change the port in `.env`:

```env
PORT=3001
```

Or kill the process using port 3000:

```powershell
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

---

## 🔗 Step 3: Connect ZodForge CLI

Update the CLI to use your local API:

```bash
# In the main zodforge project
cd ..  # Go back to zodforge root

# Set environment variables
export ZODFORGE_API_URL=http://localhost:3000
export ZODFORGE_API_KEY=zf_89f61857c56583bd9c8e65c3d058b55d

# Or on Windows PowerShell:
$env:ZODFORGE_API_URL="http://localhost:3000"
$env:ZODFORGE_API_KEY="zf_89f61857c56583bd9c8e65c3d058b55d"

# Test with a JSON file
zodforge test-data/user.json --ai-refine
```

The CLI will now use your local API for AI refinement! 🎉

---

## 📁 Project Structure

```
zodforge-api/
├── src/
│   ├── server.ts              # 🚀 Main entry point
│   ├── config/
│   │   └── env.ts             # Environment validation
│   ├── routes/
│   │   ├── health.ts          # GET /api/v1/health
│   │   └── refine.ts          # POST /api/v1/refine
│   ├── lib/
│   │   └── openai.ts          # OpenAI integration
│   ├── middleware/
│   │   └── auth.ts            # API key authentication
│   └── types/
│       └── index.ts           # TypeScript types
├── .env                       # ✅ Your API keys
├── test-request.json          # 📝 Sample request
├── test-api.ps1               # 🧪 Test script
└── README.md                  # 📖 Documentation
```

---

## 🎯 What's Next?

### Immediate Next Steps

1. ✅ **Test the API** - Make sure all endpoints work
2. ✅ **Integrate with CLI** - Test end-to-end refinement
3. ✅ **Try different schemas** - Test with your own data

### Future Enhancements (Post-MVP)

- [ ] Add Supabase database for persistent API keys
- [ ] Implement Redis caching for faster responses
- [ ] Add Anthropic fallback (Claude 3)
- [ ] Add rate limiting per user
- [ ] Add usage analytics dashboard
- [ ] Deploy to Vercel/Railway
- [ ] Add Stripe billing integration

---

## 💡 Tips

**Development Mode**: The server runs with hot-reload, so changes to TypeScript files automatically restart the server.

**Logging**: Check the terminal where the server is running for detailed logs of each request.

**Testing**: Keep the test request file (`test-request.json`) handy for quick testing.

**API Key Security**: Never commit your `.env` file! It's already in `.gitignore`.

---

## 🆘 Need Help?

- **Server not starting?** Check the terminal for error messages
- **OpenAI errors?** Verify your API key at https://platform.openai.com/api-keys
- **API not responding?** Make sure the server is running on port 3000
- **Other issues?** Check the logs in the terminal running `npm run dev`

---

## 🎉 Success Criteria

Your API is working correctly when:

✅ Server starts without errors
✅ Health check returns `"status": "healthy"`
✅ Refinement endpoint returns improved schemas
✅ OpenAI service shows as `"up"`
✅ Processing time is under 3 seconds

---

**Ready to test? Run `npm run dev` and let's go!** 🚀
