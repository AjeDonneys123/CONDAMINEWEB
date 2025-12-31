const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const fetch = require('node-fetch');
if (!global.fetch) {
  global.fetch = fetch;
  global.Headers = fetch.Headers;
  global.Request = fetch.Request;
  global.Response = fetch.Response;
}

const express = require('express');
const mongoose = require('mongoose');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// --- 1. INITIALISATION ---
const app = express();
const port = process.env.PORT || 3000;

const mongoUri = process.env.MONGODB_URI;
const geminiKey = process.env.GEMINI_API_KEY;
const MODEL_NAME = "gemini-2.0-flash"; 

if (!mongoUri) { 
    console.error('❌ ERREUR : MONGODB_URI manquant dans le fichier .env'); 
    process.exit(1); 
}

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

mongoose.connect(mongoUri)
  .then(() => console.log('✅ MongoDB Connecté'))
  .catch(err => console.error('❌ Erreur Mongo:', err));

// --- 2. CONFIG CLOUDINARY ---
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: { folder: '5e-entraineur', allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'pdf'], resource_type: 'auto' },
});
const upload = multer({ storage: storage });

// --- 3. SCHEMAS BDD ---

const PlayerSchema = new mongoose.Schema({
  firstName: String, lastName: String, classroom: String,
  validatedQuestions: [String],
  validatedLevels: { type: [mongoose.Schema.Types.Mixed], default: [] },
  spellingMistakes: { type: [{ wrong: String, correct: String, reason: String, date: { type: Date, default: Date.now } }], default: [] },
  activityLogs: { type: [{ action: String, detail: String, date: { type: Date, default: Date.now } }], default: [] },
  created_at: { type: Date, default: Date.now },
}, { minimize: false });
const Player = mongoose.model('Player', PlayerSchema, 'players');

const HomeworkSchema = new mongoose.Schema({
  title: String, classroom: String,
  levels: [{ instruction: String, aiPrompt: String, attachmentUrls: [String], questionImage: String }],
  date: { type: Date, default: Date.now }
});
const Homework = mongoose.model('Homework', HomeworkSchema, 'homeworks');

const SubmissionSchema = new mongoose.Schema({
  homeworkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Homework' },
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
  classroom: String,
  levelsResults: [{ levelIndex: Number, userText: String, userImageUrl: String, aiFeedback: String, teacherFeedback: String, grade: String }],
  submittedAt: { type: Date, default: Date.now }
});
const Submission = mongoose.model('Submission', SubmissionSchema, 'submissions');

const GameLevelSchema = new mongoose.Schema({
    chapterId: String, classroom: String, title: String, lesson: String, questions: Array, createdAt: { type: Date, default: Date.now }
});
const GameLevel = mongoose.model('GameLevel', GameLevelSchema, 'game_levels');

// --- 4. UTILITAIRES ---
function normalizeBase(str) { return (str || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase(); }
function nameTokens(str) { return normalizeBase(str).split(/[\s-']+/).filter(t => t.length >= 2); }

async function fileToPart(url) {
    if(!url) return null;
    try {
        const resp = await fetch(url);
        const buffer = await resp.arrayBuffer();
        const mimeType = url.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
        return { inlineData: { data: Buffer.from(buffer).toString('base64'), mimeType } };
    } catch(e) { return null; }
}

// --- 5. ROUTES ---

// Route Upload
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: "Pas de fichier" });
  res.json({ ok: true, imageUrl: req.file.path });
});

// Analyse Devoirs par IA
app.post('/api/analyze-homework', async (req, res) => {
    const { imageUrl, userText, homeworkInstruction, classroom, playerId } = req.body;
    if (!geminiKey) return res.json({ feedback: "Erreur : Clé IA manquante." });

    try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: MODEL_NAME, generationConfig: { responseMimeType: "application/json" } });
        
        const prompt = `RÔLE: Professeur de français. CIBLE: ${classroom}. TACHE: Corrige la réponse de l'élève. SI FAUTES: Tu dois fournir un tableau HTML et un champ JSON "reason" avec une règle pédagogique précise. JSON: { "content_feedback": "Texte HTML du commentaire et du tableau", "grade": "xx/20", "corrections": [{"wrong":"", "correct":"", "reason":""}] }`;
        
        let parts = [
            { text: prompt }, 
            { text: `CONSIGNE: ${homeworkInstruction}` }, 
            { text: `RÉPONSE ÉLÈVE: ${userText}` }
        ];

        if (imageUrl) { 
            const p = await fileToPart(imageUrl); 
            if(p) parts.push(p); 
        }

        const result = await model.generateContent(parts);
        const json = JSON.parse(result.response.text());

        if (playerId && json.corrections && json.corrections.length > 0) {
            await Player.findByIdAndUpdate(playerId, { 
                $push: { spellingMistakes: { $each: json.corrections.map(c => ({ 
                    wrong: c.wrong, 
                    correct: c.correct, 
                    reason: c.reason, 
                    date: new Date() 
                })) } } 
            });
        }

        res.json({ feedback: json.content_feedback, grade: json.grade });

    } catch (e) { 
        console.error(e);
        res.json({ feedback: "L'IA a rencontré une erreur lors de l'analyse." }); 
    }
});

// Vérification Mini-jeux par IA
app.post('/api/verify-answer-ai', async (req, res) => {
  const { question, userAnswer, expectedAnswer, playerId } = req.body;
  if (!geminiKey) return res.json({ status: "incorrect", feedback: "Clé manquante" });

  try {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME, generationConfig: { responseMimeType: "application/json" } });
    
    const prompt = `Arbitre de français. Si "expectedAnswer" est un chiffre, c'est l'index d'une option de réponse. Vérifie si la réponse de l'élève correspond au sens de la réponse attendue. Si fautes, fournis une explication grammaticale précise dans "reason". JSON: { "status": "correct"|"incorrect", "feedback": "Commentaire HTML avec tableau si besoin", "corrections": [{"wrong":"", "correct":"", "reason":""}] }`;
    
    const result = await model.generateContent([
        prompt, 
        `Question: ${question}`, 
        `Réponse attendue: ${expectedAnswer}`, 
        `Réponse élève: ${userAnswer}`
    ]);

    const json = JSON.parse(result.response.text());

    if (playerId && json.corrections && json.corrections.length > 0) {
        await Player.findByIdAndUpdate(playerId, { 
            $push: { spellingMistakes: { $each: json.corrections.map(c => ({ 
                wrong: c.wrong, 
                correct: c.correct, 
                reason: c.reason, 
                date: new Date() 
            })) } } 
        });
    }
    res.json(json);
  } catch (e) { 
      console.error(e);
      res.json({ status: "incorrect", feedback: "Erreur technique IA." }); 
  }
});

// Suppression d'une faute du carnet
app.post('/api/delete-mistake', async (req, res) => {
    const { playerId, mistakeIndex } = req.body;
    try {
        const p = await Player.findById(playerId);
        if(p) { 
            p.spellingMistakes.splice(mistakeIndex, 1); 
            await p.save(); 
            res.json({ok:true}); 
        } else {
            res.status(404).json({ok:false});
        }
    } catch(e) { res.status(500).json({ok:false}); }
});

// Inscription / Connexion
app.post('/api/register', async (req, res) => { 
    const { firstName, lastName, classroom } = req.body; 
    try {
        let p = await Player.findOne({ firstName, lastName });
        if (!p) {
            p = new Player({ firstName, lastName, classroom });
        } else {
            p.classroom = classroom;
        }
        await p.save();
        res.json({ ok: true, id: p._id, firstName, lastName, classroom });
    } catch(e) { res.status(500).json({ok:false}); }
});

// Récupération des données joueurs
app.get('/api/player-data/:id', async (req, res) => { 
    try { 
        const p = await Player.findById(req.params.id);
        res.json(p); 
    } catch(e) { res.status(404).json({}); } 
});

app.get('/api/players', async (req, res) => { 
    try {
        const list = await Player.find().sort({ lastName: 1 });
        res.json(list); 
    } catch(e) { res.status(500).json([]); }
});

// --- GESTION DES NIVEAUX DE JEUX ---

app.get('/api/game-levels/:classroom', async (req, res) => {
    try {
        const cls = req.params.classroom;
        const query = (cls === "Toutes") ? {} : { $or: [{ classroom: cls }, { classroom: "Toutes" }] };
        const lvls = await GameLevel.find(query).sort({ title: 1 });
        res.json(lvls);
    } catch(e) { res.status(500).json([]); }
});

app.post('/api/game-levels', async (req, res) => {
    try {
        const lvl = new GameLevel(req.body);
        await lvl.save();
        res.json({ ok: true });
    } catch(e) { res.status(500).json({ ok: false }); }
});

app.delete('/api/game-levels/:id', async (req, res) => {
    try {
        await GameLevel.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch(e) { res.status(500).json({ ok: false }); }
});

// Devoirs
app.get('/api/homework-all', async (req, res) => { 
    try {
        const list = await Homework.find().sort({ date: -1 });
        res.json(list); 
    } catch(e) { res.status(500).json([]); }
});

app.get('/api/homework/:class', async (req, res) => { 
    try {
        const list = await Homework.find({ $or: [{ classroom: req.params.class }, { classroom: "Toutes" }] }).sort({ date: -1 }); 
        res.json(list); 
    } catch(e) { res.status(500).json([]); }
});

app.listen(port, () => console.log(`✅ Serveur prêt sur le port ${port}`));