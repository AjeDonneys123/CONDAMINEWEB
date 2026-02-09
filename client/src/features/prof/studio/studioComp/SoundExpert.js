/**
 * 🎛️ EXPERT AUDIO CLIENT (Web Audio API)
 * V5 : Blindage du décodage avec gestion d'erreur robuste.
 */
const SoundExpert = {
    decodeAudio: async (url, audioCtx) => {
        try {
            const response = await fetch(url);
            if (!response.ok) return null;
            const arrayBuffer = await response.arrayBuffer();
            if (arrayBuffer.byteLength < 100) return null; // Fichier trop petit/invalide
            
            return await audioCtx.decodeAudioData(arrayBuffer);
        } catch (e) {
            console.warn("🔇 [SoundExpert] Erreur décodage:", url);
            return null;
        }
    }
};

export default SoundExpert;
