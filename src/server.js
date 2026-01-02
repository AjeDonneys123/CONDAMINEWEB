const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const nodeFetch = require('node-fetch');
if (!global.fetch) { global.fetch = nodeFetch; }

const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI;
const geminiKey = process.env.GEMINI_API_KEY;

// --- 1. CONFIG CLOUDINARY ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: { folder: 'condamine-docs', allowed_formats: ['jpg', 'png', 'pdf'] },
});
const upload = multer({ storage: storage });

// --- 2. MODÈLES BDD ---
const playerSchema = new mongoose.Schema({ firstName: String, lastName: String, classroom: String, spellingMistakes: Array });
const Player = mongoose.model('Player', playerSchema);

const gameLevelSchema = new mongoose.Schema({ 
    chapterId: String, title: String, questions: Array, createdAt: { type: Date, default: Date.now } 
});
const GameLevel = mongoose.model('GameLevel', gameLevelSchema);

mongoose.connect(mongoUri).then(() => console.log('✅ MongoDB Connecté')).catch(err => console.error(err));

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- 3. UTILS IA ---
async function fileToPart(url) {
    if(!url) return null;
    try {
        const resp = await fetch(url);
        const buffer = await resp.arrayBuffer();
        return { inlineData: { data: Buffer.from(buffer).toString('base64'), mimeType: url.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg' } };
    } catch(e) { return null; }
}

// --- 4. ROUTES ---

// Upload de fichier
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (req.file) res.json({ ok: true, imageUrl: req.file.path });
    else res.json({ ok: false });
});

// Génération IA avec Fichier + Nombre de questions
app.post('/api/generate-game-content', async (req, res) => {
    const { topic, docUrl, numQuestions } = req.body;
    const count = numQuestions || 5;
    
    console.log(`🤖 [IA] Génération de ${count} questions pour: ${topic || 'document'}`);
    
    const model = "gemini-2.0-flash-exp";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
    
    const prompt = `Tu es un professeur expert. Génère un quiz de ${count} questions QCM basé sur le sujet suivant : ${topic || "le document joint"}.
    RÈGLES :
    1. Réponds UNIQUEMENT avec un tableau JSON brut.
    2. Structure : [{"q": "Question", "options": ["Rép 1", "Rép 2", "Rép 3", "Rép 4"], "a": index_correct}].
    3. "a" est l'index de la réponse juste (0 à 3).
    4. Ne dis rien d'autre que le JSON.`;

    try {
        let parts = [{ text: prompt }];
        if (docUrl) {
            const mediaPart = await fileToPart(docUrl);
            if (mediaPart) parts.push(mediaPart);
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                contents: [{ parts }],
                generationConfig: { response_mime_type: "application/json" }
            })
        });
        
        const result = await response.json();
        if (result.error) throw new Error(result.error.message);

        const text = result.candidates[0].content.parts[0].text;
        res.json(JSON.parse(text));
    } catch (e) {
        console.error("💥 Erreur IA:", e.message);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/game-levels/:classroom', async (req, res) => {
    res.json(await GameLevel.find({}).sort({ createdAt: -1 }));
});

app.post('/api/game-levels', async (req, res) => {
    const { _id, ...data } = req.body;
    if (_id) await GameLevel.findByIdAndUpdate(_id, data);
    else await new GameLevel(data).save();
    res.json({ ok: true });
});

app.delete('/api/game-levels/:id', async (req, res) => {
    await GameLevel.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
});

app.post('/api/register', async (req, res) => {
    const { firstName, lastName, classroom, password } = req.body; 
    if (firstName?.toLowerCase() === "jean" && password === "Clemenceau1919") {
        return res.json({ ok: true, id: "prof", firstName: "Jean", lastName: "Vuillet", classroom: "Professeur" });
    }
    const match = await Player.findOne({ firstName, lastName, classroom });
    if (match) res.json({ ok: true, id: match._id, firstName, lastName, classroom });
    else res.status(404).json({ ok: false });
});

app.listen(port, () => console.log(`🚀 Serveur prêt port ${port}`));