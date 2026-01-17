const { GoogleGenerativeAI } = require("@google/generative-ai");

const AIEngine = {
    sanitizeJSON: (text) => {
        try {
            let clean = text.replace(/```json/gi, "").replace(/```/gi, "").trim();
            const start = Math.min(
                clean.indexOf('[') === -1 ? Infinity : clean.indexOf('['),
                clean.indexOf('{') === -1 ? Infinity : clean.indexOf('{')
            );
            const end = Math.max(clean.lastIndexOf(']'), clean.lastIndexOf('}')) + 1;
            return JSON.parse(clean.substring(start, end));
        } catch (e) { throw new Error("JSON IA illisible."); }
    },
    ask: async (prompt, systemInstruction = "") => {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash", systemInstruction });
        const result = await model.generateContent(prompt);
        return result.response.text();
    }
};
module.exports = AIEngine;