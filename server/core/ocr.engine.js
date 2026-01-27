const fetch = require('node-fetch');

/**
 * 👁️ MOTEUR OCR V2 (AVEC RETOUR D'ERREUR)
 * Renvoie l'erreur exacte si Google refuse de lire.
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
            
            // SI ERREUR API (Clé invalide, API non activée...)
            if (data.error) {
                console.error("❌ [OCR] Erreur API :", data.error.message);
                return { success: false, error: data.error.message };
            }

            const fullText = data.responses[0]?.fullTextAnnotation?.text;
            if (!fullText) {
                return { success: true, text: "" }; // Image lue mais vide
            }

            return { success: true, text: fullText };

        } catch (e) {
            return { success: false, error: "Crash Réseau: " + e.message };
        }
    }
};

module.exports = OCREngine;