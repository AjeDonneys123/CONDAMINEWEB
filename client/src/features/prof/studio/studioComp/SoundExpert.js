/**
 * 🎛️ SOUND EXPERT V505 (ROBUST)
 * - Fetch sécurisé CORS
 * - Encodage WAV strict
 * - Maths DSP corrigées
 */
const SoundExpert = {
    // 1. DÉCODAGE SÉCURISÉ
    decodeAudio: async (url, audioCtx) => {
        if (!audioCtx) return null;
        try {
            console.log("📥 [SoundExpert] Téléchargement:", url);
            const response = await fetch(url, { mode: 'cors' }); // Force CORS
            if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
            
            const arrayBuffer = await response.arrayBuffer();
            if (arrayBuffer.byteLength === 0) throw new Error("Fichier vide");

            // Copie de sécurité
            const tempBuffer = arrayBuffer.slice(0);
            const decoded = await audioCtx.decodeAudioData(tempBuffer);
            console.log(`✅ [SoundExpert] Décodé: ${decoded.duration}s (${decoded.numberOfChannels} ch)`);
            return decoded;
        } catch (e) {
            console.error("❌ [SoundExpert] Erreur:", e);
            return null;
        }
    },

    // 2. OUTILS DSP
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
        const newCtx = new (window.AudioContext || window.webkitAudioContext)();
        const newBuffer = newCtx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
        const freq = 50; 
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

    // 3. EXPORT WAV
    bufferToWav: (buffer) => {
        const numOfChan = buffer.numberOfChannels;
        const length = buffer.length * numOfChan * 2 + 44;
        const out = new ArrayBuffer(length);
        const view = new DataView(out);
        const channels = [];
        let sample;
        let offset = 0;
        let pos = 0;

        // RIFF chunk descriptor
        setUint32(0x46464952); // "RIFF"
        setUint32(length - 8); // file length - 8
        setUint32(0x45564157); // "WAVE"

        // fmt sub-chunk
        setUint32(0x20746d66); // "fmt "
        setUint32(16); // length = 16
        setUint16(1); // PCM
        setUint16(numOfChan);
        setUint32(buffer.sampleRate);
        setUint32(buffer.sampleRate * 2 * numOfChan); // byte rate
        setUint16(numOfChan * 2); // block align
        setUint16(16); // bits per sample

        // data sub-chunk
        setUint32(0x61746164); // "data"
        setUint32(length - pos - 4);

        for(let i = 0; i < buffer.numberOfChannels; i++)
            channels.push(buffer.getChannelData(i));

        while(pos < buffer.length) {
            for(let i = 0; i < numOfChan; i++) {
                sample = Math.max(-1, Math.min(1, channels[i][pos])); 
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
