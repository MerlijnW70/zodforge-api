# Security Incident Response Playbook

## Overview

This playbook provides step-by-step procedures for responding to security incidents in the ZodForge API.

---

## 🚨 Incident Classification

### Severity Levels

| Level | Definition | Response Time | Examples |
|-------|------------|---------------|----------|
| **P0 - Critical** | Active exploitation, data breach | **Immediate** | API keys leaked publicly, database compromised |
| **P1 - High** | Potential for exploitation | **< 4 hours** | Authentication bypass discovered, SQL injection found |
| **P2 - Medium** | Vulnerability confirmed | **< 24 hours** | Rate limit bypass, XSS vulnerability |
| **P3 - Low** | Theoretical vulnerability | **< 7 days** | Outdated dependency, minor information disclosure |

---

## 📋 Incident Response Procedures

### P0 - Critical Incident: API Key Leaked Publicly

**Indicators**:
- ✅ API key found in public GitHub commit
- ✅ API key posted in public forum/chat
- ✅ Unusual spike in OpenAI API usage
- ✅ Unrecognized requests to API

**IMMEDIATE ACTIONS** (Within 5 minutes):

1. **Revoke the compromised key**:
   ```bash
   # OpenAI
   # Go to https://platform.openai.com/api-keys
   # Find key → Click "Revoke"

   # ZodForge
   # Generate new key:
   node -e "console.log('zf_' + require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Update production environment**:
   ```bash
   # Railway
   railway variables set OPENAI_API_KEY=sk-proj-NEW_KEY_HERE
   railway variables set ZODFORGE_API_KEY=zf_NEW_KEY_HERE

   # Redeploy
   railway up
   ```

3. **Notify stakeholders**:
   - Internal team via Slack/email
   - Customer communication (if data impacted)

**INVESTIGATION** (Within 1 hour):

4. **Review security audit logs**:
   ```bash
   # Check for suspicious activity
   grep "auth_invalid_key\|rate_limit_exceeded" logs/security.log

   # Identify unauthorized requests
   grep -A 5 "auth_success" logs/security.log | grep -v "known-ip"
   ```

5. **Check OpenAI usage dashboard**:
   - Go to https://platform.openai.com/usage
   - Look for unusual spikes in usage
   - Check API call patterns

6. **Review git history** (if leaked via git):
   ```bash
   # Find all commits with the key
   git log -S 'sk-proj-YOUR_OLD_KEY' --all

   # If found, use git-filter-repo to remove
   git filter-repo --replace-text <(echo "sk-proj-OLD_KEY==>REDACTED")
   ```

**POST-INCIDENT** (Within 24 hours):

7. **Root cause analysis**:
   - How was the key exposed?
   - What processes failed?
   - What controls can prevent recurrence?

8. **Implement preventative measures**:
   - Enable GitHub secret scanning
   - Add pre-commit hooks to check for secrets
   - Rotate all keys as precaution
   - Update training/documentation

9. **Document incident**:
   - Timeline of events
   - Actions taken
   - Lessons learned
   - Preventative measures implemented

---

### P1 - High: Authentication Bypass Discovered

**Indicators**:
- ✅ Researcher reports authentication bug
- ✅ Logs show successful requests without valid API key
- ✅ Rate limiting bypassed

**IMMEDIATE ACTIONS** (Within 4 hours):

1. **Verify the vulnerability**:
   ```bash
   # Test the reported bypass method
   curl -X POST http://localhost:3000/api/v1/refine \
     -H "Content-Type: application/json" \
     # ... test payload
   ```

2. **Deploy emergency patch**:
   ```bash
   # Create hotfix branch
   git checkout -b hotfix/auth-bypass

   # Implement fix
   # ... code changes ...

   # Test fix
   npm test

   # Deploy
   git commit -m "security: Fix authentication bypass (P1)"
   git push origin hotfix/auth-bypass
   railway up
   ```

3. **Notify affected users** (if applicable):
   - Identify potentially impacted requests
   - Send security advisory
   - Recommend key rotation

**POST-INCIDENT**:

4. **Publish security advisory**:
   - GitHub Security Advisory
   - CHANGELOG.md entry
   - Credit researcher (if appropriate)

5. **Update tests**:
   ```typescript
   // Add regression test
   it('should prevent auth bypass via...', async () => {
     const response = await server.inject({
       method: 'POST',
       url: '/api/v1/refine',
       // ... bypass attempt
     });
     expect(response.statusCode).toBe(401);
   });
   ```

---

### P2 - Medium: Rate Limit Bypass

**ACTIONS** (Within 24 hours):

1. **Analyze bypass method**
2. **Implement additional rate limiting controls**
3. **Update tests to cover bypass scenario**
4. **Deploy fix during normal release cycle**

---

### P3 - Low: Outdated Dependency

**ACTIONS** (Within 7 days):

1. **Review security advisory**:
   ```bash
   npm audit
   ```

2. **Update dependency**:
   ```bash
   npm update package-name
   npm test
   npm run test:coverage
   ```

3. **Deploy with next release**

---

## 🔍 Investigation Tools

### Security Audit Log Analysis

```bash
# Find all HIGH severity events in last 24 hours
grep -i "high" logs/security.log | grep "$(date -d '24 hours ago' +%Y-%m-%d)"

# Count failed auth attempts by IP
grep "auth_invalid_key" logs/security.log | \
  grep -oP '"ip":"[^"]*"' | sort | uniq -c | sort -rn

# Find rate limit violations
grep "rate_limit_exceeded" logs/security.log | \
  jq -r '.details | "\(.ip) - \(.path)"'
```

### Request Tracing

```bash
# Find all requests for a specific request ID
grep "reqId:abc123" logs/app.log

# Trace suspicious IP activity
grep "10.0.0.1" logs/security.log | jq -r '.timestamp + " - " + .event'
```

### Database Queries (Supabase)

```sql
-- Find suspicious usage patterns
SELECT
  customer_id,
  COUNT(*) as request_count,
  MAX(created_at) as last_request
FROM usage
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY customer_id
HAVING COUNT(*) > 100
ORDER BY request_count DESC;

-- Check for API key usage anomalies
SELECT
  api_key_hash,
  COUNT(DISTINCT ip_address) as unique_ips,
  COUNT(*) as total_requests
FROM api_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY api_key_hash
HAVING COUNT(DISTINCT ip_address) > 10;
```

---

## 📞 Communication Templates

### Internal Alert

```
🚨 SECURITY INCIDENT - P0

Incident: API key leaked in public GitHub commit
Detected: 2025-10-21 14:30 UTC
Status: CONTAINMENT IN PROGRESS

Actions Taken:
✅ Key revoked (14:32 UTC)
✅ New key deployed to production (14:35 UTC)
🔄 Investigating usage patterns
🔄 Removing key from git history

Next Steps:
- Monitor OpenAI usage for 24h
- Review all commits from last 7 days
- Implement git secret scanning

Updates: Every 30 minutes until resolved
```

### Customer Notification

```
Subject: Security Advisory - Action Required

Dear ZodForge API User,

We identified a security issue that may have affected your account.

WHAT HAPPENED:
On October 21, 2025, we discovered [brief description].

IMPACT:
Your API key may have been exposed to [scope of exposure].

ACTION REQUIRED:
1. Rotate your API key immediately
2. Review your recent API usage for anomalies
3. Update your application with the new key

HOW TO ROTATE YOUR KEY:
[Step-by-step instructions]

We take security seriously and have implemented the following
preventative measures: [list measures]

If you have any questions, please contact: security@zodforge.dev

Thank you,
The ZodForge Security Team
```

---

## ✅ Post-Incident Checklist

After resolving any security incident:

- [ ] Incident timeline documented
- [ ] Root cause identified
- [ ] Patch deployed and verified
- [ ] Security tests added
- [ ] Affected users notified (if applicable)
- [ ] Internal team debriefed
- [ ] Preventative measures implemented
- [ ] Documentation updated
- [ ] Incident report filed
- [ ] Security metrics updated

---

## 📚 Resources

- **Security Logs**: `logs/security.log`
- **Application Logs**: `logs/app.log`
- **OpenAI Usage**: https://platform.openai.com/usage
- **Railway Dashboard**: https://railway.app/dashboard
- **Supabase Dashboard**: https://supabase.com/dashboard
- **GitHub Security**: https://github.com/MerlijnW70/zodforge-api/security

---

## 🆘 Escalation

If you need additional support:

1. **Technical**: Contact lead developer
2. **Legal**: Contact legal counsel (for data breaches)
3. **PR**: Contact communications team (for public incidents)
4. **External**: Contact CERT/CC (for coordinated disclosure)

---

**Last Updated**: 2025-10-21
**Version**: 1.0.0
**Owner**: Security Team
