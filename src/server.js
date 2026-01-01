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

const app = express();
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGODB_URI;
const geminiKey = process.env.GEMINI_API_KEY;
const MODEL_NAME = "gemini-2.0-flash"; 

if (!mongoUri) { console.error('❌ MONGODB_URI manquant'); process.exit(1); }

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// SCHEMAS
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
  levelsResults: [{ levelIndex: Number, userText: String, aiFeedback: String, grade: String }],
  submittedAt: { type: Date, default: Date.now }
});
const Submission = mongoose.model('Submission', SubmissionSchema, 'submissions');

const GameLevelSchema = new mongoose.Schema({
    chapterId: String, classroom: String, title: String, lesson: String, questions: Array, createdAt: { type: Date, default: Date.now }
});
const GameLevel = mongoose.model('GameLevel', GameLevelSchema, 'game_levels');

async function fileToPart(url) {
    if(!url) return null;
    try {
        const resp = await fetch(url);
        const buffer = await resp.arrayBuffer();
        const mimeType = url.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
        return { inlineData: { data: Buffer.from(buffer).toString('base64'), mimeType } };
    } catch(e) { return null; }
}

// ROUTES API
app.post('/api/analyze-homework', async (req, res) => {
    const { userText, homeworkInstruction, classroom, playerId, homeworkId } = req.body;
    try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: MODEL_NAME, generationConfig: { responseMimeType: "application/json" } });
        const prompt = `RÔLE: Professeur de français. CIBLE: ${classroom}. 
        TACHE: Corrige. Analyse le fond et la forme. 
        IMPORTANT: Produit un texte pédagogique riche en HTML (ne renvoie pas juste le mot 'HTML').
        SI FAUTES: Tableau HTML <table class="correction-table"> avec colonnes (Mot faux, Correction, Explication précise).
        JSON: { "content_feedback": "Ton texte HTML ici", "grade": "Note/20", "corrections": [{"wrong":"", "correct":"", "reason":""}] }`;
        const result = await model.generateContent([prompt, `CONSIGNE: ${homeworkInstruction}`, `ÉLÈVE: ${userText}`]);
        const json = JSON.parse(result.response.text());

        if (playerId && json.corrections?.length > 0) {
            await Player.findByIdAndUpdate(playerId, { $push: { spellingMistakes: { $each: json.corrections.map(c => ({ ...c, date: new Date() })) } } });
        }
        if (playerId && homeworkId) {
            await Submission.findOneAndUpdate({ homeworkId, playerId }, { classroom, $set: { levelsResults: [{ levelIndex: 0, userText, aiFeedback: json.content_feedback, grade: json.grade }], submittedAt: Date.now() } }, { upsert: true });
        }
        res.json({ feedback: json.content_feedback, grade: json.grade });
    } catch (e) { res.json({ feedback: "Désolé, l'IA a rencontré un problème technique." }); }
});

app.post('/api/register', async (req, res) => { 
    const { firstName, lastName, classroom } = req.body; 
    let p = await Player.findOne({ firstName, lastName });
    if (!p) p = new Player({ firstName, lastName, classroom });
    else p.classroom = classroom;
    await p.save();
    res.json({ ok: true, id: p._id, firstName: p.firstName, lastName: p.lastName, classroom: p.classroom });
});

app.get('/api/players', async (req, res) => { res.json(await Player.find().sort({ lastName: 1 })); });
app.get('/api/player-data/:id', async (req, res) => { res.json(await Player.findById(req.params.id)); });
app.get('/api/game-levels/:classroom', async (req, res) => {
    const query = (req.params.classroom === "Toutes") ? {} : { $or: [{ classroom: req.params.classroom }, { classroom: "Toutes" }] };
    res.json(await GameLevel.find(query).sort({ title: 1 }));
});
app.get('/api/homework-all', async (req, res) => { res.json(await Homework.find().sort({ date: -1 })); });
app.get('/api/homework/:class', async (req, res) => { res.json(await Homework.find({ $or: [{ classroom: req.params.class }, { classroom: "Toutes" }] }).sort({ date: -1 })); });
app.post('/api/delete-mistake', async (req, res) => {
    const p = await Player.findById(req.body.playerId);
    if(p) { p.spellingMistakes.splice(req.body.mistakeIndex, 1); await p.save(); res.json({ok:true}); }
    else res.status(404).json({ok:false});
});

mongoose.connect(mongoUri).then(() => {
    console.log('✅ MongoDB Connecté');
    app.listen(port, () => console.log(`🚀 Serveur prêt port ${port}`));
});