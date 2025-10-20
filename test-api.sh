#!/bin/bash
# Test script for ZodForge API

API_URL="http://localhost:3000"
API_KEY="zf_89f61857c56583bd9c8e65c3d058b55d"

echo "=================================================="
echo "ZodForge API - Test Script"
echo "=================================================="
echo ""

# Test 1: Health Check (No Auth)
echo "📊 Test 1: Health Check (No Auth Required)"
echo "GET $API_URL/api/v1/health"
echo ""
curl -s "$API_URL/api/v1/health" | jq '.'
echo ""
echo ""

# Test 2: Refine Endpoint (With Auth)
echo "🤖 Test 2: Schema Refinement (Auth Required)"
echo "POST $API_URL/api/v1/refine"
echo ""
curl -s -X POST "$API_URL/api/v1/refine" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d @test-request.json | jq '.'
echo ""
echo ""

# Test 3: Invalid API Key
echo "🔒 Test 3: Invalid API Key (Should Fail)"
echo "POST $API_URL/api/v1/refine"
echo ""
curl -s -X POST "$API_URL/api/v1/refine" \
  -H "Authorization: Bearer invalid_key" \
  -H "Content-Type: application/json" \
  -d @test-request.json | jq '.'
echo ""
echo ""

echo "=================================================="
echo "✅ Tests Complete!"
echo "=================================================="
