/**
 * 🎛️ EXPERT AUDIO CLIENT (Web Audio API)
 * V11 : Isolation totale des erreurs.
 */
const SoundExpert = {
    decodeAudio: async (url, audioCtx) => {
        if (!audioCtx) return null;
        try {
            const response = await fetch(url);
            if (!response.ok) return null;
            
            const arrayBuffer = await response.arrayBuffer();
            // On vérifie que ce n'est pas du HTML ou un fichier trop petit
            if (arrayBuffer.byteLength < 100) return null;

            return new Promise((resolve) => {
                audioCtx.decodeAudioData(arrayBuffer, 
                    (buffer) => resolve(buffer),
                    () => {
                        console.warn("Format audio non supporté:", url);
                        resolve(null);
                    }
                );
            });
        } catch (e) {
            return null;
        }
    }
};

export default SoundExpert;
