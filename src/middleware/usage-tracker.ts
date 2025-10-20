import type { FastifyRequest, FastifyReply } from 'fastify';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

// Initialize Supabase client (lazy initialization)
let supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    console.warn('[Usage Tracker] Supabase not configured - usage tracking disabled');
    return null;
  }

  if (!supabase) {
    supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
    console.log('[Usage Tracker] Supabase client initialized');
  }

  return supabase;
}

// Tier limits (requests per month)
export const TIER_LIMITS = {
  free: 100,
  pro: 5000,
  enterprise: Infinity, // Unlimited
} as const;

export type Tier = keyof typeof TIER_LIMITS;

/**
 * Track API usage for a given API key
 */
export async function trackUsage(
  apiKey: string,
  endpoint: string,
  success: boolean,
  processingTimeMs: number,
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return; // Supabase not configured

  try {
    const { error } = await supabase.from('usage').insert({
      api_key: apiKey,
      endpoint,
      success,
      processing_time_ms: processingTimeMs,
      timestamp: new Date().toISOString(),
    });

    if (error) {
      console.error('[Usage Tracker] Failed to log usage:', error.message);
    }
  } catch (err) {
    console.error('[Usage Tracker] Exception logging usage:', err);
  }
}

/**
 * Get customer tier and usage count for current month
 */
export async function getCustomerUsage(apiKey: string): Promise<{
  tier: Tier;
  requestsThisMonth: number;
  limit: number;
  remaining: number;
  resetDate: string;
} | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null; // Supabase not configured

  try {
    // Get customer tier
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('tier, subscription_status')
      .eq('api_key', apiKey)
      .single();

    if (customerError || !customer) {
      console.error('[Usage Tracker] Customer not found:', apiKey.substring(0, 10));
      return null;
    }

    // Check subscription status
    if (customer.subscription_status !== 'active') {
      console.warn('[Usage Tracker] Inactive subscription:', apiKey.substring(0, 10));
      return null;
    }

    const tier = customer.tier as Tier;
    const limit = TIER_LIMITS[tier];

    // Get usage for current month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count: requestsThisMonth, error: usageError } = await supabase
      .from('usage')
      .select('*', { count: 'exact', head: true })
      .eq('api_key', apiKey)
      .gte('timestamp', startOfMonth.toISOString());

    if (usageError) {
      console.error('[Usage Tracker] Error fetching usage:', usageError.message);
      return null;
    }

    // Calculate reset date (first day of next month)
    const resetDate = new Date();
    resetDate.setMonth(resetDate.getMonth() + 1);
    resetDate.setDate(1);
    resetDate.setHours(0, 0, 0, 0);

    return {
      tier,
      requestsThisMonth: requestsThisMonth || 0,
      limit,
      remaining: Math.max(0, limit - (requestsThisMonth || 0)),
      resetDate: resetDate.toISOString(),
    };
  } catch (err) {
    console.error('[Usage Tracker] Exception fetching customer usage:', err);
    return null;
  }
}

/**
 * Fastify middleware to track usage and enforce rate limits
 */
export async function usageMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const startTime = Date.now();
  const endpoint = request.url;

  // Extract API key from Authorization header
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.status(401).send({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header',
    });
    return;
  }

  const apiKey = authHeader.substring(7); // Remove 'Bearer ' prefix

  // Get customer usage
  const usage = await getCustomerUsage(apiKey);

  if (!usage) {
    reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid API key or inactive subscription',
    });
    return;
  }

  // Check if limit exceeded
  if (usage.requestsThisMonth >= usage.limit) {
    // Log the failed attempt
    await trackUsage(apiKey, endpoint, false, Date.now() - startTime);

    // Add rate limit headers to 429 response
    const resetTimestamp = Math.floor(new Date(usage.resetDate).getTime() / 1000);
    reply.header('X-RateLimit-Limit', usage.limit.toString());
    reply.header('X-RateLimit-Remaining', '0');
    reply.header('X-RateLimit-Reset', resetTimestamp.toString());
    reply.header('X-RateLimit-Used', usage.requestsThisMonth.toString());
    reply.header('Retry-After', resetTimestamp.toString());

    reply.status(429).send({
      error: 'Rate Limit Exceeded',
      message: `You have exceeded your ${usage.tier} plan limit of ${usage.limit} requests per month`,
      usage: {
        tier: usage.tier,
        limit: usage.limit,
        used: usage.requestsThisMonth,
        remaining: 0,
        resetDate: usage.resetDate,
      },
    });
    return;
  }

  // Add usage info to request object for use in route handlers
  (request as any).usage = usage;

  // Add standard rate limit headers to response
  const resetTimestamp = Math.floor(new Date(usage.resetDate).getTime() / 1000);
  reply.header('X-RateLimit-Limit', usage.limit.toString());
  reply.header('X-RateLimit-Remaining', usage.remaining.toString());
  reply.header('X-RateLimit-Reset', resetTimestamp.toString());
  reply.header('X-RateLimit-Used', usage.requestsThisMonth.toString());

  // Track usage after response is sent (using onResponse hook)
  request.server.addHook('onResponse', async (req: any, rep: any) => {
    // Only track for this specific request
    if (req.id === request.id) {
      const processingTime = Date.now() - startTime;
      const success = rep.statusCode >= 200 && rep.statusCode < 400;

      // Track usage asynchronously (don't block response)
      trackUsage(apiKey, endpoint, success, processingTime).catch((err) => {
        console.error('[Usage Tracker] Failed to track usage:', err);
      });
    }
  });
}

/**
 * Get detailed usage statistics for an API key
 */
export async function getUsageStats(apiKey: string): Promise<{
  tier: Tier;
  currentPeriod: {
    used: number;
    limit: number;
    remaining: number;
    resetDate: string;
  };
  lastWeek: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgProcessingTimeMs: number;
  };
} | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null; // Supabase not configured

  try {
    const usage = await getCustomerUsage(apiKey);
    if (!usage) return null;

    // Get stats for last 7 days
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data: recentUsage, error } = await supabase
      .from('usage')
      .select('success, processing_time_ms')
      .eq('api_key', apiKey)
      .gte('timestamp', weekAgo.toISOString());

    if (error) {
      console.error('[Usage Tracker] Error fetching stats:', error.message);
      return null;
    }

    const totalRequests = recentUsage?.length || 0;
    const successfulRequests = recentUsage?.filter((r) => r.success).length || 0;
    const failedRequests = totalRequests - successfulRequests;
    const avgProcessingTimeMs =
      totalRequests > 0
        ? recentUsage!.reduce((sum, r) => sum + (r.processing_time_ms || 0), 0) / totalRequests
        : 0;

    return {
      tier: usage.tier,
      currentPeriod: {
        used: usage.requestsThisMonth,
        limit: usage.limit,
        remaining: usage.remaining,
        resetDate: usage.resetDate,
      },
      lastWeek: {
        totalRequests,
        successfulRequests,
        failedRequests,
        avgProcessingTimeMs: Math.round(avgProcessingTimeMs),
      },
    };
  } catch (err) {
    console.error('[Usage Tracker] Exception fetching usage stats:', err);
    return null;
  }
}
