// @signatures: ProfScansRouter, sessions, upload
const express = require('express');
const router = express.Router();
const { ScanSession, Student } = require('../models/prof.models');
const ProfDrive = require('../core/drive.prof');
const ScanAI = require('../../domains/scans/ai/scan.ai');
const MistakeService = require('../../services/mistake.service');
const multer = require('multer');
const { Readable } = require('stream');
const upload = multer({ dest: 'public/uploads/temp' });
const defaultAiInstructions = `Objectif prioritaire: comprendre le sens réel de ce que l'élève a écrit.
Ne pas corriger l'orthographe pour l'instant.
Rester proche des mots originaux quand ils sont lisibles.`;

/**
 * 📸 BLOC PROF : LOGIQUE SCANS (/api/scans)
 */

router.get('/sessions', async (req, res) => {
    const teacherId = String(req.query?.teacherId || '').trim();
    const classId = String(req.query?.classId || '').trim();
    const includeUnassigned = String(req.query?.includeUnassigned || '').trim() === '1';
    const query = {};
    if (teacherId) query.teacherId = teacherId;
    if (classId) {
        query.$or = [{ classId }];
        if (includeUnassigned) query.$or.push({ $or: [{ classId: null }, { classId: { $exists: false } }, { classId: '' }] });
    } else if (!includeUnassigned) {
        query.$or = [{ classId: null }, { classId: { $exists: false } }, { classId: '' }];
    }
    res.json(await ScanSession.find(query).sort({ date: -1 }).lean());
});

router.post('/sessions', async (req, res) => {
    try {
        const { title, teacherId, classId, className } = req.body || {};
        const created = await ScanSession.create({
            title,
            teacherId,
            classId: classId || null,
            className: String(className || '').trim(),
            aiInstructions: defaultAiInstructions
        });
        res.json(created);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/sessions/:id/classroom', async (req, res) => {
    try {
        const classId = req.body?.classId || null;
        const className = String(req.body?.className || '').trim();
        const updated = await ScanSession.findByIdAndUpdate(
            req.params.id,
            { $set: { classId: classId || null, className } },
            { new: true }
        );
        if (!updated) return res.status(404).json({ error: "Session introuvable" });
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/sessions/:id/instructions', async (req, res) => {
    try {
        const aiInstructions = String(req.body?.aiInstructions || '').trim();
        const updated = await ScanSession.findByIdAndUpdate(
            req.params.id,
            { $set: { aiInstructions } },
            { new: true }
        );
        if (!updated) return res.status(404).json({ error: "Session introuvable" });
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/sessions/:id/manual-grade', async (req, res) => {
    try {
        const value = Number(req.body?.value);
        const studentId = String(req.body?.studentId || '').trim();
        if (!studentId || !Number.isInteger(value) || value < 1 || value > 5) {
            return res.status(400).json({ error: 'Élève ou note invalide (1 à 5).' });
        }
        const [session, student] = await Promise.all([
            ScanSession.findById(req.params.id),
            Student.findById(studentId)
        ]);
        if (!session) return res.status(404).json({ error: 'Devoir introuvable.' });
        if (!student) return res.status(404).json({ error: 'Élève introuvable.' });

        const belongsToClass = !session.classId ||
            String(student.classId || '') === String(session.classId) ||
            (student.assignedGroups || []).some((id) => String(id) === String(session.classId));
        if (!belongsToClass) return res.status(400).json({ error: "Cet élève n'appartient pas à la classe du devoir." });

        const now = new Date();
        const sessionGrade = (session.manualGrades || []).find((row) => String(row.studentId) === studentId);
        if (sessionGrade) {
            sessionGrade.value = value;
            sessionGrade.gradedAt = now;
        } else {
            session.manualGrades.push({ studentId, value, gradedAt: now });
        }

        const studentGrade = (student.manualScanGrades || []).find((row) => String(row.sessionId) === String(session._id));
        const gradePayload = {
            sessionId: session._id,
            title: String(session.title || 'Devoir Scan'),
            value,
            assignmentDate: session.date || now,
            gradedAt: now,
            teacherId: String(session.teacherId || '')
        };
        if (studentGrade) Object.assign(studentGrade, gradePayload);
        else student.manualScanGrades.push(gradePayload);

        await Promise.all([session.save(), student.save()]);
        res.json({ ok: true, session: session.toObject(), grade: gradePayload });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/sessions/:id', async (req, res) => {
    try {
        await ScanSession.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/upload', upload.single('file'), async (req, res) => {
    const { sessionId, type } = req.body;
    const folderId = await ProfDrive.getOrCreateFolder("SCANS");
    const driveFile = await ProfDrive.uploadFile(req.file.originalname, req.file.path, folderId);
    const url = `/api/structure/proxy/${driveFile.id}`;
    
    const update = type === 'SUBJECT' ? { $push: { subjectUrls: url } } : { $push: { copyUrls: url } };
    await ScanSession.findByIdAndUpdate(sessionId, update);
    res.json({ url });
});

router.post('/delete-file', async (req, res) => {
    try {
        const { sessionId, url, type } = req.body || {};
        if (!sessionId || !url) return res.status(400).json({ error: "sessionId/url manquants" });
        const session = await ScanSession.findById(sessionId);
        if (!session) return res.status(404).json({ error: "Session introuvable" });

        const fileId = String(url).includes('/proxy/') ? String(url).split('/proxy/')[1] : '';
        if (fileId) {
            try {
                await ProfDrive.deleteFile(fileId);
            } catch (e) {
                console.error(`❌ [SCANS] Drive delete fail fileId=${fileId}:`, e.message);
            }
        }

        if (type === 'SUBJECT') {
            await ScanSession.updateOne({ _id: sessionId }, { $pull: { subjectUrls: url } });
        } else {
            await ScanSession.updateOne(
                { _id: sessionId },
                { $pull: { copyUrls: url, corrections: { originalUrl: url } } }
            );
        }
        res.json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/session-zip/:sessionId', async (req, res) => {
    try {
        const session = await ScanSession.findById(req.params.sessionId).lean();
        if (!session) return res.status(404).json({ error: "Session introuvable" });

        const base = sanitizeFilePart(session.title || 'session', 'session');
        const entries = [];
        const subjectUrls = Array.isArray(session.subjectUrls) ? session.subjectUrls : [];
        const copyUrls = Array.isArray(session.copyUrls) ? session.copyUrls : [];

        for (const row of [
            ...subjectUrls.map((url, idx) => ({ url, kind: 'sujet', idx: idx + 1 })),
            ...copyUrls.map((url, idx) => ({ url, kind: 'copie', idx: idx + 1 }))
        ]) {
            const driveId = proxyUrlToDriveId(row.url);
            if (!driveId) continue;
            const driveRes = await ProfDrive.getFileResponse(driveId);
            const fileBuffer = await streamToBuffer(driveRes.stream || Readable.from([]));
            const ext = inferExtFromHeaders(driveRes.headers || {});
            entries.push({
                name: `${base}/${row.kind}s/${String(row.idx).padStart(2, '0')}_${row.kind}.${ext}`,
                data: fileBuffer
            });
        }

        entries.push({
            name: `${base}/manifest_mode_b.txt`,
            data: Buffer.from([
                `Session: ${session.title || 'Sans titre'}`,
                `Date: ${session.date ? new Date(session.date).toISOString() : ''}`,
                '',
                'Sujets:',
                ...subjectUrls.map((url, idx) => `${idx + 1}. ${url}`),
                '',
                'Copies:',
                ...copyUrls.map((url, idx) => `${idx + 1}. ${url}`)
            ].join('\n'), 'utf8')
        });

        const zipBuffer = buildStoredZip(entries);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${base}_session.zip"`);
        res.setHeader('Content-Length', String(zipBuffer.length));
        res.send(zipBuffer);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

function norm(v = '') {
    return String(v || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function isLyceeClass(className = '') {
    const c = String(className || '').toUpperCase().replace(/\s+/g, '');
    return /^(2DE|2NDE|1ERE|1ER|PREMIERE|TERM|TERMINALE|TLE)/.test(c);
}

function gradeToScore20(letter = '') {
    const g = String(letter || '').toUpperCase().trim();
    if (g === 'A+') return 19;
    if (g === 'A') return 16;
    if (g === 'B') return 13;
    if (g === 'C') return 8;
    return 10;
}

function sanitizeLetterGrade(grade = '') {
    const g = String(grade || '').toUpperCase().trim();
    if (g === 'A+' || g === 'A' || g === 'B' || g === 'C') return g;
    return 'B';
}

function sanitizeFilePart(value = '', fallback = 'scan') {
    const clean = String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 60);
    return clean || fallback;
}

function proxyUrlToDriveId(url = '') {
    return String(url).includes('/proxy/') ? String(url).split('/proxy/')[1].split('?')[0].split('#')[0] : '';
}

async function streamToBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks);
}

function inferExtFromHeaders(headers = {}) {
    const type = String(headers['content-type'] || headers['Content-Type'] || '').toLowerCase();
    if (type.includes('png')) return 'png';
    if (type.includes('webp')) return 'webp';
    if (type.includes('pdf')) return 'pdf';
    if (type.includes('gif')) return 'gif';
    return 'jpg';
}

const CRC32_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
        let c = i;
        for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        table[i] = c >>> 0;
    }
    return table;
})();

function crc32(buffer) {
    let crc = 0xffffffff;
    for (let i = 0; i < buffer.length; i += 1) crc = CRC32_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

function buildStoredZip(entries = []) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    entries.forEach((entry, index) => {
        const nameBuf = Buffer.from(String(entry.name || `file_${index + 1}`), 'utf8');
        const dataBuf = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data || '');
        const crc = crc32(dataBuf);

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0, 6);
        local.writeUInt16LE(0, 8);
        local.writeUInt16LE(0, 10);
        local.writeUInt16LE(0, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(dataBuf.length, 18);
        local.writeUInt32LE(dataBuf.length, 22);
        local.writeUInt16LE(nameBuf.length, 26);
        local.writeUInt16LE(0, 28);
        localParts.push(local, nameBuf, dataBuf);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0, 8);
        central.writeUInt16LE(0, 10);
        central.writeUInt16LE(0, 12);
        central.writeUInt16LE(0, 14);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(dataBuf.length, 20);
        central.writeUInt32LE(dataBuf.length, 24);
        central.writeUInt16LE(nameBuf.length, 28);
        central.writeUInt16LE(0, 30);
        central.writeUInt16LE(0, 32);
        central.writeUInt16LE(0, 34);
        central.writeUInt16LE(0, 36);
        central.writeUInt32LE(0, 38);
        central.writeUInt32LE(offset, 42);
        centralParts.push(central, nameBuf);

        offset += local.length + nameBuf.length + dataBuf.length;
    });

    const centralDir = Buffer.concat(centralParts);
    const localDir = Buffer.concat(localParts);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralDir.length, 12);
    end.writeUInt32LE(localDir.length, 16);
    end.writeUInt16LE(0, 20);
    return Buffer.concat([localDir, centralDir, end]);
}

function stripMarkdownFences(raw = '') {
    const txt = String(raw || '').trim();
    const fenced = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
    return fenced ? String(fenced[1] || '').trim() : txt;
}

function extractJsonPayload(raw = '') {
    const cleaned = stripMarkdownFences(raw);
    try {
        return JSON.parse(cleaned);
    } catch (_) {}

    const objStart = cleaned.indexOf('{');
    const objEnd = cleaned.lastIndexOf('}');
    if (objStart >= 0 && objEnd > objStart) {
        return JSON.parse(cleaned.slice(objStart, objEnd + 1));
    }

    const arrStart = cleaned.indexOf('[');
    const arrEnd = cleaned.lastIndexOf(']');
    if (arrStart >= 0 && arrEnd > arrStart) {
        return JSON.parse(cleaned.slice(arrStart, arrEnd + 1));
    }

    throw new Error("JSON introuvable dans le texte collé");
}

function hasUsableTranscription(value = '') {
    const txt = String(value || '').trim();
    if (txt.length < 12) return false;
    const lowered = txt.toLowerCase();
    const banned = [
        'texte manuscrit difficilement lisible',
        'copie difficilement lisible',
        'reponses globalement pertinentes',
        'resume global',
        'contenu general',
        'idee generale'
    ];
    return !banned.some(pattern => lowered.includes(pattern));
}

function buildManualImportPayload(raw = '', session) {
    const parsed = extractJsonPayload(raw);
    const rows = Array.isArray(parsed)
        ? parsed
        : (Array.isArray(parsed?.corrections) ? parsed.corrections : []);
    if (!Array.isArray(rows) || rows.length === 0) {
        throw new Error("Aucune correction exploitable trouvée");
    }

    const copyUrls = Array.isArray(session?.copyUrls) ? session.copyUrls : [];
    return rows.map((row, idx) => {
        const copyIndex = Number(row?.copyIndex);
        const safeIndex = Number.isInteger(copyIndex) && copyIndex >= 1 && copyIndex <= copyUrls.length
            ? copyIndex
            : idx + 1;
        const copyUrl = String(row?.originalUrl || copyUrls[safeIndex - 1] || '').trim();
        if (!copyUrl) {
            throw new Error(`Copie introuvable pour l'entrée ${idx + 1}`);
        }
        const literal = String(row?.literalTranscription || row?.literal_final || '').trim();
        const corrected = String(row?.transcription || row?.orthography_corrected || '').trim();
        if (!hasUsableTranscription(literal) || !hasUsableTranscription(corrected)) {
            throw new Error(`Transcription insuffisante pour la copie ${safeIndex}. Demande a ChatGPT une vraie transcription ligne par ligne.`);
        }
        return {
            copyUrl,
            aiResult: {
                studentName: String(row?.studentName || row?.eleve || 'Inconnu').trim() || 'Inconnu',
                grade: row?.grade,
                score20: row?.score20,
                appreciation: String(row?.appreciation || row?.comment || row?.feedback || '').trim(),
                transcription: corrected,
                literalTranscription: literal,
                questionFeedback: Array.isArray(row?.questionFeedback)
                    ? row.questionFeedback.map(x => String(x || '').trim()).filter(Boolean)
                    : [],
                spellingMistakes: Array.isArray(row?.spellingMistakes)
                    ? row.spellingMistakes
                        .map(m => ({
                            wrong: String(m?.wrong || '').trim(),
                            correct: String(m?.correct || '').trim()
                        }))
                        .filter(m => m.wrong || m.correct)
                    : [],
                transcriptionVariants: {
                    literal_final: {
                        label: 'Transcription fidèle',
                        text: String(row?.literalTranscription || row?.literal_final || '').trim()
                    },
                    orthography_corrected: {
                        label: 'Orthographe corrigée',
                        text: String(row?.transcription || row?.orthography_corrected || '').trim()
                    },
                    content_feedback: {
                        label: 'Feedback fond',
                        text: Array.isArray(row?.questionFeedback)
                            ? row.questionFeedback.map(x => String(x || '').trim()).filter(Boolean).join('\n')
                            : String(row?.appreciation || row?.comment || row?.feedback || '').trim()
                    }
                },
                qualityFlags: ['MANUAL_IMPORT'],
                ocrConfidence: null
            }
        };
    });
}

async function buildCorrectionForCopy(session, copyUrl, roster, students) {
    if (!String(copyUrl).includes('/proxy/')) return null;
    const aiResult = await ScanAI.correctCopy(
        copyUrl,
        session.subjectUrls || [],
        session.aiInstructions || '',
        students,
        { teacherId: String(session.teacherId || '').trim() }
    );
    const studentName = String(aiResult.studentName || 'Inconnu').trim();
    const n = norm(studentName);
    const matched = roster.find(s => s.fullNameNorm === n)
        || roster.find(s => s.fullNameNorm.includes(n) || n.includes(s.fullNameNorm));
    const studentClass = matched?.className || '';
    const studentId = matched?.id || null;
    const lycee = isLyceeClass(studentClass);
    const letter = sanitizeLetterGrade(aiResult.grade || 'B');
    const score20 = lycee
        ? (Number.isFinite(Number(aiResult.score20)) ? Number(aiResult.score20) : gradeToScore20(letter))
        : null;

    return {
        originalUrl: copyUrl,
        studentName: studentName || "Inconnu",
        studentId,
        studentClass,
        isLycee: lycee,
        grade: letter,
        score20,
        appreciation: aiResult.appreciation || "Pas d'avis.",
        transcription: aiResult.transcription || "...",
        literalTranscription: aiResult.literalTranscription || "",
        spellingMistakes: Array.isArray(aiResult.spellingMistakes) ? aiResult.spellingMistakes : [],
        questionFeedback: Array.isArray(aiResult.questionFeedback) ? aiResult.questionFeedback : [],
        transcriptionVariants: (aiResult && typeof aiResult.transcriptionVariants === 'object' && aiResult.transcriptionVariants)
            ? aiResult.transcriptionVariants
            : {
                literal_final: { label: 'Transcription fidèle', text: aiResult.literalTranscription || aiResult.transcription || "..." },
                orthography_corrected: { label: 'Orthographe corrigée', text: aiResult.transcription || "..." },
                content_feedback: { label: 'Feedback fond', text: Array.isArray(aiResult.questionFeedback) && aiResult.questionFeedback.length ? aiResult.questionFeedback.join('\n') : (aiResult.appreciation || "Pas d'avis.") }
            },
        qualityFlags: Array.isArray(aiResult.qualityFlags) ? aiResult.qualityFlags : [],
        ocrConfidence: Number.isFinite(Number(aiResult.ocrConfidence)) ? Number(aiResult.ocrConfidence) : null,
        mistakes: Array.isArray(aiResult.spellingMistakes) ? aiResult.spellingMistakes : []
    };
}

function buildCorrectionFromAiResult(aiResult, copyUrl, roster) {
    const studentName = String(aiResult?.studentName || 'Inconnu').trim();
    const n = norm(studentName);
    const matched = roster.find(s => s.fullNameNorm === n)
        || roster.find(s => s.fullNameNorm.includes(n) || n.includes(s.fullNameNorm));
    const studentClass = matched?.className || '';
    const studentId = matched?.id || null;
    const lycee = isLyceeClass(studentClass);
    const letter = sanitizeLetterGrade(aiResult?.grade || 'B');
    const score20 = lycee
        ? (Number.isFinite(Number(aiResult?.score20)) ? Number(aiResult.score20) : gradeToScore20(letter))
        : null;

    return {
        originalUrl: copyUrl,
        studentName: studentName || "Inconnu",
        studentId,
        studentClass,
        isLycee: lycee,
        grade: letter,
        score20,
        appreciation: aiResult?.appreciation || "Pas d'avis.",
        transcription: aiResult?.transcription || "...",
        literalTranscription: aiResult?.literalTranscription || "",
        spellingMistakes: Array.isArray(aiResult?.spellingMistakes) ? aiResult.spellingMistakes : [],
        questionFeedback: Array.isArray(aiResult?.questionFeedback) ? aiResult.questionFeedback : [],
        transcriptionVariants: (aiResult && typeof aiResult.transcriptionVariants === 'object' && aiResult.transcriptionVariants)
            ? aiResult.transcriptionVariants
            : {
                literal_final: { label: 'Transcription fidèle', text: aiResult?.literalTranscription || aiResult?.transcription || "..." },
                orthography_corrected: { label: 'Orthographe corrigée', text: aiResult?.transcription || "..." },
                content_feedback: { label: 'Feedback fond', text: Array.isArray(aiResult?.questionFeedback) && aiResult.questionFeedback.length ? aiResult.questionFeedback.join('\n') : (aiResult?.appreciation || "Pas d'avis.") }
            },
        qualityFlags: Array.isArray(aiResult?.qualityFlags) ? aiResult.qualityFlags : [],
        ocrConfidence: Number.isFinite(Number(aiResult?.ocrConfidence)) ? Number(aiResult.ocrConfidence) : null,
        mistakes: Array.isArray(aiResult?.spellingMistakes) ? aiResult.spellingMistakes : []
    };
}

router.post('/correct/:sessionId', async (req, res) => {
    try {
        const session = await ScanSession.findById(req.params.sessionId);
        if (!session) return res.status(404).json({ error: "Session introuvable" });
        const students = await Student.find({}, 'firstName lastName currentClass').lean();
        const roster = students.map(s => ({
            id: s._id,
            fullName: `${s.firstName || ''} ${s.lastName || ''}`.trim(),
            fullNameNorm: norm(`${s.firstName || ''} ${s.lastName || ''}`),
            className: s.currentClass || ''
        }));

        const finalResults = [];
        for (const copyUrl of (session.copyUrls || [])) {
            try {
                const one = await buildCorrectionForCopy(session, copyUrl, roster, students);
                if (one) {
                    finalResults.push(one);
                    if (one.studentId) {
                        await MistakeService.recordForStudent({
                            studentId: one.studentId,
                            mistakes: one.spellingMistakes || [],
                            sourceType: 'scan',
                            sourceRef: `${session._id}:${copyUrl}`,
                            context: one.studentName || ''
                        });
                    }
                }
            } catch (e) {
                console.error("❌ [SCANS] Corr Error:", e.message);
            }
        }
        session.corrections = finalResults;
        await session.save();
        res.json(session);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/correct-one/:sessionId', async (req, res) => {
    try {
        const session = await ScanSession.findById(req.params.sessionId);
        if (!session) return res.status(404).json({ error: "Session introuvable" });
        const copyUrl = String(req.body?.copyUrl || '');
        if (!copyUrl) return res.status(400).json({ error: "copyUrl manquant" });
        if (!(session.copyUrls || []).includes(copyUrl)) {
            return res.status(404).json({ error: "Copie introuvable dans la session" });
        }

        const students = await Student.find({}, 'firstName lastName currentClass').lean();
        const roster = students.map(s => ({
            id: s._id,
            fullName: `${s.firstName || ''} ${s.lastName || ''}`.trim(),
            fullNameNorm: norm(`${s.firstName || ''} ${s.lastName || ''}`),
            className: s.currentClass || ''
        }));
        const one = await buildCorrectionForCopy(session, copyUrl, roster, students);
        if (!one) return res.status(400).json({ error: "URL copie invalide" });
        if (one.studentId) {
            await MistakeService.recordForStudent({
                studentId: one.studentId,
                mistakes: one.spellingMistakes || [],
                sourceType: 'scan',
                sourceRef: `${session._id}:${copyUrl}`,
                context: one.studentName || ''
            });
        }

        const existing = Array.isArray(session.corrections) ? session.corrections : [];
        const idx = existing.findIndex(c => String(c.originalUrl) === copyUrl);
        if (idx >= 0) existing[idx] = one;
        else existing.push(one);
        session.corrections = existing;
        await session.save();
        res.json({ ok: true, correction: one, session });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/correct-one-compare/:sessionId', async (req, res) => {
    try {
        const session = await ScanSession.findById(req.params.sessionId);
        if (!session) return res.status(404).json({ error: "Session introuvable" });
        const copyUrl = String(req.body?.copyUrl || '');
        if (!copyUrl) return res.status(400).json({ error: "copyUrl manquant" });
        if (!(session.copyUrls || []).includes(copyUrl)) {
            return res.status(404).json({ error: "Copie introuvable dans la session" });
        }

        const students = await Student.find({}, 'firstName lastName currentClass').lean();
        const roster = students.map(s => ({
            id: s._id,
            fullName: `${s.firstName || ''} ${s.lastName || ''}`.trim(),
            fullNameNorm: norm(`${s.firstName || ''} ${s.lastName || ''}`),
            className: s.currentClass || ''
        }));

        const variants = await ScanAI.correctCopyVariants(
            copyUrl,
            session.subjectUrls || [],
            session.aiInstructions || '',
            students,
            { teacherId: String(session.teacherId || '').trim() }
        );
        const response = {
            imageOnly: buildCorrectionFromAiResult(variants.imageOnly, copyUrl, roster),
            hybrid: buildCorrectionFromAiResult(variants.hybrid, copyUrl, roster),
            ocrRefine: buildCorrectionFromAiResult(variants.ocrRefine, copyUrl, roster)
        };

        const mergeTranscriptionVariants = {
            literal_final: response.hybrid?.transcriptionVariants?.literal_final || { label: 'Transcription fidèle', text: response.hybrid?.literalTranscription || response.hybrid?.transcription || '' },
            orthography_corrected: response.hybrid?.transcriptionVariants?.orthography_corrected || { label: 'Orthographe corrigée', text: response.hybrid?.transcription || '' },
            content_feedback: response.hybrid?.transcriptionVariants?.content_feedback || {
                label: 'Feedback fond',
                text: Array.isArray(response.hybrid?.questionFeedback) && response.hybrid.questionFeedback.length
                    ? response.hybrid.questionFeedback.join('\n')
                    : (response.hybrid?.appreciation || '')
            }
        };
        const mergedCorrection = {
            ...response.hybrid,
            transcriptionVariants: mergeTranscriptionVariants,
            appreciation: 'Comparatif A/B/C généré (hybride utilisé comme base).'
        };
        if (mergedCorrection.studentId) {
            await MistakeService.recordForStudent({
                studentId: mergedCorrection.studentId,
                mistakes: mergedCorrection.spellingMistakes || [],
                sourceType: 'scan',
                sourceRef: `${session._id}:${copyUrl}`,
                context: mergedCorrection.studentName || ''
            });
        }
        const existing = Array.isArray(session.corrections) ? session.corrections : [];
        const idx = existing.findIndex(c => String(c.originalUrl) === copyUrl);
        if (idx >= 0) existing[idx] = mergedCorrection;
        else existing.push(mergedCorrection);
        session.corrections = existing;
        await session.save();

        res.json({ ok: true, variants: response, mergedCorrection, session });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/manual-import/:sessionId', async (req, res) => {
    try {
        const session = await ScanSession.findById(req.params.sessionId);
        if (!session) return res.status(404).json({ error: "Session introuvable" });

        const students = await Student.find({}, 'firstName lastName currentClass').lean();
        const roster = students.map(s => ({
            id: s._id,
            fullName: `${s.firstName || ''} ${s.lastName || ''}`.trim(),
            fullNameNorm: norm(`${s.firstName || ''} ${s.lastName || ''}`),
            className: s.currentClass || ''
        }));

        const imported = buildManualImportPayload(req.body?.rawText || '', session);
        const existingMap = new Map(
            (Array.isArray(session.corrections) ? session.corrections : [])
                .map(c => [String(c.originalUrl || ''), c])
        );

        for (const row of imported) {
            const one = buildCorrectionFromAiResult(row.aiResult, row.copyUrl, roster);
            const merged = {
                ...one,
                qualityFlags: ['MANUAL_IMPORT', ...(Array.isArray(one.qualityFlags) ? one.qualityFlags : [])]
            };
            existingMap.set(String(row.copyUrl), merged);
            if (merged.studentId) {
                await MistakeService.recordForStudent({
                    studentId: merged.studentId,
                    mistakes: merged.spellingMistakes || [],
                    sourceType: 'scan',
                    sourceRef: `${session._id}:${row.copyUrl}:manual`,
                    context: merged.studentName || ''
                });
            }
        }

        session.corrections = (session.copyUrls || [])
            .map(url => existingMap.get(String(url)))
            .filter(Boolean);
        await session.save();
        res.json({ ok: true, importedCount: imported.length, session });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

module.exports = router;
