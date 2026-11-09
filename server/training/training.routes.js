const express = require('express');
const multer = require('multer');
const TrainingConfig = require('../models/TrainingConfig');
const AIEngine = require('../core/ai.engine');

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024, files: 20 }
});
const CONFIG_KEY = 'fifth-grade-map-attributes-v1';
const SCALE_CONFIG_KEY = 'fifth-grade-geographic-scales-v1';
const CURVE_CONFIG_KEY = 'fifth-grade-demographic-curves-v1';
const RQP_OFF_TOPIC_CONFIG_KEY = 'rqp-off-topic-v1';

const imageUrlMap = (document, route) => Object.fromEntries(
    (document?.images || []).map((image) => [image.id, `/api/training-config/${route}/image/${encodeURIComponent(image.id)}`])
);

router.get('/fifth-grade-map', async (_req, res) => {
    try {
        const document = await TrainingConfig.findOne({ key: CONFIG_KEY }).select('model images.id images.name updatedAt').lean();
        if (!document) return res.json({ model: null, imageUrls: {}, updatedAt: null });
        const imageUrls = Object.fromEntries((document.images || []).map((image) => [image.id, `/api/training-config/fifth-grade-map/image/${encodeURIComponent(image.id)}`]));
        return res.json({ model: document.model || null, imageUrls, updatedAt: document.updatedAt || null });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/fifth-grade-map/image/:id', async (req, res) => {
    try {
        const document = await TrainingConfig.findOne({ key: CONFIG_KEY }).select('images').lean();
        const image = (document?.images || []).find((entry) => entry.id === req.params.id);
        if (!image) return res.status(404).end();
        res.setHeader('Content-Type', image.contentType || 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=300');
        const data = Buffer.isBuffer(image.data) ? image.data : Buffer.from(image.data?.buffer || image.data || []);
        return res.send(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.put('/fifth-grade-map', upload.array('images', 20), async (req, res) => {
    try {
        const model = JSON.parse(String(req.body?.model || '{}'));
        if (!Array.isArray(model.questions)) return res.status(400).json({ error: 'Modèle de cartes invalide.' });
        const images = (req.files || []).map((file) => {
            const separator = file.originalname.indexOf('__');
            const id = separator >= 0 ? file.originalname.slice(0, separator) : file.originalname;
            const name = separator >= 0 ? file.originalname.slice(separator + 2) : file.originalname;
            return { id, name, contentType: file.mimetype || 'image/png', data: file.buffer };
        });
        const document = await TrainingConfig.findOneAndUpdate(
            { key: CONFIG_KEY },
            { $set: { model, images } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        return res.json({ ok: true, updatedAt: document.updatedAt, questions: model.questions.length, images: images.length });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/fifth-grade-scales', async (_req, res) => {
    try {
        const document = await TrainingConfig.findOne({ key: SCALE_CONFIG_KEY }).select('model images.id images.name updatedAt').lean();
        if (!document) return res.json({ model: null, imageUrls: {}, updatedAt: null });
        return res.json({ model: document.model || null, imageUrls: imageUrlMap(document, 'fifth-grade-scales'), updatedAt: document.updatedAt || null });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/fifth-grade-scales/image/:id', async (req, res) => {
    try {
        const document = await TrainingConfig.findOne(
            { key: SCALE_CONFIG_KEY, 'images.id': req.params.id },
            { images: { $elemMatch: { id: req.params.id } } }
        ).lean();
        const image = (document?.images || []).find((entry) => entry.id === req.params.id);
        if (!image) return res.status(404).end();
        res.setHeader('Content-Type', image.contentType || 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=300');
        const data = Buffer.isBuffer(image.data) ? image.data : Buffer.from(image.data?.buffer || image.data || []);
        return res.send(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.put('/fifth-grade-scales', upload.array('images', 50), async (req, res) => {
    try {
        const model = JSON.parse(String(req.body?.model || '{}'));
        if (!Array.isArray(model.questions)) return res.status(400).json({ error: "Modèle d'échelles invalide." });
        const images = (req.files || []).map((file) => {
            const separator = file.originalname.indexOf('__');
            const id = separator >= 0 ? file.originalname.slice(0, separator) : file.originalname;
            const name = separator >= 0 ? file.originalname.slice(separator + 2) : file.originalname;
            return { id, name, contentType: file.mimetype || 'image/png', data: file.buffer };
        });
        const document = await TrainingConfig.findOneAndUpdate(
            { key: SCALE_CONFIG_KEY },
            { $set: { model, images } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        return res.json({ ok: true, updatedAt: document.updatedAt, questions: model.questions.length, images: images.length });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/fifth-grade-curves', async (_req, res) => {
    try {
        const document = await TrainingConfig.findOne({ key: CURVE_CONFIG_KEY }).select('model images.id images.name updatedAt').lean();
        if (!document) return res.json({ model: null, imageUrls: {}, updatedAt: null });
        return res.json({ model: document.model || null, imageUrls: imageUrlMap(document, 'fifth-grade-curves'), updatedAt: document.updatedAt || null });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/fifth-grade-curves/image/:id', async (req, res) => {
    try {
        const document = await TrainingConfig.findOne({ key: CURVE_CONFIG_KEY }).select('images').lean();
        const image = (document?.images || []).find((entry) => entry.id === req.params.id);
        if (!image) return res.status(404).end();
        res.setHeader('Content-Type', image.contentType || 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=300');
        const data = Buffer.isBuffer(image.data) ? image.data : Buffer.from(image.data?.buffer || image.data || []);
        return res.send(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.put('/fifth-grade-curves', upload.array('images', 50), async (req, res) => {
    try {
        const model = JSON.parse(String(req.body?.model || '{}'));
        if (!Array.isArray(model.questions)) return res.status(400).json({ error: 'Modèle de courbes invalide.' });
        const images = (req.files || []).map((file) => {
            const separator = file.originalname.indexOf('__');
            const id = separator >= 0 ? file.originalname.slice(0, separator) : file.originalname;
            const name = separator >= 0 ? file.originalname.slice(separator + 2) : file.originalname;
            return { id, name, contentType: file.mimetype || 'image/png', data: file.buffer };
        });
        const document = await TrainingConfig.findOneAndUpdate(
            { key: CURVE_CONFIG_KEY },
            { $set: { model, images } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        return res.json({ ok: true, updatedAt: document.updatedAt, questions: model.questions.length, images: images.length });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

// The RQP "hors-sujet" calibration used to live only in the teacher's
// localStorage.  Keeping it here makes the exercises available to every
// student account, independently of the browser used by the teacher.
const cleanOffTopicParagraphs = (paragraphs) => {
    if (!Array.isArray(paragraphs) || paragraphs.length === 0) return null;
    return paragraphs.slice(0, 12).map((entry, index) => ({
        id: String(entry?.id || `paragraph-${index + 1}`).slice(0, 100),
        subject: String(entry?.subject || '').trim().slice(0, 2000),
        sourceText: String(entry?.sourceText ?? entry?.text ?? '').slice(0, 12000),
        explanation: String(entry?.explanation || '').trim().slice(0, 4000)
    }));
};

router.get('/rqp-off-topic', async (_req, res) => {
    try {
        const document = await TrainingConfig.findOne({ key: RQP_OFF_TOPIC_CONFIG_KEY }).select('model updatedAt').lean();
        return res.json({ model: document?.model || null, updatedAt: document?.updatedAt || null });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.put('/rqp-off-topic', async (req, res) => {
    try {
        const paragraphs = cleanOffTopicParagraphs(req.body?.model?.paragraphs ?? req.body?.paragraphs);
        if (!paragraphs) return res.status(400).json({ error: 'Calibrage hors-sujet invalide.' });
        const model = { paragraphs };
        const document = await TrainingConfig.findOneAndUpdate(
            { key: RQP_OFF_TOPIC_CONFIG_KEY },
            { $set: { model } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        return res.json({ ok: true, model, updatedAt: document.updatedAt, paragraphs: paragraphs.length });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

const cleanRqpText = (value, max = 30000) => String(value || '').trim().slice(0, max);
const splitRqpSheetParagraphs = (sheet) => {
    const blocks = String(sheet || '').replace(/\r/g, '').split(/\n\s*\n+/).map((block) => block.trim()).filter(Boolean);
    const paragraphs = blocks.flatMap((block) => block.length > 900
        ? block.split(/\n+/).map((line) => line.trim()).filter(Boolean)
        : [block]);
    return paragraphs.map((text, index) => ({ id: `p${index + 1}`, text: cleanRqpText(text, 1400) }));
};
const askRqpQwen = async (prompt, maxOutputTokens = 3000) => {
    const raw = await AIEngine.ask(prompt, 'Tu es un professeur d’histoire-géographie bienveillant de seconde. Tu valorises le raisonnement historique : une connaissance est pertinente si l’élève établit un lien causal historiquement plausible avec le sujet, même indirect, ou s’il l’utilise intelligemment comme nuance, limite ou ouverture. Tu distingues cette démarche d’un rapprochement artificiel. Réponds en JSON strict, sans markdown.', {
        provider: 'groq', temperature: 0.1, maxOutputTokens, responseMimeType: 'application/json'
    });
    const parsed = AIEngine.sanitizeJSON(raw);
    if (!parsed) throw new Error('Réponse Qwen illisible');
    return parsed;
};

router.post('/rqp-relevance/generate', async (req, res) => {
    try {
        const sheet = cleanRqpText(req.body?.sheet);
        if (sheet.length < 180) return res.status(400).json({ error: 'Colle une fiche de révision plus complète.' });
        const points = splitRqpSheetParagraphs(sheet);
        if (points.length < 2) return res.status(400).json({ error: 'Sépare ta fiche en plusieurs paragraphes avant de commencer.' });
        const parsed = await askRqpQwen(`FICHE DE L'ÉLÈVE:\n${sheet}\n\nCrée exactement 3 sujets de RQP faciles, adaptés à une classe de seconde. Chaque sujet doit être une question claire qui contient explicitement les deux axes du plan grâce à « et », « tout en » ou « comment... pour... ». L'élève doit pouvoir répondre avec une partie des connaissances de la fiche, tandis que d'autres paragraphes seront hors sujet. Ne demande jamais de réciter tout le chapitre et ne propose ni plan, ni connaissances, ni correction. Exemples de forme attendue : « Comment la romanisation transforme-t-elle l'Empire romain et quelles sont ses limites ? » ; « Comment Auguste profite-t-il d'un contexte favorable à la paix pour imposer son pouvoir ? ». Format strict : {"sheetTitle":"...","subjects":[{"question":"..."},{"question":"..."},{"question":"..."}]}.`);
        const subjects = (Array.isArray(parsed.subjects) ? parsed.subjects : []).slice(0, 3).map((subject, subjectIndex) => ({
            id: `s${subjectIndex + 1}`,
            question: cleanRqpText(subject?.question, 500),
            points: points.map((point) => ({ id: `s${subjectIndex + 1}-${point.id}`, text: point.text }))
        })).filter((subject) => subject.question);
        if (!subjects.length) throw new Error('Aucun sujet exploitable généré');
        return res.json({ sheetTitle: cleanRqpText(parsed.sheettitle || 'Fiche de révision', 200), subjects, model: 'Qwen via Groq' });
    } catch (error) {
        return res.status(502).json({ error: error.message || 'Qwen ne répond pas.' });
    }
});

router.post('/rqp-relevance/evaluate', async (req, res) => {
    try {
        const sheet = cleanRqpText(req.body?.sheet);
        const subject = cleanRqpText(req.body?.subject, 700);
        const points = Array.isArray(req.body?.points) ? req.body.points.slice(0, 80) : [];
        const choices = req.body?.choices && typeof req.body.choices === 'object' ? req.body.choices : {};
        const parsed = await askRqpQwen(`FICHE:\n${sheet}\nSUJET:\n${subject}\nPOINTS ET CHOIX DE L'ÉLÈVE (in=sélectionné comme utile, out=non sélectionné):\n${JSON.stringify(points.map((point) => ({ id: point.id, text: point.text, choice: choices[point.id], explanation: req.body?.justifications?.[point.id] || '' })))}\n\nÉvalue avec souplesse mais rigueur. Accepte un élément qui répond directement au sujet, mais aussi un lien indirect explicitement justifié et historiquement plausible (cause, conséquence, nuance, limite, introduction ou ouverture). Exemple : la romanisation peut favoriser la Pax Romana en créant des références communes et en limitant certaines tensions, même si elle n'explique pas seule la paix. Conteste seulement les choix réellement incohérents, anachroniques ou sans lien explicable. Ne révèle pas encore la bonne réponse. Retourne uniquement les identifiants contestés: {"disagreements":[{"pointId":"...","request":"Demande une justification historique précise et encourageante."}]}.`);
        const validIds = new Set(points.map((point) => String(point.id)));
        const disagreements = (Array.isArray(parsed.disagreements) ? parsed.disagreements : []).filter((item) => validIds.has(String(item?.pointid || item?.pointId))).map((item) => ({
            pointId: String(item.pointid || item.pointId), request: cleanRqpText(item.request || 'Justifie ton choix en le reliant précisément au sujet.', 500)
        }));
        return res.json({ disagreements });
    } catch (error) {
        return res.status(502).json({ error: error.message || 'Évaluation indisponible.' });
    }
});

router.post('/rqp-relevance/verdict', async (req, res) => {
    try {
        const sheet = cleanRqpText(req.body?.sheet);
        const subject = cleanRqpText(req.body?.subject, 700);
        const points = Array.isArray(req.body?.points) ? req.body.points.slice(0, 80) : [];
        const choices = req.body?.choices && typeof req.body.choices === 'object' ? req.body.choices : {};
        const justifications = req.body?.justifications && typeof req.body.justifications === 'object' ? req.body.justifications : {};
        const parsed = await askRqpQwen(`FICHE:\n${sheet}\nSUJET:\n${subject}\nTRAVAIL:\n${JSON.stringify(points.map((point) => ({ id: point.id, text: point.text, choice: choices[point.id], justification: justifications[point.id] || '' })))}\n\nDonne le verdict final pour chaque point. expected vaut in si la connaissance peut contribuer à la réponse directement ou grâce à une justification causale historiquement plausible ; accepte aussi une nuance, une limite ou une ouverture clairement annoncée. expected vaut out seulement si le lien reste artificiel, erroné ou anachronique. Une justification solide doit donc pouvoir faire reconnaître la pertinence d'un élément élaboré. Format: {"verdicts":[{"pointId":"...","correct":true,"expected":"in","feedback":"explication brève et pédagogique"}],"advice":"conseil général"}.`);
        const validIds = new Set(points.map((point) => String(point.id)));
        const verdicts = (Array.isArray(parsed.verdicts) ? parsed.verdicts : []).filter((item) => validIds.has(String(item?.pointid || item?.pointId))).map((item) => ({
            pointId: String(item.pointid || item.pointId), correct: Boolean(item.correct), expected: String(item.expected) === 'out' ? 'out' : 'in', feedback: cleanRqpText(item.feedback, 600)
        }));
        return res.json({ verdicts, advice: cleanRqpText(parsed.advice, 1000) });
    } catch (error) {
        return res.status(502).json({ error: error.message || 'Verdict indisponible.' });
    }
});


// ─── DNB Document-method calibration (description d'image / présentation) ────
// Previously saved only in the teacher's localStorage + IndexedDB.
// These routes persist the model and images in MongoDB so every student
// account (and every browser) always sees the latest calibration.

const ALLOWED_DOC_METHOD_TYPES = ['image', 'presentation'];

const DOC_METHOD_CONFIG_KEY = (type) => `dnb-doc-method-${type}-v1`;

const cleanDocMethodExercise = (exercise, index) => ({
    id: String(exercise?.id || `exercise-${index + 1}`).slice(0, 120),
    imageKey: String(exercise?.imageKey || '').slice(0, 200),
    imageName: String(exercise?.imageName || '').slice(0, 200),
    imageKey2: String(exercise?.imageKey2 || '').slice(0, 200),
    imageName2: String(exercise?.imageName2 || '').slice(0, 200),
    correction: String(exercise?.correction || '').slice(0, 6000),
    expected: Object.fromEntries(
        Object.entries(exercise?.expected || {}).map(([k, v]) => [
            String(k).slice(0, 60),
            String(v || '').slice(0, 2000)
        ])
    )
});

const cleanDocMethodModel = (raw) => ({
    videoUrl: String(raw?.videoUrl || '').slice(0, 500),
    sheetKey: String(raw?.sheetKey || '').slice(0, 200),
    sheetName: String(raw?.sheetName || '').slice(0, 200),
    sheetMime: String(raw?.sheetMime || '').slice(0, 100),
    exercises: Array.isArray(raw?.exercises)
        ? raw.exercises.slice(0, 30).map(cleanDocMethodExercise)
        : []
});

// GET model + image URL map
router.get('/dnb-doc-method/:type', async (req, res) => {
    const { type } = req.params;
    if (!ALLOWED_DOC_METHOD_TYPES.includes(type)) return res.status(400).json({ error: 'Type invalide.' });
    try {
        const document = await TrainingConfig.findOne({ key: DOC_METHOD_CONFIG_KEY(type) })
            .select('model images.id images.name updatedAt').lean();
        if (!document) return res.json({ model: null, imageUrls: {}, updatedAt: null });
        const imageUrls = Object.fromEntries(
            (document.images || []).map((img) => [
                img.id,
                `/api/training-config/dnb-doc-method/${type}/image/${encodeURIComponent(img.id)}`
            ])
        );
        return res.json({ model: document.model || null, imageUrls, updatedAt: document.updatedAt || null });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

// GET single image
router.get('/dnb-doc-method/:type/image/:id', async (req, res) => {
    const { type, id } = req.params;
    if (!ALLOWED_DOC_METHOD_TYPES.includes(type)) return res.status(400).json({ error: 'Type invalide.' });
    try {
        const document = await TrainingConfig.findOne({ key: DOC_METHOD_CONFIG_KEY(type) }).select('images').lean();
        const image = (document?.images || []).find((entry) => entry.id === id);
        if (!image) return res.status(404).end();
        res.setHeader('Content-Type', image.contentType || 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=300');
        const data = Buffer.isBuffer(image.data) ? image.data : Buffer.from(image.data?.buffer || image.data || []);
        return res.send(data);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

// PUT model + images (multipart: field "model" JSON + files named "<imageKey>__<originalName>")
router.put('/dnb-doc-method/:type', upload.array('images', 50), async (req, res) => {
    const { type } = req.params;
    if (!ALLOWED_DOC_METHOD_TYPES.includes(type)) return res.status(400).json({ error: 'Type invalide.' });
    try {
        const raw = JSON.parse(String(req.body?.model || '{}'));
        const model = cleanDocMethodModel(raw);
        const images = (req.files || []).map((file) => {
            const separator = file.originalname.indexOf('__');
            const id = separator >= 0 ? file.originalname.slice(0, separator) : file.originalname;
            const name = separator >= 0 ? file.originalname.slice(separator + 2) : file.originalname;
            return { id, name, contentType: file.mimetype || 'image/png', data: file.buffer };
        });
        const document = await TrainingConfig.findOneAndUpdate(
            { key: DOC_METHOD_CONFIG_KEY(type) },
            { $set: { model, images } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        const imageUrls = Object.fromEntries(
            images.map((img) => [
                img.id,
                `/api/training-config/dnb-doc-method/${type}/image/${encodeURIComponent(img.id)}`
            ])
        );
        return res.json({ ok: true, updatedAt: document.updatedAt, exercises: model.exercises.length, images: images.length, imageUrls });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

module.exports = router;
