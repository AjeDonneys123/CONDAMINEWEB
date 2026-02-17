// @signatures: SoundLibraryExpert, getZombieDefaults
const mongoose = require('mongoose');

/**
 * 🎵 EXPERT BIBLIOTHÈQUE SONORE
 * Gère la récupération de sons pré-existants (notamment du projet "Zombie").
 */
const SoundLibraryExpert = {
    
    getZombieDefaults: async () => {
        try {
            const StudioProject = mongoose.model('StudioProject');
            
            // On cherche le projet le plus récent contenant "zombie" dans son titre
            const zombieProject = await StudioProject.findOne({ 
                title: { $regex: /zombie/i } 
            }).sort({ updatedAt: -1 }).lean();

            if (!zombieProject) {
                return [];
            }

            // On renvoie la liste des "globalSounds" de la première scène
            const sounds = zombieProject.scenes?.[0]?.globalSounds || [];
            
            // On ne garde que ceux qui ont vraiment des fichiers sons
            return sounds.filter(s => s.sounds && s.sounds.length > 0);

        } catch (e) {
            console.error("❌ [SOUND-LIB] Erreur fetch zombie defaults:", e.message);
            throw new Error("Impossible de récupérer les sons du Zombie.");
        }
    }
};

module.exports = SoundLibraryExpert;
