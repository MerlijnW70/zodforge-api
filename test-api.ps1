# Test script for ZodForge API (PowerShell)

$API_URL = "http://localhost:3000"
$API_KEY = "zf_89f61857c56583bd9c8e65c3d058b55d"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "ZodForge API - Test Script" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Check (No Auth)
Write-Host "📊 Test 1: Health Check (No Auth Required)" -ForegroundColor Yellow
Write-Host "GET $API_URL/api/v1/health" -ForegroundColor Gray
Write-Host ""
try {
    $response = Invoke-RestMethod -Uri "$API_URL/api/v1/health" -Method Get
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
}
Write-Host ""
Write-Host ""

# Test 2: Refine Endpoint (With Auth)
Write-Host "🤖 Test 2: Schema Refinement (Auth Required)" -ForegroundColor Yellow
Write-Host "POST $API_URL/api/v1/refine" -ForegroundColor Gray
Write-Host ""
try {
    $headers = @{
        "Authorization" = "Bearer $API_KEY"
        "Content-Type" = "application/json"
    }
    $body = Get-Content -Path "test-request.json" -Raw
    $response = Invoke-RestMethod -Uri "$API_URL/api/v1/refine" -Method Post -Headers $headers -Body $body
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
}
Write-Host ""
Write-Host ""

# Test 3: Invalid API Key
Write-Host "🔒 Test 3: Invalid API Key (Should Fail)" -ForegroundColor Yellow
Write-Host "POST $API_URL/api/v1/refine" -ForegroundColor Gray
Write-Host ""
try {
    $headers = @{
        "Authorization" = "Bearer invalid_key"
        "Content-Type" = "application/json"
    }
    $body = Get-Content -Path "test-request.json" -Raw
    $response = Invoke-RestMethod -Uri "$API_URL/api/v1/refine" -Method Post -Headers $headers -Body $body
    $response | ConvertTo-Json -Depth 10
} catch {
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
    $errorResponse | ConvertTo-Json -Depth 10
}
Write-Host ""
Write-Host ""

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "✅ Tests Complete!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
