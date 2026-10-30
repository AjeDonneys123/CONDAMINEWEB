# ALLIANCES

Prototype multijoueur autonome. Toutes les données secrètes et les règles sont calculées par le serveur ; les clients ne reçoivent que l'état public et leur propre état privé.

```bash
cd alliances
npm install
npm start
```

Ouvrir `http://localhost:3210` dans 4 à 8 navigateurs/onglets. Pour des chronomètres raccourcis : `npm run dev`.

L'hôte peut compléter le salon avec des bots IA. Chaque bot possède une personnalité persistante (diplomate, offensif, analyste, gardien, opportuniste), une mémoire des attaques et décide uniquement à partir de l'état public et de ses propres données privées.

## Connexion à Didakbot

Chaque bot doit disposer de sa propre session Didakbot. Avant de démarrer le serveur, fournir les sessions dans l'ordre des bots ajoutés :

```bash
export ALLIANCES_DIDAKBOT_BOTS='[{"chatbotId":"123","sessionCode":"ABC123"},{"chatbotId":"124","sessionCode":"DEF456"}]'
npm start
```

Les portraits indiquent `IA Didakbot` quand une session est attachée. Le serveur n'envoie à Didakbot que les informations publiques, l'état privé du bot concerné et ses propres rapports. En cas d'erreur réseau ou de réponse invalide, la stratégie locale prend automatiquement le relais.

La formule de combat déterministe et tous les paramètres d'équilibrage sont centralisés dans `config.js`.
