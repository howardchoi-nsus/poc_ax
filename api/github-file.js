const OWNER = process.env.GITHUB_OWNER || 'howardchoi-nsus';
const REPO = process.env.GITHUB_REPO || 'poc_ax';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const TOKEN = process.env.GITHUB_TOKEN;

function encodeGitHubPath(path) {
  return String(path || '')
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function isSafePath(path) {
  return Boolean(path) && !path.includes('..') && !path.startsWith('/') && !path.includes('\\');
}

export default async function handler(req, res) {
  const path = String(req.query.path || '').trim();

  if (!isSafePath(path)) {
    return res.status(400).json({ message: 'Invalid file path' });
  }

  const apiUrl = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeGitHubPath(path)}?ref=${encodeURIComponent(BRANCH)}`;

  const headers = {
    Accept: 'application/vnd.github.v3.raw',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'agent1-vercel-viewer'
  };

  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

  try {
    const gh = await fetch(apiUrl, { headers });
    const text = await gh.text();

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=300');
    res.setHeader('X-GitHub-RateLimit-Remaining', gh.headers.get('x-ratelimit-remaining') || '');

    if (!gh.ok) {
      return res.status(gh.status).send(text);
    }

    res.status(200).send(text);
  } catch (error) {
    res.status(500).json({ message: error.message || 'GitHub proxy failed' });
  }
}
