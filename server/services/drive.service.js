// ... (garder le début du fichier avec auth et drive)

const DriveService = {
    // ... (garder les fonctions existantes : getOrCreateFolder, renameFolder, deleteFolder, uploadImage, makePublic)

    // NOUVELLE FONCTION POUR LE RAPPORT TXT
    uploadRawFile: async (folderId, fileName, media) => {
        try {
            const file = await drive.files.create({
                resource: { name: fileName, parents: [folderId] },
                media: media,
                fields: 'id, webViewLink'
            });
            await DriveService.makePublic(file.data.id);
            return { id: file.data.id, link: file.data.webViewLink };
        } catch (e) {
            console.error("❌ Error Raw Upload:", e.message);
            return null;
        }
    },
    
    // (Recopie ici le reste de tes fonctions habituelles pour être sûr que le fichier soit complet)
    getOrCreateFolder: async (name, parentId = null) => {
        let q = `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
        if (parentId) q += ` and '${parentId}' in parents`;
        const res = await drive.files.list({ q, fields: 'files(id, name)' });
        if (res.data.files.length > 0) return res.data.files[0].id;
        const folder = await drive.files.create({ resource: { name, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : [] }, fields: 'id' });
        await DriveService.makePublic(folder.data.id);
        return folder.data.id;
    },
    uploadImage: async (folderId, fileName, base64Data) => {
        const buffer = Buffer.from(base64Data.split(',')[1], 'base64');
        const media = { mimeType: 'image/jpeg', body: require('stream').Readable.from(buffer) };
        const file = await drive.files.create({ resource: { name: fileName, parents: [folderId] }, media, fields: 'id, webViewLink' });
        await DriveService.makePublic(file.data.id);
        return { id: file.data.id, link: file.data.webViewLink };
    },
    renameFolder: async (id, name) => drive.files.update({ fileId: id, resource: { name } }),
    deleteFolder: async (id) => drive.files.delete({ fileId: id }),
    makePublic: async (id) => drive.permissions.create({ fileId: id, resource: { role: 'reader', type: 'anyone' } }),
    listFilesInFolder: async (id) => {
        const res = await drive.files.list({ q: `'${id}' in parents and trashed = false`, fields: 'files(id, name, webViewLink, thumbnailLink)' });
        return res.data.files;
    }
};

module.exports = DriveService;