/**
 * 🎛️ EXPERT AUDIO CLIENT (Web Audio API)
 * V6 : Décodage ultra-tolérant (ne bloque pas si erreur)
 */
const SoundExpert = {
    decodeAudio: async (url, audioCtx) => {
        try {
            const response = await fetch(url);
            if (!response.ok) return null;
            const arrayBuffer = await response.arrayBuffer();
            if (arrayBuffer.byteLength < 50) return null;
            
            // decodeAudioData renvoie une promesse
            return await audioCtx.decodeAudioData(arrayBuffer);
        } catch (e) {
            console.warn("🔇 Audio non décodable:", url);
            return null;
        }
    }
};
export default SoundExpert;
