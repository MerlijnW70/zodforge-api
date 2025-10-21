// Provider metrics collection and monitoring
export interface ProviderMetrics {
  provider: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalResponseTime: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  successRate: number;
  lastRequestTime?: number;
  lastSuccessTime?: number;
  lastFailureTime?: number;
}

interface MetricEntry {
  timestamp: number;
  provider: string;
  success: boolean;
  responseTime: number;
  error?: string;
}

/**
 * Metrics collector for provider performance monitoring
 */
export class MetricsCollector {
  private entries: MetricEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries = 10000) {
    this.maxEntries = maxEntries;
    console.log(`📊 Metrics collector initialized (max entries: ${maxEntries})`);
  }

  /**
   * Record a request metric
   */
  record(provider: string, success: boolean, responseTime: number, error?: string): void {
    const entry: MetricEntry = {
      timestamp: Date.now(),
      provider,
      success,
      responseTime,
      error,
    };

    this.entries.push(entry);

    // Prune old entries if needed
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    const status = success ? '✅' : '❌';
    console.log(
      `📊 Metric recorded: ${provider} ${status} ${responseTime}ms${error ? ` (${error})` : ''}`
    );
  }

  /**
   * Get metrics for a specific provider
   */
  getMetrics(provider: string, since?: Date): ProviderMetrics {
    const sinceTimestamp = since ? since.getTime() : 0;
    const providerEntries = this.entries.filter(
      (entry) => entry.provider === provider && entry.timestamp >= sinceTimestamp
    );

    if (providerEntries.length === 0) {
      return {
        provider,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        totalResponseTime: 0,
        averageResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
        successRate: 0,
      };
    }

    const successful = providerEntries.filter((e) => e.success);
    const failed = providerEntries.filter((e) => !e.success);
    const responseTimes = providerEntries.map((e) => e.responseTime);
    const totalResponseTime = responseTimes.reduce((sum, time) => sum + time, 0);

    const lastEntry = providerEntries[providerEntries.length - 1];
    const lastSuccess = successful.length > 0 ? successful[successful.length - 1] : undefined;
    const lastFailure = failed.length > 0 ? failed[failed.length - 1] : undefined;

    return {
      provider,
      totalRequests: providerEntries.length,
      successfulRequests: successful.length,
      failedRequests: failed.length,
      totalResponseTime,
      averageResponseTime: totalResponseTime / providerEntries.length,
      minResponseTime: Math.min(...responseTimes),
      maxResponseTime: Math.max(...responseTimes),
      successRate: successful.length / providerEntries.length,
      lastRequestTime: lastEntry?.timestamp,
      lastSuccessTime: lastSuccess?.timestamp,
      lastFailureTime: lastFailure?.timestamp,
    };
  }

  /**
   * Get metrics for all providers
   */
  getAllMetrics(since?: Date): Record<string, ProviderMetrics> {
    const providers = new Set(this.entries.map((entry) => entry.provider));
    const metrics: Record<string, ProviderMetrics> = {};

    for (const provider of providers) {
      metrics[provider] = this.getMetrics(provider, since);
    }

    return metrics;
  }

  /**
   * Get top performing providers by success rate
   */
  getTopProviders(limit = 5, since?: Date): Array<{ provider: string; metrics: ProviderMetrics }> {
    const allMetrics = this.getAllMetrics(since);
    return Object.entries(allMetrics)
      .map(([provider, metrics]) => ({ provider, metrics }))
      .sort((a, b) => b.metrics.successRate - a.metrics.successRate)
      .slice(0, limit);
  }

  /**
   * Get slowest providers by average response time
   */
  getSlowestProviders(
    limit = 5,
    since?: Date
  ): Array<{ provider: string; metrics: ProviderMetrics }> {
    const allMetrics = this.getAllMetrics(since);
    return Object.entries(allMetrics)
      .map(([provider, metrics]) => ({ provider, metrics }))
      .filter(({ metrics }) => metrics.totalRequests > 0)
      .sort((a, b) => b.metrics.averageResponseTime - a.metrics.averageResponseTime)
      .slice(0, limit);
  }

  /**
   * Get fastest providers by average response time
   */
  getFastestProviders(
    limit = 5,
    since?: Date
  ): Array<{ provider: string; metrics: ProviderMetrics }> {
    const allMetrics = this.getAllMetrics(since);
    return Object.entries(allMetrics)
      .map(([provider, metrics]) => ({ provider, metrics }))
      .filter(({ metrics }) => metrics.totalRequests > 0)
      .sort((a, b) => a.metrics.averageResponseTime - b.metrics.averageResponseTime)
      .slice(0, limit);
  }

  /**
   * Get error breakdown for a provider
   */
  getErrorBreakdown(
    provider: string,
    since?: Date
  ): Record<string, { count: number; percentage: number }> {
    const sinceTimestamp = since ? since.getTime() : 0;
    const providerEntries = this.entries.filter(
      (entry) =>
        entry.provider === provider && !entry.success && entry.timestamp >= sinceTimestamp
    );

    const errorCounts: Record<string, number> = {};
    for (const entry of providerEntries) {
      const error = entry.error || 'Unknown error';
      errorCounts[error] = (errorCounts[error] || 0) + 1;
    }

    const total = providerEntries.length;
    const breakdown: Record<string, { count: number; percentage: number }> = {};

    for (const [error, count] of Object.entries(errorCounts)) {
      breakdown[error] = {
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      };
    }

    return breakdown;
  }

  /**
   * Get timeline of requests (grouped by time interval)
   */
  getTimeline(
    provider: string,
    intervalMs = 60000,
    since?: Date
  ): Array<{
    timestamp: number;
    requests: number;
    successful: number;
    failed: number;
    avgResponseTime: number;
  }> {
    const sinceTimestamp = since ? since.getTime() : 0;
    const providerEntries = this.entries.filter(
      (entry) => entry.provider === provider && entry.timestamp >= sinceTimestamp
    );

    const buckets: Record<number, MetricEntry[]> = {};

    for (const entry of providerEntries) {
      const bucketKey = Math.floor(entry.timestamp / intervalMs) * intervalMs;
      if (!buckets[bucketKey]) {
        buckets[bucketKey] = [];
      }
      buckets[bucketKey].push(entry);
    }

    return Object.entries(buckets)
      .map(([timestamp, entries]) => {
        const successful = entries.filter((e) => e.success);
        const failed = entries.filter((e) => !e.success);
        const avgResponseTime =
          entries.reduce((sum, e) => sum + e.responseTime, 0) / entries.length;

        return {
          timestamp: parseInt(timestamp),
          requests: entries.length,
          successful: successful.length,
          failed: failed.length,
          avgResponseTime,
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.entries = [];
    console.log('📊 Metrics cleared');
  }

  /**
   * Get entry count
   */
  getEntryCount(): number {
    return this.entries.length;
  }

  /**
   * Export metrics as JSON
   */
  exportJSON(): string {
    return JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        totalEntries: this.entries.length,
        metrics: this.getAllMetrics(),
      },
      null,
      2
    );
  }
}

// Export singleton instance
export const metricsCollector = new MetricsCollector(10000);
