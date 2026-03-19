const crypto = require('crypto');
const mongoose = require('mongoose');

const SECRET_SEED = String(
    process.env.AI_CONFIG_SECRET
    || process.env.GOOGLE_CLIENT_SECRET
    || 'condamine-ai-config-dev-secret'
).trim();

const SECRET_KEY = crypto.createHash('sha256').update(SECRET_SEED).digest();

function isCentralAiAccount(user = null) {
    if (!user) return false;
    const first = String(user.firstName || '').trim().toLowerCase();
    const last = String(user.lastName || '').trim().toLowerCase();
    return (first === 'jean' || first === 'jp') && last === 'vuillet';
}

function encryptApiKey(raw = '') {
    const value = String(raw || '').trim();
    if (!value) return '';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', SECRET_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptApiKey(payload = '') {
    const raw = String(payload || '').trim();
    if (!raw) return '';
    const [ivHex, dataHex] = raw.split(':');
    if (!ivHex || !dataHex) return '';
    const iv = Buffer.from(ivHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', SECRET_KEY, iv);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8').trim();
}

async function getTeacherAiConfig(teacherId = '') {
    const id = String(teacherId || '').trim();
    if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
    const Teacher = mongoose.models.Teacher ? mongoose.model('Teacher') : null;
    const Admin = mongoose.models.Admin ? mongoose.model('Admin') : null;
    if (!Teacher || !Admin) return null;
    const user = await Teacher.findById(id).lean() || await Admin.findById(id).lean();
    if (!user) return null;
    return {
        user,
        isCentral: isCentralAiAccount(user),
        enabled: user.geminiApiEnabled !== false,
        projectId: String(user.geminiProjectId || '').trim(),
        hasEncryptedKey: Boolean(String(user.geminiApiKeyEncrypted || '').trim())
    };
}

async function resolveProfApiKey(teacherId = '') {
    const cfg = await getTeacherAiConfig(teacherId);
    if (!cfg) {
        const fallback = String(process.env.GEMINI_API_KEY || '').trim();
        return { apiKey: fallback, source: fallback ? 'global' : 'missing', projectId: '' };
    }
    if (cfg.isCentral) {
        const fallback = String(process.env.GEMINI_API_KEY || '').trim();
        return {
            apiKey: fallback,
            source: fallback ? 'central' : 'missing',
            projectId: String(cfg.projectId || process.env.GEMINI_PROJECT_ID || '').trim()
        };
    }
    if (cfg.enabled && cfg.hasEncryptedKey) {
        const apiKey = decryptApiKey(cfg.user.geminiApiKeyEncrypted);
        if (apiKey) return { apiKey, source: 'teacher', projectId: cfg.projectId };
    }
    return { apiKey: '', source: 'missing', projectId: cfg.projectId };
}

module.exports = {
    encryptApiKey,
    decryptApiKey,
    isCentralAiAccount,
    getTeacherAiConfig,
    resolveProfApiKey
};
