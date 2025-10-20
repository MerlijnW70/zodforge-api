// Security utilities for protecting sensitive data
import crypto from 'crypto';

/**
 * Log security events for monitoring and auditing
 */
export function logSecurityEvent(
  type: 'unauthorized' | 'invalid_key' | 'rate_limit' | 'suspicious_activity',
  message: string,
  severity: 'low' | 'medium' | 'high' = 'medium'
): void {
  const timestamp = new Date().toISOString();
  const logLevel = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';

  console[logLevel](`[SECURITY] [${type.toUpperCase()}] ${timestamp} - ${message}`);

  // In production, you might want to send this to a security monitoring service
  // e.g., Sentry, Datadog, CloudWatch, etc.
}

/**
 * Mask sensitive API keys in logs and error messages
 * Shows only first 7 and last 4 characters
 */
export function maskApiKey(key: string | undefined): string {
  if (!key) return '[MISSING]';
  if (key.length < 12) return '[INVALID]';

  const prefix = key.substring(0, 7);
  const suffix = key.substring(key.length - 4);
  const masked = '*'.repeat(Math.min(key.length - 11, 20));

  return `${prefix}${masked}${suffix}`;
}

/**
 * Validate API key format without exposing the actual key
 */
export function validateApiKeyFormat(key: string | undefined): {
  valid: boolean;
  error?: string;
} {
  if (!key) {
    return { valid: false, error: 'API key is missing' };
  }

  if (key.startsWith('sk-')) {
    // OpenAI key format
    if (key.length < 40) {
      return { valid: false, error: 'OpenAI API key appears to be incomplete' };
    }
  } else if (key.startsWith('zf_')) {
    // ZodForge key format
    if (key.length < 20) {
      return { valid: false, error: 'ZodForge API key is too short' };
    }
  } else {
    return { valid: false, error: 'Unknown API key format' };
  }

  return { valid: true };
}

/**
 * Hash API key for secure storage or comparison
 */
export function hashApiKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

/**
 * Generate a secure ZodForge API key
 */
export function generateApiKey(): string {
  const randomBytes = crypto.randomBytes(32);
  return `zf_${randomBytes.toString('hex')}`;
}

/**
 * Sanitize error messages to prevent key leakage
 */
export function sanitizeError(error: any): string {
  if (!error) return 'Unknown error';

  let message = typeof error === 'string' ? error : error.message || 'Unknown error';

  // Remove any potential API keys from error messages
  message = message.replace(/sk-[a-zA-Z0-9-_]{40,}/g, '[OPENAI_KEY_REDACTED]');
  message = message.replace(/zf_[a-f0-9]{64}/g, '[ZODFORGE_KEY_REDACTED]');

  // Remove other sensitive patterns
  message = message.replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]');
  message = message.replace(/Authorization:\s*[^\s]+/gi, 'Authorization: [REDACTED]');

  return message;
}

/**
 * Check if a string contains sensitive data
 */
export function containsSensitiveData(str: string): boolean {
  const sensitivePatterns = [
    /sk-[a-zA-Z0-9-_]{20,}/,      // OpenAI keys
    /zf_[a-f0-9]{20,}/,            // ZodForge keys
    /Bearer\s+[^\s]+/i,            // Bearer tokens
    /password['":\s]*[^'",\s]+/i,  // Passwords
    /api[_-]?key['":\s]*[^'",\s]+/i, // Generic API keys
  ];

  return sensitivePatterns.some(pattern => pattern.test(str));
}

/**
 * Redact sensitive data from objects for logging
 */
export function redactSensitiveData(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveData(item));
  }

  const redacted: any = {};
  const sensitiveKeys = ['password', 'apiKey', 'api_key', 'token', 'secret', 'authorization'];

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'string' && containsSensitiveData(value)) {
      redacted[key] = sanitizeError(value);
    } else if (typeof value === 'object') {
      redacted[key] = redactSensitiveData(value);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Create a secure logger that masks sensitive data
 */
export function createSecureLogger(originalLog: (...args: any[]) => void) {
  return (...args: any[]) => {
    const sanitizedArgs = args.map(arg => {
      if (typeof arg === 'string') {
        return sanitizeError(arg);
      }
      if (typeof arg === 'object') {
        return redactSensitiveData(arg);
      }
      return arg;
    });

    originalLog(...sanitizedArgs);
  };
}

/**
 * Encrypt sensitive data at rest (requires ENCRYPTION_KEY in .env)
 */
export function encryptData(data: string, encryptionKey: string): string {
  const iv = crypto.randomBytes(16);
  const key = crypto.scryptSync(encryptionKey, 'salt', 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return `${iv.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt sensitive data
 */
export function decryptData(encryptedData: string, encryptionKey: string): string {
  const [ivHex, encrypted] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const key = crypto.scryptSync(encryptionKey, 'salt', 32);
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Rate limit tracker (in-memory for MVP, use Redis in production)
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 15 * 60 * 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check if request should be allowed
   */
  checkLimit(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get existing requests for this identifier
    let requests = this.requests.get(identifier) || [];

    // Remove old requests outside the window
    requests = requests.filter(timestamp => timestamp > windowStart);

    // Check if limit exceeded
    const allowed = requests.length < this.maxRequests;
    const remaining = Math.max(0, this.maxRequests - requests.length - (allowed ? 1 : 0));
    const resetTime = requests.length > 0 ? requests[0] + this.windowMs : now + this.windowMs;

    // Add current request if allowed
    if (allowed) {
      requests.push(now);
      this.requests.set(identifier, requests);
    }

    return { allowed, remaining, resetTime };
  }

  /**
   * Clear all rate limit data (for testing)
   */
  clear(): void {
    this.requests.clear();
  }
}

/**
 * Security audit logger
 */
export class SecurityAuditor {
  private logs: Array<{
    timestamp: Date;
    event: string;
    details: any;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }> = [];

  log(event: string, details: any, severity: 'low' | 'medium' | 'high' | 'critical' = 'low'): void {
    const redactedDetails = redactSensitiveData(details);

    this.logs.push({
      timestamp: new Date(),
      event,
      details: redactedDetails,
      severity,
    });

    // In production, send to external logging service
    if (severity === 'critical' || severity === 'high') {
      console.warn(`[SECURITY] ${severity.toUpperCase()}: ${event}`, redactedDetails);
    }
  }

  getLogs(limit: number = 100): any[] {
    return this.logs.slice(-limit);
  }

  clear(): void {
    this.logs = [];
  }
}

// Export singleton instances
export const rateLimiter = new RateLimiter();
export const securityAuditor = new SecurityAuditor();
