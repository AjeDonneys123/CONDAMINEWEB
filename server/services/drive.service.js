const { google } = require('googleapis');
const { Readable } = require('stream');

// Vérification des clés
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REFRESH_TOKEN) {
    console.error("❌ ERREUR CRITIQUE : Identifiants Google Drive manquants dans .env");
}

const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID, 
    process.env.GOOGLE_CLIENT_SECRET, 
    process.env.GOOGLE_REDIRECT_URI
);
auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const drive = google.drive({ version: 'v3', auth });

const DriveService = {
    // Crée un dossier ET le rend accessible
    getOrCreateFolder: async (name, parentId = null) => {
        try {
            let q = `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            q += parentId ? ` and '${parentId}' in parents` : ` and 'root' in parents`;
            
            const res = await drive.files.list({ q, fields: 'files(id, name, webViewLink)' });
            
            if (res.data.files?.length > 0) {
                // console.log(`📂 Dossier trouvé : ${name} (${res.data.files[0].id})`);
                return res.data.files[0].id;
            }

            console.log(`✨ Création dossier Drive : ${name} (Parent: ${parentId || 'Root'})`);
            const folder = await drive.files.create({
                resource: { name, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : [] },
                fields: 'id, webViewLink'
            });
            
            // IMPORTANT : On donne la permission "Lecture pour tous" (ou au moins à ton user)
            // pour que tu puisses voir le dossier créé par le Service Account
            await drive.permissions.create({
                fileId: folder.data.id,
                resource: { role: 'writer', type: 'anyone' } // "writer" pour pouvoir y déposer des choses si besoin
            });

            return folder.data.id;
        } catch (e) { 
            console.error(`❌ Erreur Drive (getOrCreateFolder ${name}):`, e.message);
            return null; 
        }
    },

    uploadImage: async (folderId, fileName, base64Data) => {
        try {
            // console.log(`📤 Upload vers Drive ${folderId} : ${fileName}`);
            const buffer = Buffer.from(base64Data.split(',')[1], 'base64');
            const media = { mimeType: 'image/jpeg', body: Readable.from(buffer) };
            
            const file = await drive.files.create({
                resource: { name: fileName, parents: [folderId] },
                media,
                fields: 'id, webViewLink, thumbnailLink'
            });

            // Permission publique pour affichage dans l'app
            await drive.permissions.create({
                fileId: file.data.id,
                resource: { role: 'reader', type: 'anyone' }
            });

            return { id: file.data.id, link: file.data.webViewLink };
        } catch (e) {
            console.error("❌ Erreur Upload Drive:", e.message);
            return null;
        }
    },

    deleteFile: async (id) => { 
        try { await drive.files.delete({ fileId: id }); return true; } 
        catch (e) { console.error("Erreur delete:", e.message); return false; } 
    },

    moveFile: async (fileId, newParentId) => {
        try {
            const file = await drive.files.get({ fileId, fields: 'parents' });
            const previous = file.data.parents?.join(',') || "";
            return await drive.files.update({ fileId, addParents: newParentId, removeParents: previous });
        } catch(e) { console.error("Erreur Move:", e.message); }
    }
};

module.exports = DriveService;