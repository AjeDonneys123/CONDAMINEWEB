// @signatures: ProfAuth, login, config, finder, googleLogin, googleCallback, toggleTestMode
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { Teacher, Admin, Student, Classroom } = require('../models/prof.models');
const ProfDrive = require('../core/drive.prof');
const bcrypt = require('bcryptjs');
const fetch = require('node-fetch');
const { encryptApiKey, getTeacherAiConfig, isCentralAiAccount } = require('../core/profAiKeys');
const BCRYPT_HASH_RE = /^\$2[aby]\$/;
const TEST_ACCOUNT_EMAIL = 'vuillet433@gmail.com';
const visitorPassword = () => String(process.env.VISITOR_PROF_PASSWORD || 'spartacus');
const visitorSecret = () => String(process.env.VISITOR_SESSION_SECRET || process.env.JWT_SECRET || process.env.SESSION_SECRET || visitorPassword()).trim();
const signVisitorSession = () => {
    const secret = visitorSecret();
    if (!secret) throw new Error('VISITOR_SESSION_SECRET manquant');
    const payload = Buffer.from(JSON.stringify({ kind: 'visitor-prof', exp: Date.now() + 12 * 60 * 60 * 1000 })).toString('base64url');
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    return `${payload}.${signature}`;
};
const verifyVisitorSession = (token = '') => {
    const secret = visitorSecret();
    const [payload, signature] = String(token || '').split('.');
    if (!secret || !payload || !signature) return false;
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
    if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
    try {
        const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        return data.kind === 'visitor-prof' && Number(data.exp || 0) > Date.now();
    } catch (_) { return false; }
};
const isNamedJpVuillet = (user) => {
    if (!user) return false;
    const first = String(user.firstName || '').trim().toLowerCase();
    const last = String(user.lastName || '').trim().toLowerCase();
    return (first === 'jp' || first === 'jean') && last === 'vuillet';
};

async function verifyGoogleIdToken(idToken = '') {
    const token = String(idToken || '').trim();
    if (!token) throw new Error("Token Google manquant");
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(String(data?.error_description || data?.error || 'Token Google invalide'));
    const aud = String(data?.aud || '').trim();
    const allowedAud = String(process.env.GOOGLE_CLIENT_ID || '').trim();
    if (allowedAud && aud && aud !== allowedAud) {
        throw new Error("Token Google émis pour un autre client");
    }
    if (String(data?.email_verified || '').toLowerCase() !== 'true') {
        throw new Error("Email Google non vérifié");
    }
    return {
        email: String(data?.email || '').trim().toLowerCase(),
        givenName: String(data?.given_name || '').trim(),
        familyName: String(data?.family_name || '').trim(),
        name: String(data?.name || '').trim()
    };
}

async function findTeacherOrAdminByGoogleEmail(email = '') {
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail) return null;
    const emailRx = new RegExp(`^${cleanEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

    const teacher = await Teacher.findOne({
        $or: [
            { mail: cleanEmail },
            { mail: emailRx },
            { email: cleanEmail },
            { email: emailRx }
        ]
    });
    if (teacher) return { user: teacher, role: 'prof' };

    const admin = await Admin.findOne({
        $or: [
            { mail: cleanEmail },
            { mail: emailRx },
            { email: cleanEmail },
            { email: emailRx }
        ]
    });
    if (admin) return { user: admin, role: 'admin' };

    return null;
}

async function findAnyAccountByIdentity({ userId = '', firstName = '', lastName = '', className = '' } = {}) {
    const cleanUserId = String(userId || '').trim();
    const cleanFirst = String(firstName || '').trim();
    const cleanLast = String(lastName || '').trim();
    const cleanClass = String(className || '').trim();

    if (cleanUserId) {
        let user = await Teacher.findById(cleanUserId);
        if (user) return { user, role: 'prof' };
        user = await Admin.findById(cleanUserId);
        if (user) return { user, role: 'admin' };
        user = await Student.findById(cleanUserId).populate('assignedGroups', 'name type level');
        if (user) return { user, role: 'student' };
    }

    if (!cleanFirst || !cleanLast) return null;
    const firstRx = new RegExp(`^${cleanFirst.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const lastRx = new RegExp(`^${cleanLast.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');

    let user = await Teacher.findOne({ firstName: firstRx, lastName: lastRx });
    if (user) return { user, role: 'prof' };

    user = await Admin.findOne({ firstName: firstRx, lastName: lastRx });
    if (user) return { user, role: 'admin' };

    const studentQuery = { firstName: firstRx, lastName: lastRx };
    if (cleanClass) {
        studentQuery.currentClass = new RegExp(`^${cleanClass.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    }
    user = await Student.findOne(studentQuery).populate('assignedGroups', 'name type level');
    if (user) return { user, role: 'student' };

    return null;
}

/**
 * 🔐 AUTHENTIFICATION CÔTÉ PROF (HERMÉTIQUE)
 */

router.post('/login', async (req, res) => {
    const { firstName, lastName, password } = req.body;
    const fName = (firstName || '').trim();
    const lName = (lastName || '').trim();
    
    let user = await Teacher.findOne({ firstName: new RegExp(`^${fName}$`, 'i'), lastName: new RegExp(`^${lName}$`, 'i') }) 
            || await Admin.findOne({ firstName: new RegExp(`^${fName}$`, 'i'), lastName: new RegExp(`^${lName}$`, 'i') });

    if (user) {
        const storedPassword = String(user.password || '');
        const isBcryptHash = BCRYPT_HASH_RE.test(storedPassword);
        const isValid = isBcryptHash
            ? await bcrypt.compare(password, storedPassword)
            : storedPassword === password;

        if (isValid) {
            const obj = user.toObject();
            delete obj.password;
            return res.json({
                ok: true,
                user: {
                    ...obj,
                    id: obj._id,
                    role: obj.role || 'prof',
                    isDeveloper: obj.isDeveloper === true || isNamedJpVuillet(obj),
                    hasPersonalGeminiKey: Boolean(String(obj.geminiApiKeyEncrypted || '').trim())
                }
            });
        }
    }
    res.status(401).json({ ok: false, message: "Identifiants prof incorrects" });
});

router.post('/visitor-login', (_req, res) => {
    try {
        return res.json({ ok: true, token: signVisitorSession() });
    } catch (error) {
        return res.status(503).json({ ok: false, message: 'Accès visiteur non configuré côté serveur.' });
    }
});

router.post('/visitor-validate', (req, res) => {
    const ok = verifyVisitorSession(req.body?.token);
    return res.status(ok ? 200 : 401).json({ ok });
});

router.post('/password/reset-self', async (req, res) => {
    try {
        const userId = String(req.body?.userId || '').trim();
        const password = String(req.body?.password || '').trim();
        const confirmPassword = String(req.body?.confirmPassword || '').trim();
        if (!userId) return res.status(400).json({ ok: false, message: "Utilisateur introuvable." });
        if (!password || password.length < 4) {
            return res.status(400).json({ ok: false, message: "Le mot de passe doit contenir au moins 4 caractères." });
        }
        if (password !== confirmPassword) {
            return res.status(400).json({ ok: false, message: "La confirmation du mot de passe ne correspond pas." });
        }
        const user = await Teacher.findById(userId) || await Admin.findById(userId);
        if (!user) return res.status(404).json({ ok: false, message: "Utilisateur introuvable." });
        user.password = await bcrypt.hash(password, 10);
        await user.save();
        return res.json({ ok: true, message: "Nouveau mot de passe enregistré." });
    } catch (e) {
        return res.status(500).json({ ok: false, message: e.message });
    }
});

// --- NOUVEAU : BASCULE MODE TESTEUR ---
router.post('/toggle-test-mode', async (req, res) => {
    const { userId } = req.body;
    try {
        let user = await Teacher.findById(userId) || await Admin.findById(userId);
        if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

        // Bascule du booléen
        user.isTestAccount = !user.isTestAccount;
        await user.save();

        console.log(`🧪 [AUTH] Mode Testeur pour ${user.firstName} : ${user.isTestAccount}`);
        res.json({ ok: true, isTestAccount: user.isTestAccount });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/config', async (req, res) => {
    res.json({ classrooms: await Classroom.find({}).sort({name:1}).lean() });
});

router.get('/google-client-config', async (req, res) => {
    res.json({
        clientId: String(process.env.GOOGLE_CLIENT_ID || '').trim(),
        enabled: Boolean(String(process.env.GOOGLE_CLIENT_ID || '').trim())
    });
});

router.get('/ai-config/:userId', async (req, res) => {
    try {
        const cfg = await getTeacherAiConfig(req.params.userId);
        if (!cfg) return res.status(404).json({ error: "Professeur introuvable" });
        res.json({
            ok: true,
            isCentralAccount: cfg.isCentral,
            geminiApiEnabled: cfg.isCentral ? true : cfg.enabled,
            geminiProjectId: cfg.projectId,
            hasPersonalKey: cfg.hasEncryptedKey
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/ai-config/:userId', async (req, res) => {
    try {
        const user = await Teacher.findById(req.params.userId) || await Admin.findById(req.params.userId);
        if (!user) return res.status(404).json({ error: "Professeur introuvable" });
        if (isCentralAiAccount(user)) {
            return res.json({
                ok: true,
                lockedToCentral: true,
                geminiApiEnabled: true,
                geminiProjectId: String(process.env.GEMINI_PROJECT_ID || user.geminiProjectId || '').trim(),
                hasPersonalKey: Boolean(String(user.geminiApiKeyEncrypted || '').trim())
            });
        }
        user.geminiApiEnabled = req.body?.geminiApiEnabled !== false;
        user.geminiProjectId = String(req.body?.geminiProjectId || '').trim().slice(0, 200);
        const apiKey = String(req.body?.geminiApiKey || '').trim();
        if (apiKey) user.geminiApiKeyEncrypted = encryptApiKey(apiKey);
        else if (req.body?.clearKey === true) user.geminiApiKeyEncrypted = '';
        await user.save();
        res.json({
            ok: true,
            geminiApiEnabled: user.geminiApiEnabled,
            geminiProjectId: user.geminiProjectId,
            hasPersonalKey: Boolean(String(user.geminiApiKeyEncrypted || '').trim())
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/ui-state/:userId', async (req, res) => {
    try {
        const user = await Teacher.findById(req.params.userId).lean() || await Admin.findById(req.params.userId).lean();
        if (!user) return res.status(404).json({ error: "Professeur introuvable" });
        res.json({
            ok: true,
            lastProfTab: String(user.lastProfTab || 'activities'),
            lastProfClassId: String(user.lastProfClassId || '')
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/ui-state/:userId', async (req, res) => {
    try {
        const user = await Teacher.findById(req.params.userId) || await Admin.findById(req.params.userId);
        if (!user) return res.status(404).json({ error: "Professeur introuvable" });
        const allowedTabs = ['activities', 'exposes', 'classroom', 'scans', 'studio', 'students', 'admin'];
        const nextTab = String(req.body?.lastProfTab || '').trim();
        const nextClassId = String(req.body?.lastProfClassId || '').trim();
        if (allowedTabs.includes(nextTab)) user.lastProfTab = nextTab;
        user.lastProfClassId = nextClassId.slice(0, 80);
        await user.save();
        res.json({
            ok: true,
            lastProfTab: String(user.lastProfTab || 'activities'),
            lastProfClassId: String(user.lastProfClassId || '')
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/finder-data', async (req, res) => {
    const [students, teachers, admins] = await Promise.all([
        Student.find({}, 'firstName lastName currentClass hasStudentPassword studentPassword').lean(),
        Teacher.find({}, 'firstName lastName').lean(),
        Admin.find({}, 'firstName lastName').lean()
    ]);

    const studentItems = (students || []).map(s => ({
        id: s._id,
        type: 'student',
        firstName: s.firstName,
        lastName: s.lastName,
        className: s.currentClass || '',
        hasStudentPassword: s.hasStudentPassword === true || String(s.studentPassword || '').trim().length > 0
    }));

    const teacherItems = [...(teachers || []), ...(admins || [])].map(t => ({
        id: t._id,
        type: 'teacher',
        firstName: t.firstName,
        lastName: t.lastName,
        className: ''
    }));

    res.json([...studentItems, ...teacherItems]);
});

router.post('/google-login', async (req, res) => {
    try {
        const { credential, targetUserId, targetFirstName, targetLastName, targetClassName } = req.body || {};
        const googleUser = await verifyGoogleIdToken(credential);
        const email = String(googleUser.email || '').trim().toLowerCase();
        if (!email) return res.status(401).json({ ok: false, message: "Email Google introuvable." });

        if (email === 'vuillet.jean@condamine.edu.ec') {
            const target = await findAnyAccountByIdentity({
                userId: targetUserId,
                firstName: targetFirstName,
                lastName: targetLastName,
                className: targetClassName
            });
            if (!target?.user) {
                return res.status(401).json({ ok: false, message: "Aucun compte trouvé avec ce nom/prénom." });
            }
            const obj = target.user.toObject();
            delete obj.password;
            return res.json({
                ok: true,
                user: {
                    ...obj,
                    id: obj._id,
                    role: obj.role || target.role,
                    isDeveloper: true,
                    impersonatedByGoogleAdmin: true
                }
            });
        }

        if (email === TEST_ACCOUNT_EMAIL) {
            let targetStudent = null;
            const cleanTargetUserId = String(targetUserId || '').trim();
            const hasExplicitStudentTarget = Boolean(
                cleanTargetUserId
                || String(targetFirstName || '').trim()
                || String(targetLastName || '').trim()
                || String(targetClassName || '').trim()
            );
            if (hasExplicitStudentTarget) {
                if (cleanTargetUserId) {
                    targetStudent = await Student.findById(cleanTargetUserId).populate('assignedGroups', 'name type level');
                }

                if (!targetStudent) {
                    const cleanFirst = String(targetFirstName || '').trim();
                    const cleanLast = String(targetLastName || '').trim();
                    const firstRx = new RegExp(`^${cleanFirst.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
                    const lastRx = new RegExp(`^${cleanLast.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
                    const studentQuery = { isTestAccount: true };
                    if (cleanFirst) studentQuery.firstName = firstRx;
                    if (cleanLast) studentQuery.lastName = lastRx;
                    const cleanClass = String(targetClassName || '').trim();
                    if (cleanClass) {
                        studentQuery.currentClass = new RegExp(`^${cleanClass.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
                    }
                    targetStudent = await Student.findOne(studentQuery).populate('assignedGroups', 'name type level');
                }

                if (!targetStudent) {
                    return res.status(401).json({ ok: false, message: "Sélectionne d'abord un élève test valide." });
                }
                if (targetStudent.isTestAccount !== true) {
                    return res.status(401).json({ ok: false, message: "Ce compte n'est pas un compte test Google." });
                }
                const plain = targetStudent.toObject();
                return res.json({ ok: true, user: { ...plain, id: plain._id, role: 'student' } });
            }
        }

        const profOrAdmin = await findTeacherOrAdminByGoogleEmail(email);
        if (profOrAdmin?.user) {
            const obj = profOrAdmin.user.toObject();
            delete obj.password;
            return res.json({
                ok: true,
                user: {
                    ...obj,
                    id: obj._id,
                    role: obj.role || profOrAdmin.role || 'prof',
                    isDeveloper: obj.isDeveloper === true || isNamedJpVuillet(obj),
                    hasPersonalGeminiKey: Boolean(String(obj.geminiApiKeyEncrypted || '').trim())
                }
            });
        }

        let user = await Student.findOne({ email }).populate('assignedGroups', 'name type level');
        if (user) {
            const plain = user.toObject();
            return res.json({ ok: true, user: { ...plain, id: plain._id, role: 'student' } });
        }

        return res.status(401).json({ ok: false, message: "Aucun compte Condamine n'est lié à cet email Google." });
    } catch (e) {
        return res.status(401).json({ ok: false, message: String(e?.message || 'Connexion Google impossible') });
    }
});

// --- 🚀 NOUVELLES ROUTES OAUTH (FIX CANNOT GET) ---

router.get('/google/login', (req, res) => {
    try {
        const url = ProfDrive.getAuthUrl();
        res.redirect(url);
    } catch (e) {
        res.status(500).send("Erreur Init OAuth: " + e.message);
    }
});

router.get('/google/callback', async (req, res) => {
    try {
        const code = req.query.code;
        if (!code) return res.send("Pas de code reçu.");
        
        const tokens = await ProfDrive.getTokenFromCode(code);
        const refreshToken = tokens.refresh_token;

        if (!refreshToken) {
            return res.send(`
                <h1>⚠️ Pas de Refresh Token !</h1>
                <p>Google n'a renvoyé qu'un accès temporaire.</p>
                <p><strong>Solution :</strong> Supprimez l'accès à "Condamine" dans votre compte Google et réessayez.</p>
            `);
        }

        res.send(`
            <div style="font-family:sans-serif; padding:40px; text-align:center;">
                <h1 style="color:green">✅ NOUVEL ACCÈS CRÉÉ</h1>
                <p>Copiez ce code dans votre fichier <b>.env</b> :</p>
                <textarea style="width:100%; max-width:600px; height:100px; padding:10px; font-family:monospace;">${refreshToken}</textarea>
                <p style="color:red; font-weight:bold;">Redémarrez ensuite le serveur (Ctrl+C puis npm run dev).</p>
            </div>
        `);
    } catch (e) {
        res.status(500).send("Erreur Callback: " + e.message);
    }
});

module.exports = router;
