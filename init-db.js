const mongoose = require('mongoose');
require('dotenv').config();

// --- DÉFINITION RAPIDE DES SCHÉMAS POUR LE SCRIPT ---
const PlayerSchema = new mongoose.Schema({
  firstName: String, lastName: String, classroom: String, email: String,
  validatedQuestions: [String], validatedLevels: [], spellingMistakes: [],
  created_at: { type: Date, default: Date.now }
});

const TeacherSchema = new mongoose.Schema({
    firstName: String, lastName: String, password: String, subject: String,
    role: { type: String, default: "prof" }, createdAt: { type: Date, default: Date.now }
});

const ChapterSchema = new mongoose.Schema({
    title: String, subject: String, isArchived: Boolean, classroom: String
});

const ScanSessionSchema = new mongoose.Schema({
    title: String, classroom: String, chapterId: mongoose.Schema.Types.ObjectId,
    questionUrls: [String], copyUrls: [String], teacherInstruction: String,
    createdAt: { type: Date, default: Date.now }
});

const GameLevelSchema = new mongoose.Schema({
    title: String, targetGrade: String, classroom: String, questions: Array,
    chapterId: mongoose.Schema.Types.ObjectId, createdAt: { type: Date, default: Date.now }
});

const HomeworkSchema = new mongoose.Schema({
    title: String, classroom: String, targetGrade: String, levels: Array,
    chapterId: mongoose.Schema.Types.ObjectId, date: { type: Date, default: Date.now }
});

// --- MODÈLES ---
const Player = mongoose.models.Player || mongoose.model('Player', PlayerSchema, 'players');
const Teacher = mongoose.models.Teacher || mongoose.model('Teacher', TeacherSchema, 'teachers');
const Chapter = mongoose.models.Chapter || mongoose.model('Chapter', ChapterSchema, 'chapters');
const ScanSession = mongoose.models.ScanSession || mongoose.model('ScanSession', ScanSessionSchema, 'scansessions');
const GameLevel = mongoose.models.GameLevel || mongoose.model('GameLevel', GameLevelSchema, 'gamelevels');
const Homework = mongoose.models.Homework || mongoose.model('Homework', HomeworkSchema, 'homeworks');

// --- DONNÉES ---
const mainTeacher = { firstName: "Jean", lastName: "Vuillet", password: "Clemenceau1919", subject: "Histoire Géo", role: "prof" };

const players = [
    { firstName: 'Gael', lastName: 'Barbier Durango', classroom: '6D' },
    { firstName: 'Eleve', lastName: 'Test', classroom: '6D' },
    { firstName: 'Arthur', lastName: 'Rimbaud', classroom: '2A' },
    { firstName: 'Victor', lastName: 'Hugo', classroom: '5B' }
];

async function initializeDatabase() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ BDD Connectée.');

    // 1. PROF & ÉLÈVES
    await Teacher.findOneAndUpdate({ firstName: "Jean" }, mainTeacher, { upsert: true });
    for (const p of players) {
        await Player.findOneAndUpdate({ firstName: p.firstName, lastName: p.lastName }, p, { upsert: true });
    }
    console.log('👥 Prof et Élèves : OK');

    // 2. CHAPITRES (Dossiers)
    // On crée un dossier pour la 6D
    let chap6D = await Chapter.findOne({ title: "La Rome Antique", classroom: "6D" });
    if (!chap6D) {
        chap6D = await Chapter.create({ title: "La Rome Antique", subject: "H", classroom: "6D", isArchived: false });
    }
    
    // On crée un dossier pour la 5B
    let chap5B = await Chapter.findOne({ title: "Changement Climatique", classroom: "5B" });
    if (!chap5B) {
        chap5B = await Chapter.create({ title: "Changement Climatique", subject: "G", classroom: "5B", isArchived: false });
    }
    console.log('📁 Chapitres : OK');

    // 3. ACTIVITÉS (Jeu et Devoir) liés au chapitre 6D
    const existingGame = await GameLevel.findOne({ title: "Quiz Rome" });
    if (!existingGame) {
        await GameLevel.create({
            title: "Quiz Rome", classroom: "6D", targetGrade: "6e", chapterId: chap6D._id,
            questions: [{ q: "Qui est le premier empereur ?", options: ["Auguste", "César", "Néron", "Trajan"], a: 0 }]
        });
    }

    const existingHW = await Homework.findOne({ title: "Rédaction César" });
    if (!existingHW) {
        await Homework.create({
            title: "Rédaction César", classroom: "6D", targetGrade: "6e", chapterId: chap6D._id,
            levels: [{ instruction: "Raconte la guerre des Gaules.", attachmentUrls: [] }]
        });
    }
    console.log('⚡ Activités : OK');

    // 4. SCANS (Productions)
    const existingScan = await ScanSession.findOne({ title: "Travaux_Groupe_1" });
    if (!existingScan) {
        await ScanSession.create({
            title: "Travaux_Groupe_1", classroom: "6D", chapterId: chap6D._id,
            teacherInstruction: "Vérifier la syntaxe."
        });
    }
    console.log('📸 Scans : OK');

    console.log('✨ Base de données HYDRATÉE avec succès !');
  } catch (err) { console.error(err); } 
  finally { mongoose.disconnect(); }
}
initializeDatabase();