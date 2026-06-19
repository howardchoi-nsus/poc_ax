import { getDownloadUrl } from '@vercel/blob';

export default async function handler(req, res) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({
        success: false,
        step: 'env_check',
        message: 'BLOB_READ_WRITE_TOKEN 환경변수가 없습니다.'
      });
    }

    const path = String(req.query.path || '').replace(/^\/+/, '');
    if (!path) {
      return res.status(400).json({ success: false, message: 'path 값이 필요합니다.' });
    }

    const downloadUrl = await getDownloadUrl(path);
    const response = await fetch(downloadUrl);

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: `${path} 파일을 읽지 못했습니다.`,
        status: response.status
      });
    }

    const content = await response.text();

    return res.status(200).json({
      success: true,
      path,
      content
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
