#!/bin/bash
# .agent/scripts/snap.sh
# Crée un point de sauvegarde rapide

MESSAGE=${1:-"AI_SNAPSHOT_$(date +%Y%m%d_%H%M%S)"}
git add .
git commit -m "$MESSAGE" --no-verify
echo "✅ Point de sauvegarde créé : $MESSAGE"
