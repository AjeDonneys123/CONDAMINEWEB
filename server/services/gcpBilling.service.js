const { google } = require('googleapis');

const BILLING_SCOPE = 'https://www.googleapis.com/auth/cloud-platform.read-only';
const EXACT_BILLING_ENABLED = String(process.env.GCP_EXACT_BILLING_ENABLED || '').trim().toLowerCase() === 'true';

function hasGcpBillingConfig() {
    if (!EXACT_BILLING_ENABLED) return false;
    return Boolean(
        String(process.env.GCP_BILLING_SERVICE_ACCOUNT_EMAIL || '').trim()
        && String(process.env.GCP_BILLING_SERVICE_ACCOUNT_PRIVATE_KEY || '').trim()
        && String(process.env.GCP_BILLING_EXPORT_PROJECT_ID || '').trim()
        && String(process.env.GCP_BILLING_EXPORT_DATASET || '').trim()
        && String(process.env.GCP_BILLING_EXPORT_TABLE || '').trim()
    );
}

function getJwtClient() {
    const clientEmail = String(process.env.GCP_BILLING_SERVICE_ACCOUNT_EMAIL || '').trim();
    const privateKey = String(process.env.GCP_BILLING_SERVICE_ACCOUNT_PRIVATE_KEY || '')
        .replace(/\\n/g, '\n')
        .trim();
    if (!clientEmail || !privateKey) throw new Error('GCP billing service account not configured');
    return new google.auth.JWT({
        email: clientEmail,
        key: privateKey,
        scopes: [BILLING_SCOPE]
    });
}

function getBillingTablePath() {
    const projectId = String(process.env.GCP_BILLING_EXPORT_PROJECT_ID || '').trim();
    const dataset = String(process.env.GCP_BILLING_EXPORT_DATASET || '').trim();
    const table = String(process.env.GCP_BILLING_EXPORT_TABLE || '').trim();
    if (!projectId || !dataset || !table) throw new Error('GCP billing export table not configured');
    return `\`${projectId}.${dataset}.${table}\``;
}

function parseCsvEnv(name = '') {
    return String(process.env[name] || '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
}

function buildAiFilterSql() {
    const clauses = [];
    const projectIds = parseCsvEnv('GCP_AI_BILLING_PROJECT_IDS');
    const serviceDescriptions = parseCsvEnv('GCP_AI_BILLING_SERVICE_DESCRIPTIONS');
    const skuKeywords = parseCsvEnv('GCP_AI_BILLING_SKU_KEYWORDS');

    if (projectIds.length > 0) {
        const list = projectIds.map((value) => `'${value.replace(/'/g, "\\'")}'`).join(', ');
        clauses.push(`project.id IN (${list})`);
    } else {
        const legacyProject = String(process.env.GEMINI_PROJECT_ID || '').trim();
        if (legacyProject) clauses.push(`project.id = '${legacyProject.replace(/'/g, "\\'")}'`);
    }

    if (serviceDescriptions.length > 0) {
        const parts = serviceDescriptions.map((value) => `service.description = '${value.replace(/'/g, "\\'")}'`);
        clauses.push(`(${parts.join(' OR ')})`);
    }

    if (skuKeywords.length > 0) {
        const parts = skuKeywords.map((value) => `LOWER(sku.description) LIKE '%${value.toLowerCase().replace(/'/g, "\\'")}%'`);
        clauses.push(`(${parts.join(' OR ')})`);
    }

    return clauses.length > 0 ? ` AND ${clauses.join(' AND ')}` : '';
}

async function queryBigQuery(sql = '') {
    const auth = getJwtClient();
    await auth.authorize();
    const bigquery = google.bigquery({ version: 'v2', auth });
    const projectId = String(process.env.GCP_BILLING_EXPORT_PROJECT_ID || '').trim();
    const res = await bigquery.jobs.query({
        projectId,
        requestBody: {
            query: sql,
            useLegacySql: false
        }
    });
    return res.data;
}

async function getCurrentMonthAiSpend() {
    if (!hasGcpBillingConfig()) {
        return {
            configured: false,
            exact: false,
            source: EXACT_BILLING_ENABLED ? 'fallback' : 'disabled',
            spentUsd: null,
            currency: 'USD',
            rowsMatched: 0
        };
    }

    const tablePath = getBillingTablePath();
    const aiFilter = buildAiFilterSql();
    const sql = `
        SELECT
          ROUND(COALESCE(SUM(cost), 0), 6) AS spent_usd,
          COUNT(1) AS rows_matched
        FROM ${tablePath}
        WHERE usage_start_time >= TIMESTAMP_TRUNC(CURRENT_TIMESTAMP(), MONTH)
          AND usage_start_time < TIMESTAMP_ADD(TIMESTAMP_TRUNC(CURRENT_TIMESTAMP(), MONTH), INTERVAL 1 MONTH)
          ${aiFilter}
    `;

    const data = await queryBigQuery(sql);
    const firstRow = Array.isArray(data?.rows) ? data.rows[0] : null;
    const fields = Array.isArray(firstRow?.f) ? firstRow.f : [];
    const spentUsd = Number(fields?.[0]?.v || 0);
    const rowsMatched = Number(fields?.[1]?.v || 0);
    return {
        configured: true,
        exact: true,
        source: 'gcp_bigquery',
        spentUsd,
        currency: 'USD',
        rowsMatched
    };
}

async function getCurrentDayAiSpend() {
    if (!hasGcpBillingConfig()) {
        return {
            configured: false,
            exact: false,
            source: EXACT_BILLING_ENABLED ? 'fallback' : 'disabled',
            spentUsd: null,
            currency: 'USD',
            rowsMatched: 0
        };
    }

    const tablePath = getBillingTablePath();
    const aiFilter = buildAiFilterSql();
    const sql = `
        SELECT
          ROUND(COALESCE(SUM(cost), 0), 6) AS spent_usd,
          COUNT(1) AS rows_matched
        FROM ${tablePath}
        WHERE usage_start_time >= TIMESTAMP_TRUNC(CURRENT_TIMESTAMP(), DAY)
          AND usage_start_time < TIMESTAMP_ADD(TIMESTAMP_TRUNC(CURRENT_TIMESTAMP(), DAY), INTERVAL 1 DAY)
          ${aiFilter}
    `;

    const data = await queryBigQuery(sql);
    const firstRow = Array.isArray(data?.rows) ? data.rows[0] : null;
    const fields = Array.isArray(firstRow?.f) ? firstRow.f : [];
    const spentUsd = Number(fields?.[0]?.v || 0);
    const rowsMatched = Number(fields?.[1]?.v || 0);
    return {
        configured: true,
        exact: true,
        source: 'gcp_bigquery',
        spentUsd,
        currency: 'USD',
        rowsMatched
    };
}

module.exports = {
    getCurrentDayAiSpend,
    getCurrentMonthAiSpend,
    hasGcpBillingConfig,
    EXACT_BILLING_ENABLED
};
