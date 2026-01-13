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
- **server/server.js** : Gestion du cycle de vie, routes prioritaires.
- **server/features/prof/automation.routes.js** : Logique miroir BDD/Drive et classification.
- **server/services/drive.service.js** : Communications bas niveau Google Drive.
- **client/src/features/prof/components/ProfStudioFolder.jsx** : Tri alphanumérique et persistence sections.

---

# 📝 USER STORIES GARANTIES (N-RÉGRESSION)
1. **PERSISTENCE MOBILE** : Sections et chapitres retrouvés sur tout appareil.
2. **STRUCTURE DRIVE AUTO-GÉRÉE** : Création auto des dossiers Sujet/Copies/Corrections.
3. **CAPTURE INSTANTANÉE** : Photo immédiate avec feedback flash.
4. **EXPLORATEUR DRIVE RÉEL** : Visualisation dynamique des fichiers du cloud.
5. **CLASSIFICATION** : Assignation d'une production à un chapitre.
6. **AUTO-REFRESH DÉPLOIEMENT** : Refresh auto au redémarrage serveur.
7. **SYNCHRONISATION DU NOM** : Renommage BDD répercuté sur Drive en background.
8. **CLASSEMENT ALPHANUMÉRIQUE** : Tri naturel (I, II, III) des dossiers.
9. **MIROIR PHYSIQUE** : Classer une production dans un chapitre déclenche le déplacement physique.
10. **NETTOYAGE INTÉGRAL** : Suppression BDD = Suppression Drive.
11. **NORMALISATION PHYSIQUE** : Noms de dossiers Drive sans accents et en majuscules.
12. **ALIGNEMENT ET NETTOYAGE (NEW)** : La structure Drive est forcée de s'aligner sur les Super-Dossiers définis en Archives. Tout dossier Drive "orphelin" ou mal nommé est vidé de ses chapitres vers les dossiers corrects puis supprimé.