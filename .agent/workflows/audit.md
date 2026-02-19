---
description: Audit chirurgical automatisé après snapshot
---

// turbo-all

Ce workflow permet de lancer l'audit complet sans confirmations répétées.

1. Créer un commit de sauvegarde automatique
```bash
git add .
git commit -m "pre-audit-auto-save" || echo "No changes to commit"
```

2. Lancer l'audit technique (Lint, Build, Tests)
```bash
./.agent/scripts/audit.sh
```

3. Identifier les fichiers modifiés par le snapshot
```bash
git diff --name-only HEAD~1 HEAD
```

4. Afficher le diff détaillé pour l'analyse visuelle de l'Agent
```bash
git diff HEAD~1 HEAD
```
