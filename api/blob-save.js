import { put } from '@vercel/blob';

export default async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;

    if (!token) {
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

    const cleanPath = String(path || '').replace(/^\/+/, '');
    const cleanAccess = String(access || 'private').trim().toLowerCase();

    if (!cleanPath) {
      return res.status(400).json({ success: false, message: 'path 값이 필요합니다.' });
    }

    if (cleanPath.includes('..') || cleanPath.includes('\\')) {
      return res.status(400).json({ success: false, message: '유효하지 않은 path 값입니다.' });
    }

    if (content === undefined || content === null) {
      return res.status(400).json({ success: false, message: 'content 값이 필요합니다.' });
    }

    if (!['private', 'public'].includes(cleanAccess)) {
      return res.status(400).json({
        success: false,
        message: 'access 값은 private 또는 public이어야 합니다.'
      });
    }

    const blob = await put(cleanPath, String(content), {
      access: cleanAccess,
      contentType,
      addRandomSuffix: false,
      allowOverwrite: true,
      token
    });

    return res.status(200).json({
      success: true,
      pathname: blob.pathname,
      path: blob.pathname,
      url: blob.url,
      downloadUrl: blob.downloadUrl || blob.url || null,
      contentType,
      access: cleanAccess,
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
