#!/usr/bin/env bash
set -euo pipefail

models=(
  "llama3.1:8b"
  "qwen2.5:7b-instruct"
)

echo "Installation des modèles Ollama recommandés..."

for model in "${models[@]}"; do
  echo ""
  echo "→ ollama pull ${model}"
  ollama pull "${model}"
done

echo ""
echo "OK. Tu peux lancer le serveur avec: npm start"
