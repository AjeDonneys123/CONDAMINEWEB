#!/usr/bin/env bash
set -euo pipefail

echo "Diagnostic Condamine Ollama API"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Node.js est absent. Installe Node 18+."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "❌ npm est absent."
  exit 1
fi

if ! command -v ollama >/dev/null 2>&1; then
  echo "❌ Ollama est absent. Installe Ollama avant de continuer."
  exit 1
fi

echo "✅ Node: $(node -v)"
echo "✅ npm: $(npm -v)"
echo "✅ Ollama: $(ollama --version 2>/dev/null || echo installé)"

if [ ! -f ".env" ]; then
  echo "⚠️  .env absent. Crée-le avec: cp .env.example .env"
else
  echo "✅ .env présent"
fi

if [ ! -d "node_modules" ]; then
  echo "⚠️  node_modules absent. Lance: npm install"
else
  echo "✅ dépendances npm installées"
fi

echo ""
echo "Modèles Ollama installés:"
ollama list || true

echo ""
echo "Si aucun modèle n'apparaît, lance par exemple:"
echo "  ollama pull llama3.1:8b"
