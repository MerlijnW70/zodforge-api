// Comprehensive audit logging system
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { ApiKeyPayload } from './jwt-keys.js';

/**
 * Audit log entry structure
 */
export interface AuditLogEntry {
  // Request identification
  requestId?: string;

  // API Key
  kid?: string;
  customerId?: string;

  // Request details
  endpoint: string;
  method: string;

  // Request payload info (anonymized - no actual data)
  schemaTypeName?: string;
  sampleCount?: number;

  // Response info
  statusCode: number;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;

  // AI Provider info
  aiProvider?: string;
  aiModel?: string;

  // Token usage
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;

  // Cost
  cost?: number;

  // Performance
  latencyMs?: number;
  processingTimeMs?: number;
  cacheHit?: boolean;

  // Client info
  ipAddress?: string;
  userAgent?: string;
  clientVersion?: string;

  // Rate limiting
  rateLimitHit?: boolean;
  quotaExceeded?: boolean;

  // Metadata
  metadata?: Record<string, any>;
}

/**
 * Usage metrics for aggregation
 */
export interface UsageMetrics {
  kid: string;
  periodStart: Date;
  periodEnd: Date;
  periodType: 'minute' | 'hour' | 'day' | 'month';

  requestCount: number;
  successCount: number;
  errorCount: number;

  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;

  totalCost: number;

  providerUsage: Record<string, number>;
  modelUsage: Record<string, number>;

  avgLatencyMs?: number;
  minLatencyMs?: number;
  maxLatencyMs?: number;
  p50LatencyMs?: number;
  p95LatencyMs?: number;
  p99LatencyMs?: number;
}

/**
 * Audit logger for comprehensive request tracking
 */
export class AuditLogger {
  private supabase: SupabaseClient | null = null;
  private enabled: boolean;
  private batchSize = 100;
  private batchQueue: AuditLogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor(supabaseUrl?: string, supabaseKey?: string, enabled = true) {
    this.enabled = enabled;

    if (enabled && supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);

      // Auto-flush every 10 seconds
      this.flushInterval = setInterval(() => {
        this.flush();
      }, 10000);

      console.log('✅ Audit logger initialized with Supabase');
    } else {
      console.warn('⚠️  Audit logger disabled (no Supabase credentials)');
    }
  }

  /**
   * Log a request to the audit trail
   */
  async log(entry: AuditLogEntry): Promise<void> {
    if (!this.enabled || !this.supabase) {
      return;
    }

    // Add to batch queue
    this.batchQueue.push({
      ...entry,
      timestamp: new Date(),
    } as any);

    // Flush if batch is full
    if (this.batchQueue.length >= this.batchSize) {
      await this.flush();
    }
  }

  /**
   * Flush queued entries to database
   */
  async flush(): Promise<void> {
    if (!this.supabase || this.batchQueue.length === 0) {
      return;
    }

    const toInsert = [...this.batchQueue];
    this.batchQueue = [];

    try {
      const { error } = await this.supabase
        .from('audit_log')
        .insert(
          toInsert.map((entry) => ({
            request_id: entry.requestId,
            kid: entry.kid,
            customer_id: entry.customerId,
            endpoint: entry.endpoint,
            method: entry.method,
            schema_type_name: entry.schemaTypeName,
            sample_count: entry.sampleCount,
            status_code: entry.statusCode,
            success: entry.success,
            error_code: entry.errorCode,
            error_message: entry.errorMessage,
            ai_provider: entry.aiProvider,
            ai_model: entry.aiModel,
            input_tokens: entry.inputTokens,
            output_tokens: entry.outputTokens,
            total_tokens: entry.totalTokens,
            cost: entry.cost,
            latency_ms: entry.latencyMs,
            processing_time_ms: entry.processingTimeMs,
            cache_hit: entry.cacheHit,
            ip_address: entry.ipAddress,
            user_agent: entry.userAgent,
            client_version: entry.clientVersion,
            rate_limit_hit: entry.rateLimitHit,
            quota_exceeded: entry.quotaExceeded,
            metadata: entry.metadata,
          }))
        );

      if (error) {
        console.error('Failed to insert audit logs:', error);
      }
    } catch (error) {
      console.error('Audit log flush error:', error);
    }
  }

  /**
   * Track usage metrics (aggregated)
   */
  async trackUsage(metrics: UsageMetrics): Promise<void> {
    if (!this.enabled || !this.supabase) {
      return;
    }

    try {
      const { error } = await this.supabase
        .from('api_key_usage')
        .upsert(
          {
            kid: metrics.kid,
            period_start: metrics.periodStart.toISOString(),
            period_end: metrics.periodEnd.toISOString(),
            period_type: metrics.periodType,
            request_count: metrics.requestCount,
            success_count: metrics.successCount,
            error_count: metrics.errorCount,
            total_input_tokens: metrics.totalInputTokens,
            total_output_tokens: metrics.totalOutputTokens,
            total_tokens: metrics.totalTokens,
            total_cost: metrics.totalCost,
            provider_usage: metrics.providerUsage,
            model_usage: metrics.modelUsage,
            avg_latency_ms: metrics.avgLatencyMs,
            min_latency_ms: metrics.minLatencyMs,
            max_latency_ms: metrics.maxLatencyMs,
            p50_latency_ms: metrics.p50LatencyMs,
            p95_latency_ms: metrics.p95LatencyMs,
            p99_latency_ms: metrics.p99LatencyMs,
          },
          {
            onConflict: 'kid,period_start,period_type',
            // Increment counts on conflict
          }
        );

      if (error) {
        console.error('Failed to track usage:', error);
      }
    } catch (error) {
      console.error('Usage tracking error:', error);
    }
  }

  /**
   * Update API key last used timestamp
   */
  async updateKeyLastUsed(kid: string): Promise<void> {
    if (!this.enabled || !this.supabase) {
      return;
    }

    try {
      await this.supabase
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('kid', kid);
    } catch (error) {
      console.error('Failed to update key last used:', error);
    }
  }

  /**
   * Check rate limit (per-key)
   */
  async checkRateLimit(
    kid: string,
    windowType: 'minute' | 'day' | 'month',
    limit: number
  ): Promise<{ allowed: boolean; current: number; limit: number }> {
    if (!this.enabled || !this.supabase) {
      return { allowed: true, current: 0, limit };
    }

    try {
      const { data, error } = await this.supabase.rpc('check_rate_limit', {
        p_kid: kid,
        p_window_type: windowType,
        p_limit: limit,
      });

      if (error) {
        console.error('Rate limit check error:', error);
        return { allowed: true, current: 0, limit }; // Fail open
      }

      return {
        allowed: data === true,
        current: 0, // TODO: Get from state table
        limit,
      };
    } catch (error) {
      console.error('Rate limit check error:', error);
      return { allowed: true, current: 0, limit }; // Fail open
    }
  }

  /**
   * Increment rate limit counter
   */
  async incrementRateLimit(kid: string, windowType: 'minute' | 'day' | 'month'): Promise<void> {
    if (!this.enabled || !this.supabase) {
      return;
    }

    try {
      await this.supabase.rpc('increment_rate_limit', {
        p_kid: kid,
        p_window_type: windowType,
      });
    } catch (error) {
      console.error('Failed to increment rate limit:', error);
    }
  }

  /**
   * Get usage summary for a key
   */
  async getUsageSummary(
    kid: string,
    periodType: 'day' | 'month',
    since?: Date
  ): Promise<UsageMetrics | null> {
    if (!this.enabled || !this.supabase) {
      return null;
    }

    try {
      let query = this.supabase
        .from('api_key_usage')
        .select('*')
        .eq('kid', kid)
        .eq('period_type', periodType);

      if (since) {
        query = query.gte('period_start', since.toISOString());
      }

      const { data, error } = await query.order('period_start', { ascending: false }).limit(1);

      if (error || !data || data.length === 0) {
        return null;
      }

      const row = data[0];
      return {
        kid: row.kid,
        periodStart: new Date(row.period_start),
        periodEnd: new Date(row.period_end),
        periodType: row.period_type,
        requestCount: row.request_count,
        successCount: row.success_count,
        errorCount: row.error_count,
        totalInputTokens: row.total_input_tokens,
        totalOutputTokens: row.total_output_tokens,
        totalTokens: row.total_tokens,
        totalCost: parseFloat(row.total_cost),
        providerUsage: row.provider_usage,
        modelUsage: row.model_usage,
        avgLatencyMs: row.avg_latency_ms,
        minLatencyMs: row.min_latency_ms,
        maxLatencyMs: row.max_latency_ms,
        p50LatencyMs: row.p50_latency_ms,
        p95LatencyMs: row.p95_latency_ms,
        p99LatencyMs: row.p99_latency_ms,
      };
    } catch (error) {
      console.error('Failed to get usage summary:', error);
      return null;
    }
  }

  /**
   * Cleanup on shutdown
   */
  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    await this.flush();
  }
}

// Export singleton instance
let auditLogger: AuditLogger | null = null;

export function getAuditLogger(): AuditLogger {
  if (!auditLogger) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    const enabled = process.env.AUDIT_LOGGING_ENABLED !== 'false';

    auditLogger = new AuditLogger(supabaseUrl, supabaseKey, enabled);
  }

  return auditLogger;
}
