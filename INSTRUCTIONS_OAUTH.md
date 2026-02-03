# 🔐 RÉPARER L'ERREUR INVALID_GRANT
Si tes images ne s'affichent plus et que le terminal affiche `invalid_grant` :

1. Lance le projet (`npm run dev`).
2. Ouvre : http://localhost:3000/api/auth/google/login
3. Connecte-toi à Google.
4. Copie le code affiché sur la page.
5. Colle-le dans ton fichier `.env` :
   `GOOGLE_REFRESH_TOKEN=ton_nouveau_code_ici`
6. Redémarre le projet.

*Note : Si Google dit que l'application n'est pas validée, clique sur "Paramètres avancés" puis "Accéder à Condamine (non sécurisé)".*
