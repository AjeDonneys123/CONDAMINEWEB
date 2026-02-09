/**
 * 🎛️ SOUND EXPERT V500 (FULL FEATURES)
 * Contient toutes les algos de manipulation audio (DSP) + Encodage WAV.
 */
const SoundExpert = {
    // 1. DÉCODAGE ROBUSTE
    decodeAudio: async (url, audioCtx) => {
        if (!audioCtx) return null;
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error("Fetch error");
            const arrayBuffer = await response.arrayBuffer();
            if (arrayBuffer.byteLength < 100) throw new Error("File too small");
            
            // On clone le buffer car decodeAudioData le détache
            const tempBuffer = arrayBuffer.slice(0);
            return await audioCtx.decodeAudioData(tempBuffer);
        } catch (e) {
            console.error("Audio Decode Error:", e);
            return null;
        }
    },

    // 2. MODIFICATIONS
    trim: (buffer, startPct, endPct) => {
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

    changeSpeed: (buffer, rate) => {
        // Changement de vitesse "simple" (change aussi le pitch)
        // Pour garder le pitch, il faudrait un algo complexe (Phase Vocoder).
        // Ici on triche en ré-échantillonnant.
        const newLen = Math.floor(buffer.length / rate);
        const newCtx = new (window.AudioContext || window.webkitAudioContext)();
        const newBuffer = newCtx.createBuffer(buffer.numberOfChannels, newLen, buffer.sampleRate);
        
        for (let i = 0; i < buffer.numberOfChannels; i++) {
            const data = buffer.getChannelData(i);
            const newData = newBuffer.getChannelData(i);
            for (let j = 0; j < newLen; j++) {
                // Interpolation linéaire simple
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

    applyGain: (buffer, gainVal) => {
        const newCtx = new (window.AudioContext || window.webkitAudioContext)();
        const newBuffer = newCtx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
        for (let i = 0; i < buffer.numberOfChannels; i++) {
            const data = buffer.getChannelData(i);
            const newData = newBuffer.getChannelData(i);
            for (let j = 0; j < buffer.length; j++) {
                newData[j] = data[j] * gainVal;
            }
        }
        return newBuffer;
    },

    reverse: (buffer) => {
        const newCtx = new (window.AudioContext || window.webkitAudioContext)();
        const newBuffer = newCtx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
        for (let i = 0; i < buffer.numberOfChannels; i++) {
            const data = buffer.getChannelData(i);
            const newData = newBuffer.getChannelData(i);
            for (let j = 0; j < buffer.length; j++) {
                newData[j] = data[buffer.length - 1 - j];
            }
        }
        return newBuffer;
    },

    robotize: (buffer) => {
        // Effet Ring Modulator basique
        const newCtx = new (window.AudioContext || window.webkitAudioContext)();
        const newBuffer = newCtx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
        const freq = 50; // Hz
        for (let i = 0; i < buffer.numberOfChannels; i++) {
            const data = buffer.getChannelData(i);
            const newData = newBuffer.getChannelData(i);
            for (let j = 0; j < buffer.length; j++) {
                const carrier = Math.sin(j / buffer.sampleRate * 2 * Math.PI * freq);
                newData[j] = data[j] * carrier;
            }
        }
        return newBuffer;
    },

    fade: (buffer, type) => {
        // Fade In ou Out sur 20%
        const newCtx = new (window.AudioContext || window.webkitAudioContext)();
        const newBuffer = newCtx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
        const fadeLen = Math.floor(buffer.length * 0.2);
        
        for (let i = 0; i < buffer.numberOfChannels; i++) {
            const data = buffer.getChannelData(i);
            const newData = newBuffer.getChannelData(i);
            for (let j = 0; j < buffer.length; j++) {
                let multiplier = 1;
                if (type === 'in' && j < fadeLen) multiplier = j / fadeLen;
                if (type === 'out' && j > buffer.length - fadeLen) multiplier = (buffer.length - j) / fadeLen;
                newData[j] = data[j] * multiplier;
            }
        }
        return newBuffer;
    },

    // 3. EXPORT WAV (CRUCIAL POUR SAUVEGARDER)
    bufferToWav: (buffer) => {
        const numOfChan = buffer.numberOfChannels;
        const length = buffer.length * numOfChan * 2 + 44;
        const out = new ArrayBuffer(length);
        const view = new DataView(out);
        const channels = [];
        let sample;
        let offset = 0;
        let pos = 0;

        // write WAVE header
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
        setUint16(16); // 16-bit (hardcoded in this demo)

        setUint32(0x61746164); // "data" - chunk
        setUint32(length - pos - 4); // chunk length

        // Write interleaved data
        for(let i = 0; i < buffer.numberOfChannels; i++)
            channels.push(buffer.getChannelData(i));

        while(pos < buffer.length) {
            for(let i = 0; i < numOfChan; i++) {
                // clamp
                sample = Math.max(-1, Math.min(1, channels[i][pos])); 
                // scale to 16-bit signed int
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
