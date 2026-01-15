const { GoogleGenerativeAI } = require("@google/generative-ai");
const AIService = {
    analyzeSubmission: async (userText, instruction, classroom, context) => {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const prompt = `${context}\nCONSIGNE: ${instruction}\nCLASSE: ${classroom}\nTEXTE: ${userText}\nFormat JSON pur: { grade, feedback_fond, corrections: [{wrong, correct, rule}] }`;
        const result = await model.generateContent(prompt);
        return JSON.parse(result.response.text().replace(/```json/g, "").replace(/```/g, "").trim());
    }
};
module.exports = AIService;