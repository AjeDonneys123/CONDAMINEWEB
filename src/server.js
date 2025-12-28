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
  params: {
    folder: '5e-entraineur', 
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp', 'pdf'], 
    resource_type: 'auto' 
  },
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
  title: String,
  classroom: String,
  levels: [{
      instruction: String,
      aiPrompt: String,
      attachmentUrls: [String],
      questionImage: String
  }],
  date: { type: Date, default: Date.now }
});
const Homework = mongoose.model('Homework', HomeworkSchema, 'homeworks');

const SubmissionSchema = new mongoose.Schema({
  homeworkId: { type: mongoose.Schema.Types.ObjectId, ref: 'Homework' },
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
  classroom: String,
  levelsResults: [{
      levelIndex: Number,
      userText: String,
      userImageUrl: String,
      aiFeedback: String,    
      teacherFeedback: String, 
      grade: String          
  }],
  submittedAt: { type: Date, default: Date.now }
});
const Submission = mongoose.model('Submission', SubmissionSchema, 'submissions');

const BugSchema = new mongoose.Schema({
  reporterName: String, classroom: String, description: String, gameChapter: String, date: { type: Date, default: Date.now },
});
const Bug = mongoose.model('Bug', BugSchema, 'bugs');

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

app.post('/api/homework', async (req, res) => {
    try { const hw = new Homework(req.body); await hw.save(); res.json({ ok: true }); } catch(e) { res.status(500).json({ ok: false }); }
});

app.get('/api/homework/:class', async (req, res) => {
    try { const cls = req.params.class; const list = await Homework.find({ $or: [{ classroom: cls }, { classroom: "Toutes" }] }).sort({ date: -1 }); res.json(list); } catch(e) { res.status(500).json([]); }
});

app.get('/api/homework-all', async (req, res) => {
    try { const list = await Homework.find().sort({ date: -1 }); res.json(list); } catch(e) { res.status(500).json([]); }
});

app.put('/api/homework/:id', async (req, res) => {
    try { await Homework.findByIdAndUpdate(req.params.id, req.body); res.json({ ok: true }); } catch(e) { res.status(500).json({ ok: false }); }
});

app.delete('/api/homework/:id', async (req, res) => {
    try { await Homework.findByIdAndDelete(req.params.id); res.json({ ok: true }); } catch(e) { res.status(500).json({ ok: false }); }
});

// === ANALYSE ET SAUVEGARDE AUTOMATIQUE DE LA COPIE ===
app.post('/api/analyze-homework', async (req, res) => {
    const { imageUrl, userText, homeworkInstruction, teacherDocUrls, questionImage, classroom, playerId, homeworkId, levelIndex } = req.body;
    
    if (!geminiKey) return res.json({ feedback: "Erreur : Clé IA manquante." });

    try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: MODEL_NAME, generationConfig: { responseMimeType: "application/json" } });

        // CONSTRUCTION DU PROMPT MULTIMODAL
        let parts = [];

        // 1. INSTRUCTION SYSTÈME
        parts.push({ text: `
            RÔLE : Tu es un professeur correcteur bienveillant et précis pour des élèves de niveau Collège/Lycée (${classroom || 'Niveau inconnu'}).
            
            TA TÂCHE :
            1. Analyse les documents de référence fournis (s'il y en a) pour comprendre le contexte du cours.
            2. Analyse la QUESTION posée à l'élève (qui peut être un texte, une image, ou les deux).
            3. Analyse la RÉPONSE de l'élève (texte et/ou image).
            4. Compare la réponse aux attentes de la question et aux documents.
            5. Note sur 20.
            
            FORMAT JSON ATTENDU : { "content_feedback": "Texte HTML de correction structuré", "grade": "Note/20", "spelling_corrections": [] }
        `});

        // 2. DOCUMENTS DE RÉFÉRENCE (LE COURS)
        if (teacherDocUrls && teacherDocUrls.length > 0) {
            parts.push({ text: "\n--- DOCUMENTS DE RÉFÉRENCE / COURS (POUR LE CONTEXTE) ---\n" });
            for (let url of teacherDocUrls) { 
                if(url === "BREAK") continue;
                const p = await fileToPart(url); 
                if(p) parts.push(p); 
            }
        }

        // 3. LA QUESTION (L'ÉNONCÉ)
        parts.push({ text: "\n--- ÉNONCÉ / QUESTION POSÉE À L'ÉLÈVE ---\n" });
        if (homeworkInstruction) parts.push({ text: `CONSIGNE TEXTUELLE : "${homeworkInstruction}"` });
        if (questionImage) {
            parts.push({ text: "IMAGE DE LA QUESTION :" });
            const p = await fileToPart(questionImage);
            if(p) parts.push(p);
        }

        // 4. LA RÉPONSE DE L'ÉLÈVE
        parts.push({ text: "\n--- TRAVAIL DE L'ÉLÈVE ---\n" });
        if (userText) parts.push({ text: `RÉPONSE TEXTE : "${userText}"` });
        if (imageUrl) {
            parts.push({ text: "IMAGE DE LA RÉPONSE DE L'ÉLÈVE :" });
            const p = await fileToPart(imageUrl);
            if(p) parts.push(p);
        }

        const result = await model.generateContent(parts);
        const jsonResponse = JSON.parse(result.response.text());

        // SAUVEGARDE
        if (playerId && homeworkId) {
            const newResult = {
                levelIndex: levelIndex || 0,
                userText: userText,
                userImageUrl: imageUrl,
                aiFeedback: jsonResponse.content_feedback,
                grade: jsonResponse.grade || "A valider"
            };

            const existingSub = await Submission.findOne({ homeworkId, playerId });

            if (existingSub) {
                const idx = existingSub.levelsResults.findIndex(r => r.levelIndex === newResult.levelIndex);
                if (idx > -1) existingSub.levelsResults[idx] = newResult;
                else existingSub.levelsResults.push(newResult);
                existingSub.submittedAt = Date.now();
                await existingSub.save();
            } else {
                const newSub = new Submission({
                    homeworkId, playerId, classroom,
                    levelsResults: [newResult]
                });
                await newSub.save();
            }
        }

        res.json({ feedback: jsonResponse.content_feedback, grade: jsonResponse.grade });

    } catch (error) { 
        console.error(error);
        res.json({ feedback: `Erreur technique : ${error.message}` }); 
    }
});

app.get('/api/submissions/:hwId', async (req, res) => {
    try {
        const subs = await Submission.find({ homeworkId: req.params.hwId }).populate('playerId');
        res.json(subs);
    } catch(e) { res.status(500).json([]); }
});

app.get('/api/submission-detail/:subId', async (req, res) => {
    try {
        const sub = await Submission.findById(req.params.subId).populate('playerId').populate('homeworkId');
        res.json(sub);
    } catch(e) { res.status(500).json(null); }
});

app.post('/api/update-correction', async (req, res) => {
    try {
        const { subId, levelsResults } = req.body;
        await Submission.findByIdAndUpdate(subId, { levelsResults });
        res.json({ ok: true });
    } catch(e) { res.status(500).json({ ok: false }); }
});

app.post('/api/register', async (req, res) => {
  try {
    const { firstName, lastName, classroom } = req.body;
    if (!firstName || !lastName || !classroom) return res.status(400).json({ ok: false });
    if(firstName.toLowerCase() === "eleve" && lastName.toLowerCase() === "test") {
       let testPlayer = await Player.findOne({ firstName: "Eleve", lastName: "Test" });
       if (!testPlayer) { testPlayer = new Player({ firstName: "Eleve", lastName: "Test", classroom: classroom }); await testPlayer.save(); }
       else { testPlayer.classroom = classroom; await testPlayer.save(); }
       return res.json({ ok: true, id: testPlayer._id, firstName: "Eleve", lastName: "Test", classroom: classroom });
    }
    const inputFirst = nameTokens(firstName); const inputLast = nameTokens(lastName); const normClass = normalizeClassroom(classroom);
    let classes = [normClass]; if (['2C', '2D'].includes(normClass)) classes = ['2C', '2D', '2CD']; if (['6', '6D'].includes(normClass)) classes = ['6', '6D'];
    const all = await Player.find({ classroom: { $in: classes } });
    const found = all.find(p => { const dbFirst = nameTokens(p.firstName); const dbLast = nameTokens(p.lastName); return inputFirst.some(t => dbFirst.includes(t)) && inputLast.some(t => dbLast.includes(t)); });
    if (!found) return res.status(404).json({ ok: false, error: "Élève introuvable." });
    return res.json({ ok: true, id: found._id, firstName: found.firstName, lastName: found.lastName, classroom: found.classroom });
  } catch (e) { res.status(500).json({ ok: false }); }
});

app.post('/api/verify-answer-ai', async (req, res) => {
  const { question, userAnswer, expectedAnswer, playerId } = req.body;
  if (geminiKey) {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({ model: MODEL_NAME, generationConfig: { responseMimeType: "application/json" } });
      const systemInstruction = `RÔLE : Arbitre de Jeu "Bienveillant". TACHE : Valide phonétique (demografi = correct). FORMAT JSON : { "status": "correct" | "incorrect", "feedback": "...", "corrections": [] }`;
      const result = await model.generateContent([systemInstruction, `Q: ${question}, A attendue: ${expectedAnswer}, R élève: ${userAnswer}`]);
      return res.json(JSON.parse(result.response.text()));
    } catch (error) { console.error(error); }
  }
  res.json({ status: "incorrect", feedback: "Erreur IA" });
});

app.get('/api/players', async (req, res) => { res.json(await Player.find().sort({ lastName: 1 })); });
app.post('/api/reset-player', async (req, res) => { await Player.findByIdAndUpdate(req.body.playerId, { validatedQuestions: [], validatedLevels: [], spellingMistakes: [], activityLogs: [] }); res.json({ok:true}); });
app.post('/api/report-bug', async (req, res) => { const newBug = new Bug(req.body); await newBug.save(); res.json({ok:true}); });
app.get('/api/bugs', async(req,res)=>{ res.json(await Bug.find().sort({date:-1})); });
app.delete('/api/bugs/:id', async(req,res)=>{ await Bug.findByIdAndDelete(req.params.id); res.json({ok:true}); });

app.listen(port, () => { console.log(`✅ Serveur prêt sur le port ${port}`); });