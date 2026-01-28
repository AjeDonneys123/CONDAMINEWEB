RÈGLES DE SORTIE : Utilisez Gemini 2.0 Flash. Fichiers complets. Tags [[[£ FILE: path £]]] content [[[£ END: path £]]]. Snippet unique.
RELIE apply.js : Sécurité anti-régression active (Taille > 90%). Rejet automatique des snippets.

REGLE D OR ABSOLUE : ENVOYER Une introduction, puis LE CODE EN UN SEUL BLOC PRÉCÉDÉ DE ```` ET SUIVI DE ````, enfin une conclusion.

SANTÉ DU SYSTÈME (ALERTE TOKEN) : 
- À 500 000 tokens, envoie l'alerte : "⚠️ SEUIL DE TOKENS PROCHE : SNAPSHOT RECOMMANDÉ".

LOGIQUE DE MÉMOIRE (HISTORY.TXT) :
- Ce fichier est notre "Mémoire Vive". 
- MISE À JOUR : Dès qu'une tâche majeure est finie ou qu'un bug complexe est résolu, mets à jour `history.txt` IMMÉDIATEMENT dans le bloc de code suivant. N'attends pas la fin de session.
- Ne jamais effacer l'historique, ajouter les nouvelles entrées à la suite.

🚨 PROTOCOLE DE RÉPARATION (RAPPORT D'INCIDENT) :
- Si l'utilisateur colle un "RAPPORT AUTOMATIQUE (REVERT TRIGGERED)", cela signifie que :
  1. Le code précédent a causé une régression.
  2. L'utilisateur a DÉJÀ fait un Revert (il est revenu à la version stable).
  3. MA MISSION : Analyser la raison du rejet (Verdict Oracle) et renvoyer le fichier CORRIGÉ qui n'aura plus le défaut détecté.

!!! EN MAJUSCULE CELLES QUI MARCHENT PAS OU LES BUGS
🛡️ 1. ESPACE ADMIN : Importation massive, gestion users/classes. OK.
🎓 2. ESPACE PROF : Plan de classe, Comportement (Croix/Bonus). OK.
🎬 STUDIO : Création Devoirs & Jeux. OK.
📸 SCAN & CORRECTION : 
   - DOUBLE PASSE LITTÉRALE : Utilise le sujet + copie pour transcrire sans lisser.
   - SABLIER : Traitement en arrière-plan.
🎒 3. ESPACE ÉLÈVE : Dashboard, Statuts couleur, Feedback IA. OK.
🧠 4. MOTEUR : Auth Hybride, Google Drive Proxy (Streaming). OK.
