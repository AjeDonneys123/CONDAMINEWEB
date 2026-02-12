/**
 * 🎛️ SOUND EXPERT V555 (FULL DSP SUITE)
 * Service partagé pour la gestion audio (Décodage + Effets).
 * Comprend : Decode, Trim, Speed, Gain, Reverse, Robotize, WavExport.
 */

// Cache mémoire pour éviter de re-télécharger/re-décoder les sons en boucle
const audioCache = new Map();

const SoundExpert = {
    // --- 1. CORE : DÉCODAGE ---
    
    decodeAudio: async (url, audioCtx) => {
        if (!audioCtx) return null;
        
        // A. SI DÉJÀ EN MÉMOIRE
        if (audioCache.has(url)) {
            return audioCache.get(url);
        }

        try {
            const response = await fetch(url, { mode: 'cors' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const arrayBuffer = await response.arrayBuffer();
            if (arrayBuffer.byteLength < 100) throw new Error("Fichier trop petit");

            // On copie le buffer car decodeAudioData le détache
            const tempBuffer = arrayBuffer.slice(0);
            
            return await new Promise((resolve, reject) => {
                audioCtx.decodeAudioData(tempBuffer, 
                    (decoded) => {
                        // B. MISE EN CACHE
                        audioCache.set(url, decoded);
                        resolve(decoded);
                    },
                    (err) => {
                        console.error("❌ Decode Error:", err);
                        resolve(null);
                    }
                );
            });
            
        } catch (e) {
            console.error("❌ [SoundExpert] Erreur:", e.message);
            return null;
        }
    },

    // --- 2. DSP : EFFETS AUDIO ---

    /**
     * Coupe le son (Trim)
     */
    trim: (buffer, startPct, endPct) => {
        if (!buffer || !buffer.getChannelData) return buffer;
        
        const start = Math.floor(startPct * buffer.length);
        const end = Math.floor(endPct * buffer.length);
        const newLen = end - start;
        
        if (newLen <= 0) return buffer;

        const newCtx = new (window.AudioContext || window.webkitAudioContext)();
        const newBuffer = newCtx.createBuffer(buffer.numberOfChannels, newLen, buffer.sampleRate);

        for (let i = 0; i < buffer.numberOfChannels; i++) {
            const channel = buffer.getChannelData(i);
            const newChannel = newBuffer.getChannelData(i);
            for (let j = 0; j < newLen; j++) {
                newChannel[j] = channel[start + j];
            }
        }
        return newBuffer;
    },
    
    /**
     * Change la vitesse (Pitch shift via resampling basique)
     */
    changeSpeed: (buffer, rate) => {
        if (!buffer || !buffer.getChannelData) return buffer;
        
        // Nouvelle longueur estimée
        const newLen = Math.floor(buffer.length / rate);
        const newCtx = new (window.AudioContext || window.webkitAudioContext)();
        const newBuffer = newCtx.createBuffer(buffer.numberOfChannels, newLen, buffer.sampleRate);

        for (let i = 0; i < buffer.numberOfChannels; i++) {
            const data = buffer.getChannelData(i);
            const newData = newBuffer.getChannelData(i);
            
            // Interpolation linéaire pour redimensionner le signal
            for (let j = 0; j < newLen; j++) {
                const originalPos = j * rate;
                const index = Math.floor(originalPos);
                const frac = originalPos - index;
                
                const a = data[Math.min(index, buffer.length - 1)];
                const b = data[Math.min(index + 1, buffer.length - 1)];
                
                newData[j] = a + (b - a) * frac;
            }
        }
        return newBuffer;
    },

    /**
     * Applique un gain (Volume)
     */
    applyGain: (buffer, val) => {
        if (!buffer || !buffer.getChannelData) return buffer;
        
        const newCtx = new (window.AudioContext || window.webkitAudioContext)();
        const newBuffer = newCtx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
        
        for (let i = 0; i < buffer.numberOfChannels; i++) {
            const d = buffer.getChannelData(i);
            const n = newBuffer.getChannelData(i);
            for (let j = 0; j < buffer.length; j++) {
                // Clipping simple pour éviter la saturation brutale
                let sample = d[j] * val;
                if (sample > 1) sample = 1;
                if (sample < -1) sample = -1;
                n[j] = sample;
            }
        }
        return newBuffer;
    },

    /**
     * Inverse le son (Reverse)
     */
    reverse: (buffer) => {
        if (!buffer || !buffer.getChannelData) return buffer;
        
        const newCtx = new (window.AudioContext || window.webkitAudioContext)();
        const newBuffer = newCtx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
        
        for (let i = 0; i < buffer.numberOfChannels; i++) {
            const d = buffer.getChannelData(i);
            const n = newBuffer.getChannelData(i);
            for (let j = 0; j < buffer.length; j++) {
                n[j] = d[buffer.length - 1 - j];
            }
        }
        return newBuffer;
    },

    /**
     * Effet Robot (Modulation en anneau)
     */
    robotize: (buffer) => {
        if (!buffer || !buffer.getChannelData) return buffer;
        
        const newCtx = new (window.AudioContext || window.webkitAudioContext)();
        const newBuffer = newCtx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
        const freq = 50; // Fréquence de modulation (Hz)
        
        for (let i = 0; i < buffer.numberOfChannels; i++) {
            const d = buffer.getChannelData(i);
            const n = newBuffer.getChannelData(i);
            for (let j = 0; j < buffer.length; j++) {
                // Onde porteuse sinusoïdale
                const carrier = Math.sin(j / buffer.sampleRate * 2 * Math.PI * freq);
                n[j] = d[j] * carrier;
            }
        }
        return newBuffer;
    },

    // --- 3. EXPORT : BUFFER VERS WAV (BLOB) ---

    bufferToWav: (buffer) => {
        if (!buffer || !buffer.getChannelData) return null;

        const numOfChan = buffer.numberOfChannels;
        const length = buffer.length * numOfChan * 2 + 44;
        const out = new ArrayBuffer(length);
        const view = new DataView(out);
        const channels = [];
        let sample;
        let offset = 0;
        let pos = 0;

        // Écriture Header WAV
        setUint32(0x46464952); // "RIFF"
        setUint32(length - 8); // file length - 8
        setUint32(0x45564157); // "WAVE"

        setUint32(0x20746d66); // "fmt " chunk
        setUint32(16); // length = 16
        setUint16(1); // PCM (uncompressed)
        setUint16(numOfChan);
        setUint32(buffer.sampleRate);
        setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
        setUint16(numOfChan * 2); // block-align
        setUint16(16); // 16-bit (hardcoded in this loop)

        setUint32(0x61746164); // "data" - chunk
        setUint32(length - pos - 4); // chunk length

        // Préparation des canaux
        for(let i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));

        // Entrelacement et conversion 16-bit
        while(pos < buffer.length) {
            for(let i = 0; i < numOfChan; i++) {
                // Clamp entre -1 et 1
                sample = Math.max(-1, Math.min(1, channels[i][pos])); 
                // Conversion float -> int16
                sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; 
                view.setInt16(44 + offset, sample, true); 
                offset += 2;
            }
            pos++;
        }

        return new Blob([out], { type: "audio/wav" });

        function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
        function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }
    }
};

export default SoundExpert;
