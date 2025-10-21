// Environment configuration with Zod validation and security
import { z } from 'zod';
import { config } from 'dotenv';
import { maskApiKey, validateApiKeyFormat } from '../lib/security.js';

// Only load .env file in development (Railway injects env vars directly)
if (process.env.NODE_ENV !== 'production') {
  config();
  console.log('📁 Loaded .env file (development mode)');
} else {
  console.log('☁️  Using Railway environment variables (production mode)');
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),

  // OpenAI (CRITICAL - NEVER EXPOSE THIS!)
  OPENAI_API_KEY: z
    .string()
    .min(40, 'OpenAI API key must be at least 40 characters')
    .startsWith('sk-', 'OpenAI API key must start with sk-')
    .refine(
      (key) => {
        const validation = validateApiKeyFormat(key);
        return validation.valid;
      },
      { message: 'Invalid OpenAI API key format' }
    ),

  // ZodForge API key for user authentication
  ZODFORGE_API_KEY: z
    .string()
    .min(20, 'ZodForge API key must be at least 20 characters')
    .startsWith('zf_', 'ZodForge API key must start with zf_')
    .refine(
      (key) => {
        const validation = validateApiKeyFormat(key);
        return validation.valid;
      },
      { message: 'Invalid ZodForge API key format' }
    ),

  // Anthropic API key (OPTIONAL - for Claude fallback)
  ANTHROPIC_API_KEY: z
    .string()
    .min(40, 'Anthropic API key must be at least 40 characters')
    .startsWith('sk-ant-', 'Anthropic API key must start with sk-ant-')
    .optional()
    .refine(
      (key) => {
        if (!key) return true; // Optional field
        const validation = validateApiKeyFormat(key);
        return validation.valid;
      },
      { message: 'Invalid Anthropic API key format' }
    ),

  // Supabase (for audit logging, rate limiting, and customer management)
  SUPABASE_URL: z
    .string()
    .url('Supabase URL must be a valid URL')
    .optional(),

  SUPABASE_SERVICE_KEY: z
    .string()
    .min(100, 'Supabase service key must be at least 100 characters')
    .optional(),

  // JWT Secret for API key signing (REQUIRED for JWT-based keys)
  JWT_SECRET: z
    .string()
    .min(32, 'JWT secret must be at least 32 characters for security')
    .optional(),

  // Audit logging
  AUDIT_LOGGING_ENABLED: z.coerce.boolean().optional().default(true),

  // Secrets Manager configuration
  SECRETS_PROVIDER: z
    .enum(['env', 'aws', 'google', 'azure'])
    .optional()
    .default('env'),

  // AWS Secrets Manager (optional)
  AWS_REGION: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),

  // Google Secret Manager (optional)
  GCP_PROJECT_ID: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),

  // Azure Key Vault (optional)
  AZURE_KEY_VAULT_URL: z.string().url().optional(),

  // Optional security settings
  RATE_LIMIT_MAX: z.coerce.number().optional().default(100),
  RATE_LIMIT_WINDOW: z.coerce.number().optional().default(900000), // 15 minutes
  REQUEST_TIMEOUT: z.coerce.number().optional().default(30000),
  MAX_REQUEST_SIZE: z.coerce.number().optional().default(1048576), // 1MB

  // Optional encryption key for sensitive data at rest
  ENCRYPTION_KEY: z.string().min(32).optional(),

  // Logging settings
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).optional().default('info'),
  ENABLE_REQUEST_LOGGING: z.coerce.boolean().optional().default(true),
  MASK_SENSITIVE_DATA: z.coerce.boolean().optional().default(true),
});

// Parse and validate environment variables
let parsedEnv: z.infer<typeof envSchema>;

try {
  parsedEnv = envSchema.parse(process.env);

  // Log startup with masked keys for security
  console.log('✅ Environment variables validated successfully');
  console.log('🔐 OpenAI API Key:', maskApiKey(parsedEnv.OPENAI_API_KEY));
  console.log('🔑 ZodForge API Key:', maskApiKey(parsedEnv.ZODFORGE_API_KEY));
  if (parsedEnv.ANTHROPIC_API_KEY) {
    console.log('🤖 Anthropic API Key:', maskApiKey(parsedEnv.ANTHROPIC_API_KEY));
    console.log('   → Claude fallback enabled ✅');
  } else {
    console.log('🤖 Anthropic API Key: Not configured (Claude fallback disabled)');
  }

  // Security configuration
  if (parsedEnv.JWT_SECRET) {
    console.log('🔒 JWT Secret:', maskApiKey(parsedEnv.JWT_SECRET));
    console.log('   → JWT-based API keys enabled ✅');
  } else {
    console.log('🔒 JWT Secret: Not configured (legacy keys only)');
  }

  console.log('🔐 Secrets Provider:', parsedEnv.SECRETS_PROVIDER);

  // Audit logging
  if (parsedEnv.AUDIT_LOGGING_ENABLED) {
    if (parsedEnv.SUPABASE_URL && parsedEnv.SUPABASE_SERVICE_KEY) {
      console.log('📝 Audit Logging: Enabled ✅');
      console.log('   → Supabase:', parsedEnv.SUPABASE_URL);
    } else {
      console.log('📝 Audit Logging: Enabled but Supabase not configured ⚠️');
    }
  } else {
    console.log('📝 Audit Logging: Disabled');
  }

  console.log('📊 Rate Limit:', `${parsedEnv.RATE_LIMIT_MAX} req/${parsedEnv.RATE_LIMIT_WINDOW}ms`);
  console.log('');
} catch (error) {
  console.error('❌ Environment variable validation failed:');
  if (error instanceof z.ZodError) {
    error.issues.forEach((err: z.ZodIssue) => {
      console.error(`  - ${err.path.join('.')}: ${err.message}`);
    });
  }

  // Show what environment variables are actually available (for debugging)
  const availableEnvVars = Object.keys(process.env).filter(key =>
    ['NODE_ENV', 'OPENAI_API_KEY', 'ZODFORGE_API_KEY', 'ANTHROPIC_API_KEY', 'PORT', 'HOST'].includes(key)
  );
  console.error('\n🔍 Available environment variables:', availableEnvVars.length > 0 ? availableEnvVars.join(', ') : 'NONE');

  if (process.env.NODE_ENV === 'production') {
    console.error('💡 In Railway: Go to Variables tab and add OPENAI_API_KEY and ZODFORGE_API_KEY');
  } else {
    console.error('💡 Locally: Check your .env file and compare with .env.example');
  }
  console.error('');
  process.exit(1);
}

export const env = parsedEnv;

export type Env = z.infer<typeof envSchema>;

/**
 * Get masked environment config for logging (safe to display)
 */
export function getMaskedEnv(): Partial<Env> {
  return {
    NODE_ENV: env.NODE_ENV,
    PORT: env.PORT,
    HOST: env.HOST,
    OPENAI_API_KEY: maskApiKey(env.OPENAI_API_KEY) as any,
    ZODFORGE_API_KEY: maskApiKey(env.ZODFORGE_API_KEY) as any,
    RATE_LIMIT_MAX: env.RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW: env.RATE_LIMIT_WINDOW,
    LOG_LEVEL: env.LOG_LEVEL,
  };
}
