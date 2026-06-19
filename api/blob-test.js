import { put } from '@vercel/blob';

export default async function handler(req, res) {
  const blob = await put(
    'test/hello.txt',
    'hello',
    {
      access: 'public'
    }
  );

  return res.json(blob);
}
