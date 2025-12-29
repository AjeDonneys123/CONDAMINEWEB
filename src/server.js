// ==================================================
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

if (!mongoUri) { console.error('❌ ERREUR : MONGODB_URI manquant'); process.exit(1); }

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
  spellingMistakes: { type: [{ wrong: String, correct: String, date: { type: Date, default: Date.now } }], default: [] },
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

const BugSchema = new mongoose.Schema({ reporterName: String, classroom: String, description: String, gameChapter: String, date: { type: Date, default: Date.now } });
const Bug = mongoose.model('Bug', BugSchema, 'bugs');

// --- NOUVEAU SCHEMA POUR LES JEUX (ZOMBIE, ETC) ---
const GameLevelSchema = new mongoose.Schema({
    chapterId: String, // ex: "ch1-zombie"
    classroom: String, // ex: "5e"
    title: String,     // ex: "Niveau 1 - Présent"
    lesson: String,    // Contenu HTML de la leçon (optionnel)
    questions: Array,  // Liste des questions JSON
    createdAt: { type: Date, default: Date.now }
});
const GameLevel = mongoose.model('GameLevel', GameLevelSchema, 'game_levels');

// --- 4. UTILITAIRES ---
function normalizeBase(str) { return (str || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').trim().toLowerCase(); }
function nameTokens(str) { return normalizeBase(str).split(/[\s-']+/).filter(t => t.length >= 2); }
function normalizeClassroom(c) { return normalizeBase(c).replace(/(?<=\d)(e|de|d)/, '').toUpperCase(); }
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

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: "Pas de fichier" });
  res.json({ ok: true, imageUrl: req.file.path });
});

// --- ROUTES GAME LEVELS (CRUD) ---
app.get('/api/game-levels/:classroom', async (req, res) => {
    try {
        const lvls = await GameLevel.find({ $or: [{ classroom: req.params.classroom }, { classroom: "Toutes" }] }).sort({ title: 1 });
        res.json(lvls);
    } catch(e) { res.status(500).json([]); }
});
app.post('/api/game-levels', async (req, res) => {
    try { const lvl = new GameLevel(req.body); await lvl.save(); res.json({ ok: true }); } catch(e) { res.status(500).json({ ok: false }); }
});
app.delete('/api/game-levels/:id', async (req, res) => {
    try { await GameLevel.findByIdAndDelete(req.params.id); res.json({ ok: true }); } catch(e) { res.status(500).json({ ok: false }); }
});

// --- ROUTE GÉNÉRATION IA POUR PROFESSEUR ---
app.post('/api/generate-game-content', async (req, res) => {
    const { docUrl, topic, gameType } = req.body; 
    
    if (!geminiKey) return res.json({ error: "Clé IA manquante" });

    try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: MODEL_NAME, generationConfig: { responseMimeType: "application/json" } });

        let prompt = "";
        if (gameType === "quiz") {
            prompt = `
            RÔLE : Tu es un professeur expert qui crée des QCM pour des élèves.
            SUJET : ${topic || "Le document fourni"}.
            TACHE : Génère 5 questions QCM à choix multiple basées sur le document ou le sujet.
            FORMAT JSON ATTENDU : Une liste d'objets :
            [
              { "q": "Intitulé de la question ?", "options": ["Choix A", "Choix B", "Choix C", "Choix D"], "a": 0 }
            ]
            IMPORTANT : "a" est l'index de la bonne réponse (0, 1, 2 ou 3).
            `;
        } else {
            prompt = `
            RÔLE : Tu es un professeur de français.
            SUJET : ${topic || "Le document fourni"}.
            TACHE : Génère 1 sujet de rédaction stimulant.
            FORMAT JSON ATTENDU :
            [
              { "q": "Sujet de la rédaction..." }
            ]
            `;
        }

        let parts = [{ text: prompt }];
        if (docUrl) {
            const p = await fileToPart(docUrl);
            if(p) parts.push(p);
        }

        const result = await model.generateContent(parts);
        const jsonResponse = JSON.parse(result.response.text());
        res.json(jsonResponse);

    } catch (e) { console.error(e); res.status(500).json({ error: e.message }); }
});


app.post('/api/homework', async (req, res) => { try { const hw = new Homework(req.body); await hw.save(); res.json({ ok: true }); } catch(e) { res.status(500).json({ ok: false }); } });
app.get('/api/homework/:class', async (req, res) => { try { const cls = req.params.class; const list = await Homework.find({ $or: [{ classroom: cls }, { classroom: "Toutes" }] }).sort({ date: -1 }); res.json(list); } catch(e) { res.status(500).json([]); } });
app.get('/api/homework-all', async (req, res) => { try { const list = await Homework.find().sort({ date: -1 }); res.json(list); } catch(e) { res.status(500).json([]); } });
app.put('/api/homework/:id', async (req, res) => { try { await Homework.findByIdAndUpdate(req.params.id, req.body); res.json({ ok: true }); } catch(e) { res.status(500).json({ ok: false }); } });
app.delete('/api/homework/:id', async (req, res) => { try { await Homework.findByIdAndDelete(req.params.id); res.json({ ok: true }); } catch(e) { res.status(500).json({ ok: false }); } });

app.post('/api/analyze-homework', async (req, res) => {
    const { imageUrl, userText, homeworkInstruction, teacherDocUrls, questionImage, classroom, playerId, homeworkId, levelIndex } = req.body;
    if (!geminiKey) return res.json({ feedback: "Erreur : Clé IA manquante." });
    try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: MODEL_NAME, generationConfig: { responseMimeType: "application/json" } });
        let parts = [];
        parts.push({ text: `RÔLE : Professeur correcteur. CIBLE: ${classroom}. NOTE SUR 20. JSON: { "content_feedback": "HTML", "grade": "xx/20" }` });
        if (teacherDocUrls) for (let url of teacherDocUrls) { if(url!=="BREAK") { const p = await fileToPart(url); if(p) parts.push(p); } }
        parts.push({ text: `QUESTION: "${homeworkInstruction}"` });
        if (questionImage) { const p = await fileToPart(questionImage); if(p) parts.push(p); }
        parts.push({ text: `REPONSE ELEVE: "${userText}"` });
        if (imageUrl) { const p = await fileToPart(imageUrl); if(p) parts.push(p); }
        const result = await model.generateContent(parts);
        const json = JSON.parse(result.response.text());
        if (playerId && homeworkId) {
            const newResult = { levelIndex: levelIndex||0, userText, userImageUrl: imageUrl, aiFeedback: json.content_feedback, grade: json.grade||"A valider" };
            const sub = await Submission.findOne({ homeworkId, playerId });
            if (sub) { const idx = sub.levelsResults.findIndex(r => r.levelIndex === newResult.levelIndex); if (idx > -1) sub.levelsResults[idx] = newResult; else sub.levelsResults.push(newResult); sub.submittedAt = Date.now(); await sub.save(); }
            else { await new Submission({ homeworkId, playerId, classroom, levelsResults: [newResult] }).save(); }
        }
        res.json({ feedback: json.content_feedback, grade: json.grade });
    } catch (error) { res.json({ feedback: `Erreur: ${error.message}` }); }
});

app.get('/api/submissions/:hwId', async (req, res) => { try { const subs = await Submission.find({ homeworkId: req.params.hwId }).populate('playerId'); res.json(subs); } catch(e) { res.status(500).json([]); } });
app.get('/api/submission-detail/:subId', async (req, res) => { try { const sub = await Submission.findById(req.params.subId).populate('playerId').populate('homeworkId'); res.json(sub); } catch(e) { res.status(500).json(null); } });
app.post('/api/update-correction', async (req, res) => { try { const { subId, levelsResults } = req.body; await Submission.findByIdAndUpdate(subId, { levelsResults }); res.json({ ok: true }); } catch(e) { res.status(500).json({ ok: false }); } });
app.post('/api/register', async (req, res) => { try { const { firstName, lastName, classroom } = req.body; if (!firstName || !lastName || !classroom) return res.status(400).json({ ok: false }); if(firstName.toLowerCase() === "eleve" && lastName.toLowerCase() === "test") { let testPlayer = await Player.findOne({ firstName: "Eleve", lastName: "Test" }); if (!testPlayer) { testPlayer = new Player({ firstName: "Eleve", lastName: "Test", classroom: classroom }); await testPlayer.save(); } else { testPlayer.classroom = classroom; await testPlayer.save(); } return res.json({ ok: true, id: testPlayer._id, firstName: "Eleve", lastName: "Test", classroom: classroom }); } const inputFirst = nameTokens(firstName); const inputLast = nameTokens(lastName); const normClass = normalizeClassroom(classroom); let classes = [normClass]; if (['2C', '2D'].includes(normClass)) classes = ['2C', '2D', '2CD']; if (['6', '6D'].includes(normClass)) classes = ['6', '6D']; const all = await Player.find({ classroom: { $in: classes } }); const found = all.find(p => { const dbFirst = nameTokens(p.firstName); const dbLast = nameTokens(p.lastName); return inputFirst.some(t => dbFirst.includes(t)) && inputLast.some(t => dbLast.includes(t)); }); if (!found) return res.status(404).json({ ok: false, error: "Élève introuvable." }); return res.json({ ok: true, id: found._id, firstName: found.firstName, lastName: found.lastName, classroom: found.classroom }); } catch (e) { res.status(500).json({ ok: false }); } });

app.post('/api/verify-answer-ai', async (req, res) => {
  const { question, userAnswer, expectedAnswer, playerId } = req.body;
  if (geminiKey) {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: MODEL_NAME, generationConfig: { responseMimeType: "application/json" } });
      const systemInstruction = `RÔLE : Arbitre de Jeu. JSON: { "status": "correct"|"incorrect", "feedback": "...", "corrections": [{"wrong":"", "correct":""}] }`;
      const result = await model.generateContent([systemInstruction, `Q: ${question}, A attendue: ${expectedAnswer}, R élève: ${userAnswer}`]);
      const json = JSON.parse(result.response.text());
      if (playerId && json.corrections && json.corrections.length > 0) { await Player.findByIdAndUpdate(playerId, { $push: { spellingMistakes: { $each: json.corrections.map(c => ({ wrong: c.wrong, correct: c.correct, date: new Date() })) } } }); }
      return res.json(json);
    } catch (error) { console.error(error); }
  }
  res.json({ status: "incorrect", feedback: "Erreur IA" });
});

app.get('/api/player-data/:id', async (req, res) => { try { const p = await Player.findById(req.params.id); if(p) res.json(p); else res.status(404).json({}); } catch(e) { res.status(500).json({}); } });
app.get('/api/players', async (req, res) => { res.json(await Player.find().sort({ lastName: 1 })); });
app.post('/api/reset-player', async (req, res) => { await Player.findByIdAndUpdate(req.body.playerId, { validatedQuestions: [], validatedLevels: [], spellingMistakes: [], activityLogs: [] }); res.json({ok:true}); });
app.post('/api/report-bug', async (req, res) => { const newBug = new Bug(req.body); await newBug.save(); res.json({ok:true}); });
app.get('/api/bugs', async(req,res)=>{ res.json(await Bug.find().sort({date:-1})); });
app.delete('/api/bugs/:id', async(req,res)=>{ await Bug.findByIdAndDelete(req.params.id); res.json({ok:true}); });

app.listen(port, () => { console.log(`✅ Serveur prêt sur le port ${port}`); });

// ==================================================