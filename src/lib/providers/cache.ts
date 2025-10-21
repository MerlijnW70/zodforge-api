// Response caching layer for AI providers
import crypto from 'crypto';
import type { RefinementRequest, RefinementResponse } from '../../types/index.js';

/**
 * Cache entry
 */
interface CacheEntry {
  key: string;
  response: Omit<RefinementResponse, 'success' | 'error' | 'errorCode'>;
  timestamp: number;
  ttl: number;
  provider: string;
  hits: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  totalEntries: number;
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  memorySizeBytes: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /**
   * Maximum number of entries
   */
  maxEntries: number;

  /**
   * Default TTL in milliseconds
   */
  defaultTTL: number;

  /**
   * Enable cache
   */
  enabled: boolean;
}

/**
 * Response cache with LRU eviction
 */
export class ResponseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private hits = 0;
  private misses = 0;
  private config: CacheConfig;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxEntries: config.maxEntries || 1000,
      defaultTTL: config.defaultTTL || 3600000, // 1 hour
      enabled: config.enabled ?? true,
    };

    console.log('💾 Response cache initialized');
    console.log(`   Max entries: ${this.config.maxEntries}`);
    console.log(`   Default TTL: ${this.config.defaultTTL}ms`);
  }

  /**
   * Generate cache key from request
   */
  private generateKey(request: RefinementRequest): string {
    // Create deterministic hash from request data
    const data = JSON.stringify({
      schema: request.schema,
      samples: request.samples,
      options: {
        provider: request.options?.provider,
        model: request.options?.model,
        temperature: request.options?.temperature,
      },
    });

    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Get cached response
   */
  get(request: RefinementRequest): Omit<RefinementResponse, 'success' | 'error' | 'errorCode'> | null {
    if (!this.config.enabled) {
      return null;
    }

    const key = this.generateKey(request);
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Cache hit - update stats and move to end (LRU)
    entry.hits++;
    this.hits++;
    this.cache.delete(key);
    this.cache.set(key, entry);

    console.log(`💾 Cache HIT for ${request.schema.typeName} (provider: ${entry.provider})`);
    return entry.response;
  }

  /**
   * Set cached response
   */
  set(
    request: RefinementRequest,
    response: Omit<RefinementResponse, 'success' | 'error' | 'errorCode'>,
    ttl?: number
  ): void {
    if (!this.config.enabled) {
      return;
    }

    const key = this.generateKey(request);

    // Evict oldest entry if cache is full
    if (this.cache.size >= this.config.maxEntries && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const entry: CacheEntry = {
      key,
      response,
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTTL,
      provider: response.aiProvider || 'unknown',
      hits: 0,
    };

    this.cache.set(key, entry);
    console.log(`💾 Cache SET for ${request.schema.typeName} (TTL: ${entry.ttl}ms)`);
  }

  /**
   * Invalidate cache entry
   */
  invalidate(request: RefinementRequest): boolean {
    const key = this.generateKey(request);
    const deleted = this.cache.delete(key);
    if (deleted) {
      console.log(`💾 Cache INVALIDATE for ${request.schema.typeName}`);
    }
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    console.log('💾 Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;

    // Rough memory estimate
    const memorySizeBytes = Array.from(this.cache.values()).reduce((sum, entry) => {
      return sum + JSON.stringify(entry).length;
    }, 0);

    return {
      totalEntries: this.cache.size,
      totalHits: this.hits,
      totalMisses: this.misses,
      hitRate,
      memorySizeBytes,
    };
  }

  /**
   * Enable/disable cache
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    console.log(`💾 Cache ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Update cache configuration
   */
  updateConfig(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('💾 Cache configuration updated');
  }

  /**
   * Prune expired entries
   */
  prune(): number {
    const now = Date.now();
    let pruned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        pruned++;
      }
    }

    if (pruned > 0) {
      console.log(`💾 Pruned ${pruned} expired cache entries`);
    }

    return pruned;
  }
}

// Export singleton instance
export const responseCache = new ResponseCache({
  maxEntries: 1000,
  defaultTTL: 3600000, // 1 hour
  enabled: true,
});

// Auto-prune every 10 minutes
setInterval(() => {
  responseCache.prune();
}, 600000);
