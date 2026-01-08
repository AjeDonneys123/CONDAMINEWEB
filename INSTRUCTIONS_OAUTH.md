// Cause principale
// - redirect_uri_mismatch : l'URI de callback utilisée par ton serveur doit être exactement listée
//   dans la Google Cloud Console (APIs & Services → Credentials → OAuth 2.0 Client ID → Authorized redirect URIs).
// - Même si la redirection est correcte, le token que tu obtiendras appartient toujours au compte
//   avec lequel tu t'es connecté lors du consent (vuillet433@gmail.com si tu as choisi ton perso).
// - Pour obtenir l'accès aux photos du compte condamine (compte scolaire), il faut soit que
//   la personne admin/ayant accès à condamine donne le consent en se connectant, soit utiliser
//   une solution d'administration (service account + domain-wide delegation) fournie par l'admin.

// Options concrètes (choisis une)
1) Corriger le redirect URI + autoriser avec le compte ciblé (simple si tu peux te connecter au compte condamine)
   - Dans Google Cloud Console -> Credentials -> edit OAuth client -> ajouter :
     http://localhost:3000/api/google/oauth/callback
   - Ouvre : http://localhost:3000/api/google/oauth
   - Connecte-toi avec le compte condamine et accepte. (Le callback écrira le refresh token dans .env)
   - Si tu n'as pas accès au compte condamine, demande à l'admin du collège de le faire.

2) Faire autoriser le compte condamine par l'admin (si tu ne peux pas t'y connecter)
   - Demander à l'administrateur GSuite/Workspace de :
     a) Ouvrir le lien http://<ta-machine>:3000/api/google/oauth (ou sur leur machine)
     b) Se connecter au compte condamine et donner le consent.
   - L'admin peut ensuite te transmettre (sûrement hors-chat : e.g. via messagerie interne) soit :
     - le refresh token, que tu colles toi‑même dans `.env`, ou
     - exécuter le flow sur la machine serveur et le token sera écrit automatiquement dans `.env`.

3) Domain-wide delegation (solution « admin-friendly » et scalable)
   - L'admin crée un Service Account dans Google Cloud Console, active domain-wide delegation et
     délègue les scopes nécessaires (photoslibrary.readonly n'est PAS toujours supporté par DWD ;
     Drive scopes le sont). Attention : Google Photos API n'autorise généralement pas l'accès
     via service accounts pour comptes utilisateur normaux sauf configuration particulière.
   - Avantage : pas besoin du refresh token d'un utilisateur. Complexe à configurer côté admin.

4) Récupérer les photos via Drive (si les images sont déjà synchronisées dans Drive)
   - Si les images du compte condamine sont déjà présentes dans Google Drive (ou peuvent être placées là),
     l'admin peut autoriser Drive API (plus simple pour service accounts/domain delegation).
   - Dans ce cas ton système peut utiliser la Drive API pour copier les fichiers.

5) Alternative non-technique (si urgent)
   - Demander à l'admin du collège d’exporter (ou partager) le dossier Photos/Drive et de
     te donner un lien partagé ou une archive. Tu peux ensuite importer dans ton Drive via ton outil.

//// Étapes rapides pour résoudre l'erreur redirect_uri_mismatch (si tu veux tester localement toi-même)
// 1) Ouvre Google Cloud Console -> APIs & Services -> Credentials -> OAuth 2.0 Client IDs.
// 2) Clique sur ton client OAuth -> Authorized redirect URIs -> Add URI:
//      http://localhost:3000/api/google/oauth/callback
//    (La valeur doit être strictement identique à celle utilisée par l'app: schéma, host, port, path)
// 3) Sauvegarde, puis relance : http://localhost:3000/api/google/oauth
// 4) Si tu veux le token pour le compte condamine et que tu n'y as pas accès, demande à l'admin
//    d'exécuter le même flow (ou de te fournir le refresh token en dehors de ce chat).