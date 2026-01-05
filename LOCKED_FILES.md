# 🔒 FICHIERS SANCTUARISÉS
Ces fichiers sont stables et fonctionnels. NE PAS MODIFIER SANS ORDRE EXPLICITE.

## ⚙️ SERVEUR (BACKEND)
- **server/server.js** : Point d'entrée. Connexion BDD OK.
- **server/features/auth/auth.routes.js** : Login Prof/Élève OK.
- **server/features/eleve/eleve.routes.js** : IA Correction + Sauvegarde OK.
- **server/features/prof/prof.routes.js** : Création Devoir + Upload + Wizard IA OK.
- **server/features/game/game.routes.js** : IA Génération Quiz OK.

## 🎮 JEUX (MOTEURS VANELLA)
- **client/src/features/eleve/games/zombie/zombie_core.js** : Moteur Zombie V6 (Cleanup OK).
- **client/src/features/eleve/games/starship/starship_core.js** : Moteur Starship V7 (Input Boss OK).
- **client/src/features/eleve/games/mainGames.js** : Logique Mathématique Commune.

## 🎨 INTERFACE (REACT)
- **client/src/features/prof/games/GameStudio.jsx** : Création Quiz + IA OK.
- **client/src/features/prof/homework/HomeworkStudio.jsx** : Création Devoir + Wizard OK.

---
*Dernière mise à jour : Version Stable V11*