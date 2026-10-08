const express = require('express');
const multer = require('multer');
const fetch = require('node-fetch');
const mongoose = require('mongoose');
const { Student, DilVocabulary } = require('../../prof/models/prof.models');
const AIEngine = require('../../core/ai.engine');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const cleanWord = (value = '') => String(value || '').trim().replace(/\s+/g, ' ').slice(0, 500);
const normalise = (value = '') => cleanWord(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const cleanFocusWords = (value) => (Array.isArray(value) ? value : [])
    .map((word) => cleanWord(word).slice(0, 60))
    .filter((word) => /[\p{L}\p{N}]/u.test(word))
    .filter((word, index, list) => list.findIndex((item) => normalise(item) === normalise(word)) === index)
    .slice(0, 30);

router.get('/:studentId/vocabulary', async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.studentId)) return res.status(400).json({ error: 'Élève invalide.' });
    const words = await DilVocabulary.find({ studentId: req.params.studentId }).sort({ wrongCount: -1, correctCount: 1, createdAt: -1 }).lean();
    res.json(words);
});

router.post('/:studentId/vocabulary', async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.studentId)) return res.status(400).json({ error: 'Élève invalide.' });
    const french = cleanWord(req.body?.french);
    // Les professeurs peuvent ajouter un mot ou une expression de français à
    // apprendre : dans ce cas il n'y a pas de traduction imposée et l'entrée
    // est volontairement conservée telle quelle des deux côtés.
    const spanish = cleanWord(req.body?.spanish) || french;
    const focusWords = cleanFocusWords(req.body?.focusWords);
    const exerciseType = req.body?.exerciseType === 'correction' ? 'correction' : 'vocabulary';
    const incorrectSentence = exerciseType === 'correction' ? cleanWord(req.body?.incorrectSentence) : '';
    const incorrectWords = exerciseType === 'correction' ? cleanFocusWords(req.body?.incorrectWords) : [];
    if (!french || !spanish || !/[\p{L}]/u.test(french)) return res.status(400).json({ error: 'Mot à traduire invalide.' });
    const student = await Student.findById(req.params.studentId, '_id isDil').lean();
    if (!student) return res.status(404).json({ error: 'Élève introuvable.' });
    const existing = await DilVocabulary.findOne({ studentId: student._id, french: new RegExp(`^${french.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
    if (existing) {
        existing.spanish = spanish;
        existing.focusWords = focusWords;
        existing.exerciseType = exerciseType;
        existing.incorrectSentence = incorrectSentence;
        existing.incorrectWords = incorrectWords;
        await existing.save();
        return res.json(existing);
    }
    res.status(201).json(await DilVocabulary.create({ studentId: student._id, french, spanish, focusWords, exerciseType, incorrectSentence, incorrectWords }));
});

router.post('/:studentId/correct-expression', async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.studentId)) return res.status(400).json({ error: 'Élève invalide.' });
    const incorrectSentence = String(req.body?.incorrectSentence || '').trim().replace(/\s+/g, ' ').slice(0, 500);
    if (!incorrectSentence || !/[\p{L}]/u.test(incorrectSentence)) return res.status(400).json({ error: 'Écris une expression à corriger.' });
    const student = await Student.findById(req.params.studentId, '_id currentClass').lean();
    if (!student) return res.status(404).json({ error: 'Élève introuvable.' });
    try {
        const raw = await AIEngine.ask(
            `Corrige uniquement l’orthographe, la grammaire et la ponctuation de cette expression française. Garde le sens et le style de l’élève. N’ajoute aucune information.\nExpression : ${incorrectSentence}`,
            'Tu es un correcteur de français bienveillant. Réponds uniquement en JSON strict au format {"correction":"expression corrigée"}.',
            { route: 'eleve-dil', feature: 'french-expression-correction', temperature: 0, maxOutputTokens: 300, responseMimeType: 'application/json' }
        );
        const parsed = AIEngine.sanitizeJSON(raw);
        const corrected = String(parsed?.correction || '').trim().replace(/\s+/g, ' ').slice(0, 500);
        if (!corrected || !/[\p{L}]/u.test(corrected)) return res.status(502).json({ error: 'Le correcteur n’a pas fourni de correction exploitable.' });
        let pair = await DilVocabulary.findOne({ studentId: student._id, exerciseType: 'correction', incorrectSentence });
        if (pair) {
            pair.french = corrected;
            pair.spanish = corrected;
            pair.focusWords = [];
            pair.incorrectWords = [];
        } else {
            pair = new DilVocabulary({ studentId: student._id, french: corrected, spanish: corrected, exerciseType: 'correction', incorrectSentence, focusWords: [], incorrectWords: [] });
        }
        await pair.save();
        return res.json({ pair, corrected });
    } catch (error) {
        console.error('[DIL français] Correction IA impossible:', error?.message || error);
        return res.status(502).json({ error: 'La correction IA est momentanément indisponible.' });
    }
});

router.delete('/:studentId/vocabulary/:wordId', async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.studentId) || !mongoose.Types.ObjectId.isValid(req.params.wordId)) {
        return res.status(400).json({ error: 'Mot ou élève invalide.' });
    }
    await DilVocabulary.deleteOne({ _id: req.params.wordId, studentId: req.params.studentId });
    res.json({ ok: true });
});

router.post('/:studentId/answer', async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.studentId)) return res.status(400).json({ error: 'Élève invalide.' });
    const word = await DilVocabulary.findOne({ _id: req.body?.wordId, studentId: req.params.studentId });
    if (!word) return res.status(404).json({ error: 'Mot introuvable.' });
    const correct = normalise(req.body?.answer) === normalise(word.french);
    if (correct) {
        word.correctCount = Number(word.correctCount || 0) + 1;
        word.correctStreak = Number(word.correctStreak || 0) + 1;
        word.mastered = Number(word.correctStreak || 0) >= 4;
        word.lastCorrectAt = new Date();
    } else {
        word.wrongCount = Number(word.wrongCount || 0) + 1;
        word.correctStreak = 0;
        word.mastered = false;
    }
    await word.save();
    res.json({ correct, word });
});

// OCR.Space propose une offre gratuite. La clé de démonstration est volontairement
// limitée : une clé propre peut être fournie dans OCR_SPACE_API_KEY sans changer l'UI.
router.post('/:studentId/ocr', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Photo manquante.' });
    try {
        const body = new URLSearchParams({
            apikey: String(process.env.OCR_SPACE_API_KEY || 'helloworld'),
            language: 'fre',
            isOverlayRequired: 'true',
            scale: 'true',
            detectOrientation: 'true',
            base64Image: `data:${req.file.mimetype || 'image/jpeg'};base64,${req.file.buffer.toString('base64')}`
        });
        const response = await fetch('https://api.ocr.space/parse/image', { method: 'POST', body });
        const data = await response.json().catch(() => ({}));
        const text = (data?.ParsedResults || []).map((row) => row?.ParsedText || '').join('\n').trim();
        if (!response.ok || !text) throw new Error(data?.ErrorMessage?.join(' ') || 'Aucun texte lisible trouvé.');
        const lines = (data?.ParsedResults || []).flatMap((result) => (result?.TextOverlay?.Lines || []).map((line) => ({
            text: String(line?.LineText || '').trim(),
            height: Number(line?.MaxHeight || 0),
            top: Number(line?.MinTop || 0)
        }))).filter((line) => line.text);
        res.json({ text: text.slice(0, 30000), lines });
    } catch (error) {
        res.status(502).json({ error: error.message || 'OCR indisponible. Saisis le texte manuellement.' });
    }
});

router.get('/translate/fr-es', async (req, res) => {
    const french = cleanWord(req.query?.q);
    if (!french) return res.status(400).json({ error: 'Mot manquant.' });
    try {
        const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(french)}&langpair=fr|es`);
        const data = await response.json().catch(() => ({}));
        const spanish = cleanWord(data?.responseData?.translatedText);
        if (!response.ok || !spanish) throw new Error('Traduction indisponible.');
        res.json({ french, spanish });
    } catch (error) {
        res.status(502).json({ error: error.message || 'Traduction indisponible.' });
    }
});

router.get('/translate/es-fr', async (req, res) => {
    const spanish = cleanWord(req.query?.q);
    if (!spanish) return res.status(400).json({ error: 'Mot manquant.' });
    try {
        const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(spanish)}&langpair=es|fr`);
        const data = await response.json().catch(() => ({}));
        const french = cleanWord(data?.responseData?.translatedText);
        if (!response.ok || !french) throw new Error('Traduction indisponible.');
        res.json({ french, spanish });
    } catch (error) {
        res.status(502).json({ error: error.message || 'Traduction indisponible.' });
    }
});

module.exports = router;
