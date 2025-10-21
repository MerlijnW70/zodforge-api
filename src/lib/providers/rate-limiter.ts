// Per-provider rate limiting
export interface RateLimitConfig {
  /**
   * Maximum requests per window
   */
  maxRequests: number;

  /**
   * Window duration in milliseconds
   */
  windowMs: number;

  /**
   * Enable rate limiting
   */
  enabled: boolean;
}

interface RateLimitEntry {
  requests: number[];
  blocked: boolean;
  blockedUntil?: number;
}

/**
 * Rate limiter for AI providers
 */
export class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private configs: Map<string, RateLimitConfig> = new Map();

  /**
   * Set rate limit for a provider
   */
  setLimit(provider: string, config: RateLimitConfig): void {
    this.configs.set(provider, config);
    console.log(
      `⏱️  Rate limit set for ${provider}: ${config.maxRequests} req/${config.windowMs}ms`
    );
  }

  /**
   * Check if request is allowed
   */
  async checkLimit(provider: string): Promise<{ allowed: boolean; retryAfter?: number }> {
    const config = this.configs.get(provider);

    // No config = no limit
    if (!config || !config.enabled) {
      return { allowed: true };
    }

    const now = Date.now();
    let entry = this.limits.get(provider);

    if (!entry) {
      entry = { requests: [], blocked: false };
      this.limits.set(provider, entry);
    }

    // Check if currently blocked
    if (entry.blocked && entry.blockedUntil) {
      if (now < entry.blockedUntil) {
        const retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
        return { allowed: false, retryAfter };
      } else {
        // Unblock
        entry.blocked = false;
        entry.blockedUntil = undefined;
        entry.requests = [];
      }
    }

    // Remove requests outside window
    entry.requests = entry.requests.filter((timestamp) => now - timestamp < config.windowMs);

    // Check if limit exceeded
    if (entry.requests.length >= config.maxRequests) {
      const oldestRequest = entry.requests[0];
      const retryAfter = Math.ceil((oldestRequest + config.windowMs - now) / 1000);

      entry.blocked = true;
      entry.blockedUntil = oldestRequest + config.windowMs;

      console.warn(
        `⏱️  Rate limit EXCEEDED for ${provider} (${entry.requests.length}/${config.maxRequests}). Retry after ${retryAfter}s`
      );

      return { allowed: false, retryAfter };
    }

    // Record request
    entry.requests.push(now);
    return { allowed: true };
  }

  /**
   * Reset rate limit for a provider
   */
  reset(provider: string): void {
    this.limits.delete(provider);
    console.log(`⏱️  Rate limit reset for ${provider}`);
  }

  /**
   * Reset all rate limits
   */
  resetAll(): void {
    this.limits.clear();
    console.log('⏱️  All rate limits reset');
  }

  /**
   * Get current rate limit status
   */
  getStatus(provider: string): {
    requestCount: number;
    maxRequests: number;
    windowMs: number;
    blocked: boolean;
    retryAfter?: number;
  } | null {
    const config = this.configs.get(provider);
    const entry = this.limits.get(provider);

    if (!config) {
      return null;
    }

    const now = Date.now();
    const requests = entry?.requests.filter((t) => now - t < config.windowMs) || [];

    let retryAfter: number | undefined;
    if (entry?.blocked && entry.blockedUntil) {
      retryAfter = Math.ceil((entry.blockedUntil - now) / 1000);
    }

    return {
      requestCount: requests.length,
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
      blocked: entry?.blocked || false,
      retryAfter,
    };
  }

  /**
   * Get all rate limit statuses
   */
  getAllStatuses(): Record<
    string,
    {
      requestCount: number;
      maxRequests: number;
      windowMs: number;
      blocked: boolean;
    }
  > {
    const statuses: Record<string, any> = {};

    for (const provider of this.configs.keys()) {
      const status = this.getStatus(provider);
      if (status) {
        statuses[provider] = status;
      }
    }

    return statuses;
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();
