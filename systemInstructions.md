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

# 🔒 FICHIERS SANCTUARISÉS (LOCKED FILES)
Ces fichiers constituent le cœur fonctionnel du système. Toute modification future doit impérativement garantir la non-régression des User Stories listées ci-dessous.

## ⚙️ BACKEND & INFRASTRUCTURE
- **server/server.js** : Gestion du cycle de vie (Boot ID), ordre des routes (API > Static) et stabilité Render (anti-erreur 520).
- **server/features/prof/automation.routes.js** : Logique de création de structure Drive, auto-réparation des dossiers et upload de photos.
- **server/services/drive.service.js** : Communication bas niveau avec Google Drive API (listing, création, upload).
- **git-auto.js** : Robot de déploiement automatique (Build increment + Push + Signal BDD).

## 📂 STRUCTURE DE DONNÉES (MODELS)
- **server/models/ScanSession.js** : Schéma triple dossiers (Sujet/Copies/Corrections) et liaison Chapter.
- **server/models/Chapter.js** : Structure des dossiers de cours.
- **server/models/Teacher.js** : Persistence des super-dossiers (subjectSections).

## 🎨 INTERFACE STUDIO (FRONTEND)
- **client/src/features/prof/scans/ScansStudio.jsx** : Interface de pilotage (Modes SNAP/FILES/IA), gestion de la caméra et explorateur Drive.
- **client/src/features/prof/components/ProfStudioFolder.jsx** : Système de rangement des archives par Super-Dossiers avec synchronisation BDD/Mobile.
- **client/src/App.jsx** : Moniteur de déploiement et Auto-Refresh post-Render.

---

# 📝 USER STORIES GARANTIES (N-RÉGRESSION)
Avant toute modification des fichiers ci-dessus, vérifier que :

1. **PERSISTENCE MOBILE** : Un prof se connectant sur un nouveau téléphone retrouve instantanément ses super-dossiers (sections) et dossiers de cours (Chapter).
2. **STRUCTURE DRIVE AUTO-GÉRÉE** : La création d'un scan ou l'accès à l'onglet FILES crée/répare automatiquement les 3 sous-dossiers (Sujet, Copies, Corrections) sur Google Drive.
3. **CAPTURE INSTANTANÉE** : Le clic sur le bouton de capture (SNAP) prend une photo immédiate, l'envoie dans le bon tiroir Drive et rafraîchit le plateau de miniatures.
4. **EXPLORATEUR DRIVE RÉEL** : Le bouton FILES permet de visualiser les fichiers réellement présents sur le Drive (listing dynamique) avec miniatures cliquables.
5. **CLASSIFICATION** : Une production de scan peut être assignée ou déplacée dans un dossier de cours actif (non archivé) de la classe correspondante.
6. **AUTO-REFRESH DÉPLOIEMENT** : Le site détecte un redémarrage serveur (Build ID) et force un rechargement de page pour l'utilisateur sans action manuelle (F5).
7. **SYNCHRONISATION DU NOM** : Le renommage d'un dossier de cours (Chapter) dans l'interface met à jour simultanément le titre en base de données et le nom du dossier correspondant sur Google Drive.