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
  const folder = String(req.query.folder || '').trim();

  if (!isSafePath(folder)) {
    return res.status(400).json({ message: 'Invalid folder path' });
  }

  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeGitHubPath(folder)}?ref=${encodeURIComponent(BRANCH)}`;

  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'agent1-vercel-viewer'
  };

  if (TOKEN) headers.Authorization = `Bearer ${TOKEN}`;

  try {
    const gh = await fetch(url, { headers });
    const text = await gh.text();

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
