// Quick test of @zodforge/cloud SDK with live API
import { ZodForgeClient, refineSchema, setApiKey } from './src/index.js';

const API_KEY = 'zf_89f61857c56583bd9c8e65c3d058b55d';
const BASE_URL = 'http://localhost:3000';

async function testSDK() {
  console.log('🧪 Testing @zodforge/cloud SDK\n');

  // Test 1: Client instance method
  console.log('📝 Test 1: Client Instance');
  const client = new ZodForgeClient({
    apiKey: API_KEY,
    baseUrl: BASE_URL
  });

  const result1 = await client.refineSchema({
    schema: {
      code: 'z.object({ price: z.number(), currency: z.string() })',
      typeName: 'Product',
      fields: {
        price: 'z.number()',
        currency: 'z.string()'
      }
    },
    samples: [
      { price: 100, currency: 'USD' },
      { price: 50, currency: 'EUR' },
      { price: 75, currency: 'GBP' }
    ]
  });

  console.log('✅ Success!');
  console.log('Refined code:', result1.refinedSchema?.code);
  console.log('Improvements:', result1.refinedSchema?.improvements.length);
  console.log('Relationships:', result1.refinedSchema?.relationships?.length || 0);
  console.log('Processing time:', result1.processingTime + 'ms');
  console.log('Cached:', result1.cached || false);
  console.log();

  // Test 2: Convenience function
  console.log('📝 Test 2: Convenience Function');
  setApiKey(API_KEY);

  const result2 = await refineSchema(
    {
      schema: {
        code: 'z.object({ lat: z.number(), lng: z.number() })',
        typeName: 'Location',
        fields: {
          lat: 'z.number()',
          lng: 'z.number()'
        }
      },
      samples: [
        { lat: 51.5074, lng: -0.1278 },
        { lat: 40.7128, lng: -74.0060 }
      ]
    },
    { baseUrl: BASE_URL }
  );

  console.log('✅ Success!');
  console.log('Refined code:', result2.refinedSchema?.code);
  console.log('Improvements:', result2.refinedSchema?.improvements.length);

  // Show explainability fields
  if (result2.refinedSchema?.improvements[0]) {
    const imp = result2.refinedSchema.improvements[0];
    console.log('\n🔍 Enhanced Explainability:');
    console.log('  Field:', imp.field);
    console.log('  Source Snippet:', imp.sourceSnippet);
    console.log('  Detected Pattern:', imp.detectedPattern);
    console.log('  Rule Applied:', imp.ruleApplied);
  }

  // Show relationships
  if (result2.refinedSchema?.relationships?.[0]) {
    const rel = result2.refinedSchema.relationships[0];
    console.log('\n🧠 Context Reasoning:');
    console.log('  Fields:', rel.fields.join(' + '));
    console.log('  Pattern:', rel.pattern);
    console.log('  Confidence:', rel.confidence);
  }

  console.log();

  // Test 3: Cache hit
  console.log('📝 Test 3: Cache Hit (same request)');
  const result3 = await client.refineSchema({
    schema: {
      code: 'z.object({ lat: z.number(), lng: z.number() })',
      typeName: 'Location',
      fields: {
        lat: 'z.number()',
        lng: 'z.number()'
      }
    },
    samples: [
      { lat: 51.5074, lng: -0.1278 },
      { lat: 40.7128, lng: -74.0060 }
    ]
  });

  console.log('✅ Success!');
  console.log('Cached:', result3.cached || false);
  console.log('Processing time:', result3.processingTime + 'ms');
  console.log();

  console.log('🎉 All tests passed!');
}

testSDK().catch(error => {
  console.error('❌ Test failed:', error.message);
  if (error.statusCode) {
    console.error('Status code:', error.statusCode);
  }
  process.exit(1);
});
