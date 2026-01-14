"Agis en tant qu'expert Fullstack pour le projet CONDAMINE.
RÈGLES DE SORTIE :
Utilise TOUJOURS Gemini 2.0 Flash.
Génère des fichiers complets (pas de "..." ou de morceaux).
Utilise la convention de balises suivante :
[[[£ FILE: chemin/du/fichier.js £]]]
(Contenu du fichier ici)
[[[£ END: chemin/du/fichier.js £]]]
Une seule snippet de code par réponse regroupant tous les fichiers modifiés + une conclusion hors de la snipette .
Ne jamais tronquer le code pour éviter l'alerte TRUNCATED."

# 📌 ÉTAT ACTUEL : LA FONDATION STABLE (RÉALITÉ TECHNIQUE)
Le projet utilise actuellement une structure classique Prof/Élève. Une tentative de migration globale a échoué. **Il est impératif de maintenir ces chemins jusqu'à migration validée domaine par domaine :**
- **Backend Routes** : `server/features/prof/`, `server/features/eleve/`, `server/features/game/`.
- **Frontend Components** : `client/src/features/prof/` et `client/src/features/eleve/`.

# 🎯 OBJECTIF STRATÉGIQUE : RESTRUCTURATION "ZÉRO POROSITÉ"
L'objectif est de migrer vers une architecture **Modulaire par Domaine** pour isoler les fonctionnalités et éviter que la modification d'une feature (ex: Scans) ne casse une autre (ex: Jeux).
- **MÉTHODE STRICTE** : Migration progressive, UN SEUL domaine à la fois (ex: d'abord Games, puis Scans).
- **VALIDATION SYSTÉMATIQUE** : Un domaine n'est considéré comme migré que si les User Stories associées sont testées et validées en local ET en live.
- **ÉTANCHÉITÉ** : Séparer l'IA et le Cloud dans `server/services/` pour que les routes ne soient que des aiguilleurs.

# 🔒 FICHIERS SANCTUARISÉS (LOCKED FILES)
Toute modification doit garantir la non-régression des 15 User Stories.
- **server/server.js** : Cycle de vie, Boot ID, et ordre des routes API (prioritaires).
- **server/features/prof/automation.routes.js** : Logique vitale Drive (Sujet/Copies/Corrections).
- **client/src/App.jsx** : Moniteur de build et Auto-Refresh.
- **client/src/features/prof/scans/ScansStudio.jsx** : Interface de pilotage Caméra/Drive.
- **client/src/features/prof/components/ProfStudioFolder.jsx** : Tri Archives et persistence Mobile.

---

# 📝 LES 15 USER STORIES GARANTIES (CONSTITUTION CONDAMINE)

## 📱 Mobilité & Persistence
1. **PERSISTENCE MOBILE** : Sections et chapitres synchronisés en BDD, visibles sur tout appareil.
2. **ISOLATION DES CLASSES** : Les dossiers d'une classe sont invisibles pour les autres.
3. **VISIBILITÉ SÉLECTIVE** : Seules les matières contenant des dossiers actifs s'affichent par défaut.

## 📂 Gestion du Cloud (Miroir Drive/BDD)
4. **STRUCTURE AUTO-GÉRÉE** : Création auto des 3 sous-dossiers (Sujet/Copies/Corrections) sur Drive.
5. **NORMALISATION PHYSIQUE** : Dossiers Drive en MAJUSCULES et SANS ACCENTS.
6. **SYNCHRONISATION DU NOM** : Renommer dans l'app renomme sur Drive en tâche de fond.
7. **MIROIR PHYSIQUE** : Classer un scan déplace physiquement le dossier dans le chapitre sur Drive.
8. **ALIGNEMENT & NETTOYAGE** : Le bouton 🔄 force le Drive à s'aligner sur les Archives et vire les parasites.
9. **NETTOYAGE INTÉGRAL** : Supprimer dans l'app supprime physiquement le dossier sur Google Drive.

## 📸 Capture & Exploration
10. **CAPTURE INSTANTANÉE** : Photo immédiate avec effet "Flash" visuel.
11. **TRAY DE MINIATURES** : Affichage horizontal immédiat des photos prises sous la caméra.
12. **EXPLORATEUR DRIVE RÉEL** : Le bouton FILES liste les fichiers réels du cloud (Listing API).

## ⚙️ Administration & Déploiement
13. **AUTO-REFRESH LIVE** : Détection de redémarrage (Build ID) et recharge auto du site.
14. **WIZARD D'IMPORTATION** : Bouton "+" pour importer une classe via copier/coller.
15. **SUPPRESSION DE CLASSE** : Nettoyage total BDD d'une classe après double confirmation.

INSTRUCTION LA PLUS IMPORTANTE L ENSEMBLE DU CODE RENVOYE DOIS TOUJOURS ETRE CONTENU DANS UNE SEULE SNIPETTE DE CODE SINON COPIER COLLER IMPOSSIBLE