// Setup script: Create admin JWT key AND store in Supabase
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { getJwtKeyManager } from './src/lib/jwt-keys.js';
import crypto from 'crypto';

// Load environment variables
config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL and SUPABASE_SERVICE_KEY are required in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupAdminKey() {
  console.log('🔑 Creating Admin JWT API Key with Database Entry...\n');

  // Key metadata
  const customerId = 'admin';
  const name = 'Admin Master Key';
  const tier = 'enterprise';
  const permissions = ['refine', 'admin'];
  const metadata = {
    createdBy: 'setup-script',
    environment: 'production'
  };

  // Tier defaults for enterprise
  const rateLimit = {
    requestsPerMinute: 1000,
    requestsPerDay: 100000,
    requestsPerMonth: -1 // unlimited
  };

  const quota = {
    tokensPerMonth: -1, // unlimited
    costLimitPerMonth: -1 // unlimited
  };

  try {
    // 1. Generate JWT token FIRST (it will create its own kid)
    console.log('🔐 Generating JWT token...');
    const jwtManager = getJwtKeyManager();
    const token = jwtManager.generateKey({
      customerId,
      name,
      tier,
      rateLimit,
      quota,
      permissions,
      metadata
    });

    // 2. Extract kid from the generated token
    const decoded = jwtManager.verifyKey(token);
    if (!decoded) {
      console.error('❌ Failed to decode generated token');
      process.exit(1);
    }

    const kid = decoded.kid;
    console.log(`✅ JWT generated with kid: ${kid}`);

    // 3. Insert key metadata into Supabase with the SAME kid
    console.log('📊 Inserting key metadata into Supabase...');
    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        kid,
        customer_id: customerId,
        name,
        tier,
        permissions,
        rate_limit_per_minute: rateLimit.requestsPerMinute,
        rate_limit_per_day: rateLimit.requestsPerDay,
        rate_limit_per_month: rateLimit.requestsPerMonth,
        quota_tokens_per_month: quota.tokensPerMonth,
        quota_cost_limit_per_month: quota.costLimitPerMonth,
        environment: metadata.environment,
        created_by: metadata.createdBy,
        is_active: true
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Failed to insert key into database:', error.message);
      process.exit(1);
    }

    console.log('✅ Key metadata stored in Supabase');

    console.log('\n✅ Admin API Key Created Successfully!\n');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🔐 ADMIN API KEY (SAVE THIS SECURELY!)');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(token);
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('\n⚠️  IMPORTANT: This key will NOT be shown again!');
    console.log('   Store it in a secure location (password manager).\n');
    console.log('📋 Key Details:');
    console.log(`   - Key ID: ${kid}`);
    console.log('   - Customer ID: admin');
    console.log('   - Tier: Enterprise (unlimited requests)');
    console.log('   - Permissions: refine, admin');
    console.log('   - Rate Limits: 1000/min, 100000/day, unlimited/month');
    console.log('   - Quota: UNLIMITED tokens, UNLIMITED cost\n');
    console.log('🚀 Test it:');
    console.log(`   curl http://localhost:3000/api/v1/api-keys/me \\`);
    console.log(`     -H "Authorization: Bearer ${token}"\n`);

    // Store to file for easy access
    const fs = await import('fs');
    fs.writeFileSync('ADMIN_KEY.txt', token);
    console.log('💾 Key also saved to: ADMIN_KEY.txt (⚠️ DELETE THIS FILE AFTER STORING SECURELY!)\n');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

setupAdminKey();
