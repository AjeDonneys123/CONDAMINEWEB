const mongoose = require('mongoose');
const crypto = require('crypto');
require('../models/MistakesBook');

const normalizeToken = (value = '') =>
    String(value || '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();

const normalizeMistakeEntry = (entry) => {
    if (!entry || typeof entry !== 'object') return null;
    const wrong = String(entry.wrong || entry.from || '').trim();
    const correct = String(entry.correct || entry.to || '').trim();
    const context = String(entry.context || '').trim();
    if (!wrong || !correct) return null;
    if (normalizeToken(wrong) === normalizeToken(correct)) return null;
    return { wrong, correct, context };
};

const buildFingerprint = ({ studentId, wrong, correct, sourceType, sourceRef }) => {
    const base = [
        String(studentId || ''),
        normalizeToken(wrong),
        normalizeToken(correct),
        normalizeToken(sourceType),
        normalizeToken(sourceRef)
    ].join('|');
    return crypto.createHash('sha1').update(base).digest('hex');
};

const upsertStudentCache = async (studentId, mistakes = []) => {
    try {
        const Student = mongoose.model('Student');
        const student = await Student.findById(studentId);
        if (!student) return;
        const current = Array.isArray(student.spellingMistakes) ? student.spellingMistakes : [];
        const keySet = new Set(
            current.map((m) => `${normalizeToken(m?.wrong)}|${normalizeToken(m?.correct)}`)
        );
        for (const m of mistakes) {
            const key = `${normalizeToken(m.wrong)}|${normalizeToken(m.correct)}`;
            if (keySet.has(key)) continue;
            keySet.add(key);
            current.unshift({ wrong: m.wrong, correct: m.correct, date: new Date() });
        }
        student.spellingMistakes = current.slice(0, 300);
        await student.save();
    } catch (e) {}
};

const MistakeService = {
    normalizeMany: (items = []) => {
        const rows = Array.isArray(items) ? items : [];
        const out = [];
        const seen = new Set();
        rows.forEach((row) => {
            const n = normalizeMistakeEntry(row);
            if (!n) return;
            const key = `${normalizeToken(n.wrong)}|${normalizeToken(n.correct)}`;
            if (seen.has(key)) return;
            seen.add(key);
            out.push(n);
        });
        return out;
    },

    recordForStudent: async ({
        studentId,
        mistakes = [],
        sourceType = 'unknown',
        sourceRef = '',
        context = ''
    }) => {
        if (!studentId || !mongoose.Types.ObjectId.isValid(String(studentId))) return { inserted: 0 };
        const cleanMistakes = MistakeService.normalizeMany(mistakes);
        if (cleanMistakes.length === 0) return { inserted: 0 };

        const MistakesBook = mongoose.model('MistakesBook');
        const ops = cleanMistakes.map((m) => {
            const fingerprint = buildFingerprint({ studentId, wrong: m.wrong, correct: m.correct, sourceType, sourceRef });
            return {
                updateOne: {
                    filter: { fingerprint },
                    update: {
                        $setOnInsert: {
                            studentId,
                            wrong: m.wrong,
                            correct: m.correct,
                            context: m.context || context || '',
                            sourceType: String(sourceType || ''),
                            sourceRef: String(sourceRef || ''),
                            fingerprint,
                            date: new Date()
                        }
                    },
                    upsert: true
                }
            };
        });

        const bulk = await MistakesBook.bulkWrite(ops, { ordered: false });
        const inserted = Number(bulk?.upsertedCount || 0);
        await upsertStudentCache(studentId, cleanMistakes);
        return { inserted };
    }
};

module.exports = MistakeService;

