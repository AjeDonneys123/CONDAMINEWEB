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

mongoose.connect(mongoUri).then(() => console.log('✅ MongoDB Connecté'));

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
  levelsResults: [{ levelIndex: Number, userText: String, userImageUrl: String, aiFeedback: String, teacherFeedback: String, grade: String }],
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

// ROUTES
app.post('/api/analyze-homework', async (req, res) => {
    const { imageUrl, userText, homeworkInstruction, classroom, playerId, homeworkId, levelIndex } = req.body;
    try {
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: MODEL_NAME, generationConfig: { responseMimeType: "application/json" } });
        
        const systemPrompt = `RÔLE: Professeur de français. CIBLE: ${classroom}.
        TACHE: Analyse le fond de la réponse et l'orthographe.
        
        INSTRUCTIONS DE SORTIE (IMPORTANT) :
        1. "content_feedback": Rédige un commentaire pédagogique complet en HTML. S'il y a des fautes, ajoute obligatoirement à la fin de ton commentaire un titre "Analyse Orthographique" et un tableau HTML <table class="correction-table"> avec 3 colonnes: Mot faux (rouge/barré), Correction (vert), Règle précise.
        2. "corrections": Liste JSON des objets {wrong, correct, reason}.
        
        JSON: { "content_feedback": "TEXTE HTML ICI", "grade": "xx/20", "corrections": [...] }`;

        let parts = [{ text: systemPrompt }, { text: `CONSIGNE: ${homeworkInstruction}` }, { text: `ÉLÈVE: ${userText}` }];
        if (imageUrl) { const p = await fileToPart(imageUrl); if(p) parts.push(p); }
        
        const result = await model.generateContent(parts);
        const json = JSON.parse(result.response.text());

        if (playerId && json.corrections?.length > 0) {
            await Player.findByIdAndUpdate(playerId, { 
                $push: { spellingMistakes: { $each: json.corrections.map(c => ({ 
                    wrong: c.wrong, correct: c.correct, reason: c.reason || "Grammaire", date: new Date() 
                })) } } 
            });
        }
        
        if (playerId && homeworkId) {
            const resObj = { levelIndex: levelIndex||0, userText, userImageUrl: imageUrl, aiFeedback: json.content_feedback, grade: json.grade||"A valider" };
            const sub = await Submission.findOne({ homeworkId, playerId });
            if (sub) { 
                const idx = sub.levelsResults.findIndex(r => r.levelIndex === resObj.levelIndex); 
                if (idx > -1) sub.levelsResults[idx] = resObj; else sub.levelsResults.push(resObj); 
                sub.submittedAt = Date.now(); await sub.save(); 
            } else { await new Submission({ homeworkId, playerId, classroom, levelsResults: [resObj] }).save(); }
        }

        res.json({ feedback: json.content_feedback, grade: json.grade });
    } catch (e) { res.json({ feedback: "Désolé, l'IA a rencontré une erreur." }); }
});

app.post('/api/verify-answer-ai', async (req, res) => {
  const { question, userAnswer, expectedAnswer, playerId } = req.body;
  try {
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME, generationConfig: { responseMimeType: "application/json" } });
    const prompt = `Arbitre de français. Si "expectedAnswer" est un chiffre, c'est un index d'option.
    SI FAUTES: Produit un feedback HTML incluant un tableau <table class="correction-table">.
    JSON: { "status": "correct"|"incorrect", "feedback": "HTML ICI", "corrections": [{"wrong":"", "correct":"", "reason":""}] }`;
    const result = await model.generateContent([prompt, `Q: ${question}, A: ${expectedAnswer}, R: ${userAnswer}`]);
    const json = JSON.parse(result.response.text());
    if (playerId && json.corrections?.length > 0) {
        await Player.findByIdAndUpdate(playerId, { $push: { spellingMistakes: { $each: json.corrections.map(c => ({ ...c, date: new Date() })) } } });
    }
    res.json(json);
  } catch (e) { res.json({ status: "incorrect" }); }
});

app.post('/api/delete-mistake', async (req, res) => {
    const { playerId, mistakeIndex } = req.body;
    const p = await Player.findById(playerId);
    if(p) { p.spellingMistakes.splice(mistakeIndex, 1); await p.save(); res.json({ok:true}); }
    else res.status(404).json({ok:false});
});

app.post('/api/register', async (req, res) => { 
    const { firstName, lastName, classroom } = req.body; 
    let p = await Player.findOne({ firstName, lastName });
    if (!p) p = new Player({ firstName, lastName, classroom });
    await p.save();
    res.json({ ok: true, id: p._id, firstName, lastName, classroom });
});

app.get('/api/homework/:class', async (req, res) => { 
    const list = await Homework.find({ $or: [{ classroom: req.params.class }, { classroom: "Toutes" }] }).sort({ date: -1 }); 
    res.json(list); 
});

app.get('/api/player-data/:id', async (req, res) => { res.json(await Player.findById(req.params.id)); });
app.get('/api/game-levels/:classroom', async (req, res) => {
    res.json(await GameLevel.find({ $or: [{ classroom: req.params.classroom }, { classroom: "Toutes" }] }).sort({ title: 1 }));
});

app.listen(port, () => console.log(`✅ Serveur prêt port ${port}`));