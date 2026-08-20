// @signatures: ProfDrive, getAuthUrl, getFileStream, getOrCreateFolder, getTokenFromCode, init, uploadFile
const { google } = require('googleapis');
const fs = require('fs');
const fetch = require('node-fetch');
const { maybeTranscodeUpload } = require('../../core/videoTranscode');
const OCREngine = require('../../core/ocr.engine');

console.log("☁️ [DRIVE-CORE] Initialisation...");

let oauth2Client = null;

const normalizeSlidesTextChunk = (value = '') => String(value || '').replace(/\s+/g, ' ').trim();

const collectSlidesTextAndColors = (pageElements = [], detectColor = null) => {
    const texts = [];
    const colors = new Set();

    const pushTextElements = (elements = []) => {
        (Array.isArray(elements) ? elements : []).forEach((te) => {
            const content = normalizeSlidesTextChunk(te?.textRun?.content || te?.autoText?.content || '');
            if (content) texts.push(content);
            if (typeof detectColor === 'function') {
                const rgb = te?.textRun?.style?.foregroundColor?.opaqueColor?.rgbColor;
                const cname = detectColor(rgb);
                if (cname) colors.add(cname);
            }
        });
    };

    const visitElement = (el) => {
        if (!el || typeof el !== 'object') return;
        pushTextElements(el?.shape?.text?.textElements);
        pushTextElements(el?.wordArt?.text ? [{ textRun: { content: el.wordArt.text } }] : []);
        const rows = Array.isArray(el?.table?.tableRows) ? el.table.tableRows : [];
        rows.forEach((row) => {
            const cells = Array.isArray(row?.tableCells) ? row.tableCells : [];
            cells.forEach((cell) => {
                const cellElements = Array.isArray(cell?.text?.textElements) ? cell.text.textElements : [];
                pushTextElements(cellElements);
            });
        });
        const children = Array.isArray(el?.group?.children) ? el.group.children : [];
        children.forEach(visitElement);
    };

    (Array.isArray(pageElements) ? pageElements : []).forEach(visitElement);
    return { texts, colors: Array.from(colors) };
};

const collectSlidesTitleCandidates = (pageElements = []) => {
    const rows = [];
    const visitTextElements = (elements = [], isTitle = false) => {
        (Array.isArray(elements) ? elements : []).forEach((element) => {
            const text = normalizeSlidesTextChunk(element?.textRun?.content || element?.autoText?.content || '');
            if (!text) return;
            rows.push({
                text,
                fontSize: Number(element?.textRun?.style?.fontSize?.magnitude || 0),
                isTitle
            });
        });
    };
    const visitElement = (element) => {
        if (!element || typeof element !== 'object') return;
        const placeholderType = String(element?.shape?.placeholder?.type || '').toUpperCase();
        const isTitle = placeholderType === 'TITLE' || placeholderType === 'CENTERED_TITLE';
        visitTextElements(element?.shape?.text?.textElements, isTitle);
        if (element?.wordArt?.text) rows.push({ text: normalizeSlidesTextChunk(element.wordArt.text), fontSize: 100, isTitle: true });
        (element?.table?.tableRows || []).forEach((row) => (row?.tableCells || []).forEach((cell) => visitTextElements(cell?.text?.textElements)));
        (element?.group?.children || []).forEach(visitElement);
    };
    (Array.isArray(pageElements) ? pageElements : []).forEach(visitElement);
    return rows;
};

const chapterMarkerPattern = /^(?:ch(?:apitre)?\.?\s*(?:n[°o]\s*)?(?:\d+|[ivxlcdm]+)\b|chapitre\b)/i;

const extractSlideTextViaOcr = async ({ presentationId = '', pageObjectId = '', slideNumber = 0, slidesApi = null }) => {
    const pid = String(presentationId || '').trim();
    const oid = String(pageObjectId || '').trim();
    const num = Math.max(0, Number(slideNumber || 0));
    if (!pid || !oid || !num || !oauth2Client || !slidesApi) return '';
    try {
        const thumb = await slidesApi.presentations.pages.getThumbnail({
            presentationId: pid,
            pageObjectId: oid,
            thumbnailProperties_mimeType: 'PNG',
            thumbnailProperties_thumbnailSize: 'LARGE'
        });
        const contentUrl = String(thumb?.data?.contentUrl || '').trim();
        if (!contentUrl) return '';
        const tokenObj = await oauth2Client.getAccessToken();
        const token = typeof tokenObj === 'string' ? tokenObj : String(tokenObj?.token || '').trim();
        const resp = await fetch(contentUrl, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            timeout: 10000
        });
        if (!resp.ok) return '';
        const arr = await resp.arrayBuffer();
        const base64 = Buffer.from(arr).toString('base64');
        const ocr = await OCREngine.extractText(base64);
        if (!ocr?.success) return '';
        return String(ocr.filteredText || ocr.text || '').replace(/\r/g, '').trim();
    } catch (_) {
        return '';
    }
};

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
        const prepared = await maybeTranscodeUpload({ localPath, originalName: fileName });
        const uploadPath = prepared.uploadPath || localPath;
        const uploadName = prepared.uploadName || fileName;
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        try {
            const file = await drive.files.create({
                resource: { name: uploadName, parents: [parentFolderId] },
                media: { body: fs.createReadStream(uploadPath) },
                fields: 'id'
            });
            await drive.permissions.create({ fileId: file.data.id, resource: { role: 'reader', type: 'anyone' } });
            return { id: file.data.id, transcoded: !!prepared.transcoded, name: uploadName };
        } finally {
            (prepared.cleanup || []).forEach((p) => {
                try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {}
            });
        }
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

    splitGoogleSlidesByChapter: async (presentationRef = '') => {
        if (!oauth2Client) throw new Error("Drive non connecté");
        const presentationId = ProfDrive.extractSlidesPresentationId(presentationRef);
        if (!presentationId) throw new Error("ID présentation introuvable");
        const slidesApi = google.slides({ version: 'v1', auth: oauth2Client });
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const pres = await slidesApi.presentations.get({ presentationId });
        const sourceTitle = String(pres?.data?.title || 'Présentation').trim();
        const slides = Array.isArray(pres?.data?.slides) ? pres.data.slides : [];
        const boundaries = [];

        slides.forEach((slide, index) => {
            const candidates = collectSlidesTitleCandidates(slide?.pageElements || []);
            const marker = candidates.find((row) => chapterMarkerPattern.test(row.text)
                && (row.isTitle || row.fontSize >= 24 || (row.fontSize === 0 && candidates.length <= 4)));
            if (!marker) return;
            const extracted = collectSlidesTextAndColors(slide?.pageElements || []);
            const fullText = normalizeSlidesTextChunk(extracted.texts.join(' '));
            boundaries.push({ index, slideNumber: index + 1, title: (fullText || marker.text).slice(0, 140) });
        });

        if (!boundaries.length) {
            throw Object.assign(new Error('Aucun grand titre « CH » ou « Chapitre » détecté dans la présentation.'), { status: 422 });
        }

        const chapters = [];
        for (let index = 0; index < boundaries.length; index += 1) {
            const start = boundaries[index].index;
            const end = index + 1 < boundaries.length ? boundaries[index + 1].index - 1 : slides.length - 1;
            const chapterTitle = boundaries[index].title || `Chapitre ${index + 1}`;
            const copy = await drive.files.copy({
                fileId: presentationId,
                requestBody: { name: `${chapterTitle} — NotebookLM`.slice(0, 180) },
                fields: 'id,name'
            });
            const copyId = String(copy?.data?.id || '');
            if (!copyId) throw new Error(`Copie du chapitre ${index + 1} impossible`);
            const deleteRequests = slides
                .filter((_slide, slideIndex) => slideIndex < start || slideIndex > end)
                .map((slide) => ({ deleteObject: { objectId: String(slide?.objectId || '') } }))
                .filter((request) => request.deleteObject.objectId);
            if (deleteRequests.length) {
                await slidesApi.presentations.batchUpdate({
                    presentationId: copyId,
                    requestBody: { requests: deleteRequests }
                });
            }
            chapters.push({
                title: chapterTitle,
                startSlide: start + 1,
                endSlide: end + 1,
                slideCount: end - start + 1,
                presentationId: copyId,
                editUrl: `https://docs.google.com/presentation/d/${copyId}/edit`
            });
        }
        return { sourcePresentationId: presentationId, sourceTitle, chapters };
    },

    createGoogleSlidesRange: async (presentationRef = '', startSlide = 1, endSlide = 1, title = '') => {
        if (!oauth2Client) throw new Error("Drive non connecté");
        const presentationId = ProfDrive.extractSlidesPresentationId(presentationRef);
        if (!presentationId) throw new Error("ID présentation introuvable");
        const slidesApi = google.slides({ version: 'v1', auth: oauth2Client });
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const pres = await slidesApi.presentations.get({ presentationId });
        const slides = Array.isArray(pres?.data?.slides) ? pres.data.slides : [];
        const start = Math.max(1, Number(startSlide || 0));
        const end = Math.min(slides.length, Number(endSlide || 0));
        if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) {
            throw Object.assign(new Error(`Sélection invalide. Choisis une plage comprise entre 1 et ${slides.length}.`), { status: 400 });
        }
        const copy = await drive.files.copy({
            fileId: presentationId,
            requestBody: { name: `${String(title || `Slides ${start}-${end}`).trim()} — NotebookLM`.slice(0, 180) },
            fields: 'id,name'
        });
        const copyId = String(copy?.data?.id || '');
        if (!copyId) throw new Error('Copie de la présentation impossible');
        const deleteRequests = slides
            .filter((_slide, index) => index + 1 < start || index + 1 > end)
            .map((slide) => ({ deleteObject: { objectId: String(slide?.objectId || '') } }))
            .filter((request) => request.deleteObject.objectId);
        if (deleteRequests.length) {
            await slidesApi.presentations.batchUpdate({ presentationId: copyId, requestBody: { requests: deleteRequests } });
        }
        await drive.permissions.create({
            fileId: copyId,
            requestBody: {
                type: 'anyone',
                role: 'reader',
                allowFileDiscovery: false
            },
            fields: 'id,role,type'
        });
        return {
            presentationId: copyId,
            editUrl: `https://docs.google.com/presentation/d/${copyId}/edit`,
            publicReaderUrl: `https://docs.google.com/presentation/d/${copyId}/view`,
            publicAccess: 'reader',
            startSlide: start,
            endSlide: end,
            slideCount: end - start + 1
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

    replaceGoogleDocContent: async (docId, text = '', boldRanges = []) => {
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
            (Array.isArray(boldRanges) ? boldRanges : []).slice(0, 500).forEach((range) => {
                const start = Math.max(0, Math.min(safeText.length, Number(range?.start || 0)));
                const end = Math.max(start, Math.min(safeText.length, Number(range?.end || 0)));
                if (end <= start) return;
                requests.push({
                    updateTextStyle: {
                        range: { startIndex: start + 1, endIndex: end + 1 },
                        textStyle: { bold: true },
                        fields: 'bold'
                    }
                });
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
        for (let idx = 0; idx < allSlides.length; idx += 1) {
            const slide = allSlides[idx];
            const slideNumber = idx + 1;
            if (wanted.size > 0 && !wanted.has(slideNumber)) continue;
            const extracted = collectSlidesTextAndColors(slide?.pageElements || []);
            let text = extracted.texts.join(' ').trim();
            if (!text && wanted.size > 0) {
                text = await extractSlideTextViaOcr({
                    presentationId,
                    pageObjectId: String(slide?.objectId || ''),
                    slideNumber,
                    slidesApi
                });
            }
            rows.push({
                slideNumber,
                objectId: String(slide?.objectId || ''),
                text
            });
        }
        return {
            presentationId,
            title,
            slides: rows,
            combinedText: rows.map((r) => `Slide ${r.slideNumber}: ${r.text}`).join('\n').trim()
        };
    },

    getGoogleSlidesManifest: async (presentationRef, selectedSlideNumbers = [], filterCondition = '', includeThumbnails = true) => {
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
        const cond = String(filterCondition || '').trim().toLowerCase();
        const colorAliases = {
            red: ['red', 'rouge'],
            green: ['green', 'vert', 'verte'],
            blue: ['blue', 'bleu', 'bleue'],
            yellow: ['yellow', 'jaune'],
            orange: ['orange'],
            purple: ['purple', 'violet', 'violette'],
            black: ['black', 'noir', 'noire'],
            white: ['white', 'blanc', 'blanche']
        };
        const normalizeColor = (raw = '') => {
            const k = String(raw || '').trim().toLowerCase().replace(/^couleur\s*:\s*/, '').replace(/^color\s*:\s*/, '');
            if (!k) return '';
            const hit = Object.entries(colorAliases).find(([, labels]) => labels.includes(k));
            return hit?.[0] || '';
        };
        const targetColor = normalizeColor(cond);
        const detectColor = (rgb = {}) => {
            const r = Number(rgb?.red || 0);
            const g = Number(rgb?.green || 0);
            const b = Number(rgb?.blue || 0);
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            if (max < 0.18) return 'black';
            if (min > 0.82) return 'white';
            if (r > 0.82 && g > 0.62 && b < 0.35) return 'orange';
            if (r > 0.8 && g > 0.8 && b < 0.35) return 'yellow';
            if (r > g + 0.15 && r > b + 0.15) return 'red';
            if (g > r + 0.12 && g > b + 0.12) return 'green';
            if (b > r + 0.12 && b > g + 0.12) return 'blue';
            if (r > 0.45 && b > 0.45 && g < 0.45) return 'purple';
            return '';
        };
        const rows = [];
        for (let idx = 0; idx < allSlides.length; idx += 1) {
            const slide = allSlides[idx];
            const slideNumber = idx + 1;
            if (wanted.size > 0 && !wanted.has(slideNumber)) continue;
            const extracted = collectSlidesTextAndColors(slide?.pageElements || [], detectColor);
            const text = extracted.texts.join(' ').trim();
            const colors = new Set(extracted.colors);
            if (targetColor) {
                if (!colors.has(targetColor)) continue;
            } else if (cond && !text.toLowerCase().includes(cond)) {
                continue;
            }
            let thumbnailUrl = '';
            if (includeThumbnails) {
                try {
                    const thumb = await slidesApi.presentations.pages.getThumbnail({
                        presentationId,
                        pageObjectId: String(slide?.objectId || ''),
                        thumbnailProperties_mimeType: 'PNG',
                        thumbnailProperties_thumbnailSize: 'LARGE'
                    });
                    thumbnailUrl = String(thumb?.data?.contentUrl || '').trim();
                } catch (_) {}
            }
            rows.push({
                slideNumber,
                objectId: String(slide?.objectId || ''),
                text,
                colors: Array.from(colors),
                thumbnailUrl
            });
        }
        return {
            presentationId,
            title,
            slides: rows
        };
    },

    getGoogleSlideThumbnailUrl: async (presentationRef = '', pageObjectId = '', slideNumber = 0) => {
        if (!oauth2Client) throw new Error("Drive non connecté");
        const presentationId = ProfDrive.extractSlidesPresentationId(presentationRef);
        if (!presentationId) throw new Error("ID présentation introuvable");
        const slidesApi = google.slides({ version: 'v1', auth: oauth2Client });
        let pageId = String(pageObjectId || '').trim();

        const resolveFromIndex = async () => {
            const idx = Math.max(1, Number(slideNumber || 0));
            if (!Number.isInteger(idx) || idx <= 0) return '';
            const pres = await slidesApi.presentations.get({ presentationId });
            const slides = Array.isArray(pres?.data?.slides) ? pres.data.slides : [];
            return String(slides[idx - 1]?.objectId || '').trim();
        };

        if (!pageId || pageId.length <= 2) {
            pageId = await resolveFromIndex();
        }
        if (!pageId) throw new Error("pageObjectId requis");

        const thumb = await slidesApi.presentations.pages.getThumbnail({
            presentationId,
            pageObjectId: pageId,
            thumbnailProperties_mimeType: 'PNG',
            thumbnailProperties_thumbnailSize: 'LARGE'
        });
        const contentUrl = String(thumb?.data?.contentUrl || '').trim();
        if (!contentUrl) throw new Error("Miniature indisponible");
        return { presentationId, pageObjectId: pageId, contentUrl };
    },

    getGoogleSlideThumbnailBinary: async (presentationRef = '', pageObjectId = '', slideNumber = 0) => {
        const out = await ProfDrive.getGoogleSlideThumbnailUrl(presentationRef, pageObjectId, slideNumber);
        const tokenObj = await oauth2Client.getAccessToken();
        const token = typeof tokenObj === 'string' ? tokenObj : String(tokenObj?.token || '').trim();
        const resp = await fetch(out.contentUrl, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            timeout: 10000
        });
        if (!resp.ok) throw new Error(`Miniature HTTP ${resp.status}`);
        const arr = await resp.arrayBuffer();
        const buffer = Buffer.from(arr);
        const contentType = String(resp.headers.get('content-type') || 'image/png');
        return { presentationId: out.presentationId, pageObjectId: out.pageObjectId, buffer, contentType };
    }
};

ProfDrive.init();
module.exports = ProfDrive;
