#!/usr/bin/env bash
# End-to-end feature verification for ClearBorder V1 + V2
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PASS=0
FAIL=0
WARN=0

ok()   { echo "✅ $1"; PASS=$((PASS+1)); }
fail() { echo "❌ $1"; FAIL=$((FAIL+1)); }
warn() { echo "⚠️  $1"; WARN=$((WARN+1)); }

echo "═══════════════════════════════════════════════════"
echo " ClearBorder Feature Verification"
echo "═══════════════════════════════════════════════════"
echo

# ── V1 Agent ──────────────────────────────────────────────────────────────────
echo "── V1 Agent (port 8787) ──"
if curl -sf http://localhost:8787/health >/dev/null 2>&1; then
  HEALTH=$(curl -s http://localhost:8787/health)
  ok "Agent health endpoint"
  echo "   $HEALTH"
  if echo "$HEALTH" | grep -q '"geminiAvailable":true'; then
    ok "Gemini API key active (computer use probe passed)"
  else
    warn "Gemini not available — computer use will fallback to scripted"
  fi
  if echo "$HEALTH" | grep -q '"computerUse":"gemini"'; then
    ok "Computer use mode: gemini"
  fi
else
  fail "Agent not running on :8787 — run: pnpm dev"
fi

echo
echo "── V1 Web (port 3000) ──"
for path in "/" "/portal/login"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000$path")
  if [ "$code" = "200" ]; then ok "GET $path → $code"; else fail "GET $path → $code"; fi
done

echo
echo "── V1 Intake + Orchestrator ──"
INTAKE=$(curl -s -X POST http://localhost:8787/api/cases/intake \
  -H 'Content-Type: application/json' \
  -d '{"importerPassportId":"VERIFY-E2E","importerName":"Test AG","shipmentReference":"E2E-'"$(date +%s)"'","declaredValue":240,"invoiceValue":2400,"currency":"USD","originCountry":"China","originCountryCode":"CN","shipperName":"Shenzhen Bright Electronics Co.","shipperPhone":"+867550000000"}')
if echo "$INTAKE" | grep -q '"ok":true'; then
  ok "POST /api/cases/intake creates case and starts agent"
  CASE_ID=$(echo "$INTAKE" | python3 -c "import sys,json; print(json.load(sys.stdin)['caseId'])" 2>/dev/null || echo "?")
  echo "   caseId: $CASE_ID"
  sleep 8
  STATUS=$(curl -s "http://localhost:8787/api/cases/$CASE_ID" 2>/dev/null || echo '{}')
  if echo "$STATUS" | grep -qE 'phase|status|AWAITING'; then
    ok "Orchestrator progressed (case status available)"
    echo "   $(echo "$STATUS" | python3 -m json.tool 2>/dev/null | head -8 | tr '\n' ' ')"
  else
    warn "Case status endpoint returned: $STATUS"
  fi
else
  fail "Intake failed: $INTAKE"
fi

echo
echo "── V1 Demo Replayer (WS events) ──"
if curl -sf --max-time 3 http://localhost:8787/events 2>/dev/null | grep -q 'data:'; then
  ok "SSE /events stream available"
else
  warn "SSE /events not reachable (may need active connection)"
fi

# ── V2 Backend ────────────────────────────────────────────────────────────────
echo
echo "── V2 Backend (port 8000) ──"
if curl -sf http://localhost:8000/docs >/dev/null 2>&1; then
  ok "FastAPI backend running"
  HYDR=$(curl -s http://localhost:8000/api/verify/hydration/env_test_id)
  if echo "$HYDR" | grep -q '"ok":true'; then
    ok "State hydration (env_test_id) — time continuity"
    echo "   state=$(echo "$HYDR" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('state','?'))")"
  else
    fail "Hydration check failed: $HYDR"
  fi
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/mock-customs/login)
  if [ "$code" = "200" ]; then ok "Mock customs portal reachable"; else fail "Mock portal → $code"; fi
else
  fail "V2 backend not running on :8000 — run: pnpm dev:v2:backend"
fi

echo
echo "── V2 Upload → Portal Sync → Approval ──"
if [ -f backend/fixtures/mock_invoice.pdf ] && curl -sf http://localhost:8000/docs >/dev/null 2>&1; then
  if python3 backend/scripts/run_tests.py 2>&1 | tail -3 | grep -q "All tests passed"; then
    ok "Full V2 pipeline: upload → extract → portal fill → approve → COMPLETED"
  else
    fail "V2 integration tests failed — run: python3 backend/scripts/run_tests.py"
  fi
else
  warn "Skipped V2 upload test (backend down or missing fixture)"
fi

echo
echo "── V2 Frontend (port 3001) ──"
code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/ 2>/dev/null || echo "000")
if [ "$code" = "200" ]; then ok "Sender app running on :3001"; else warn "V2 frontend not on :3001 (code=$code) — run: cd frontend && ../node_modules/.bin/next dev -p 3001"; fi

echo
echo "═══════════════════════════════════════════════════"
echo " Results: $PASS passed, $FAIL failed, $WARN warnings"
echo "═══════════════════════════════════════════════════"
[ "$FAIL" -eq 0 ] || exit 1
