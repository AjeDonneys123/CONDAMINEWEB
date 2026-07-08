#!/usr/bin/env bash
set -euo pipefail

SERVER_URL="${SERVER_URL:-http://localhost:8787}"
API_KEY="${API_KEY:-}"

if [ -f ".env" ] && [ -z "${API_KEY}" ]; then
  API_KEY="$(grep -E '^API_KEY=' .env | head -1 | cut -d '=' -f 2- || true)"
fi

if [ -z "${API_KEY}" ]; then
  echo "❌ API_KEY introuvable. Mets API_KEY dans .env ou lance:"
  echo "API_KEY=ta-cle bash scripts/test-chat.sh"
  exit 1
fi

curl -sS -X POST "${SERVER_URL}/api/chat" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d '{
    "prompt": "Réponds en une phrase: que peux-tu faire pour une classe ?",
    "system": "Tu es une IA locale pour aider un professeur."
  }'

echo ""
