// @signatures: ProfDrive, getAuthUrl, getFileStream, getOrCreateFolder, getTokenFromCode, init, uploadFile
const { google } = require('googleapis');
const fs = require('fs');

console.log("☁️ [DRIVE-CORE] Initialisation...");

let oauth2Client = null;

const ProfDrive = {
    init: () => {
        try {
            const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
            const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();
            const redirectUri = (process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/google/callback").trim();

            if (!clientId || !clientSecret) {
                console.error("❌ [DRIVE] CREDENTIALS MANQUANTS");
                return;
            }

            oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
            
            if (process.env.GOOGLE_REFRESH_TOKEN) {
                oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN.trim() });
                console.log("✅ Drive Auth Ready.");
            }
        } catch (e) {
            console.error("❌ CRASH INIT DRIVE:", e.message);
        }
    },

    getAuthUrl: () => {
        if (!oauth2Client) throw new Error("Client OAuth non initialisé.");
        return oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: [
                'https://www.googleapis.com/auth/drive.file',
                'https://www.googleapis.com/auth/drive.readonly',
                'https://www.googleapis.com/auth/documents',
                'https://www.googleapis.com/auth/presentations',
                'https://www.googleapis.com/auth/gmail.send'
            ],
            prompt: 'consent'
        });
    },

    getTokenFromCode: async (code) => {
        if (!oauth2Client) throw new Error("Client OAuth non initialisé.");
        const { tokens } = await oauth2Client.getToken(code);
        return tokens;
    },

    getFileStream: async (fileId) => {
        if (!oauth2Client) throw new Error("Drive non connecté");
        try {
            const drive = google.drive({ version: 'v3', auth: oauth2Client });
            const res = await drive.files.get(
                { fileId: fileId, alt: 'media' },
                { responseType: 'stream' }
            );
            return res.data;
        } catch (e) {
            console.error(`❌ Drive Stream Error [${fileId}]:`, e.message);
            throw e;
        }
    },

    getFileResponse: async (fileId, range = '') => {
        if (!oauth2Client) throw new Error("Drive non connecté");
        try {
            const drive = google.drive({ version: 'v3', auth: oauth2Client });
            const opts = { responseType: 'stream', validateStatus: () => true };
            if (range) opts.headers = { Range: range };
            const res = await drive.files.get(
                { fileId: fileId, alt: 'media' },
                opts
            );
            return {
                status: Number(res.status || 200),
                headers: res.headers || {},
                stream: res.data
            };
        } catch (e) {
            console.error(`❌ Drive Stream Response Error [${fileId}]:`, e.message);
            throw e;
        }
    },

    deleteFile: async (fileId) => {
        if (!oauth2Client) throw new Error("Drive non connecté");
        if (!fileId) throw new Error("fileId manquant");
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        await drive.files.update({ fileId, resource: { trashed: true } });
    },

    getOrCreateFolder: async (name, parentId = null) => {
        if (!oauth2Client) throw new Error("Drive non connecté");
        try {
            const drive = google.drive({ version: 'v3', auth: oauth2Client });
            const q = `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false ${parentId ? `and '${parentId}' in parents` : ''}`;
            const res = await drive.files.list({ q, fields: 'files(id)' });
            if (res.data.files.length > 0) return res.data.files[0].id;
            const folder = await drive.files.create({
                resource: { name, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : [] },
                fields: 'id'
            });
            return folder.data.id;
        } catch (e) { throw e; }
    },

    uploadFile: async (fileName, localPath, parentFolderId) => {
        if (!oauth2Client) throw new Error("Drive non connecté");
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const file = await drive.files.create({
            resource: { name: fileName, parents: [parentFolderId] },
            media: { body: fs.createReadStream(localPath) },
            fields: 'id'
        });
        await drive.permissions.create({ fileId: file.data.id, resource: { role: 'reader', type: 'anyone' } });
        return { id: file.data.id };
    },

    createGoogleDoc: async (title, parentFolderId = null) => {
        if (!oauth2Client) throw new Error("Drive non connecté");
        const docs = google.docs({ version: 'v1', auth: oauth2Client });
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const created = await docs.documents.create({
            requestBody: { title: String(title || 'Brouillon élève').slice(0, 180) }
        });
        const docId = String(created?.data?.documentId || '');
        if (!docId) throw new Error("Création Google Doc échouée");

        if (parentFolderId) {
            const meta = await drive.files.get({ fileId: docId, fields: 'parents' });
            const previousParents = (meta.data.parents || []).join(',');
            await drive.files.update({
                fileId: docId,
                addParents: parentFolderId,
                removeParents: previousParents || undefined,
                fields: 'id, parents'
            });
        }
        // Partage explicite pour éviter les 404 côté iframe élève.
        await drive.permissions.create({
            fileId: docId,
            requestBody: { role: 'writer', type: 'anyone' }
        });
        return {
            docId,
            editUrl: `https://docs.google.com/document/d/${docId}/edit`,
            embedUrl: `https://docs.google.com/document/d/${docId}/edit?embedded=true`
        };
    },

    createGoogleSlides: async (title, parentFolderId = null) => {
        if (!oauth2Client) throw new Error("Drive non connecté");
        const slides = google.slides({ version: 'v1', auth: oauth2Client });
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const created = await slides.presentations.create({
            requestBody: { title: String(title || 'Support élève').slice(0, 180) }
        });
        const presentationId = String(created?.data?.presentationId || '');
        if (!presentationId) throw new Error("Création Google Slides échouée");

        if (parentFolderId) {
            const meta = await drive.files.get({ fileId: presentationId, fields: 'parents' });
            const previousParents = (meta.data.parents || []).join(',');
            await drive.files.update({
                fileId: presentationId,
                addParents: parentFolderId,
                removeParents: previousParents || undefined,
                fields: 'id, parents'
            });
        }
        // Partage explicite pour éviter les 404 côté iframe élève.
        await drive.permissions.create({
            fileId: presentationId,
            requestBody: { role: 'writer', type: 'anyone' }
        });
        return {
            presentationId,
            editUrl: `https://docs.google.com/presentation/d/${presentationId}/edit`,
            embedUrl: `https://docs.google.com/presentation/d/${presentationId}/embed`
        };
    },

    getGoogleDocStats: async (docId) => {
        if (!oauth2Client) throw new Error("Drive non connecté");
        const docs = google.docs({ version: 'v1', auth: oauth2Client });
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const [doc, revs] = await Promise.all([
            docs.documents.get({ documentId: docId }),
            drive.revisions.list({ fileId: docId, pageSize: 200, fields: 'revisions(id,modifiedTime,lastModifyingUser(displayName))' })
        ]);
        const body = doc?.data?.body?.content || [];
        const text = body
            .flatMap((block) => (block?.paragraph?.elements || []))
            .map((el) => String(el?.textRun?.content || ''))
            .join(' ');
        const words = text.trim().split(/\s+/).filter(Boolean);
        const revisions = Array.isArray(revs?.data?.revisions) ? revs.data.revisions : [];
        return {
            wordCount: words.length,
            charCount: text.trim().length,
            revisionCount: revisions.length,
            lastRevisionAt: revisions.length ? revisions[revisions.length - 1].modifiedTime : null
        };
    },

    replaceGoogleDocContent: async (docId, text = '') => {
        if (!oauth2Client) throw new Error("Drive non connecté");
        if (!docId) throw new Error("docId manquant");
        const docs = google.docs({ version: 'v1', auth: oauth2Client });
        const safeText = String(text || '');
        const doc = await docs.documents.get({ documentId: docId });
        const endIndex = Number(doc?.data?.body?.content?.[doc.data.body.content.length - 1]?.endIndex || 1);
        const requests = [];
        if (endIndex > 2) {
            requests.push({
                deleteContentRange: {
                    range: { startIndex: 1, endIndex: endIndex - 1 }
                }
            });
        }
        if (safeText.length > 0) {
            requests.push({
                insertText: {
                    location: { index: 1 },
                    text: safeText
                }
            });
        }
        if (requests.length > 0) {
            await docs.documents.batchUpdate({
                documentId: docId,
                requestBody: { requests }
            });
        }
        return true;
    },

    extractSlidesPresentationId: (rawUrl = '') => {
        const raw = String(rawUrl || '').trim();
        if (!raw) return '';
        const idOnly = raw.match(/^[a-zA-Z0-9_-]{20,}$/);
        if (idOnly?.[0]) return idOnly[0];
        const m = raw.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/i) || raw.match(/\/design\/([a-zA-Z0-9_-]+)/i);
        return m?.[1] ? m[1] : '';
    },

    getGoogleSlidesText: async (presentationRef, selectedSlideNumbers = []) => {
        if (!oauth2Client) throw new Error("Drive non connecté");
        const presentationId = ProfDrive.extractSlidesPresentationId(presentationRef);
        if (!presentationId) throw new Error("ID présentation introuvable");
        const slidesApi = google.slides({ version: 'v1', auth: oauth2Client });
        const pres = await slidesApi.presentations.get({ presentationId });
        const title = String(pres?.data?.title || '');
        const allSlides = Array.isArray(pres?.data?.slides) ? pres.data.slides : [];
        const wanted = new Set(
            (Array.isArray(selectedSlideNumbers) ? selectedSlideNumbers : [])
                .map((n) => Number(n))
                .filter((n) => Number.isInteger(n) && n > 0)
        );
        const rows = [];
        allSlides.forEach((slide, idx) => {
            const slideNumber = idx + 1;
            if (wanted.size > 0 && !wanted.has(slideNumber)) return;
            const texts = [];
            (slide?.pageElements || []).forEach((el) => {
                const elements = el?.shape?.text?.textElements || [];
                elements.forEach((te) => {
                    const content = String(te?.textRun?.content || '').replace(/\s+/g, ' ').trim();
                    if (content) texts.push(content);
                });
            });
            rows.push({
                slideNumber,
                objectId: String(slide?.objectId || ''),
                text: texts.join(' ').trim()
            });
        });
        return {
            presentationId,
            title,
            slides: rows,
            combinedText: rows.map((r) => `Slide ${r.slideNumber}: ${r.text}`).join('\n').trim()
        };
    }
};

ProfDrive.init();
module.exports = ProfDrive;
