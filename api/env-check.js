export default async function handler(req, res) {
  return res.status(200).json({
    success: true,
    hasBlobToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    tokenPrefix: process.env.BLOB_READ_WRITE_TOKEN
      ? process.env.BLOB_READ_WRITE_TOKEN.slice(0, 12)
      : null,
    nodeEnv: process.env.NODE_ENV || null
  });
}
