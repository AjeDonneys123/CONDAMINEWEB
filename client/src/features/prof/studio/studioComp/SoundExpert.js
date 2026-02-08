/**
 * 🎛️ EXPERT AUDIO CLIENT (Web Audio API)
 * Manipulation de buffers audio sans serveur.
 * V3 : Optimisation du décodeur pour pré-chargement Studio.
 */
const SoundExpert = {
    
    // Convertir Blob/URL en AudioBuffer (Méthode statique propre)
    decodeAudio: async (url, audioCtx) => {
        try {
            const response = await fetch(url);
            const arrayBuffer = await response.arrayBuffer();
            // Utilise le contexte passé en paramètre ou en crée un nouveau
            const ctx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
            return await ctx.decodeAudioData(arrayBuffer);
        } catch (e) {
            console.error("❌ Audio Decode Error:", e);
            return null;
        }
    },

    // Créer un nouveau buffer vide
    createBuffer: (channels, length, sampleRate) => {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        return audioCtx.createBuffer(channels, length, sampleRate);
    },

    // EFFET : Plus Fort / Moins Fort
    applyGain: (buffer, value) => {
        const newBuffer = SoundExpert.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const inputData = buffer.getChannelData(channel);
            const outputData = newBuffer.getChannelData(channel);
            for (let i = 0; i < buffer.length; i++) {
                outputData[i] = inputData[i] * value;
            }
        }
        return newBuffer;
    },

    // EFFET : Inverser
    reverse: (buffer) => {
        const newBuffer = SoundExpert.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const inputData = buffer.getChannelData(channel);
            const outputData = newBuffer.getChannelData(channel);
            for (let i = 0; i < buffer.length; i++) {
                outputData[i] = inputData[buffer.length - 1 - i];
            }
        }
        return newBuffer;
    },

    // EFFET : Vitesse (Resampling simple)
    changeSpeed: (buffer, playbackRate) => {
        const newLength = Math.floor(buffer.length / playbackRate);
        const newBuffer = SoundExpert.createBuffer(buffer.numberOfChannels, newLength, buffer.sampleRate);
        
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const inputData = buffer.getChannelData(channel);
            const outputData = newBuffer.getChannelData(channel);
            for (let i = 0; i < newLength; i++) {
                const originalIndex = i * playbackRate;
                const indexFloor = Math.floor(originalIndex);
                const indexCeil = Math.min(buffer.length - 1, Math.ceil(originalIndex));
                const fraction = originalIndex - indexFloor;
                
                const a = inputData[indexFloor];
                const b = inputData[indexCeil];
                outputData[i] = a + (b - a) * fraction;
            }
        }
        return newBuffer;
    },

    // EFFET : Fade In / Out
    fade: (buffer, type) => {
        const newBuffer = SoundExpert.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
        const fadeLength = Math.min(buffer.length, buffer.sampleRate * 2); 
        
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const inputData = buffer.getChannelData(channel);
            const outputData = newBuffer.getChannelData(channel);
            
            for (let i = 0; i < buffer.length; i++) {
                let multiplier = 1;
                if (type === 'in' && i < fadeLength) {
                    multiplier = i / fadeLength;
                } else if (type === 'out' && i > buffer.length - fadeLength) {
                    multiplier = (buffer.length - i) / fadeLength;
                }
                outputData[i] = inputData[i] * multiplier;
            }
        }
        return newBuffer;
    },

    // EFFET : Robot (Modulation d'amplitude simple)
    robotize: (buffer) => {
        const newBuffer = SoundExpert.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
        const freq = 50; 
        
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const inputData = buffer.getChannelData(channel);
            const outputData = newBuffer.getChannelData(channel);
            for (let i = 0; i < buffer.length; i++) {
                const modulator = Math.sin(2 * Math.PI * freq * (i / buffer.sampleRate));
                outputData[i] = inputData[i] * modulator;
            }
        }
        return newBuffer;
    },

    // COUPER (TRIM)
    trim: (buffer, startRatio, endRatio) => {
        const startSample = Math.floor(buffer.length * startRatio);
        const endSample = Math.floor(buffer.length * endRatio);
        const newLength = endSample - startSample;
        
        if (newLength <= 0) return buffer;

        const newBuffer = SoundExpert.createBuffer(buffer.numberOfChannels, newLength, buffer.sampleRate);
        
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const inputData = buffer.getChannelData(channel);
            const outputData = newBuffer.getChannelData(channel);
            for (let i = 0; i < newLength; i++) {
                outputData[i] = inputData[startSample + i];
            }
        }
        return newBuffer;
    },

    // Export vers WAV (pour sauvegarde)
    bufferToWav: (buffer) => {
        const numOfChan = buffer.numberOfChannels;
        const length = buffer.length * numOfChan * 2 + 44;
        const bufferArray = new ArrayBuffer(length);
        const view = new DataView(bufferArray);
        let pos = 0;

        function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
        function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }

        setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157);
        setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan);
        setUint32(buffer.sampleRate); setUint32(buffer.sampleRate * 2 * numOfChan);
        setUint16(numOfChan * 2); setUint16(16); setUint32(0x61746164); setUint32(length - 44);

        const channels = [];
        for(let i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));

        for (let i = 0; i < buffer.length; i++) {
            for (let channel = 0; channel < numOfChan; channel++) {
                let sample = Math.max(-1, Math.min(1, channels[channel][i]));
                sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0;
                view.setInt16(pos, sample, true);
                pos += 2;
            }
        }
        return new Blob([bufferArray], { type: "audio/wav" });
    }
};

export default SoundExpert;
