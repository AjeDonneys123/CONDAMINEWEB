/**
 * 🎛️ EXPERT AUDIO CLIENT (Web Audio API)
 * V9 : Décodage ultra-robuste pour Simulator.
 */
const SoundExpert = {
    decodeAudio: async (url, audioCtx) => {
        if (!audioCtx) return null;
        try {
            console.log(`📡 [SoundExpert] Décodage : ${url}`);
            const response = await fetch(url);
            if (!response.ok) throw new Error("Fetch Fail");
            
            const arrayBuffer = await response.arrayBuffer();
            if (arrayBuffer.byteLength < 50) throw new Error("Fichier vide");

            return new Promise((resolve, reject) => {
                audioCtx.decodeAudioData(arrayBuffer, 
                    (buffer) => resolve(buffer),
                    (err) => {
                        console.error("❌ Erreur décodage AudioData:", err);
                        resolve(null); // On ne rejette pas pour ne pas bloquer le Promise.all
                    }
                );
            });
        } catch (e) {
            console.error(`❌ [SoundExpert] Crash sur ${url}:`, e.message);
            return null;
        }
    }
};

export default SoundExpert;
