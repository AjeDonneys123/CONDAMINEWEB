// @signatures: getImageData, streamToBuffer
const AIEngine = require('../../../core/ai.engine');
const OCREngine = require('../../../core/ocr.engine'); 
const StructureDrive = require('../../structure/experts/structure.drive'); 
const { preprocessForScan, splitIntoZones } = require('./image.preprocess');

const streamToBuffer = async (stream) => {
    const chunks = [];
    return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('error', (err) => reject(err));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
};

const escapeHtml = (s = '') => String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const ensureRedMarkup = (transcription = '', mistakes = []) => {
    const text = String(transcription || '');
    if (text.includes('ai-red-mark')) return text;
    if (!Array.isArray(mistakes) || mistakes.length === 0) return text;
    const fixes = mistakes
        .filter(m => m && (m.wrong || m.correct))
        .slice(0, 8)
        .map(m => {
            const wrong = escapeHtml(String(m.wrong || '').trim() || '...');
            const correct = escapeHtml(String(m.correct || '').trim() || '...');
            return `<span class="ai-red-mark">${wrong} → ${correct}</span>`;
        });
    if (fixes.length === 0) return text;
    return `${text}\n\n${fixes.join(' ')}`;
};

const stripHtml = (html = '') => String(html || '').replace(/<[^>]*>/g, ' ');
const normalizeTxt = (s = '') => String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const tokenize = (s = '') => normalizeTxt(s).split(' ').filter(Boolean);
const weirdTokenRatio = (text = '') => {
    const tokens = tokenize(text);
    if (!tokens.length) return 1;
    let weird = 0;
    tokens.forEach((t) => {
        if (t.length <= 3) return;
        const vowels = (t.match(/[aeiouy]/g) || []).length;
        const hasLongConsonantRun = /[bcdfghjklmnpqrstvwxz]{5,}/.test(t);
        if (vowels === 0 || hasLongConsonantRun) weird += 1;
    });
    return weird / tokens.length;
};
const confidenceLabel = (confidence) => {
    const n = Number(confidence);
    if (!Number.isFinite(n)) return 'unknown';
    if (n >= 0.8) return 'high';
    if (n >= 0.55) return 'medium';
    return 'low';
};

const buildQualityFlags = ({ substitutionRatio, ocrConfidence, literalText }) => {
    const flags = [];
    if (Number.isFinite(substitutionRatio) && substitutionRatio > 0.2) flags.push('HIGH_SUBSTITUTION');
    if (Number.isFinite(ocrConfidence) && ocrConfidence < 0.55) flags.push('LOW_CONFIDENCE_OCR');
    const ilCount = (String(literalText || '').match(/\[illisible\]/gi) || []).length;
    if (ilCount >= 3) flags.push('HEAVY_ILLEGIBLE');
    return flags;
};

const computeSubstitutionRatio = (literalTranscription = '', correctedTranscription = '', spellingMistakes = []) => {
    const literal = tokenize(literalTranscription);
    const corrected = tokenize(stripHtml(correctedTranscription));
    if (!literal.length || !corrected.length) return 0;

    const literalSet = new Set(literal);
    const tolerated = new Set();
    (Array.isArray(spellingMistakes) ? spellingMistakes : []).forEach((m) => {
        const w = tokenize(m?.wrong || '');
        const c = tokenize(m?.correct || '');
        w.forEach(t => tolerated.add(t));
        c.forEach(t => tolerated.add(t));
    });

    let suspicious = 0;
    corrected.forEach((tok) => {
        if (tok.length < 4) return;
        if (!literalSet.has(tok) && !tolerated.has(tok)) suspicious += 1;
    });
    return suspicious / corrected.length;
};
const tokenCount = (s = '') => tokenize(s).length;

const defaultInstructions = `Comprendre le sens réel écrit par l'élève.
Ne pas corriger l'orthographe pour l'instant.
Rester proche des mots visibles de la copie.`;

const clampNum = (n, min, max, fallback) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return fallback;
    return Math.max(min, Math.min(max, v));
};

const cleanModelText = (raw = '') => {
    const txt = String(raw || '').trim();
    if (!txt) return '';
    return txt
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();
};

const toVariant = (label, text) => ({ label, text: String(text || '').trim() });

const parseOrFirstObject = (raw = '') => {
    const parsedRaw = AIEngine.sanitizeJSON(raw);
    return Array.isArray(parsedRaw) ? (parsedRaw[0] || {}) : (parsedRaw || {});
};

const fallbackText = (raw = '', minLen = 20) => {
    const cleaned = cleanModelText(raw);
    return cleaned && cleaned.length >= minLen ? cleaned : '';
};

const normalizeMistakes = (mistakes = []) => (
    Array.isArray(mistakes)
        ? mistakes
            .filter((m) => m && (m.wrong || m.correct))
            .map((m) => ({
                wrong: String(m.wrong || '').trim(),
                correct: String(m.correct || '').trim(),
                context: String(m.context || '').trim()
            }))
        : []
);

const buildCanonicalVariants = ({ literal = '', orthography = '', feedback = '' }) => ({
    literal_final: toVariant('Transcription fidèle', literal),
    orthography_corrected: toVariant('Orthographe corrigée', orthography),
    content_feedback: toVariant('Feedback fond', feedback)
});

const ScanAI = {
    correctCopy: async (copyUrl, subjectUrls, instructions, studentList, options = {}) => {
        const scanAiV2Enabled = String(process.env.SCAN_AI_V2 || 'true').toLowerCase() !== 'false';
        const zoneSplitEnabled = String(process.env.SCAN_ZONE_SPLIT || 'false').toLowerCase() !== 'false';
        const envOcrMode = String(process.env.SCAN_OCR_MODE || '').trim().toLowerCase();
        const defaultOcrMode = envOcrMode || 'none';
        const ocrMode = String(options.ocrMode || defaultOcrMode).toLowerCase(); // none | light | full
        const useOcrHints = ocrMode !== 'none';
        const zoneCount = clampNum(options.zoneCount, 3, 8, 6);
        const upscale = clampNum(options.upscale, 1, 2.3, 2.1);
        const seedTranscription = String(options.seedTranscription || '').trim();
        const threeTabPipelineEnabled = String(process.env.SCAN_THREE_TAB_PIPELINE || 'true').toLowerCase() !== 'false';
        console.log(`👁️ [SCAN-AI] Correction V2=${scanAiV2Enabled ? 'ON' : 'OFF'} (3 passes)...`);

        const rosterText = studentList.map(s => `${s.firstName} ${s.lastName}`).join(', ');

        const extractFileId = (url = '') => {
            const raw = String(url || '');
            const idx = raw.indexOf('/proxy/');
            if (idx === -1) return '';
            return raw.slice(idx + '/proxy/'.length).split('?')[0].split('#')[0].trim();
        };

        const getImageData = async (url) => {
            try {
                const fileId = extractFileId(url);
                if (!fileId) return null;
                const stream = await StructureDrive.getFileStream(fileId);
                const buffer = await streamToBuffer(stream);
                return buffer.toString('base64');
            } catch (e) {
                return null;
            }
        };

        const copyB64 = await getImageData(copyUrl);
        if (!copyB64) return { studentName: "Erreur", grade: "?", appreciation: "Image non chargée" };

        const preprocess = scanAiV2Enabled
            ? await preprocessForScan(copyB64, { upscale })
            : { preprocessedB64: copyB64, meta: { original: {}, preprocessed: {}, ms: 0 }, usedSharp: false };

        const targetForOCR = preprocess?.preprocessedB64 || copyB64;
        const ocrResult = useOcrHints
            ? await OCREngine.extractText(targetForOCR)
            : { success: false, text: '', filteredText: '', confidence: null, wordsCount: 0 };
        const ocrBaseText = String(ocrResult?.filteredText || ocrResult?.text || '').trim();
        const zones = (scanAiV2Enabled && zoneSplitEnabled)
            ? await splitIntoZones(targetForOCR, { zoneCount })
            : [];
        const zoneOcrResults = await Promise.all(
            zones.map(async (z) => {
                if (!useOcrHints) return '';
                const zOcr = await OCREngine.extractText(z.b64);
                return String(zOcr?.filteredText || zOcr?.text || '').trim();
            })
        );
        const zoneTexts = zoneOcrResults.filter(Boolean);
        const zoneLiteralSeed = zoneTexts.join('\n').trim();
        const zoneImageParts = zones
            .filter(z => z?.b64)
            .slice(0, 4)
            .map((z) => ({ inlineData: { mimeType: "image/jpeg", data: z.b64 } }));
        const subjectB64List = await Promise.all((subjectUrls || []).slice(0, 2).map(getImageData));
        const subjectImageParts = subjectB64List
            .filter(Boolean)
            .map((b64) => ({ inlineData: { mimeType: "image/jpeg", data: b64 } }));
        const imagePartsPrimary = [
            { inlineData: { mimeType: "image/jpeg", data: copyB64 } },
            ...(targetForOCR !== copyB64 ? [{ inlineData: { mimeType: "image/jpeg", data: targetForOCR } }] : []),
            ...zoneImageParts
        ];

        const runLegacy = async () => {
            const legacySystem = `Tu es un PROFESSEUR CORRECTEUR francophone.
Mission: corriger la copie en gardant le sens.
Règles:
1) corrections visibles avec <span class="ai-red-mark">...</span>
2) pas d'invention
3) réponse JSON strict:
{
  "studentName":"Nom",
  "grade":"A+, A, B ou C",
  "score20":0,
  "appreciation":"...",
  "transcription":"...",
  "spellingMistakes":[{"wrong":"...","correct":"..."}],
  "questionFeedback":[]
}`;
            const legacyParts = [
                { text: `Consignes prof: "${String(instructions || '').trim()}"` },
                { text: `OCR filtré prioritaire: "${ocrResult.success ? ocrBaseText : 'Non disponible'}"` },
                { text: `OCR complet (secours): "${ocrResult.success ? ocrResult.text : 'Non disponible'}"` },
                ...subjectImageParts,
                { inlineData: { mimeType: "image/jpeg", data: copyB64 } }
            ];
            const legacyRaw = await AIEngine.ask(legacyParts, legacySystem);
            const legacyParsedRaw = AIEngine.sanitizeJSON(legacyRaw);
            const legacyParsed = Array.isArray(legacyParsedRaw) ? (legacyParsedRaw[0] || {}) : (legacyParsedRaw || {});
            const normalizedMistakes = Array.isArray(legacyParsed.spellingMistakes)
                ? legacyParsed.spellingMistakes
                    .filter(m => m && (m.wrong || m.correct))
                    .map(m => ({ wrong: String(m.wrong || '').trim(), correct: String(m.correct || '').trim() }))
                : [];
            return {
                studentName: legacyParsed.studentName || "Inconnu",
                grade: legacyParsed.grade || "B",
                score20: Number.isFinite(Number(legacyParsed.score20)) ? Number(legacyParsed.score20) : null,
                appreciation: legacyParsed.appreciation || "Pas d'avis.",
                transcription: ensureRedMarkup(String(legacyParsed.transcription || "..."), normalizedMistakes),
                literalTranscription: ocrBaseText,
                spellingMistakes: normalizedMistakes,
                questionFeedback: Array.isArray(legacyParsed.questionFeedback) ? legacyParsed.questionFeedback : [],
                transcriptionVariants: buildCanonicalVariants({
                    literal: String(legacyParsed.transcription || ocrBaseText || "..."),
                    orthography: String(legacyParsed.transcription || "..."),
                    feedback: String(legacyParsed.appreciation || "Pas d'avis.")
                }),
                qualityFlags: [],
                ocrConfidence: Number.isFinite(Number(ocrResult.confidence)) ? Number(ocrResult.confidence) : null
            };
        };

        try {
            if (!scanAiV2Enabled || !threeTabPipelineEnabled) return await runLegacy();

            // PASS A - Transcription fidèle
            const passASystem = `Tu es un transcripteur de copies manuscrites françaises.
MISSION: produire une transcription fidèle (pas de correction orthographique).
RÈGLES:
1) Priorité absolue à l'image.
2) OCR seulement comme indice secondaire.
3) Pas de reformulation créative, pas de synonymes.
4) Si mot incertain: [mot?], si illisible: [illisible].
5) Déduis le nom parmi: [${rosterText}].
Réponds en JSON strict:
{
  "studentName":"Nom",
  "literalTranscription":"...",
  "confidence":0.0,
  "uncertainTokens":["..."],
  "illegibleSpans":["..."]
}`;
            const passAParts = [
                { text: `Consignes prof: "${String(instructions || defaultInstructions).trim()}"` },
                ...(seedTranscription ? [{ text: `Candidat base (optionnel): "${seedTranscription}"` }] : []),
                ...(useOcrHints ? [
                    { text: `OCR filtré (indice): "${ocrResult.success ? ocrBaseText : 'Non disponible'}"` },
                    { text: `OCR zones (indice):\n${zoneLiteralSeed || 'non disponible'}` }
                ] : []),
                ...subjectImageParts,
                ...imagePartsPrimary
            ];
            const passARaw = await AIEngine.ask(passAParts, passASystem);
            const passAParsed = parseOrFirstObject(passARaw);
            const passAConfidence = Number.isFinite(Number(passAParsed.confidence)) ? Number(passAParsed.confidence) : null;
            let literalTranscription = String(passAParsed.literalTranscription || '').trim();
            if (!literalTranscription) literalTranscription = fallbackText(passARaw);
            if (!literalTranscription) literalTranscription = String(seedTranscription || zoneLiteralSeed || ocrBaseText || '').trim();
            if (!literalTranscription) literalTranscription = '[illisible]';
            const uncertainTokens = Array.isArray(passAParsed.uncertainTokens) ? passAParsed.uncertainTokens.map((v) => String(v || '').trim()).filter(Boolean) : [];
            const illegibleSpans = Array.isArray(passAParsed.illegibleSpans) ? passAParsed.illegibleSpans.map((v) => String(v || '').trim()).filter(Boolean) : [];
            const studentName = String(passAParsed.studentName || '').trim() || 'Inconnu';

            // PASS B - Orthographe (comparaison fidèle <-> image)
            const passBSystem = `Tu es correcteur orthographique, sans changer le sens.
MISSION: corriger seulement l'orthographe/grammaire de surface à partir de la transcription fidèle et de l'image.
RÈGLES:
1) Ne pas réécrire les idées.
2) Pas de synonymes non nécessaires.
3) Corrections minimales.
Réponds en JSON strict:
{
  "orthographyCorrected":"...",
  "spellingMistakes":[{"wrong":"...","correct":"...","context":"..."}]
}`;
            const passBParts = [
                { text: `Transcription fidèle: "${literalTranscription}"` },
                ...subjectImageParts,
                ...imagePartsPrimary
            ];
            const passBRaw = await AIEngine.ask(passBParts, passBSystem);
            const passBParsed = parseOrFirstObject(passBRaw);
            let orthographyCorrected = String(passBParsed.orthographyCorrected || '').trim();
            if (!orthographyCorrected) orthographyCorrected = fallbackText(passBRaw);
            if (!orthographyCorrected) orthographyCorrected = literalTranscription;
            const spellingMistakes = normalizeMistakes(passBParsed.spellingMistakes);

            // PASS C - Feedback fond par question
            const passCSystem = `Tu es professeur correcteur.
MISSION: donner un feedback de fond par question à partir de la copie et du sujet.
RÈGLES:
1) Ne pas corriger l'orthographe ici.
2) Feedback actionnable, par question.
3) Note lettre: A+, A, B, C.
Réponds en JSON strict:
{
  "appreciation":"...",
  "questionFeedback":["..."],
  "grade":"A+|A|B|C",
  "score20":0
}`;
            const passCParts = [
                { text: `Consignes prof: "${String(instructions || defaultInstructions).trim()}"` },
                { text: `Transcription fidèle: "${literalTranscription}"` },
                { text: `Version orthographe corrigée: "${orthographyCorrected}"` },
                ...subjectImageParts,
                ...imagePartsPrimary
            ];
            const passCRaw = await AIEngine.ask(passCParts, passCSystem);
            const passCParsed = parseOrFirstObject(passCRaw);
            const appreciation = String(passCParsed.appreciation || '').trim() || 'Pas d’avis.';
            const questionFeedback = Array.isArray(passCParsed.questionFeedback)
                ? passCParsed.questionFeedback.map((v) => String(v || '').trim()).filter(Boolean)
                : [];
            const gradeRaw = String(passCParsed.grade || 'B').trim().toUpperCase();
            const grade = ['A+', 'A', 'B', 'C'].includes(gradeRaw) ? gradeRaw : 'B';
            const score20 = Number.isFinite(Number(passCParsed.score20)) ? Number(passCParsed.score20) : null;

            const ocrConfidence = Number.isFinite(Number(ocrResult.confidence))
                ? Number(ocrResult.confidence)
                : passAConfidence;
            const literalNoise = weirdTokenRatio(literalTranscription);
            const literalTokens = tokenCount(literalTranscription);
            const substitutionRatio = computeSubstitutionRatio(literalTranscription, orthographyCorrected, spellingMistakes);
            const qualityFlags = buildQualityFlags({
                substitutionRatio,
                ocrConfidence: Number(ocrConfidence),
                literalText: literalTranscription
            });
            if (literalNoise > 0.22) qualityFlags.push('NOISY_TRANSCRIPTION');
            if (literalTokens < 12) qualityFlags.push('SHORT_TRANSCRIPTION');

            const feedbackText = questionFeedback.length
                ? questionFeedback.map((fb, idx) => `Q${idx + 1}. ${fb}`).join('\n')
                : appreciation;
            const transcriptionVariants = buildCanonicalVariants({
                literal: literalTranscription,
                orthography: orthographyCorrected,
                feedback: feedbackText
            });

            const logPayload = {
                usedSharp: Boolean(preprocess?.usedSharp),
                preprocessMs: preprocess?.meta?.ms || 0,
                originalSize: preprocess?.meta?.original?.size || 0,
                preprocessedSize: preprocess?.meta?.preprocessed?.size || 0,
                ocrWords: ocrResult.wordsCount || 0,
                ocrConfidence: Number.isFinite(Number(ocrConfidence)) ? Number(ocrConfidence) : null,
                confidenceLabel: confidenceLabel(ocrConfidence),
                zonesUsed: zoneTexts.length,
                literalNoise: Number(literalNoise.toFixed(3)),
                literalTokens,
                substitutionRatio: Number(substitutionRatio.toFixed(3)),
                uncertainTokens: uncertainTokens.length,
                illegibleSpans: illegibleSpans.length,
                qualityFlags
            };
            console.log(`[SCAN-AI][metrics] ${JSON.stringify(logPayload)}`);

            return {
                studentName,
                grade,
                score20,
                appreciation,
                transcription: orthographyCorrected,
                literalTranscription,
                spellingMistakes,
                questionFeedback,
                transcriptionVariants,
                qualityFlags,
                ocrConfidence: Number.isFinite(Number(ocrConfidence)) ? Number(ocrConfidence) : null
            };
        } catch (e) {
            console.error("❌ [SCAN-AI] Pipeline failure:", e.message);
            return {
                studentName: "Erreur",
                grade: "?",
                score20: null,
                appreciation: "Échec analyse",
                transcription: "Impossible de générer la correction.",
                literalTranscription: "",
                spellingMistakes: [],
                questionFeedback: [],
                qualityFlags: ["PIPELINE_ERROR"],
                ocrConfidence: null
            };
        }
    },

    correctCopyVariants: async (copyUrl, subjectUrls, instructions, studentList) => {
        const common = { zoneCount: 6, upscale: 2.2 };
        const imageOnly = await ScanAI.correctCopy(copyUrl, subjectUrls, instructions, studentList, {
            ...common,
            ocrMode: 'none'
        });
        const hybrid = await ScanAI.correctCopy(copyUrl, subjectUrls, instructions, studentList, {
            ...common,
            ocrMode: 'light'
        });
        const ocrRefine = await ScanAI.correctCopy(copyUrl, subjectUrls, instructions, studentList, {
            ...common,
            ocrMode: 'full',
            seedTranscription: imageOnly?.literalTranscription || imageOnly?.transcription || ''
        });
        return { imageOnly, hybrid, ocrRefine };
    }
};

module.exports = ScanAI;
