# CONDAMINEWEB

## IA locale avec Ollama

Le projet peut utiliser un serveur Ollama indépendant pour éviter les coûts d’API IA.

Le serveur indépendant est dans :

```txt
ollama-api-server/
```

Sur le serveur Condamine, ajoute dans `.env` :

```env
OLLAMA_API_SERVER_URL=http://IP_DE_TON_ORDI_FIXE:8787
OLLAMA_API_KEY=la-meme-cle-que-dans-ollama-api-server
OLLAMA_API_MODEL=llama3.1:8b
```

Avec cette configuration, Condamine utilise automatiquement le serveur Ollama local en priorité.

Tu peux forcer explicitement le fournisseur avec :

```env
AI_PROVIDER=ollama_server
```

Pour revenir à Gemini :

```env
AI_PROVIDER=gemini
```

Si `OLLAMA_API_SERVER_URL` n’est pas défini, le comportement actuel reste inchangé.
