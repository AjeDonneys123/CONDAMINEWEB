# 🔐 RÉPARER L'ERREUR INVALID_GRANT

Si tu reçois l'erreur `invalid_grant`, ton token Google est mort. Voici comment le régénérer proprement :

1.  **Lancer le serveur** localement ou sur Render.
2.  **Ouvrir l'URL suivante** dans ton navigateur :
    `http://localhost:3000/api/auth/google/login`
    *(Remplace localhost:3000 par l'adresse de ton site si tu es en ligne)*.
3.  **Autoriser Condamine** : Connecte-toi au compte Google prof et accepte les droits d'accès à Drive.
4.  **Récupérer le Token** : Une page blanche va s'afficher avec une longue chaîne de caractères.
5.  **Mettre à jour le .env** : Copie cette chaîne et colle-la dans ton fichier `.env` sur la ligne :
    `GOOGLE_REFRESH_TOKEN=...ta_nouvelle_valeur...`
6.  **Redémarrer** : Relance le serveur.

### ✅ Pourquoi ça arrive ?
- Tu as changé le mot de passe du compte Google.
- Tu as révoqué les accès manuellement dans les paramètres de sécurité Google.
- Le token a expiré (rare mais possible après 6 mois d'inactivité).