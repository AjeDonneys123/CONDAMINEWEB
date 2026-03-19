// @signatures: AdminRoutes, driveCheck, students, classrooms
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
require('../../models/BugReport');
const AdminExpert = require('./experts/admin.expert');
const StructureDrive = require('../structure/experts/structure.drive');
const { sendMail, sendLatePunishmentMail, resetLateMailState } = require('../../services/punishmentMailer');
const { isCentralAiAccount } = require('../../prof/core/profAiKeys');
const { getDailyFreeTierStatus, getFreeTierStatus, getUsageSummary, getCurrentDayWindow, getCurrentMonthWindow } = require('../../services/aiUsage.service');
const { getCurrentDayAiSpend, getCurrentMonthAiSpend, hasGcpBillingConfig } = require('../../services/gcpBilling.service');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const isNamedJpVuillet = (user) => {
    if (!user) return false;
    const first = String(user.firstName || '').trim().toLowerCase();
    const last = String(user.lastName || '').trim().toLowerCase();
    return (first === 'jp' || first === 'jean') && last === 'vuillet';
};
const requireDeveloper = async (req, res, next) => {
    try {
        const userId = String(req.query.userId || req.body?.userId || '').trim();
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(403).json({ error: "Accès développeur requis" });
        }
        const Teacher = mongoose.model('Teacher');
        const Admin = mongoose.model('Admin');
        const user = await Teacher.findById(userId).lean() || await Admin.findById(userId).lean();
        if (!user) return res.status(403).json({ error: "Accès développeur requis" });
        if (user.isDeveloper === true || isNamedJpVuillet(user)) return next();
        return res.status(403).json({ error: "Accès développeur requis" });
    } catch (e) {
        return res.status(403).json({ error: "Accès développeur requis" });
    }
};

// --- ROUTES CRITIQUES POUR LE PROF ---

// 1. Check Drive (Indispensable pour le voyant vert)
router.get('/drive-check', requireDeveloper, asyncHandler(async (req, res) => res.json(await AdminExpert.checkDriveStatus())));

router.get('/ai-usage', requireDeveloper, asyncHandler(async (req, res) => {
    const teacherId = String(req.query.teacherId || '').trim();
    const fallbackFreeTier = await getDailyFreeTierStatus({ teacherId });
    const cloudSpend = await getCurrentDayAiSpend().catch((e) => ({
        configured: hasGcpBillingConfig(),
        exact: false,
        source: 'gcp_error',
        spentUsd: null,
        currency: 'USD',
        rowsMatched: 0,
        error: e.message || 'GCP billing query failed'
    }));
    const preciseSpentUsd = Number.isFinite(Number(cloudSpend?.spentUsd)) ? Number(cloudSpend.spentUsd) : Number(fallbackFreeTier.spentUsd || 0);
    const budgetUsd = Number(fallbackFreeTier.budgetUsd || 0);
    const remainingUsd = Math.max(0, budgetUsd - preciseSpentUsd);
    const remainingPct = budgetUsd > 0 ? Math.max(0, Math.min(100, (remainingUsd / budgetUsd) * 100)) : 100;
    const freeTier = {
        ...fallbackFreeTier,
        spentUsd: preciseSpentUsd,
        remainingUsd,
        remainingPct,
        measurement: cloudSpend?.exact ? 'exact_google_cloud' : 'estimated_local',
        measurementSource: String(cloudSpend?.source || 'fallback'),
        googleCloudConfigured: Boolean(cloudSpend?.configured),
        googleCloudRowsMatched: Number(cloudSpend?.rowsMatched || 0),
        googleCloudError: String(cloudSpend?.error || '')
    };
    const { start: dayStart, end: dayEnd } = getCurrentDayWindow();
    const { start, end } = getCurrentMonthWindow();
    const personalMonth = teacherId ? await getUsageSummary({ teacherId, source: 'teacher', start, end }) : null;
    const globalMonth = await getUsageSummary({ source: 'global', start, end });
    const centralDay = await getUsageSummary({ teacherId, source: 'central', start: dayStart, end: dayEnd });
    const globalDay = await getUsageSummary({ source: 'global', start: dayStart, end: dayEnd });
    const cloudMonth = await getCurrentMonthAiSpend().catch(() => null);
    res.json({
        freeTier,
        cloudSpend,
        day: {
            start: dayStart,
            end: dayEnd,
            central: centralDay,
            global: globalDay
        },
        month: {
            start,
            end,
            personal: personalMonth,
            global: globalMonth,
            cloud: cloudMonth
        }
    });
}));

// 2. Classes (Indispensable pour le menu du haut)
router.get('/classrooms', asyncHandler(async (req, res) => { 
    const classes = await mongoose.model('Classroom').find({}).sort({ name: 1 }).lean(); 
    res.json(classes); 
}));

// 3. Élèves (Indispensable pour la distribution)
router.get('/students', asyncHandler(async (req, res) => { 
    res.json(await mongoose.model('Student').find({}).sort({ lastName: 1 }).lean()); 
}));

router.get('/students/:id/control-recoveries', asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'ID invalide' });
    const rows = await mongoose.model('ControlRecovery').find({ studentId: req.params.id }).sort({ updatedAt: -1 }).lean();
    res.json(rows);
}));

router.post('/control-recoveries/:id/validate', asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ error: 'ID invalide' });
    const doc = await mongoose.model('ControlRecovery').findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Récupération introuvable' });
    doc.teacherValidated = true;
    doc.teacherValidatedAt = new Date();
    await doc.save();
    res.json({ ok: true, item: doc.toObject() });
}));

// 4. Matières
router.get('/subjects', asyncHandler(async (req, res) => {
    res.json(await mongoose.model('Subject').find({}).sort({ name: 1 }).lean());
}));

// 5. Enseignants (Pour le profil)
router.get('/teachers/:id', asyncHandler(async (req, res) => { 
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ error: "ID Invalide" }); 
    let user = await mongoose.model('Teacher').findById(req.params.id).lean() || await mongoose.model('Admin').findById(req.params.id).lean(); 
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" }); 
    user.isDeveloper = user.isDeveloper === true || isNamedJpVuillet(user);
    user.hasPersonalGeminiKey = Boolean(String(user.geminiApiKeyEncrypted || '').trim());
    user.isCentralAiAccount = isCentralAiAccount(user);
    delete user.geminiApiKeyEncrypted;
    res.json(user); 
}));

// 6. Dump BDD (Pour le visualiseur BDD)
router.get('/database-dump', requireDeveloper, asyncHandler(async (req, res) => res.json(await AdminExpert.getFullDump())));

// 7. Test envoi mail punition (diagnostic)
router.post('/punishment-mail-test', asyncHandler(async (req, res) => {
    const Student = mongoose.model('Student');
    const { studentId, reset = false, toOverride = '' } = req.body || {};

    let student = null;
    if (studentId && mongoose.Types.ObjectId.isValid(studentId)) {
        student = await Student.findById(studentId);
    } else {
        student = await Student.findOne({
            firstName: /julian/i,
            lastName: /^p/i,
            currentClass: { $in: ['5B', '5 B', '5b', '5 b'] }
        });
    }

    if (!student) return res.status(404).json({ ok: false, error: 'Student not found for test' });

    if (reset) {
        resetLateMailState(student);
    }
    student.punishmentStatus = 'LATE';
    const result = await sendLatePunishmentMail(student, { force: true, toOverride });
    await student.save();

    res.json({
        ok: true,
        result,
        student: {
            id: student._id,
            firstName: student.firstName,
            lastName: student.lastName,
            currentClass: student.currentClass,
            punishmentStatus: student.punishmentStatus,
            punishmentLateMailSentAt: student.punishmentLateMailSentAt,
            punishmentLateMailTo: student.punishmentLateMailTo,
            punishmentLateMailError: student.punishmentLateMailError
        },
        mailConfig: {
            hasEmailUser: Boolean(process.env.EMAIL_USER),
            hasEmailPass: Boolean(process.env.EMAIL_PASS)
        }
    });
}));

// 8. Signalement bug (prof + eleve)
router.post('/bug-reports', asyncHandler(async (req, res) => {
    const { userId, description, page = '', userAgent = '' } = req.body || {};
    const cleanDescription = String(description || '').trim();
    if (!cleanDescription || cleanDescription.length < 6) {
        return res.status(400).json({ error: 'Description trop courte' });
    }

    let reporterName = 'Utilisateur';
    let reporterRole = 'unknown';
    const cleanUserId = String(userId || '').trim();
    if (mongoose.Types.ObjectId.isValid(cleanUserId)) {
        const Teacher = mongoose.model('Teacher');
        const Admin = mongoose.model('Admin');
        const Student = mongoose.model('Student');
        const prof = await Teacher.findById(cleanUserId).lean();
        const admin = !prof ? await Admin.findById(cleanUserId).lean() : null;
        const student = (!prof && !admin) ? await Student.findById(cleanUserId).lean() : null;
        const found = prof || admin || student;
        if (found) {
            reporterName = `${found.firstName || ''} ${found.lastName || ''}`.trim() || 'Utilisateur';
            reporterRole = prof ? 'prof' : admin ? 'admin' : 'student';
        }
    }

    const BugReport = mongoose.model('BugReport');
    const created = await BugReport.create({
        reporterName,
        reporterRole,
        reporterId: cleanUserId,
        description: cleanDescription.slice(0, 4000),
        page: String(page || '').slice(0, 200),
        userAgent: String(userAgent || '').slice(0, 600)
    });
    res.json({ ok: true, id: created._id });
}));

// 9. Liste des bugs (dev only)
router.get('/bug-reports', requireDeveloper, asyncHandler(async (req, res) => {
    const BugReport = mongoose.model('BugReport');
    const list = await BugReport.find({}).sort({ createdAt: -1 }).limit(300).lean();
    res.json(list);
}));

// 10. Connect-as (dev only) : ouvre une session miroir prof/élève
router.post('/connect-as', requireDeveloper, asyncHandler(async (req, res) => {
    const requesterId = String(req.query.userId || req.body?.userId || '').trim();
    const targetId = String(req.body?.targetId || '').trim();
    if (!mongoose.Types.ObjectId.isValid(requesterId) || !mongoose.Types.ObjectId.isValid(targetId)) {
        return res.status(400).json({ error: 'ID invalide' });
    }

    const Teacher = mongoose.model('Teacher');
    const Admin = mongoose.model('Admin');
    const Student = mongoose.model('Student');

    const targetTeacher = await Teacher.findById(targetId).lean();
    const targetAdmin = !targetTeacher ? await Admin.findById(targetId).lean() : null;
    const targetStudent = (!targetTeacher && !targetAdmin) ? await Student.findById(targetId).lean() : null;
    const target = targetTeacher || targetAdmin || targetStudent;
    if (!target) return res.status(404).json({ error: 'Profil introuvable' });

    const role = targetTeacher ? 'prof' : targetAdmin ? 'admin' : 'student';
    const isDeveloper = (targetTeacher || targetAdmin)
        ? (target.isDeveloper === true || isNamedJpVuillet(target))
        : false;
    const sanitized = { ...target, id: target._id, role, isDeveloper };
    delete sanitized.password;

    res.json({ ok: true, user: sanitized });
}));

router.post('/send-mail', asyncHandler(async (req, res) => {
    const { to, subject, text } = req.body || {};
    if (!to || !subject || !text) {
        return res.status(400).json({ ok: false, error: 'Missing to/subject/text' });
    }

    const list = Array.isArray(to) ? to : [to];
    const results = [];
    for (const recipient of list) {
        // Envoi séquentiel pour logs lisibles.
        const r = await sendMail({ to: recipient, subject, text });
        results.push({ to: recipient, ...r });
    }
    res.json({ ok: true, results });
}));

module.exports = router;
