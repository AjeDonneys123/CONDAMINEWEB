/**
 * 🎛️ SOUND EXPERT V557 (CACHE INVALIDATION)
 * Service partagé pour la gestion audio avec gestion de la mémoire vive.
 */

const audioCache = new Map();

const SoundExpert = {
    // 1. DÉCODAGE AVEC CACHE
    decodeAudio: async (url, audioCtx) => {
        if (!audioCtx || !url) return null;
        if (audioCache.has(url)) return audioCache.get(url);

        try {
            const response = await fetch(url, { mode: 'cors' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const arrayBuffer = await response.arrayBuffer();
            const tempBuffer = arrayBuffer.slice(0);
            
            return await new Promise((resolve) => {
                audioCtx.decodeAudioData(tempBuffer, 
                    (decoded) => {
                        audioCache.set(url, decoded);
                        resolve(decoded);
                    },
                    () => resolve(null)
                );
            });
        } catch (e) { return null; }
    },

    // --- NOUVEAU : NETTOYAGE DU CACHE (ANTI-SONS ZOMBIES) ---
    removeFromCache: (url) => {
        if (audioCache.has(url)) {
            audioCache.delete(url);
            console.log("🧹 [SoundExpert] Cache vidé pour :", url);
        }
    },

    clearAllCache: () => audioCache.clear(),

    // --- DSP TOOLS ---
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
            for (let j = 0; j < newLen; j++) newChannel[j] = channel[start + j];
        }
        return newBuffer;
    },
    
    changeSpeed: (buffer, rate) => {
        if (!buffer || !buffer.getChannelData) return buffer;
        const newLen = Math.floor(buffer.length / rate);
        const newCtx = new (window.AudioContext || window.webkitAudioContext)();
        const newBuffer = newCtx.createBuffer(buffer.numberOfChannels, newLen, buffer.sampleRate);
        for (let i = 0; i < buffer.numberOfChannels; i++) {
            const data = buffer.getChannelData(i);
            const newData = newBuffer.getChannelData(i);
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

    applyGain: (buffer, val) => {
        if (!buffer || !buffer.getChannelData) return buffer;
        const newCtx = new (window.AudioContext || window.webkitAudioContext)();
        const newBuffer = newCtx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
        for (let i = 0; i < buffer.numberOfChannels; i++) {
            const d = buffer.getChannelData(i);
            const n = newBuffer.getChannelData(i);
            for (let j = 0; j < buffer.length; j++) {
                let s = d[j] * val;
                n[j] = s > 1 ? 1 : (s < -1 ? -1 : s);
            }
        }
        return newBuffer;
    },

    reverse: (buffer) => {
        if (!buffer || !buffer.getChannelData) return buffer;
        const newCtx = new (window.AudioContext || window.webkitAudioContext)();
        const newBuffer = newCtx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
        for (let i = 0; i < buffer.numberOfChannels; i++) {
            const d = buffer.getChannelData(i);
            const n = newBuffer.getChannelData(i);
            for (let j = 0; j < buffer.length; j++) n[j] = d[buffer.length - 1 - j];
        }
        return newBuffer;
    },

    robotize: (buffer) => {
        if (!buffer || !buffer.getChannelData) return buffer;
        const newCtx = new (window.AudioContext || window.webkitAudioContext)();
        const newBuffer = newCtx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
        const freq = 50; 
        for (let i = 0; i < buffer.numberOfChannels; i++) {
            const d = buffer.getChannelData(i);
            const n = newBuffer.getChannelData(i);
            for (let j = 0; j < buffer.length; j++) {
                const carrier = Math.sin(j / buffer.sampleRate * 2 * Math.PI * freq);
                n[j] = d[j] * carrier;
            }
        }
        return newBuffer;
    },

    bufferToWav: (buffer) => {
        if (!buffer || !buffer.getChannelData) return null;
        const numOfChan = buffer.numberOfChannels;
        const length = buffer.length * numOfChan * 2 + 44;
        const out = new ArrayBuffer(length);
        const view = new DataView(out);
        setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157); setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan); setUint32(buffer.sampleRate); setUint32(buffer.sampleRate * 2 * numOfChan); setUint16(numOfChan * 2); setUint16(16); setUint32(0x61746164); setUint32(length - 44);
        const channels = [];
        for(let i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));
        let pos = 0, offset = 44;
        while(pos < buffer.length) {
            for(let i = 0; i < numOfChan; i++) {
                let sample = Math.max(-1, Math.min(1, channels[i][pos]));
                view.setInt16(offset, sample < 0 ? sample * 32768 : sample * 32767, true);
                offset += 2;
            }
            pos++;
        }
        return new Blob([out], { type: "audio/wav" });
        function setUint16(d) { view.setUint16(offset, d, true); offset += 2; }
        function setUint32(d) { view.setUint32(offset, d, true); offset += 4; }
    }
};

export default SoundExpert;
