#!/bin/bash
# .agent/scripts/audit.sh
# Vérifie la santé du projet après modification

echo "🔍 Lancement de l'audit technique..."

# 1. Vérification Lint (si existant)
if [ -f "package.json" ] && grep -q "lint" package.json; then
    echo "--- Linting ---"
    npm run lint || echo "⚠️ Avertissements Lint détectés"
fi

# 2. Vérification Build/Compilation
if [ -f "package.json" ] && grep -q "build" package.json; then
    echo "--- Building ---"
    npm run build || { echo "❌ ÉCHEC DU BUILD"; exit 1; }
fi

# 3. Vérification Tests
if [ -f "package.json" ] && grep -q "test" package.json; then
    echo "--- Testing ---"
    npm test -- --watchAll=false || { echo "❌ ÉCHEC DES TESTS"; exit 1; }
fi

echo "✅ AUDIT RÉUSSI : Le code est stable."
