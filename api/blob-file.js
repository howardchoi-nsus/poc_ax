import { get } from '@vercel/blob';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

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

    const result = await get(path, {
      access: 'private',
      token
    });

    if (!result || result.statusCode !== 200 || !result.stream) {
      return res.status(404).json({
        success: false,
        message: `${path} 파일을 찾지 못했습니다.`
      });
    }

    const content = await new Response(result.stream).text();
    const blob = result.blob;

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
