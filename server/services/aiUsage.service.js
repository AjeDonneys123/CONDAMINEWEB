const mongoose = require('mongoose');

const DEFAULT_MONTHLY_FREE_USD = Number(process.env.AI_FREE_USD_MONTH || 5);
const DEFAULT_DAILY_FREE_USD = Number(process.env.AI_FREE_USD_DAY || 0.17);
const DEFAULT_WARNING_PCT = Number(process.env.AI_FREE_WARNING_PCT || 15);

const MODEL_PRICING = {
    'gemini-2.5-flash-lite': { inputPerMillionUsd: 0.10, outputPerMillionUsd: 0.40 },
    'gemini-2.5-flash': { inputPerMillionUsd: 0.30, outputPerMillionUsd: 2.50 }
};

function getModelPricing(model = '') {
    const clean = String(model || '').trim().toLowerCase();
    if (MODEL_PRICING[clean]) return MODEL_PRICING[clean];
    if (clean.includes('flash-lite')) return MODEL_PRICING['gemini-2.5-flash-lite'];
    if (clean.includes('flash')) return MODEL_PRICING['gemini-2.5-flash'];
    return { inputPerMillionUsd: 0, outputPerMillionUsd: 0 };
}

function getCurrentMonthWindow(now = new Date()) {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    return { start, end };
}

function getCurrentDayWindow(now = new Date()) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    return { start, end };
}

function getRequestChars(prompt = null, systemInstruction = '') {
    const promptChars = Array.isArray(prompt)
        ? prompt.reduce((sum, part) => {
            const textLen = String(part?.text || '').length;
            const inlineLen = String(part?.inlineData?.data || '').length;
            return sum + textLen + inlineLen;
        }, 0)
        : String(prompt || '').length;
    return promptChars + String(systemInstruction || '').length;
}

function estimateTokensFromChars(chars = 0) {
    const n = Number(chars || 0);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.max(1, Math.round(n / 4));
}

async function recordUsage(entry = {}) {
    try {
        const AIUsageLedger = mongoose.model('AIUsageLedger');
        await AIUsageLedger.create({
            provider: String(entry.provider || 'gemini'),
            source: String(entry.source || 'global'),
            teacherId: mongoose.Types.ObjectId.isValid(String(entry.teacherId || '')) ? entry.teacherId : null,
            route: String(entry.route || '').trim(),
            feature: String(entry.feature || '').trim(),
            model: String(entry.model || '').trim(),
            promptTokens: Number(entry.promptTokens || 0),
            candidateTokens: Number(entry.candidateTokens || 0),
            totalTokens: Number(entry.totalTokens || 0),
            cachedContentTokens: Number(entry.cachedContentTokens || 0),
            thoughtsTokens: Number(entry.thoughtsTokens || 0),
            estimatedInputCostUsd: Number(entry.estimatedInputCostUsd || 0),
            estimatedOutputCostUsd: Number(entry.estimatedOutputCostUsd || 0),
            estimatedTotalCostUsd: Number(entry.estimatedTotalCostUsd || 0),
            status: String(entry.status || 'success'),
            errorMessage: String(entry.errorMessage || '').slice(0, 500),
            requestChars: Number(entry.requestChars || 0),
            responseChars: Number(entry.responseChars || 0),
            occurredAt: entry.occurredAt instanceof Date ? entry.occurredAt : new Date()
        });
    } catch (e) {
        console.error('[AIUsage] record failed:', e.message);
    }
}

async function logGeminiUsage({
    teacherId = '',
    source = 'global',
    model = '',
    usageMetadata = null,
    route = '',
    feature = '',
    prompt = null,
    systemInstruction = '',
    responseText = '',
    status = 'success',
    errorMessage = ''
} = {}) {
    const pricing = getModelPricing(model);
    const requestChars = getRequestChars(prompt, systemInstruction);
    const responseChars = String(responseText || '').length;
    const promptTokensRaw = Number(usageMetadata?.promptTokenCount || 0);
    const candidateTokensRaw = Number(usageMetadata?.candidatesTokenCount || 0);
    const promptTokens = promptTokensRaw > 0 ? promptTokensRaw : estimateTokensFromChars(requestChars);
    const candidateTokens = candidateTokensRaw > 0 ? candidateTokensRaw : ((status === 'success' && responseChars > 0) ? estimateTokensFromChars(responseChars) : 0);
    const totalTokens = Number(usageMetadata?.totalTokenCount || (promptTokens + candidateTokens));
    const cachedContentTokens = Number(usageMetadata?.cachedContentTokenCount || 0);
    const thoughtsTokens = Number(usageMetadata?.thoughtsTokenCount || 0);
    const estimatedInputCostUsd = (promptTokens / 1000000) * pricing.inputPerMillionUsd;
    const estimatedOutputCostUsd = (candidateTokens / 1000000) * pricing.outputPerMillionUsd;
    const estimatedTotalCostUsd = estimatedInputCostUsd + estimatedOutputCostUsd;

    recordUsage({
        provider: 'gemini',
        source,
        teacherId,
        route,
        feature,
        model,
        promptTokens,
        candidateTokens,
        totalTokens,
        cachedContentTokens,
        thoughtsTokens,
        estimatedInputCostUsd,
        estimatedOutputCostUsd,
        estimatedTotalCostUsd,
        status,
        errorMessage,
        requestChars,
        responseChars
    });
}

async function getUsageSummary({ teacherId = '', source = '', start = null, end = null } = {}) {
    const AIUsageLedger = mongoose.model('AIUsageLedger');
    const match = {};
    if (source) match.source = String(source).trim();
    if (mongoose.Types.ObjectId.isValid(String(teacherId || ''))) match.teacherId = new mongoose.Types.ObjectId(teacherId);
    if (start || end) {
        match.occurredAt = {};
        if (start) match.occurredAt.$gte = start;
        if (end) match.occurredAt.$lt = end;
    }

    const [summary] = await AIUsageLedger.aggregate([
        { $match: match },
        {
            $group: {
                _id: null,
                requests: { $sum: 1 },
                promptTokens: { $sum: '$promptTokens' },
                candidateTokens: { $sum: '$candidateTokens' },
                totalTokens: { $sum: '$totalTokens' },
                estimatedInputCostUsd: { $sum: '$estimatedInputCostUsd' },
                estimatedOutputCostUsd: { $sum: '$estimatedOutputCostUsd' },
                estimatedTotalCostUsd: { $sum: '$estimatedTotalCostUsd' }
            }
        }
    ]);

    const base = summary || {
        requests: 0,
        promptTokens: 0,
        candidateTokens: 0,
        totalTokens: 0,
        estimatedInputCostUsd: 0,
        estimatedOutputCostUsd: 0,
        estimatedTotalCostUsd: 0
    };
    const flashLite = getModelPricing('gemini-2.5-flash-lite');
    const derivedInputCostUsd = (Number(base.promptTokens || 0) / 1000000) * flashLite.inputPerMillionUsd;
    const derivedOutputCostUsd = (Number(base.candidateTokens || 0) / 1000000) * flashLite.outputPerMillionUsd;
    const storedTotalCostUsd = Number(base.estimatedTotalCostUsd || 0);
    const derivedTotalCostUsd = derivedInputCostUsd + derivedOutputCostUsd;
    return {
        ...base,
        estimatedInputCostUsd: Math.max(Number(base.estimatedInputCostUsd || 0), derivedInputCostUsd),
        estimatedOutputCostUsd: Math.max(Number(base.estimatedOutputCostUsd || 0), derivedOutputCostUsd),
        estimatedTotalCostUsd: Math.max(storedTotalCostUsd, derivedTotalCostUsd)
    };
}

function mergeUsageSummaries(...rows) {
    return rows.reduce((acc, row) => ({
        requests: Number(acc.requests || 0) + Number(row?.requests || 0),
        promptTokens: Number(acc.promptTokens || 0) + Number(row?.promptTokens || 0),
        candidateTokens: Number(acc.candidateTokens || 0) + Number(row?.candidateTokens || 0),
        totalTokens: Number(acc.totalTokens || 0) + Number(row?.totalTokens || 0),
        estimatedInputCostUsd: Number(acc.estimatedInputCostUsd || 0) + Number(row?.estimatedInputCostUsd || 0),
        estimatedOutputCostUsd: Number(acc.estimatedOutputCostUsd || 0) + Number(row?.estimatedOutputCostUsd || 0),
        estimatedTotalCostUsd: Number(acc.estimatedTotalCostUsd || 0) + Number(row?.estimatedTotalCostUsd || 0)
    }), {
        requests: 0,
        promptTokens: 0,
        candidateTokens: 0,
        totalTokens: 0,
        estimatedInputCostUsd: 0,
        estimatedOutputCostUsd: 0,
        estimatedTotalCostUsd: 0
    });
}

async function getFreeTierStatus({ teacherId = '' } = {}) {
    const { start, end } = getCurrentMonthWindow();
    const centralSummary = await getUsageSummary({ teacherId, source: 'central', start, end });
    const globalSummary = await getUsageSummary({ teacherId, source: 'global', start, end });
    const summary = mergeUsageSummaries(centralSummary, globalSummary);
    const budgetUsd = Number.isFinite(DEFAULT_MONTHLY_FREE_USD) ? Math.max(0, DEFAULT_MONTHLY_FREE_USD) : 0;
    const spentUsd = Number(summary.estimatedTotalCostUsd || 0);
    const remainingUsd = Math.max(0, budgetUsd - spentUsd);
    const remainingPct = budgetUsd > 0 ? Math.max(0, Math.min(100, (remainingUsd / budgetUsd) * 100)) : 100;

    return {
        source: 'central+global',
        windowStart: start,
        windowEnd: end,
        budgetUsd,
        spentUsd,
        remainingUsd,
        remainingPct,
        requests: Number(summary.requests || 0),
        promptTokens: Number(summary.promptTokens || 0),
        candidateTokens: Number(summary.candidateTokens || 0),
        totalTokens: Number(summary.totalTokens || 0)
    };
}

async function getDailyFreeTierStatus({ teacherId = '' } = {}) {
    const { start, end } = getCurrentDayWindow();
    const centralSummary = await getUsageSummary({ teacherId, source: 'central', start, end });
    const globalSummary = await getUsageSummary({ teacherId, source: 'global', start, end });
    const summary = mergeUsageSummaries(centralSummary, globalSummary);
    const budgetUsd = Number.isFinite(DEFAULT_DAILY_FREE_USD) ? Math.max(0, DEFAULT_DAILY_FREE_USD) : 0;
    const spentUsd = Number(summary.estimatedTotalCostUsd || 0);
    const remainingUsd = Math.max(0, budgetUsd - spentUsd);
    const remainingPct = budgetUsd > 0 ? Math.max(0, Math.min(100, (remainingUsd / budgetUsd) * 100)) : 100;

    return {
        source: 'central+global',
        windowStart: start,
        windowEnd: end,
        budgetUsd,
        spentUsd,
        remainingUsd,
        remainingPct,
        requests: Number(summary.requests || 0),
        promptTokens: Number(summary.promptTokens || 0),
        candidateTokens: Number(summary.candidateTokens || 0),
        totalTokens: Number(summary.totalTokens || 0)
    };
}

module.exports = {
    getCurrentDayWindow,
    getCurrentMonthWindow,
    getDailyFreeTierStatus,
    getFreeTierStatus,
    DEFAULT_DAILY_FREE_USD,
    DEFAULT_WARNING_PCT,
    getModelPricing,
    getUsageSummary,
    logGeminiUsage
};
