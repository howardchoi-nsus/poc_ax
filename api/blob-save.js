import { put } from '@vercel/blob';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({
        success: false,
        step: 'env_check',
        message: 'BLOB_READ_WRITE_TOKEN 환경변수가 없습니다.'
      });
    }

    const {
      path,
      content,
      contentType = 'text/plain; charset=utf-8',
      access = 'private',
      metadata = {}
    } = req.body || {};

    if (!path) {
      return res.status(400).json({ success: false, message: 'path 값이 필요합니다.' });
    }

    if (content === undefined || content === null) {
      return res.status(400).json({ success: false, message: 'content 값이 필요합니다.' });
    }

    const blob = await put(String(path).replace(/^\/+/, ''), String(content), {
      access,
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true
    });

    return res.status(200).json({
      success: true,
      pathname: blob.pathname,
      url: blob.url,
      downloadUrl: blob.downloadUrl || null,
      contentType,
      access,
      metadata
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      step: 'blob_save',
      name: error.name,
      message: error.message
    });
  }
}
