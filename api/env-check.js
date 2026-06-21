export default async function handler(req, res) {
  const n8nRequirementSaveWebhook =
    process.env.N8N_REQUIREMENT_SAVE_WEBHOOK ||
    'https://kolchohoohu.app.n8n.cloud/webhook/agent1-requirement-save';

  const n8nPrdGenerateWebhook =
    process.env.N8N_PRD_GENERATE_WEBHOOK ||
    'https://kolchohoohu.app.n8n.cloud/webhook/agent1-prd-generate';

  return res.status(200).json({
    success: true,
    hasBlobToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    tokenPrefix: process.env.BLOB_READ_WRITE_TOKEN
      ? process.env.BLOB_READ_WRITE_TOKEN.slice(0, 12)
      : null,
    n8n: {
      hasRequirementSaveWebhook: Boolean(n8nRequirementSaveWebhook),
      requirementSaveWebhookSource: process.env.N8N_REQUIREMENT_SAVE_WEBHOOK ? 'env' : 'default',
      hasPrdGenerateWebhook: Boolean(n8nPrdGenerateWebhook),
      prdGenerateWebhookSource: process.env.N8N_PRD_GENERATE_WEBHOOK ? 'env' : 'default',
      hasPrdReviseWebhook: Boolean(process.env.N8N_PRD_REVISE_WEBHOOK),
      prdReviseWebhookSource: process.env.N8N_PRD_REVISE_WEBHOOK ? 'env' : 'missing'
    },
    nodeEnv: process.env.NODE_ENV || null
  });
}
