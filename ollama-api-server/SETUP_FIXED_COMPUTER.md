# Installation sur l’ordinateur fixe

Ce guide sert pour la machine qui hébergera l’IA locale.

## 1. Installer les prérequis

Installe :

- Node.js 18 ou plus récent ;
- Ollama ;
- Git.

Vérifie :

```bash
node -v
npm -v
ollama --version
git --version
```

## 2. Récupérer le projet

Quand le repo sera publié :

```bash
git clone <URL_DU_REPO>
cd condamine-ollama-api-server
```

Si le dossier reste dans le repo Condamine principal :

```bash
git clone <URL_DU_REPO_CONDAMINE>
cd CONDAMINEWEB/ollama-api-server
```

## 3. Installer le serveur

```bash
npm install
cp .env.example .env
```

Ouvre `.env` et change au minimum :

```env
API_KEY=une-vraie-cle-longue-et-secrete
DEFAULT_MODEL=llama3.1:8b
```

## 4. Installer un modèle

```bash
ollama pull llama3.1:8b
```

Pour une machine moins puissante, essaie plutôt :

```bash
ollama pull qwen2.5:7b-instruct
```

## 5. Tester avant de brancher le site

```bash
bash scripts/check-setup.sh
npm start
```

Dans un autre terminal :

```bash
curl http://localhost:8787/health
```

Puis :

```bash
bash scripts/test-chat.sh
```

## 6. Brancher Condamine

Dans le `.env` du serveur Condamine :

```env
OLLAMA_API_SERVER_URL=http://IP_DE_L_ORDI_FIXE:8787
OLLAMA_API_KEY=la-meme-cle-que-dans-le-serveur-ollama
OLLAMA_API_MODEL=llama3.1:8b
```

Redémarre Condamine.

Tu devrais voir un badge “IA locale active” dans le site quand le serveur répond.

## 7. Démarrage automatique

Linux/systemd :

1. copie `examples/condamine-ollama-api.service` vers `/etc/systemd/system/` ;
2. adapte `WorkingDirectory` ;
3. lance :

```bash
sudo systemctl daemon-reload
sudo systemctl enable condamine-ollama-api
sudo systemctl start condamine-ollama-api
sudo systemctl status condamine-ollama-api
```

## Modèle conseillé

Pour des élèves, je commencerais avec :

- `llama3.1:8b` si la machine a assez de RAM ;
- `qwen2.5:7b-instruct` si tu veux quelque chose de léger et efficace ;
- éviter les modèles trop gros au départ : ils sont meilleurs, mais ils peuvent bloquer toute une classe si l’ordinateur ne suit pas.
