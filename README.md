# CONDAMINEWEB

Plateforme pédagogique d'Histoire-Géographie & Éducation Civique (CondaWeb).

## Moteur d'Intelligence Artificielle

Le projet utilise **Google Gemini** (Gemini 2.0 Flash) comme moteur IA principal pour le tutorat méthodologique et la correction des devoirs d'entraînement DNB.

### Configuration (`.env`)

```env
GEMINI_API_KEY=votre_cle_gemini
GEMINI_MODEL=gemini-2.0-flash
AI_PROVIDER=gemini
```

## Démarrage

```bash
# Développement complet (serveur + client)
npm run dev

# Tests d'intégrité
npm test
```
