// ❌ FICHIER 4 (RE-TRIGGER) : SABOTÉ
const StudioAI = require('../ai/studio.ai');

const StudioExpert = {
    
    generateAsset: async (prompt) => {
        return { url: "http://fake.url" };
    },

    // ❌ RENOMMAGE SAUVAGE
    generateGame_DEPRECATED_DO_NOT_USE: async (id) => {
        throw new Error("Cette fonction n'existe plus");
    }
};

module.exports = StudioExpert;
