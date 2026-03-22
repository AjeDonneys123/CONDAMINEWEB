require('dotenv').config();

const keys = [
  'GCP_BILLING_SERVICE_ACCOUNT_EMAIL',
  'GCP_BILLING_SERVICE_ACCOUNT_PRIVATE_KEY',
  'GCP_BILLING_EXPORT_PROJECT_ID',
  'GCP_BILLING_EXPORT_DATASET',
  'GCP_BILLING_EXPORT_TABLE'
];

for (const k of keys) {
  const v = process.env[k] || '';
  console.log(k, {
    present: !!String(v).trim(),
    length: String(v).length,
    sample: String(v).slice(0, 25)
  });
}
