const mongoose = require('mongoose');

/**
 * 📤 SERVICE : GESTION DES SCANS
 * Mission : Gérer les sessions de capture PilotSnap.
 */
const ScanService = {
    createSession: async (data) => {
        const ScanSession = mongoose.model('ScanSession');
        return await ScanSession.create(data);
    },
    
    addCapture: async (sessionId, type, driveId) => {
        const ScanSession = mongoose.model('ScanSession');
        const field = type === 'subject' ? 'subjectUrls' : 'copyUrls';
        return await ScanSession.findByIdAndUpdate(sessionId, {
            $push: { [field]: driveId }
        }, { new: true });
    },

    deleteSession: async (id) => {
        const ScanSession = mongoose.model('ScanSession');
        // US#9 : Idéalement ici, on supprimerait aussi les fichiers sur Drive
        return await ScanSession.findByIdAndDelete(id);
    }
};

module.exports = ScanService;