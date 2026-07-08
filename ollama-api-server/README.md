# Condamine Ollama API Server

Petit serveur indépendant pour héberger une IA locale avec Ollama et la brancher au site Condamine.

Objectif : tu clones ce dossier sur ton ordinateur fixe, tu installes Ollama + un modèle, tu lances ce serveur, puis le site peut envoyer ses demandes IA ici au lieu de payer une API externe.

## Installation rapide

```bash
git clone <ton-futur-repo>
cd condamine-ollama-api-server
npm install
cp .env.example .env
```

Installe Ollama sur la machine, puis récupère au moins un modèle :

```bash
ollama pull llama3.1:8b
```

Ou avec le script fourni :

```bash
bash scripts/install-models.sh
```

Lance le serveur :

```bash
npm start
```

Teste :

```bash
curl http://localhost:8787/health
```

Pour l’installation complète sur l’ordinateur fixe, suis :

```txt
SETUP_FIXED_COMPUTER.md
```

## Configuration

Dans `.env` :

```env
PORT=8787
HOST=0.0.0.0
OLLAMA_BASE_URL=http://127.0.0.1:11434
DEFAULT_MODEL=llama3.1:8b
API_KEY=change-moi-avec-une-cle-longue
ALLOWED_ORIGINS=*
```

Garde `HOST=0.0.0.0` si tu veux que les autres machines du réseau local puissent appeler le serveur.

## Routes disponibles

### Santé du serveur

```bash
curl http://localhost:8787/health
```

### Liste des modèles

```bash
curl -H "x-api-key: TA_CLE" http://localhost:8787/api/models
```

### Chat simple

```bash
curl -X POST http://localhost:8787/api/chat \
  -H "Content-Type: application/json" \
  -H "x-api-key: TA_CLE" \
  -d '{
    "prompt": "Explique les fractions à un élève de 6e.",
    "system": "Tu es un professeur patient et clair."
  }'
```

### Format compatible OpenAI

```bash
curl -X POST http://localhost:8787/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TA_CLE" \
  -d '{
    "model": "llama3.1:8b",
    "messages": [
      { "role": "user", "content": "Donne-moi une dictée courte." }
    ]
  }'
```

## Pour l’ordinateur fixe

Quand tout fonctionne, le serveur doit idéalement tourner tout seul au démarrage.

Un exemple de service Linux est dans :

```txt
examples/condamine-ollama-api.service
```

Il faudra adapter `WorkingDirectory` selon le chemin réel sur ton ordinateur fixe.

## Brancher Condamine dessus

Dans le `.env` du site Condamine, mets :

```env
OLLAMA_API_SERVER_URL=http://IP_DE_TON_ORDI_FIXE:8787
OLLAMA_API_KEY=TA_CLE
OLLAMA_API_MODEL=llama3.1:8b
```

Condamine utilisera automatiquement ce serveur en priorité dès que `OLLAMA_API_SERVER_URL` est présent.

Tu peux aussi forcer le choix :

```env
AI_PROVIDER=ollama_server
```

Et pour revenir à Gemini :

```env
AI_PROVIDER=gemini
```

## Notes importantes

- Ce serveur ne rend pas les modèles “magiquement gratuits” : il utilise ton matériel local. Le coût devient surtout l’électricité et la puissance de l’ordinateur.
- Pour une classe entière, commence avec un modèle 7B ou 8B. C’est beaucoup plus réaliste qu’un gros modèle.
- Mets une vraie `API_KEY` si le serveur est accessible en dehors de ton ordinateur.
- Si tu exposes ce serveur sur Internet, il faudra ajouter une couche plus sérieuse : HTTPS, reverse proxy, logs et limites par utilisateur.
