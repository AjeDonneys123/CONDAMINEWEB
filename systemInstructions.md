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

# 📌 ÉTAT ACTUEL : LA FONDATION STABLE
Structure Prof/Élève. Routes Backend : `server/features/`. Frontend : `client/src/features/`.

# 🎯 OBJECTIF STRATÉGIQUE : RESTRUCTURATION "ZÉRO POROSITÉ"
Migration progressive domaine par domaine.

# 🔒 FICHIERS SANCTUARISÉS (LOCKED FILES)
- server/server.js
- client/src/App.jsx

# 📝 LES 15 USER STORIES GARANTIES (CONSTITUTION CONDAMINE)

## ☁️ Gestion du Cloud (RÈGLE ABSOLUE)
**COMPTE DE RÉFÉRENCE** : Le système doit impérativement opérer sur le compte Google **condamine.edu.ec**. 
Toute tentative de connexion sur un compte personnel (ex: gmail.com) doit être signalée comme une erreur de configuration.

4. **STRUCTURE AUTO-GÉRÉE** : Hiérarchie stricte : `CONDA CLASSE > [NOM PROF] > [CLASSE] > DEVOIRS > [MATIÈRE] > [CHAPITRE]`.
5. **NORMALISATION PHYSIQUE** : Dossiers Drive en MAJUSCULES et SANS ACCENTS.
8. **ALIGNEMENT & NETTOYAGE** : Le bouton 🔄 (Synchro) force l'alignement BDD -> Drive. Le bouton 🧨 (Nuke) pulvérise l'arborescence de la classe pour repartir à zéro.
9. **NETTOYAGE INTÉGRAL** : Supprimer dans l'app supprime physiquement sur Drive.

## 📸 Capture & Exploration
12. **EXPLORATEUR DRIVE RÉEL** : Diagnostic permanent du compte connecté dans le Header.

!!! regle ultra archi importante : envoie moi toujours l ensemble du code dans un seul token