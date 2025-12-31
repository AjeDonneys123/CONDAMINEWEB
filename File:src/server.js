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

if (!mongoUri) { console.error('❌ ERREUR : MONGODB_URI manquant'); process.exit(1); }

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

mongoose.connect(mongoUri)
  .then(() => console.log('✅ MongoDB Connecté'))
  .catch(err => console.error('❌ Erreur Mongo:', err));

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
  levelsResults: [{
    levelIndex: Number,
    userText: String,
    userImageUrl: String,

    aiFeedback: String,
    aiFeedbackFond: String,
    aiFeedbackForme: String,
    correctedText: String,
    spellingMap: { type: mongoose.Schema.Types.Mixed, default: {} },

    teacherFeedback: String,
    grade: String
  }],
  submittedAt: { type: Date, default: Date.now }
});
const Submission = mongoose.model('Submission', SubmissionSchema, 'submissions');

const BugSchema = new mongoose.Schema({ reporterName: String, classroom: String, description: String, gameChapter: String, date: { type: Date, default: Date.now } });
const Bug = mongoose.model('Bug', BugSchema, 'bugs');

const GameLevelSchema = new mongoose.Schema({
  chapterId: String,
  classroom: String,
  title: String,
  lesson: String,
  questions: Array,
  createdAt: { type: Date, default: Date.now }
});
const GameLevel = mongoose.model('GameLevel', GameLevelSchema, 'game_levels');

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

function safeJsonParse(txt) {
  try { return JSON.parse(txt); } catch(e) { return null; }
}

function normalizeWord(w) {
  return (w || '').toString().trim();
}

function mapToCorrectionsArray(spellingMap) {
  if (!spellingMap || typeof spellingMap != 'object') return [];
  const entries = Object.entries(spellingMap);
  const out = [];
  for (let i = 0; i < entries.length; i++) {
    const wrong = normalizeWord(entries[i][0]);
    const correct = normalizeWord(entries[i][1]);
    if (wrong && correct && wrong.toLowerCase() != correct.toLowerCase()) {
      out.push({ wrong: wrong, correct: correct, date: new Date() });
    }
  }
  return out;
}

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: "Pas de fichier" });
  res.json({ ok: true, imageUrl: req.file.path });
});

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

app.post('/api/generate-game-content', async (req, res) => {
  const { docUrl, topic, gameType } = req.body;

  if (!geminiKey) return res.json({ error: "Clé IA manquante" });

  try {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME, generationConfig: { responseMimeType: "application/json" } });

    let prompt = "";
    if (gameType == "quiz") {
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

    const systemInstruction =
      `RÔLE : Professeur correcteur (FR). CIBLE: ${classroom}. NOTE SUR 20.
Tu corriges le FOND et la FORME.
Tu renvoies uniquement du JSON valide, sans texte autour.

JSON attendu:
{
  "aiFeedbackFond": "HTML",
  "aiFeedbackForme": "HTML",
  "aiFeedback": "HTML (résumé global court)",
  "spellingMap": { "motMalEcrt": "motBienEcrit" },
  "correctedText": "Texte réécrit corrigé",
  "grade": "xx/20"
}

Règles spellingMap:
- uniquement des mots (pas de phrases)
- max 30 entrées
- pas de doublons
`;

    parts.push({ text: systemInstruction });

    if (teacherDocUrls) {
      for (let url of teacherDocUrls) {
        if (url != "BREAK") {
          const p = await fileToPart(url);
          if (p) parts.push(p);
        }
      }
    }

    parts.push({ text: `QUESTION: "${homeworkInstruction || ""}"` });

    if (questionImage) {
      const p = await fileToPart(questionImage);
      if (p) parts.push(p);
    }

    parts.push({ text: `REPONSE ELEVE (texte): "${userText || ""}"` });

    if (imageUrl) {
      const p = await fileToPart(imageUrl);
      if (p) parts.push(p);
    }

    const result = await model.generateContent(parts);
    const raw = result && result.response ? result.response.text() : "";
    const json = safeJsonParse(raw);

    if (!json) {
      return res.json({ feedback: `Erreur: Réponse IA illisible`, grade: "A valider" });
    }

    const aiFeedbackFond = (json.aiFeedbackFond || "").toString();
    const aiFeedbackForme = (json.aiFeedbackForme || "").toString();
    const aiFeedback = (json.aiFeedback || json.content_feedback || "").toString();
    const correctedText = (json.correctedText || "").toString();
    const spellingMap = (json.spellingMap && typeof json.spellingMap == "object") ? json.spellingMap : {};
    const grade = (json.grade || "A valider").toString();

    if (playerId && homeworkId) {
      const lvl = (typeof levelIndex == "number") ? levelIndex : parseInt(levelIndex || "0", 10);

      const newResult = {
        levelIndex: lvl,
        userText: userText,
        userImageUrl: imageUrl,
        aiFeedback: aiFeedback,
        aiFeedbackFond: aiFeedbackFond,
        aiFeedbackForme: aiFeedbackForme,
        correctedText: correctedText,
        spellingMap: spellingMap,
        grade: grade
      };

      const sub = await Submission.findOne({ homeworkId: homeworkId, playerId: playerId });

      if (sub) {
        const idx = sub.levelsResults.findIndex(r => r.levelIndex == newResult.levelIndex);
        if (idx > -1) sub.levelsResults[idx] = newResult;
        else sub.levelsResults.push(newResult);
        sub.submittedAt = Date.now();
        await sub.save();
      } else {
        await new Submission({ homeworkId: homeworkId, playerId: playerId, classroom: classroom, levelsResults: [newResult] }).save();
      }

      const corrections = mapToCorrectionsArray(spellingMap);
      if (corrections.length > 0) {
        await Player.findByIdAndUpdate(playerId, { $push: { spellingMistakes: { $each: corrections } } });
      }

      await Player.findByIdAndUpdate(playerId, {
        $push: {
          activityLogs: {
            action: "homework_ai_correction",
            detail: "Correction IA fond + forme + fautes enregistrées",
            date: new Date()
          }
        }
      });
    }

    res.json({
      feedback: aiFeedback,
      grade: grade,
      aiFeedbackFond: aiFeedbackFond,
      aiFeedbackForme: aiFeedbackForme,
      correctedText: correctedText,
      spellingMap: spellingMap
    });

  } catch (error) {
    res.json({ feedback: `Erreur: ${error.message}`, grade: "A valider" });
  }
});

app.get('/api/submissions/:hwId', async (req, res) => { try { const subs = await Submission.find({ homeworkId: req.params.hwId }).populate('playerId'); res.json(subs); } catch(e) { res.status(500).json([]); } });
app.get('/api/submission-detail/:subId', async (req, res) => { try { const sub = await Submission.findById(req.params.subId).populate('playerId').populate('homeworkId'); res.json(sub); } catch(e) { res.status(500).json(null); } });
app.post('/api/update-correction', async (req, res) => { try { const { subId, levelsResults } = req.body; await Submission.findByIdAndUpdate(subId, { levelsResults }); res.json({ ok: true }); } catch(e) { res.status(500).json({ ok: false }); } });

app.post('/api/register', async (req, res) => {
  try {
    const { firstName, lastName, classroom } = req.body;
    if (!firstName || !lastName || !classroom) return res.status(400).json({ ok: false });

    if(firstName.toLowerCase() == "eleve" && lastName.toLowerCase() == "test") {
      let testPlayer = await Player.findOne({ firstName: "Eleve", lastName: "Test" });
      if (!testPlayer) {
        testPlayer = new Player({ firstName: "Eleve", lastName: "Test", classroom: classroom });
        await testPlayer.save();
      } else {
        testPlayer.classroom = classroom;
        await testPlayer.save();
      }
      return res.json({ ok: true, id: testPlayer._id, firstName: "Eleve", lastName: "Test", classroom: classroom });
    }

    const inputFirst = nameTokens(firstName);
    const inputLast = nameTokens(lastName);
    const normClass = normalizeClassroom(classroom);

    let classes = [normClass];
    if (['2C', '2D'].includes(normClass)) classes = ['2C', '2D', '2CD'];
    if (['6', '6D'].includes(normClass)) classes = ['6', '6D'];

    const all = await Player.find({ classroom: { $in: classes } });
    const found = all.find(p => {
      const dbFirst = nameTokens(p.firstName);
      const dbLast = nameTokens(p.lastName);
      return inputFirst.some(t => dbFirst.includes(t)) && inputLast.some(t => dbLast.includes(t));
    });

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
      const systemInstruction = `RÔLE : Arbitre de Jeu. JSON: { "status": "correct"|"incorrect", "feedback": "...", "corrections": [{"wrong":"", "correct":""}] }`;
      const result = await model.generateContent([systemInstruction, `Q: ${question}, A attendue: ${expectedAnswer}, R élève: ${userAnswer}`]);
      const json = JSON.parse(result.response.text());
      if (playerId && json.corrections && json.corrections.length > 0) {
        await Player.findByIdAndUpdate(playerId, { $push: { spellingMistakes: { $each: json.corrections.map(c => ({ wrong: c.wrong, correct: c.correct, date: new Date() })) } } });
      }
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