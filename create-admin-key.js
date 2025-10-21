// Quick script to create your first admin JWT API key
import { config } from 'dotenv';
import { createApiKey } from './src/lib/jwt-keys.js';

// Load environment variables
config();

console.log('🔑 Creating Admin JWT API Key...\n');

// Create an admin key with full permissions
const adminKey = createApiKey(
  'admin',                    // customerId
  'Admin Master Key',         // name
  'enterprise',               // tier (enterprise = unlimited)
  {
    permissions: ['refine', 'admin'],  // Full permissions
    metadata: {
      createdBy: 'setup-script',
      environment: 'production'
    }
  }
);

console.log('✅ Admin API Key Created Successfully!\n');
console.log('═══════════════════════════════════════════════════════════');
console.log('🔐 ADMIN API KEY (SAVE THIS SECURELY!)');
console.log('═══════════════════════════════════════════════════════════\n');
console.log(adminKey);
console.log('\n═══════════════════════════════════════════════════════════');
console.log('\n⚠️  IMPORTANT: This key will NOT be shown again!');
console.log('   Store it in a secure location (password manager).\n');
console.log('📋 Key Features:');
console.log('   - Tier: Enterprise (unlimited requests)');
console.log('   - Permissions: refine, admin');
console.log('   - Rate Limits: NONE');
console.log('   - Quota: UNLIMITED\n');
console.log('🚀 Test it:');
console.log(`   curl http://localhost:3000/api/v1/api-keys/me \\
     -H "Authorization: Bearer ${adminKey}"\n`);
