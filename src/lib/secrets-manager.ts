// Secrets manager for AI provider keys and sensitive configuration
// Supports: AWS Secrets Manager, Google Secret Manager, Azure Key Vault, or local env fallback

export interface SecretsProvider {
  name: string;
  getSecret(key: string): Promise<string | null>;
  setSecret?(key: string, value: string): Promise<void>;
}

/**
 * AWS Secrets Manager provider
 */
class AwsSecretsProvider implements SecretsProvider {
  name = 'aws-secrets-manager';

  async getSecret(key: string): Promise<string | null> {
    try {
      // Lazy load AWS SDK
      const { SecretsManagerClient, GetSecretValueCommand } = await import('@aws-sdk/client-secrets-manager');

      const client = new SecretsManagerClient({
        region: process.env.AWS_REGION || 'us-east-1',
      });

      const response = await client.send(
        new GetSecretValueCommand({
          SecretId: key,
        })
      );

      return response.SecretString || null;
    } catch (error: any) {
      console.error(`AWS Secrets Manager error for ${key}:`, error.message);
      return null;
    }
  }
}

/**
 * Google Secret Manager provider
 */
class GoogleSecretsProvider implements SecretsProvider {
  name = 'google-secret-manager';

  async getSecret(key: string): Promise<string | null> {
    try {
      // Lazy load Google SDK
      const { SecretManagerServiceClient } = await import('@google-cloud/secret-manager');

      const client = new SecretManagerServiceClient();
      const projectId = process.env.GCP_PROJECT_ID;

      if (!projectId) {
        throw new Error('GCP_PROJECT_ID not set');
      }

      const name = `projects/${projectId}/secrets/${key}/versions/latest`;
      const [version] = await client.accessSecretVersion({ name });

      const payload = version.payload?.data;
      return payload ? payload.toString() : null;
    } catch (error: any) {
      console.error(`Google Secret Manager error for ${key}:`, error.message);
      return null;
    }
  }
}

/**
 * Azure Key Vault provider
 */
class AzureKeyVaultProvider implements SecretsProvider {
  name = 'azure-key-vault';

  async getSecret(key: string): Promise<string | null> {
    try {
      // Lazy load Azure SDK
      const { SecretClient } = await import('@azure/keyvault-secrets');
      const { DefaultAzureCredential } = await import('@azure/identity');

      const vaultUrl = process.env.AZURE_KEY_VAULT_URL;
      if (!vaultUrl) {
        throw new Error('AZURE_KEY_VAULT_URL not set');
      }

      const credential = new DefaultAzureCredential();
      const client = new SecretClient(vaultUrl, credential);

      const secret = await client.getSecret(key);
      return secret.value || null;
    } catch (error: any) {
      console.error(`Azure Key Vault error for ${key}:`, error.message);
      return null;
    }
  }
}

/**
 * Environment variable fallback (local development)
 */
class EnvSecretsProvider implements SecretsProvider {
  name = 'environment-variables';

  async getSecret(key: string): Promise<string | null> {
    return process.env[key] || null;
  }
}

/**
 * Secrets Manager - centralized secret retrieval with fallback
 */
export class SecretsManager {
  private provider: SecretsProvider;
  private cache: Map<string, { value: string | null; cachedAt: number }> = new Map();
  private cacheTTL = 3600000; // 1 hour

  constructor(providerType?: 'aws' | 'google' | 'azure' | 'env') {
    const type = providerType || (process.env.SECRETS_PROVIDER as any) || 'env';

    switch (type) {
      case 'aws':
        this.provider = new AwsSecretsProvider();
        break;
      case 'google':
        this.provider = new GoogleSecretsProvider();
        break;
      case 'azure':
        this.provider = new AzureKeyVaultProvider();
        break;
      default:
        this.provider = new EnvSecretsProvider();
    }

    console.log(`🔐 Secrets manager initialized: ${this.provider.name}`);
  }

  /**
   * Get a secret with caching
   */
  async getSecret(key: string, skipCache = false): Promise<string | null> {
    // Check cache
    if (!skipCache) {
      const cached = this.cache.get(key);
      if (cached && Date.now() - cached.cachedAt < this.cacheTTL) {
        return cached.value;
      }
    }

    // Fetch from provider
    const value = await this.provider.getSecret(key);

    // Cache result
    this.cache.set(key, {
      value,
      cachedAt: Date.now(),
    });

    return value;
  }

  /**
   * Get required secret (throws if not found)
   */
  async getRequiredSecret(key: string): Promise<string> {
    const value = await this.getSecret(key);

    if (!value) {
      throw new Error(`Required secret not found: ${key}`);
    }

    return value;
  }

  /**
   * Invalidate cache for a key
   */
  invalidateCache(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get provider name
   */
  getProviderName(): string {
    return this.provider.name;
  }
}

// Export singleton instance
let secretsManager: SecretsManager | null = null;

export function getSecretsManager(): SecretsManager {
  if (!secretsManager) {
    secretsManager = new SecretsManager();
  }
  return secretsManager;
}

/**
 * Helper: Get AI provider API keys from secrets manager
 */
export async function getProviderApiKeys(): Promise<{
  openai: string | null;
  anthropic: string | null;
  jwt_secret: string | null;
}> {
  const manager = getSecretsManager();

  const [openai, anthropic, jwt_secret] = await Promise.all([
    manager.getSecret('OPENAI_API_KEY'),
    manager.getSecret('ANTHROPIC_API_KEY'),
    manager.getSecret('JWT_SECRET'),
  ]);

  return { openai, anthropic, jwt_secret };
}
