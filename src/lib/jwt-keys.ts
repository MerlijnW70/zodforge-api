// JWT-based API key system for stateless validation
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

/**
 * JWT API Key payload structure
 */
export interface ApiKeyPayload {
  // Unique key identifier
  kid: string;

  // Customer/user identifier
  customerId: string;

  // Key name/description
  name: string;

  // Tier (free, pro, enterprise)
  tier: 'free' | 'pro' | 'enterprise';

  // Rate limits
  rateLimit: {
    requestsPerMinute: number;
    requestsPerDay: number;
    requestsPerMonth: number;
  };

  // Quotas
  quota: {
    tokensPerMonth: number;
    costLimitPerMonth: number; // USD
  };

  // Permissions
  permissions: string[];

  // Issued at (Unix timestamp)
  iat: number;

  // Expiration (Unix timestamp, optional)
  exp?: number;

  // Metadata
  metadata?: {
    createdBy?: string;
    environment?: 'development' | 'production';
    ipWhitelist?: string[];
  };
}

/**
 * JWT key manager for signing and verifying API keys
 */
export class JwtKeyManager {
  private secret: string;
  private issuer: string;

  constructor(secret?: string, issuer = 'zodforge-api') {
    if (!secret) {
      throw new Error('JWT secret is required');
    }

    this.secret = secret;
    this.issuer = issuer;
  }

  /**
   * Generate a new JWT-based API key
   */
  generateKey(payload: Omit<ApiKeyPayload, 'iat' | 'kid'>): string {
    const kid = this.generateKeyId();

    const fullPayload: ApiKeyPayload = {
      ...payload,
      kid,
      iat: Math.floor(Date.now() / 1000),
    };

    const token = jwt.sign(fullPayload, this.secret, {
      issuer: this.issuer,
      algorithm: 'HS256',
      ...(payload.exp ? { expiresIn: payload.exp } : {}),
    });

    // Format: zf_jwt_<token>
    return `zf_jwt_${token}`;
  }

  /**
   * Verify and decode a JWT API key
   */
  verifyKey(apiKey: string): ApiKeyPayload | null {
    try {
      // Remove zf_jwt_ prefix
      if (!apiKey.startsWith('zf_jwt_')) {
        return null;
      }

      const token = apiKey.substring('zf_jwt_'.length);

      const decoded = jwt.verify(token, this.secret, {
        issuer: this.issuer,
        algorithms: ['HS256'],
      }) as ApiKeyPayload;

      return decoded;
    } catch (error) {
      // Invalid signature, expired, etc.
      return null;
    }
  }

  /**
   * Refresh/rotate an API key (issues new token with same kid)
   */
  rotateKey(oldKey: string, updates?: Partial<Omit<ApiKeyPayload, 'iat' | 'kid'>>): string | null {
    const decoded = this.verifyKey(oldKey);
    if (!decoded) {
      return null;
    }

    const newPayload: Omit<ApiKeyPayload, 'iat' | 'kid'> = {
      customerId: decoded.customerId,
      name: decoded.name,
      tier: decoded.tier,
      rateLimit: decoded.rateLimit,
      quota: decoded.quota,
      permissions: decoded.permissions,
      metadata: decoded.metadata,
      ...updates,
    };

    // Keep same kid for tracking
    const fullPayload: ApiKeyPayload = {
      ...newPayload,
      kid: decoded.kid,
      iat: Math.floor(Date.now() / 1000),
    };

    const token = jwt.sign(fullPayload, this.secret, {
      issuer: this.issuer,
      algorithm: 'HS256',
    });

    return `zf_jwt_${token}`;
  }

  /**
   * Generate unique key identifier
   */
  private generateKeyId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Extract key ID from API key without full verification
   */
  extractKeyId(apiKey: string): string | null {
    try {
      if (!apiKey.startsWith('zf_jwt_')) {
        return null;
      }

      const token = apiKey.substring('zf_jwt_'.length);
      const decoded = jwt.decode(token) as ApiKeyPayload | null;

      return decoded?.kid || null;
    } catch {
      return null;
    }
  }

  /**
   * Check if key is expired (without full verification)
   */
  isExpired(apiKey: string): boolean {
    try {
      if (!apiKey.startsWith('zf_jwt_')) {
        return true;
      }

      const token = apiKey.substring('zf_jwt_'.length);
      const decoded = jwt.decode(token) as ApiKeyPayload | null;

      if (!decoded || !decoded.exp) {
        return false; // No expiration
      }

      const now = Math.floor(Date.now() / 1000);
      return decoded.exp < now;
    } catch {
      return true;
    }
  }

  /**
   * Create default tier configurations
   */
  static getTierDefaults(tier: ApiKeyPayload['tier']): Pick<ApiKeyPayload, 'rateLimit' | 'quota'> {
    switch (tier) {
      case 'free':
        return {
          rateLimit: {
            requestsPerMinute: 10,
            requestsPerDay: 100,
            requestsPerMonth: 1000,
          },
          quota: {
            tokensPerMonth: 100000,
            costLimitPerMonth: 5.0,
          },
        };

      case 'pro':
        return {
          rateLimit: {
            requestsPerMinute: 60,
            requestsPerDay: 5000,
            requestsPerMonth: 100000,
          },
          quota: {
            tokensPerMonth: 10000000,
            costLimitPerMonth: 100.0,
          },
        };

      case 'enterprise':
        return {
          rateLimit: {
            requestsPerMinute: 1000,
            requestsPerDay: 100000,
            requestsPerMonth: -1, // Unlimited
          },
          quota: {
            tokensPerMonth: -1, // Unlimited
            costLimitPerMonth: -1, // Unlimited
          },
        };

      default:
        return JwtKeyManager.getTierDefaults('free');
    }
  }
}

// Export singleton instance (initialized from env)
let jwtKeyManager: JwtKeyManager | null = null;

export function getJwtKeyManager(): JwtKeyManager {
  if (!jwtKeyManager) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
    jwtKeyManager = new JwtKeyManager(secret);
  }
  return jwtKeyManager;
}

// Helper function to create a new key
export function createApiKey(
  customerId: string,
  name: string,
  tier: ApiKeyPayload['tier'],
  options?: {
    permissions?: string[];
    expiresIn?: number;
    metadata?: ApiKeyPayload['metadata'];
  }
): string {
  const manager = getJwtKeyManager();
  const tierDefaults = JwtKeyManager.getTierDefaults(tier);

  return manager.generateKey({
    customerId,
    name,
    tier,
    rateLimit: tierDefaults.rateLimit,
    quota: tierDefaults.quota,
    permissions: options?.permissions || ['refine'],
    ...(options?.expiresIn ? { exp: options.expiresIn } : {}),
    metadata: options?.metadata,
  });
}
