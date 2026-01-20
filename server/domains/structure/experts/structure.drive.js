const { google } = require('googleapis');
const DriveEngine = require('../../../core/drive.engine');
const mongoose = require('mongoose');

const VAULT_NAME = "CONDA_PROJECT_VAULT";

/**
 * 🛠️ EXPERT DRIVE STRUCTURE - VERSION 102
 * Intègre le moteur de streaming pour le proxy d'images.
 */
const StructureDrive = {
    ensureVault: async () => {
        try { return await DriveEngine.getOrCreateFolder(VAULT_NAME); } 
        catch (e) { return null; }
    },

    /**
     * V102 : RÉCUPÉRATION DU FLUX BINAIRE
     * Permet au serveur de servir l'image à la place de Google.
     */
    getFileStream: async (fileId) => {
        try {
            const drive = google.drive({ version: 'v3', auth: DriveEngine.oauth2Client });
            const res = await drive.files.get(
                { fileId: fileId, alt: 'media' },
                { responseType: 'stream' }
            );
            return res.data;
        } catch (e) {
            console.error("❌ Stream Error:", e.message);
            throw e;
        }
    },

    getDriveTree: async () => {
        try {
            if (!DriveEngine.oauth2Client) throw new Error("No Auth");
            const drive = google.drive({ version: 'v3', auth: DriveEngine.oauth2Client });
            const vaultId = await StructureDrive.ensureVault();
            const res = await drive.files.list({ q: `'${vaultId}' in parents and trashed = false`, fields: 'files(id, name, mimeType, webViewLink)', pageSize: 50, orderBy: 'createdTime desc' });
            return { name: VAULT_NAME, id: vaultId, type: 'folder', children: res.data.files.map(f => ({ id: f.id, name: f.name, type: f.mimeType === 'application/vnd.google-apps.folder' ? 'folder' : 'file', link: f.webViewLink })) };
        } catch (e) { return { name: VAULT_NAME, error: e.message }; }
    },

    deleteDriveItem: async (id) => {
        const drive = google.drive({ version: 'v3', auth: DriveEngine.oauth2Client });
        await drive.files.update({ fileId: id, resource: { trashed: true } });
        return { ok: true };
    },

    syncBaseStructure: async () => {
        await StructureDrive.ensureVault();
        return { ok: true };
    }
};

module.exports = StructureDrive;