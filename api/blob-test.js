export default async function handler(req, res) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(500).json({
        success: false,
        step: 'env_check',
        message: 'BLOB_READ_WRITE_TOKEN 환경변수가 없습니다.'
      });
    }

    const { put } = await import('@vercel/blob');

    const blob = await put(
      'test/hello.md',
      '# Hello Vercel Blob\n\nBlob 저장 테스트입니다.',
      {
        access: 'public',
        contentType: 'text/markdown'
      }
    );

    return res.status(200).json({
      success: true,
      url: blob.url,
      pathname: blob.pathname
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      step: 'blob_put',
      name: error.name,
      message: error.message
    });
  }
}
