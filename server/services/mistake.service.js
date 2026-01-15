const mongoose = require('mongoose');

/**
 * 🛠️ SERVICE : GESTION DES ERREURS (OPTIMUM)
 * US#11 : Découple la sauvegarde des fautes d'orthographe.
 * Utilisé par : Devoirs (Correction IA) et Jeux (Analyses futures).
 */
const MistakeService = {
    archiveMistakes: async (playerId, corrections) => {
        if (!playerId || !corrections || !Array.isArray(corrections)) return;
        try {
            const Player = mongoose.model('Player');
            await Player.findByIdAndUpdate(playerId, {
                $push: { spellingMistakes: { $each: corrections } }
            });
            console.log(`📝 [MISTAKE_SERVICE] ${corrections.length} erreurs archivées pour l'élève.`);
        } catch (e) {
            console.error("❌ [MISTAKE_SERVICE] Erreur archive:", e.message);
        }
    }
};

module.exports = MistakeService;