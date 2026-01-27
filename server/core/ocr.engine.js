const fetch = require('node-fetch');

/**
 * 👁️ MOTEUR OCR DÉDIÉ (Google Cloud Vision)
 * Lit le texte pixel par pixel sans essayer de le comprendre.
 */
const OCREngine = {
    extractText: async (base64Image) => {
        const apiKey = process.env.GEMINI_API_KEY;
        const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

        const body = {
            requests: [{
                image: { content: base64Image },
                features: [{ type: "DOCUMENT_TEXT_DETECTION" }]
            }]
        };

        try {
            console.log("🔍 [OCR] Appel Google Vision...");
            const response = await fetch(url, {
                method: 'POST',
                body: JSON.stringify(body),
                headers: { 'Content-Type': 'application/json' }
            });

            const data = await response.json();
            
            if (data.error) {
                console.error("❌ [OCR] Erreur API :", data.error.message);
                return null;
            }

            const fullText = data.responses[0]?.fullTextAnnotation?.text;
            if (!fullText) {
                console.warn("⚠️ [OCR] Aucun texte détecté.");
                return "";
            }

            console.log("✅ [OCR] Lecture réussie.");
            return fullText;

        } catch (e) {
            console.error("❌ [OCR] Crash Réseau :", e.message);
            return null;
        }
    }
};

module.exports = OCREngine;