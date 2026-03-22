const { getDailyFreeTierStatus } = require('./aiUsage.service');
const { getCurrentDayAiSpend } = require('./gcpBilling.service');

const WARNING_PCT = Number(process.env.AI_FREE_WARNING_PCT || 15);
const HARD_BLOCK_PCT = Number(process.env.AI_FREE_BLOCK_PCT || 0);

async function getAiGuardStatus({ teacherId = '' } = {}) {
    const fallback = await getDailyFreeTierStatus({ teacherId });
    const cloudSpend = await getCurrentDayAiSpend().catch(() => null);
    const cloudSpentRaw = cloudSpend?.spentUsd;
    const exactSpent = (cloudSpend?.exact === true && cloudSpentRaw !== null && cloudSpentRaw !== undefined && Number.isFinite(Number(cloudSpentRaw)))
        ? Number(cloudSpentRaw)
        : Number(fallback.spentUsd || 0);
    const budgetUsd = Number(fallback.budgetUsd || 0);
    const remainingUsd = Math.max(0, budgetUsd - exactSpent);
    const remainingPct = budgetUsd > 0 ? Math.max(0, Math.min(100, (remainingUsd / budgetUsd) * 100)) : 100;
    const blocked = remainingPct <= HARD_BLOCK_PCT || remainingUsd <= 0;
    const warning = !blocked && remainingPct <= WARNING_PCT;

    return {
        blocked,
        warning,
        remainingPct,
        remainingUsd,
        spentUsd: exactSpent,
        budgetUsd,
        exact: Boolean(cloudSpend?.exact),
        source: cloudSpend?.exact ? 'gcp_bigquery' : 'fallback',
        message: blocked
            ? `IA bloquée: quota gratuit du jour consommé (${exactSpent.toFixed(4)}$ / ${budgetUsd.toFixed(2)}$).`
            : warning
                ? `Alerte IA: il reste ${remainingUsd.toFixed(3)}$ aujourd'hui (${remainingPct.toFixed(1)}%).`
                : ''
    };
}

async function assertAiWithinFreeTier({ teacherId = '' } = {}) {
    const status = await getAiGuardStatus({ teacherId });
    if (!status.blocked) return status;
    const err = new Error(status.message || 'Quota IA gratuit du jour atteint');
    err.code = 'AI_FREE_TIER_BLOCKED';
    err.status = 402;
    err.aiGuard = status;
    throw err;
}

module.exports = {
    assertAiWithinFreeTier,
    getAiGuardStatus
};
