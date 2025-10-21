-- Migration: API Keys with JWT, Rate Limiting, Quota Tracking, and Audit Logging
-- Version: 1.1.0
-- Date: 2025-10-21

-- =====================================================
-- 1. API Keys Table (JWT-based)
-- =====================================================

CREATE TABLE IF NOT EXISTS api_keys (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- JWT Key ID (kid from JWT payload)
  kid TEXT UNIQUE NOT NULL,

  -- Customer/User info
  customer_id TEXT NOT NULL,
  customer_email TEXT,

  -- Key metadata
  name TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('free', 'pro', 'enterprise')),

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,

  -- Rate limits (per key)
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 10,
  rate_limit_per_day INTEGER NOT NULL DEFAULT 100,
  rate_limit_per_month INTEGER NOT NULL DEFAULT 1000,

  -- Quotas (per key)
  quota_tokens_per_month INTEGER NOT NULL DEFAULT 100000,
  quota_cost_limit_per_month DECIMAL(10, 2) NOT NULL DEFAULT 5.00,

  -- Permissions
  permissions TEXT[] DEFAULT ARRAY['refine'],

  -- Metadata
  environment TEXT CHECK (environment IN ('development', 'production')),
  ip_whitelist TEXT[],
  created_by TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

-- Indexes for api_keys
CREATE INDEX idx_api_keys_kid ON api_keys(kid);
CREATE INDEX idx_api_keys_customer_id ON api_keys(customer_id);
CREATE INDEX idx_api_keys_tier ON api_keys(tier);
CREATE INDEX idx_api_keys_is_active ON api_keys(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_api_keys_last_used ON api_keys(last_used_at DESC);

-- =====================================================
-- 2. API Key Usage Tracking (Per-Key Metrics)
-- =====================================================

CREATE TABLE IF NOT EXISTS api_key_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- API Key reference
  kid TEXT NOT NULL REFERENCES api_keys(kid) ON DELETE CASCADE,

  -- Time window (for aggregation)
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('minute', 'hour', 'day', 'month')),

  -- Usage metrics
  request_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,

  -- Token usage
  total_input_tokens BIGINT DEFAULT 0,
  total_output_tokens BIGINT DEFAULT 0,
  total_tokens BIGINT DEFAULT 0,

  -- Cost tracking
  total_cost DECIMAL(10, 4) DEFAULT 0,

  -- Provider usage
  provider_usage JSONB DEFAULT '{}',  -- {"openai": 50, "anthropic": 30}

  -- Model usage
  model_usage JSONB DEFAULT '{}',     -- {"gpt-4": 40, "claude-3.5": 20}

  -- Performance metrics
  avg_latency_ms INTEGER,
  min_latency_ms INTEGER,
  max_latency_ms INTEGER,
  p50_latency_ms INTEGER,
  p95_latency_ms INTEGER,
  p99_latency_ms INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for usage tracking
CREATE INDEX idx_usage_kid ON api_key_usage(kid);
CREATE INDEX idx_usage_period ON api_key_usage(period_start, period_end);
CREATE INDEX idx_usage_period_type ON api_key_usage(period_type);
CREATE UNIQUE INDEX idx_usage_unique_period ON api_key_usage(kid, period_start, period_type);

-- =====================================================
-- 3. Audit Log (Comprehensive Request Logging)
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Request identification
  request_id TEXT,

  -- API Key
  kid TEXT REFERENCES api_keys(kid) ON DELETE SET NULL,
  customer_id TEXT,

  -- Request details
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,

  -- Request payload info (anonymized)
  schema_type_name TEXT,
  sample_count INTEGER,

  -- Response info
  status_code INTEGER,
  success BOOLEAN,
  error_code TEXT,
  error_message TEXT,

  -- AI Provider info
  ai_provider TEXT,  -- 'openai', 'anthropic', etc.
  ai_model TEXT,     -- 'gpt-4-turbo', 'claude-3.5-sonnet', etc.

  -- Token usage (this request)
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,

  -- Cost (this request)
  cost DECIMAL(10, 6),

  -- Performance
  latency_ms INTEGER,
  processing_time_ms INTEGER,
  cache_hit BOOLEAN DEFAULT FALSE,

  -- Client info
  ip_address INET,
  user_agent TEXT,
  client_version TEXT,

  -- Rate limiting
  rate_limit_hit BOOLEAN DEFAULT FALSE,
  quota_exceeded BOOLEAN DEFAULT FALSE,

  -- Metadata
  metadata JSONB,

  -- Timestamp
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit_log
CREATE INDEX idx_audit_kid ON audit_log(kid);
CREATE INDEX idx_audit_customer ON audit_log(customer_id);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_endpoint ON audit_log(endpoint);
CREATE INDEX idx_audit_status ON audit_log(status_code);
CREATE INDEX idx_audit_provider ON audit_log(ai_provider);
CREATE INDEX idx_audit_success ON audit_log(success);

-- Partition by month for performance (optional, for large scale)
-- CREATE TABLE audit_log_2025_10 PARTITION OF audit_log
-- FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

-- =====================================================
-- 4. Rate Limit State (Real-time tracking)
-- =====================================================

CREATE TABLE IF NOT EXISTS rate_limit_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- API Key
  kid TEXT NOT NULL REFERENCES api_keys(kid) ON DELETE CASCADE,

  -- Window type
  window_type TEXT NOT NULL CHECK (window_type IN ('minute', 'day', 'month')),

  -- Window start
  window_start TIMESTAMPTZ NOT NULL,

  -- Request count in this window
  request_count INTEGER DEFAULT 0,

  -- Last request time
  last_request_at TIMESTAMPTZ DEFAULT NOW(),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one row per (kid, window_type, window_start)
CREATE UNIQUE INDEX idx_rate_limit_unique ON rate_limit_state(kid, window_type, window_start);
CREATE INDEX idx_rate_limit_kid ON rate_limit_state(kid);
CREATE INDEX idx_rate_limit_window ON rate_limit_state(window_start);

-- =====================================================
-- 5. Functions and Triggers
-- =====================================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_api_keys_updated_at BEFORE UPDATE ON api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_updated_at BEFORE UPDATE ON api_key_usage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rate_limit_updated_at BEFORE UPDATE ON rate_limit_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 6. Helper Functions
-- =====================================================

-- Function to check rate limit
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_kid TEXT,
  p_window_type TEXT,
  p_limit INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  -- Calculate window start based on type
  CASE p_window_type
    WHEN 'minute' THEN
      v_window_start := DATE_TRUNC('minute', NOW());
    WHEN 'day' THEN
      v_window_start := DATE_TRUNC('day', NOW());
    WHEN 'month' THEN
      v_window_start := DATE_TRUNC('month', NOW());
  END CASE;

  -- Get current count
  SELECT COALESCE(request_count, 0) INTO v_count
  FROM rate_limit_state
  WHERE kid = p_kid
    AND window_type = p_window_type
    AND window_start = v_window_start;

  -- Check if under limit
  RETURN (v_count < p_limit);
END;
$$ LANGUAGE plpgsql;

-- Function to increment rate limit counter
CREATE OR REPLACE FUNCTION increment_rate_limit(
  p_kid TEXT,
  p_window_type TEXT
)
RETURNS VOID AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
BEGIN
  -- Calculate window start
  CASE p_window_type
    WHEN 'minute' THEN
      v_window_start := DATE_TRUNC('minute', NOW());
    WHEN 'day' THEN
      v_window_start := DATE_TRUNC('day', NOW());
    WHEN 'month' THEN
      v_window_start := DATE_TRUNC('month', NOW());
  END CASE;

  -- Insert or update
  INSERT INTO rate_limit_state (kid, window_type, window_start, request_count, last_request_at)
  VALUES (p_kid, p_window_type, v_window_start, 1, NOW())
  ON CONFLICT (kid, window_type, window_start)
  DO UPDATE SET
    request_count = rate_limit_state.request_count + 1,
    last_request_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 7. Row Level Security (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limit_state ENABLE ROW LEVEL SECURITY;

-- Policies (customize based on your auth setup)
-- Example: Only service role can access these tables
CREATE POLICY service_role_all ON api_keys
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY service_role_all ON api_key_usage
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY service_role_all ON audit_log
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY service_role_all ON rate_limit_state
  FOR ALL USING (auth.role() = 'service_role');

-- =====================================================
-- 8. Sample Data (Optional - for testing)
-- =====================================================

-- Example: Create a test API key entry
-- INSERT INTO api_keys (kid, customer_id, name, tier, customer_email)
-- VALUES (
--   'test_kid_123',
--   'customer_test',
--   'Test API Key',
--   'pro',
--   'test@example.com'
-- );

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE api_keys IS 'JWT-based API keys with per-key limits and quotas';
COMMENT ON TABLE api_key_usage IS 'Aggregated usage metrics per API key';
COMMENT ON TABLE audit_log IS 'Comprehensive request audit trail';
COMMENT ON TABLE rate_limit_state IS 'Real-time rate limit tracking per key';

COMMENT ON COLUMN api_keys.kid IS 'JWT Key ID from JWT payload (unique identifier)';
COMMENT ON COLUMN api_keys.tier IS 'Subscription tier: free, pro, enterprise';
COMMENT ON COLUMN audit_log.cache_hit IS 'Whether response was served from cache';
COMMENT ON COLUMN audit_log.cost IS 'Cost in USD for this request';
