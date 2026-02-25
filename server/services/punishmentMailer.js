const { google } = require('googleapis');

function resolveRecipient(student) {
    const globalOverride = (process.env.PUNISHMENT_MAIL_TO_OVERRIDE || '').trim().toLowerCase();
    if (globalOverride) return globalOverride;
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

async function sendMail({ to, subject, text, fromOverride = '' }) {
    const toEmail = (to || '').trim().toLowerCase();
    if (!toEmail) return { sent: false, reason: 'no-recipient' };

    const oauth2Client = getOauthClient();
    if (!oauth2Client) {
        return { sent: false, reason: 'gmail-oauth-not-configured' };
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const from = (fromOverride || process.env.EMAIL_USER || 'jean.vuillet@condamine.edu.ec').trim();
    const safeSubject = String(subject || 'Message').trim();
    const safeText = String(text || '').trim() || 'Message automatique.';
    const mime = [
        `From: ${from}`,
        `To: ${toEmail}`,
        `Subject: ${safeSubject}`,
        `Date: ${new Date().toUTCString()}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset="UTF-8"',
        '',
        safeText
    ].join('\r\n');
    const raw = encodeBase64Url(mime);

    try {
        const sendRes = await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw }
        });
        const messageId = sendRes?.data?.id || '';
        console.log(`[mail] sent to=${toEmail} subject="${safeSubject}" gmailMessageId=${messageId || 'n/a'}`);
        return { sent: true, to: toEmail, from, messageId };
    } catch (e) {
        console.error(`[mail] failed to=${toEmail} err=${e.message || 'unknown'}`);
        return { sent: false, reason: 'send-error', error: e.message };
    }
}

async function sendLatePunishmentMail(student, opts = {}) {
    const force = !!opts.force;
    const toOverride = (opts.toOverride || '').trim().toLowerCase();
    if (!student) return { sent: false, reason: 'no-student' };
    if (!force && student.punishmentStatus !== 'LATE') return { sent: false, reason: 'not-late' };
    if (!force && student.punishmentLateMailSentAt) return { sent: false, reason: 'already-sent' };

    const to = toOverride || resolveRecipient(student);
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
    const text = `Bonjour ${studentName},\n\nTa punition est en retard.\nSi elle n'est pas rendue dans une semaine, tes parents seront prévenus par email.\n\nRends ta punition ici: https://condaweb.vercel.app/\nClasse: ${className}\n\nCeci est un message automatique.`;
    const mime = [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${subject}`,
        `Date: ${new Date().toUTCString()}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset="UTF-8"',
        '',
        text
    ].join('\r\n');
    const raw = encodeBase64Url(mime);

    try {
        const sendRes = await gmail.users.messages.send({
            userId: 'me',
            requestBody: { raw }
        });
        student.punishmentLateMailSentAt = new Date();
        student.punishmentLateMailTo = to;
        student.punishmentLateMailError = '';
        const messageId = sendRes?.data?.id || '';
        console.log(`[punishment-mail] sent to=${to} student=${studentName} class=${className} force=${force} gmailMessageId=${messageId || 'n/a'}`);
        return { sent: true, to, from, messageId };
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
    sendMail,
    sendLatePunishmentMail,
    resetLateMailState
};
