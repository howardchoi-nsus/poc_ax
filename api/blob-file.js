import { list } from '@vercel/blob';

export default async function handler(req, res) {
  try {
    const path = String(req.query.path || '').replace(/^\/+/, '');

    if (!path) {
      return res.status(400).json({
        success: false,
        message: 'path 값이 없습니다.'
      });
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;

    if (!token) {
      return res.status(500).json({
        success: false,
        step: 'env_check',
        message: 'BLOB_READ_WRITE_TOKEN 환경변수가 없습니다.'
      });
    }

    const result = await list({
      prefix: path,
      limit: 10,
      token
    });

    const blob = result.blobs.find((item) => item.pathname === path);

    if (!blob) {
      return res.status(404).json({
        success: false,
        message: `${path} 파일을 찾지 못했습니다.`
      });
    }

    const readUrl = blob.downloadUrl || blob.url;

    if (!readUrl || !/^https?:\/\//.test(readUrl)) {
      return res.status(500).json({
        success: false,
        step: 'blob_url_check',
        message: `Invalid URL: ${readUrl || 'empty'}`
      });
    }

    const response = await fetch(readUrl, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        step: 'blob_fetch',
        message: `Blob 파일을 읽지 못했습니다. HTTP ${response.status}`
      });
    }

    const content = await response.text();

    return res.status(200).json({
      success: true,
      path,
      name: path.split('/').pop(),
      content,
      text: content,
      size: blob.size,
      uploadedAt: blob.uploadedAt,
      contentType: blob.contentType || 'text/plain'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      step: 'blob_file',
      name: error.name,
      message: error.message
    });
  }
}