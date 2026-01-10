const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const DriveService = require('../../services/drive.service');

// ... (Garder GetSuffix, Liste sessions, Création, Rename, Delete)

// --- SUPPRIMER UNE PHOTO (MISE À JOUR IMMÉDIATE) ---
router.post('/scan-delete-photo', async (req, res) => {
    try {
        const { sessionId, type, url } = req.body;
        const field = type === 'quest' ? { questionUrls: url } : { copyUrls: url };
        
        // 1. On cherche l'ID Drive dans l'URL pour supprimer le fichier physique
        const idMatch = url.match(/id=([-\w]{25,})/) || url.match(/\/d\/([-\w]{25,})/);
        if (idMatch) await DriveService.deleteFolder(idMatch[1]);

        // 2. On retire l'URL de la liste en BDD
        const updated = await mongoose.model('ScanSession').findByIdAndUpdate(
            sessionId,
            { $pull: field },
            { new: true }
        );
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// ... (Garder upload et instructions)
module.exports = router;