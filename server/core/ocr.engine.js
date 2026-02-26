const fetch = require('node-fetch');

const buildFilteredText = (fullTextAnnotation) => {
    try {
        const pages = Array.isArray(fullTextAnnotation?.pages) ? fullTextAnnotation.pages : [];
        const words = [];
        pages.forEach((page) => {
            const pageH = Number(page?.height || 0);
            (page.blocks || []).forEach((block) => {
                (block.paragraphs || []).forEach((par) => {
                    (par.words || []).forEach((w) => {
                        const token = (w.symbols || []).map(s => s?.text || '').join('').trim();
                        if (!token) return;
                        const vertices = w?.boundingBox?.vertices || [];
                        const ys = vertices.map(v => Number(v?.y || 0));
                        const yMid = ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : 0;
                        words.push({
                            token,
                            conf: typeof w.confidence === 'number' ? w.confidence : null,
                            yMid,
                            pageH
                        });
                    });
                });
            });
        });
        if (!words.length) return '';

        // Remove likely header overlays / teacher notes and ultra-low-confidence noise.
        const filtered = words.filter((w) => {
            if (!w.pageH) return true;
            if (w.yMid < w.pageH * 0.11) return false;
            if (typeof w.conf === 'number' && w.conf < 0.35) return false;
            return true;
        });
        if (!filtered.length) return '';

        const all = filtered.sort((a, b) => a.yMid - b.yMid);
        const lineThreshold = Math.max(10, (all[0]?.pageH || 1000) * 0.015);
        const lines = [];
        all.forEach((w) => {
            const last = lines[lines.length - 1];
            if (!last || Math.abs(last.y - w.yMid) > lineThreshold) {
                lines.push({ y: w.yMid, tokens: [w.token] });
            } else {
                last.tokens.push(w.token);
            }
        });
        return lines.map(l => l.tokens.join(' ')).join('\n').trim();
    } catch (_) {
        return '';
    }
};

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

            const fullTextAnnotation = data.responses[0]?.fullTextAnnotation;
            const fullText = fullTextAnnotation?.text;
            const filteredText = buildFilteredText(fullTextAnnotation);
            const pages = Array.isArray(fullTextAnnotation?.pages) ? fullTextAnnotation.pages : [];
            const confidences = [];
            pages.forEach((p) => {
                (p.blocks || []).forEach((b) => {
                    (b.paragraphs || []).forEach((par) => {
                        (par.words || []).forEach((w) => {
                            if (typeof w.confidence === 'number') confidences.push(w.confidence);
                        });
                    });
                });
            });
            const confidence = confidences.length
                ? (confidences.reduce((a, b) => a + b, 0) / confidences.length)
                : null;
            if (!fullText) {
                return { success: true, text: "", filteredText: "", confidence, wordsCount: confidences.length }; // Image lue mais vide
            }

            return {
                success: true,
                text: fullText,
                filteredText,
                confidence,
                wordsCount: confidences.length
            };

        } catch (e) {
            return { success: false, error: "Crash Réseau: " + e.message };
        }
    }
};

module.exports = OCREngine;
