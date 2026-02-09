/**
 * 🎛️ EXPERT AUDIO CLIENT (Web Audio API)
 * V8 : ESM Clean export.
 */
const SoundExpert = {
    decodeAudio: async (url, audioCtx) => {
        try {
            const response = await fetch(url);
            if (!response.ok) return null;
            const arrayBuffer = await response.arrayBuffer();
            if (arrayBuffer.byteLength < 50) return null;
            return await audioCtx.decodeAudioData(arrayBuffer);
        } catch (e) {
            return null;
        }
    }
};

export default SoundExpert;
