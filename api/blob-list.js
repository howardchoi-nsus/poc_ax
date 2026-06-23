import { list } from '@vercel/blob';

export default async function handler(req, res) {
  try {
    const token = process.env.BLOB_READ_WRITE_TOKEN;

    if (!token) {
      return res.status(500).json({
        success: false,
        step: 'env_check',
        message: 'BLOB_READ_WRITE_TOKEN 환경변수가 없습니다.'
      });
    }

    const prefix = String(req.query.prefix || req.query.folder || '').replace(/^\/+/, '');
    const result = await list({
      prefix: prefix ? `${prefix.replace(/\/+$/, '')}/` : undefined,
      limit: Number(req.query.limit || 1000),
      token
    });

    return res.status(200).json({
      success: true,
      prefix,
      files: result.blobs.map((blob) => ({
        name: blob.pathname.split('/').pop(),
        path: blob.pathname,
        pathname: blob.pathname,
        url: blob.url,
        size: blob.size,
        uploadedAt: blob.uploadedAt
      }))
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      step: 'blob_list',
      name: error.name,
      message: error.message
    });
  }
}
