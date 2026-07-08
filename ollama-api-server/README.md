# Serveur Ollama pour Condamine

Cette passerelle est le seul service a exposer au serveur Condamine. Le port Ollama `11434` doit rester prive.

```bash
cd ollama-api-server
npm install
cp .env.example .env
# Remplacer API_KEY dans .env
ollama pull llama3.1:8b
npm start
```

Verification locale :

```bash
curl http://127.0.0.1:8787/health
```

Sur le serveur du site Condamine :

```env
AI_PROVIDER=ollama_server
OLLAMA_API_SERVER_URL=https://adresse-securisee.example
OLLAMA_API_KEY=LA_MEME_CLE_QUE_SUR_L_IMAC
OLLAMA_API_MODEL=llama3.1:8b
```

Pour un site heberge sur Internet, utiliser un tunnel HTTPS Cloudflare ou Tailscale vers `http://127.0.0.1:8787`. Ne jamais publier directement `11434`.

## Demarrage automatique sur cet iMac

Le fichier `macos/com.condamine.ollama-api.plist` permet a `launchd` de redemarrer automatiquement la passerelle. Il contient des chemins propres a cet iMac et aucune cle secrete ; la cle reste uniquement dans le fichier `.env` ignore par Git.
