const AIEngine = require('../../../core/ai.engine');
const StructureDrive = require('../../structure/experts/structure.drive'); 

const streamToBuffer = async (stream) => {
    const chunks = [];
    return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('error', (err) => reject(err));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
    });
};

const ScanAI = {
    correctCopy: async (copyUrl, subjectUrls, instructions, studentList) => {
        console.log("👁️ [SCAN-AI] Correction V121 (Technique OCR)...");

        const rosterText = studentList.map(s => `${s.firstName} ${s.lastName}`).join(', ');

        // PROMPT TECHNIQUE (Non-Humain)
        const system = `TASK: DOCUMENT ANALYSIS & OCR.
        
        INPUT DATA:
        1. Reference Document (Image).
        2. Handwriting Sample (Image).
        
        INSTRUCTIONS:
        1. EXTRACT NAME: Look for a name in the handwriting sample that matches one of: [${rosterText}].
        2. ANALYSE CONTENT: Compare the handwritten text content against the reference criteria: "${instructions}".
        3. GENERATE REPORT: Output a JSON object.
        
        GRADING LOGIC (Technical Score):
        - A = High Match.
        - B = Partial Match.
        - C = Low Match.

        OUTPUT FORMAT (JSON ONLY):
        {
            "studentName": "Extracted Name",
            "grade": "A, B, or C",
            "appreciation": "Technical summary.",
            "transcription": "Full OCR transcription + <span style='color:#ef4444'>[CORRECTIONS]</span>.",
            "mistakes": []
        }`;

        const promptParts = [
            { text: "START ANALYSIS." }
        ];

        const getImageData = async (url) => {
            try {
                if (url.includes('/proxy/')) {
                    const fileId = url.split('/proxy/')[1];
                    const stream = await StructureDrive.getFileStream(fileId);
                    const buffer = await streamToBuffer(stream);
                    if (buffer.length < 100) throw new Error("Fichier vide");
                    return buffer.toString('base64');
                }
                return null;
            } catch (e) { return null; }
        };

        try {
            if (subjectUrls) {
                for (const url of subjectUrls) {
                    const b64 = await getImageData(url);
                    if (b64) promptParts.push({ inlineData: { mimeType: "image/jpeg", data: b64 } });
                }
            }

            const copyB64 = await getImageData(copyUrl);
            if (copyB64) {
                promptParts.push({ inlineData: { mimeType: "image/jpeg", data: copyB64 } });
            } else {
                return {
                    studentName: "Image Illisible",
                    grade: "C",
                    appreciation: "Erreur technique.",
                    transcription: "Fichier non trouvé.",
                    mistakes: []
                };
            }

            const rawText = await AIEngine.ask(promptParts, system);
            return AIEngine.sanitizeJSON(rawText);

        } catch (e) {
            return { 
                studentName: "Erreur", 
                grade: "?", 
                appreciation: "Echec technique.", 
                transcription: e.message, 
                mistakes: [] 
            };
        }
    }
};

module.exports = ScanAI;