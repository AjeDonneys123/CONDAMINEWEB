/**
 * 🎛️ EXPERT AUDIO CLIENT (Web Audio API)
 * V10 : Décodage avec Timeout anti-blocage.
 */
const SoundExpert = {
    decodeAudio: async (url, audioCtx) => {
        if (!audioCtx) return null;
        
        // Timeout de sécurité : si le son ne se décode pas en 4s, on abandonne pour ne pas bloquer le jeu
        const timeoutPromise = new Promise(res => setTimeout(() => res(null), 4000));

        const decodePromise = (async () => {
            try {
                console.log(`📡 [SoundExpert] Décodage : ${url}`);
                const response = await fetch(url);
                if (!response.ok) return null;
                
                const arrayBuffer = await response.arrayBuffer();
                if (arrayBuffer.byteLength < 50) return null;

                return new Promise((resolve) => {
                    audioCtx.decodeAudioData(arrayBuffer, 
                        (buffer) => resolve(buffer),
                        () => resolve(null) // Erreur de format
                    );
                });
            } catch (e) { return null; }
        })();

        return Promise.race([decodePromise, timeoutPromise]);
    }
};

export default SoundExpert;
