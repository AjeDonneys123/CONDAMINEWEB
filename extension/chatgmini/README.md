# ChatGmini Companion

Extension Chrome locale pour CondaWeb.

## Chargement local

1. Ouvrir `chrome://extensions`
2. Activer `Mode developpeur`
3. Cliquer `Charger l'extension non empaquetee`
4. Selectionner ce dossier: `extension/chatgmini`

## Ce que fait cette premiere version

- expose `window.__condaGeminiExtension = true` sur CondaWeb
- expose `window.ChatGmini.openGemini()`
- ouvre Gemini dans une fenetre popup depuis l'extension

## Domaines autorises

- `http://localhost:5173`
- `http://127.0.0.1:5173`
- `https://condaweb.vercel.app`
