const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

// --- PATCH CRITIQUE POUR NODE 16 (DOIT ETRE EN PREMIER) ---
const nodeFetch = require('node-fetch');
if (!global.fetch) {
  global.fetch = nodeFetch;
  global.Headers = nodeFetch.Headers;
  global.Request = nodeFetch.Request;
  global.Response = nodeFetch.Response;
}
// ---------------------------------------------------------

const express = require('express');
const mongoose = require('mongoose');
// Import Google APRES le patch fetch
const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI;
const geminiKey = process.env.GEMINI_API_KEY;
const MODEL_NAME = "gemini-2.0-flash"; // ou "gemini-1.5-flash" si le 2.0 n'est pas dispo

// --- GESTION BDD ---
let isDbConnected = false;
const connectDB = async () => {
  if (!mongoUri) return;
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 5000 });
    isDbConnected = true;
    console.log('✅ MongoDB Connecté');
  } catch (err) {
    console.error('⚠️ Mode Hors-Ligne (MongoDB inaccessible)');
    isDbConnected = false;
  }
};
connectDB();

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// CLOUDINARY
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

// UTILS
async function fileToPart(url) {
    if(!url) return null;
    try {
        const resp = await fetch(url);
        const buffer = await resp.arrayBuffer();
        return { inlineData: { data: Buffer.from(buffer).toString('base64'), mimeType: 'image/jpeg' } };
    } catch(e) { return null; }
}

// MODELS
let Player, Homework, Submission, GameLevel;
try {
    const PlayerSchema = new mongoose.Schema({ firstName: String, lastName: String, classroom: String, validatedQuestions: [String], validatedLevels: { type: [mongoose.Schema.Types.Mixed], default: [] }, spellingMistakes: { type: [{ wrong: String, correct: String, reason: String, date: { type: Date, default: Date.now } }], default: [] }, activityLogs: { type: [{ action: String, detail: String, date: { type: Date, default: Date.now } }], default: [] }, created_at: { type: Date, default: Date.now }, }, { minimize: false });
    Player = mongoose.model('Player', PlayerSchema, 'players');
    const HomeworkSchema = new mongoose.Schema({ title: String, classroom: String, levels: [{ instruction: String, aiPrompt: String, attachmentUrls: [String], questionImage: String }], date: { type: Date, default: Date.now } });
    Homework = mongoose.model('Homework', HomeworkSchema, 'homeworks');
    const SubmissionSchema = new mongoose.Schema({ homeworkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Homework' }, playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' }, classroom: String, levelsResults: [{ levelIndex: Number, userText: String, userImageUrl: String, aiFeedback: String, teacherFeedback: String, grade: String }], submittedAt: { type: Date, default: Date.now } });
    Submission = mongoose.model('Submission', SubmissionSchema, 'submissions');
    const GameLevelSchema = new mongoose.Schema({ chapterId: String, classroom: String, title: String, lesson: String, questions: Array, createdAt: { type: Date, default: Date.now } });
    GameLevel = mongoose.model('GameLevel', GameLevelSchema, 'game_levels');
} catch(e) { console.log("Schemas ok"); }


// --- ROUTES ---

// UPLOAD
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (req.file && req.file.path) res.json({ ok: true, imageUrl: req.file.path });
    else res.json({ ok: false });
});

// GENERATE QUIZ (IA)
app.post('/api/generate-game-content', async (req, res) => {
    const { docUrl, topic, gameType } = req.body;
    try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: MODEL_NAME, generationConfig: { responseMimeType: "application/json" } });
        
        // Prompt strict pour forcer le JSON
        const systemPrompt = `Tu es un professeur expert pour des collégiens. 
        TACHE : Génère 5 questions QCM sur le sujet fourni ou l'image.
        FORMAT JSON OBLIGATOIRE :
        [
          { 
            "q": "Intitulé de la question ?", 
            "options": ["Choix A", "Choix B", "Choix C", "Choix D"], 
            "a": 0 
          }
        ]
        (Note: "a" est l'index de la bonne réponse : 0, 1, 2 ou 3).`;

        let parts = [{ text: systemPrompt }, { text: `Sujet : ${topic || "Analyse le document"}` }];
        
        if (docUrl) {
            const imgPart = await fileToPart(docUrl);
            if (imgPart) parts.push(imgPart);
        }

        const result = await model.generateContent(parts);
        const text = result.response.text();
        
        // Nettoyage au cas où l'IA ajoute des balises markdown ```json ... ```
        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const json = JSON.parse(cleanText);
        res.json(json);
    } catch (e) {
        console.error("Erreur IA:", e);
        res.status(500).json({ error: "Erreur IA", details: e.message });
    }
});

// REGISTER
app.post('/api/register', async (req, res) => { 
    const { firstName, lastName, classroom } = req.body; 
    if (firstName.trim().toLowerCase() === "jean" && lastName.trim().toLowerCase() === "vuillet") {
        return res.json({ ok: true, id: "prof", firstName: "Jean", lastName: "Vuillet", classroom: "Professeur" });
    }
    if (!isDbConnected) {
        return res.json({ ok: true, id: "local_" + Date.now(), firstName, lastName, classroom, isOfflineMode: true });
    }
    try {
        let p = await Player.findOne({ firstName, lastName });
        if (!p) p = new Player({ firstName, lastName, classroom });
        await p.save();
        res.json({ ok: true, id: p._id, firstName, lastName, classroom });
    } catch (e) { res.status(500).json({ ok: false, error: "Erreur DB" }); }
});

// CRUD LEVELS
app.get('/api/game-levels/:classroom', async (req, res) => {
    if(!isDbConnected) return res.json([]);
    try { res.json(await GameLevel.find({ $or: [{ classroom: req.params.classroom }, { classroom: "Toutes" }] }).sort({ title: 1 })); } catch(e){ res.json([]); }
});

app.post('/api/game-levels', async (req, res) => {
    if(!isDbConnected) return res.json({ok: true}); 
    try {
        const lvl = new GameLevel(req.body);
        await lvl.save();
        res.json({ok: true});
    } catch(e) { res.status(500).json({error: "Erreur sauvegarde"}); }
});

app.delete('/api/game-levels/:id', async (req, res) => {
    if(!isDbConnected) return res.json({ok: true}); 
    try { await GameLevel.findByIdAndDelete(req.params.id); res.json({ok: true}); } catch(e) { res.status(500).json({ok:false}); }
});

// GET PLAYERS & HOMEWORK
app.get('/api/players', async (req, res) => {
    if (!isDbConnected) return res.json([{ _id: '1', firstName: 'Alice', lastName: 'Test', classroom: '6D' }]);
    try { const players = await Player.find().sort({ classroom: 1, lastName: 1 }); res.json(players); } catch (e) { res.json([]); }
});
app.get('/api/homework/:class', async (req, res) => { 
    if(!isDbConnected) return res.json([]); 
    try { const list = await Homework.find({ $or: [{ classroom: req.params.class }, { classroom: "Toutes" }] }).sort({ date: -1 }); res.json(list); } catch(e){ res.json([]); }
});

// IA VERIFY (GAMEPLAY)
app.post('/api/verify-answer-ai', async (req, res) => {
  const { question, userAnswer, expectedAnswer, playerId } = req.body;
  try {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME, generationConfig: { responseMimeType: "application/json" } });
    const prompt = `Arbitre de français. JSON: { "status": "correct"|"incorrect", "feedback": "HTML", "corrections": [] }`;
    const result = await model.generateContent([prompt, `Q: ${question}, A: ${expectedAnswer}, R: ${userAnswer}`]);
    const json = JSON.parse(result.response.text());
    if (isDbConnected && playerId && !playerId.startsWith("local_") && playerId !== "prof") {
        await Player.findByIdAndUpdate(playerId, { $push: { spellingMistakes: { $each: json.corrections.map(c => ({ ...c, date: new Date() })) } } });
    }
    res.json(json);
  } catch (e) { res.json({ status: "incorrect", feedback: "Erreur IA" }); }
});

app.listen(port, () => console.log(`🚀 Serveur prêt port ${port}`));