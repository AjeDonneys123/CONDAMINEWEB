const { google } = require('googleapis');

const TEST_RECIPIENT = 'vuillet433@hotmail.com';

function normalize(v = '') {
    return String(v || '').trim().toUpperCase();
}

function isJulianP5B(student) {
    const first = normalize(student?.firstName);
    const last = normalize(student?.lastName);
    const cls = normalize(student?.currentClass).replace(/\s+/g, '');
    return first === 'JULIAN' && last.startsWith('P') && cls === '5B';
}

function resolveRecipient(student) {
    if (isJulianP5B(student)) return TEST_RECIPIENT;
    return (student?.email || '').trim().toLowerCase() || null;
}

function getOauthClient() {
    const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
    const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
    const redirectUri = (process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback').trim();
    const refreshToken = (process.env.GOOGLE_REFRESH_TOKEN || '').trim();
    if (!clientId || !clientSecret || !refreshToken) return null;
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return oauth2Client;
}

function encodeBase64Url(str) {
    return Buffer.from(str, 'utf8')
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

async function sendLatePunishmentMail(student, opts = {}) {
    const force = !!opts.force;
    if (!student) return { sent: false, reason: 'no-student' };
    if (!force && student.punishmentStatus !== 'LATE') return { sent: false, reason: 'not-late' };
    if (!force && student.punishmentLateMailSentAt) return { sent: false, reason: 'already-sent' };

    const to = resolveRecipient(student);
    if (!to) {
        console.warn(`[punishment-mail] skip: no recipient for ${student.firstName || ''} ${student.lastName || ''}`.trim());
        return { sent: false, reason: 'no-recipient' };
    }

    const oauth2Client = getOauthClient();
    if (!oauth2Client) {
        console.warn(`[punishment-mail] skip: gmail oauth not configured (CLIENT_ID=${Boolean(process.env.GOOGLE_CLIENT_ID)} CLIENT_SECRET=${Boolean(process.env.GOOGLE_CLIENT_SECRET)} REFRESH_TOKEN=${Boolean(process.env.GOOGLE_REFRESH_TOKEN)})`);
        return { sent: false, reason: 'gmail-oauth-not-configured' };
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const from = (process.env.EMAIL_USER || 'jean.vuillet@condamine.edu.ec').trim();
    const studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim();
    const className = student.currentClass || 'Classe inconnue';
    const subject = `Punition en retard - ${studentName}`;
    const text = `Bonjour ${studentName},\n\nTa punition est en retard.\nSi elle n'est pas rendue dans une semaine, tes parents seront prévenus par email.\n\nClasse: ${className}\n\nCeci est un message automatique.`;
    const mime = [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        'Content-Type: text/plain; charset="UTF-8"',
        '',
        text
    ].join('\n');
    const raw = encodeBase64Url(mime);

    try {
        await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw }
        });
        student.punishmentLateMailSentAt = new Date();
        student.punishmentLateMailTo = to;
        student.punishmentLateMailError = '';
        console.log(`[punishment-mail] sent to=${to} student=${studentName} class=${className} force=${force}`);
        return { sent: true, to };
    } catch (e) {
        student.punishmentLateMailError = e.message || 'mail-send-failed';
        console.error(`[punishment-mail] failed to=${to} err=${e.message || 'unknown'}`);
        return { sent: false, reason: 'send-error', error: e.message };
    }
}

function resetLateMailState(student) {
    if (!student) return;
    student.punishmentLateMailSentAt = null;
    student.punishmentLateMailTo = '';
    student.punishmentLateMailError = '';
}

module.exports = {
    sendLatePunishmentMail,
    resetLateMailState
};
