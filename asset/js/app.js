/**
 * Vercel 배포 전 수정할 값
 * - GitHub Repository가 public이면 토큰 없이 조회 가능합니다.
 * - GitHub에 쓰기 작업은 브라우저에서 직접 하지 말고 n8n Webhook을 통해 처리합니다.
 * - n8n Webhook URL은 Vercel Environment Variable로 주입하는 방식을 권장합니다.
 */
const CONFIG = {
  // GitHub 조회는 /api 프록시를 통해 서버에서 인증 처리합니다.
  owner: 'howardchoi-nsus',
  repo: 'poc_ax',
  branch: 'main',
  folders: {
    source: 'source',
    req: 'req',
    prompts: 'prompts',
    prd: 'prd',
    maps: 'maps',
    logs: 'logs'
  },

  // 예: 'https://YOUR-N8N-DOMAIN/webhook/requirement-save'
  requirementSaveWebhook: '',
  // 예: 'https://YOUR-N8N-DOMAIN/webhook/agent1-prd-generate'
  prdGenerateWebhook: ''
};

marked.setOptions({ breaks: true, gfm: true });

let currentArea = 'req';
let filesByArea = { req: [], prd: [], maps: [], logs: [] };
let selectedReq = null;
let selectedPrd = null;
let selectedMap = null;
let rawMode = false;

const SOURCE_OPTIONS = {
  JIRA:   { label: 'JIRA', badge: 'JIRA', className: 'badge-jira' },
  SLACK:  { label: 'SLACK', badge: 'Slack', className: 'badge-slack' },
  FILE:   { label: '파일업로드', badge: 'File', className: 'badge-file' },
  DIRECT: { label: '직접등록', badge: '직접등록', className: 'badge-direct' }
};

let sourceBadgeCache = {};

const el = (id) => document.getElementById(id);
const fileList = el('file-list');
const search = el('search');
const toast = el('toast');

const apiFor = (folder) => `/api/github-list?folder=${encodeURIComponent(folder)}`;
const rawFor = (path) => `/api/github-file?path=${encodeURIComponent(path)}`;
const ghFor = (path) => `https://github.com/${CONFIG.owner}/${CONFIG.repo}/blob/${CONFIG.branch}/${path}`;

function initLabels() {
  el('repo-badge').textContent = `${CONFIG.owner}/${CONFIG.repo} · ${CONFIG.branch}`;
  el('branch-label').textContent = CONFIG.branch;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function formatSize(bytes) {
  if (!bytes) return '-';
  if (bytes < 1024) return bytes + 'B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + 'KB';
  return (bytes / 1024 / 1024).toFixed(1) + 'MB';
}


function makeTimestamp() {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yy}${mm}${dd}_${hh}${mi}${ss}`;
}

function normalizeRequirementKeyword(value) {
  return String(value || '')
    .trim()
    .replace(/^REQ_/i, '')
    .replace(/\.(txt|md|markdown)$/i, '')
    .replace(/\s+/g, '_')
    .replace(/[\\/:*?"<>|#%{}^~[\]`]+/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildRequirementId(timestamp = makeTimestamp()) {
  const keyword = normalizeRequirementKeyword(el('requirement-id').value);
  if (!keyword) return '';
  return `REQ_${keyword}_${timestamp}`;
}

function updateSourcePathPreview() {
  const sourcePath = el('source-path');
  const keyword = normalizeRequirementKeyword(el('requirement-id').value);
  if (!sourcePath) return;

  if (!keyword) {
    sourcePath.value = '';
    return;
  }
  sourcePath.value = `${CONFIG.folders.source}/REQ_${keyword}_YYMMDD_HHMMSS.txt`;
}

function getSourceOption(value) {
  return SOURCE_OPTIONS[value] || null;
}

function renderSourceBadge(sourceType) {
  const option = getSourceOption(sourceType);
  if (!option) return '<span class="source-badge badge-unknown">-</span>';
  return `<span class="source-badge ${option.className}">[ ${option.badge} ]</span>`;
}

function parseSourceTypeFromText(text) {
  const value = String(text || '');
  const patterns = [
    /source_type\s*:\s*["']?(JIRA|SLACK|FILE|DIRECT)["']?/i,
    /sourceType["']?\s*:\s*["'](JIRA|SLACK|FILE|DIRECT)["']/i,
    /"sourceType"\s*:\s*"(JIRA|SLACK|FILE|DIRECT)"/i,
    /출처\s*정보\s*[:：]\s*(JIRA|SLACK|파일업로드|직접등록)/i
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (!match) continue;
    const raw = match[1].toUpperCase();
    if (raw === '파일업로드') return 'FILE';
    if (raw === '직접등록') return 'DIRECT';
    return raw;
  }
  return '';
}

function sourceTypeFromPath(path) {
  if (sourceBadgeCache[path]) return sourceBadgeCache[path];
  const name = (path || '').toUpperCase();
  if (name.includes('JIRA')) return 'JIRA';
  if (name.includes('SLACK')) return 'SLACK';
  if (name.includes('FILE')) return 'FILE';
  if (name.includes('DIRECT')) return 'DIRECT';
  return '';
}

function hydrateSourceBadges() {
  const items = Array.from(fileList.querySelectorAll('.file-item'));
  items.slice(0, 30).forEach(async (item) => {
    const path = item.dataset.path;
    const badgeEl = item.querySelector('[data-source-badge]');
    if (!path || !badgeEl) return;

    let sourceType = sourceTypeFromPath(path);
    if (!sourceType && !sourceBadgeCache[path]) {
      try {
        const text = await fetchText(path);
        sourceType = parseSourceTypeFromText(text);
        if (sourceType) sourceBadgeCache[path] = sourceType;
      } catch {
        sourceType = '';
      }
    }

    badgeEl.outerHTML = renderSourceBadge(sourceType);
  });
}

function setSourceInputState() {
  const sourceType = el('source-type').value;
  const requirementText = el('requirement-text');
  const localFile = el('local-file');
  const sourceDetail = el('source-detail');

  const isFile = sourceType === 'FILE';
  const isDirect = sourceType === 'DIRECT';
  const isExternal = sourceType === 'JIRA' || sourceType === 'SLACK';

  requirementText.disabled = !(isFile || isDirect);
  localFile.disabled = !isFile;
  sourceDetail.disabled = !sourceType;

  if (!sourceType) {
    requirementText.value = '';
    sourceDetail.value = '';
    requirementText.placeholder = '출처 정보를 선택하면 입력할 수 있습니다.';
  } else if (isFile) {
    requirementText.placeholder = '로컬 파일을 불러오거나 파일 내용을 직접 붙여넣으세요.';
  } else if (isDirect) {
    requirementText.placeholder = '요구사항 원문을 직접 입력하세요.';
  } else {
    requirementText.value = '';
    requirementText.placeholder = 'JIRA/SLACK 선택 시 요구사항 원문은 직접 입력할 수 없습니다.';
  }
}

function fileExtPattern(area) {
  if (area === 'maps' || area === 'logs') return /\.(json)$/i;
  return /\.(md|markdown|txt)$/i;
}

async function fetchFolder(area) {
  const folder = CONFIG.folders[area];
  const res = await fetch(apiFor(folder));
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`${folder}: ${err.message || 'HTTP ' + res.status}`);
  }
  const data = await res.json();
  return data
    .filter((f) => f.type === 'file' && fileExtPattern(area).test(f.name))
    .map((f) => ({ ...f, area, path: `${folder}/${f.name}` }))
    .sort((a, b) => b.name.localeCompare(a.name));
}

async function refreshAll() {
  fileList.innerHTML = '<div class="empty">Repository 파일을 불러오는 중...</div>';
  try {
    const areas = ['req', 'prd', 'maps', 'logs'];
    const results = await Promise.allSettled(areas.map(fetchFolder));
    results.forEach((r, idx) => {
      filesByArea[areas[idx]] = r.status === 'fulfilled' ? r.value : [];
      if (r.status === 'rejected') console.warn(r.reason);
    });
    renderList();
    showToast('목록을 갱신했습니다.');
  } catch (e) {
    fileList.innerHTML = `<div class="error">불러오기 실패<br><br>${escapeHtml(e.message)}</div>`;
  }
}

function renderList() {
  const q = search.value.trim().toLowerCase();
  const files = filesByArea[currentArea].filter((f) => f.name.toLowerCase().includes(q));
  if (!files.length) {
    fileList.innerHTML = `<div class="empty">/${CONFIG.folders[currentArea]} 폴더에 표시할 파일이 없습니다.</div>`;
    return;
  }

  fileList.innerHTML = files.map((f) => {
    const badge = renderSourceBadge(sourceTypeFromPath(f.path));
    return `
      <div class="file-item" data-path="${escapeHtml(f.path)}" data-area="${f.area}">
        <div class="fi-top">
          <span data-source-badge>${badge}</span>
          <div class="fi-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
          <div class="fi-meta">${formatSize(f.size)}</div>
        </div>
        <div class="fi-path">${escapeHtml(f.path)}</div>
      </div>
    `;
  }).join('');

  fileList.querySelectorAll('.file-item').forEach((item) => {
    item.addEventListener('click', () => {
      fileList.querySelectorAll('.file-item').forEach((n) => n.classList.remove('active'));
      item.classList.add('active');
      openRepositoryFile(item.dataset.area, item.dataset.path);
    });
  });

  hydrateSourceBadges();
}

async function fetchText(path) {
  const res = await fetch(rawFor(path));
  if (!res.ok) throw new Error(`${path} 파일을 불러오지 못했습니다. HTTP ${res.status}`);
  return await res.text();
}

function renderPane(side, path, text, mode = 'markdown') {
  const preview = el(`${side}-preview`);
  const raw = el(`${side}-raw`);
  const source = el(`${side}-source`);
  const link = el(`${side}-gh`);

  source.textContent = `Source: ${path}`;
  link.href = ghFor(path);
  raw.value = text;

  if (mode === 'json') {
    try {
      const pretty = JSON.stringify(JSON.parse(text), null, 2);
      raw.value = pretty;
      preview.innerHTML = marked.parse('```json\n' + pretty + '\n```');
    } catch {
      preview.innerHTML = marked.parse('```json\n' + text + '\n```');
    }
  } else {
    preview.innerHTML = marked.parse(text);
  }

  raw.style.display = rawMode ? 'block' : 'none';
  preview.style.display = rawMode ? 'none' : 'block';
}

async function openRepositoryFile(area, path) {
  try {
    el('viewer-meta').textContent = `선택 파일: ${path}`;

    if (area === 'req') {
      const text = await fetchText(path);
      const parsedSourceType = parseSourceTypeFromText(text);
      if (parsedSourceType) sourceBadgeCache[path] = parsedSourceType;
      selectedReq = { path, text };
      renderPane('req', path, text);
      await autoFindPrdForReq(path);
    }

    if (area === 'prd') {
      const text = await fetchText(path);
      selectedPrd = { path, text };
      renderPane('prd', path, text);
    }

    if (area === 'maps') {
      await openMap(path);
    }

    if (area === 'logs') {
      const text = await fetchText(path);
      renderPane('prd', path, text, 'json');
      el('viewer-meta').textContent = `실행 로그 조회: ${path}`;
    }
  } catch (e) {
    showToast(e.message);
  }
}

function getRequirementKey(path) {
  const name = path.split('/').pop() || '';
  return name
    .replace(/^REQ_/, '')
    .replace(/^PRD_REQ_/, '')
    .replace(/^PRD_/, '')
    .replace(/\.(md|markdown|txt)$/i, '')
    .replace(/_\d{8}_\d{6}$/i, '');
}

async function autoFindPrdForReq(reqPath) {
  const key = getRequirementKey(reqPath).toLowerCase();

  const mapCandidate = filesByArea.maps.find((m) => m.name.toLowerCase().includes(key));
  if (mapCandidate) {
    await openMap(mapCandidate.path);
    return;
  }

  const prdCandidate = filesByArea.prd.find((p) => p.name.toLowerCase().includes(key));
  if (prdCandidate) {
    const prdText = await fetchText(prdCandidate.path);
    selectedPrd = { path: prdCandidate.path, text: prdText };
    renderPane('prd', prdCandidate.path, prdText);
  } else {
    el('prd-preview').innerHTML = '<p class="muted-text">연결된 PRD를 찾지 못했습니다. PRD 생성 버튼을 실행하거나 /PRD 파일을 직접 선택하세요.</p>';
    el('prd-raw').value = '';
    el('prd-source').textContent = 'Source: /prd';
    el('prd-gh').href = '#';
  }
}

function normalizeMapPath(map, keyCandidates) {
  for (const key of keyCandidates) {
    if (map && typeof map[key] === 'string' && map[key]) return map[key].replace(/^\/+/, '');
  }
  return '';
}

async function openMap(path) {
  const text = await fetchText(path);
  let map;
  try {
    map = JSON.parse(text);
  } catch {
    selectedMap = { path, text, json: null };
    renderPane('prd', path, text, 'json');
    return;
  }

  selectedMap = { path, text, json: map };
  const reqPath = normalizeMapPath(map, ['requirementFilePath', 'reqFilePath', 'requirement_path', 'reqPath']);
  const prdPath = normalizeMapPath(map, ['prdFilePath', 'prd_path', 'prdPath', 'outputPrdFile']);

  el('viewer-meta').textContent = `매핑 조회: ${path}`;

  if (reqPath) {
    const reqText = await fetchText(reqPath);
    selectedReq = { path: reqPath, text: reqText };
    renderPane('req', reqPath, reqText);
  } else {
    renderPane('req', path, text, 'json');
  }

  if (prdPath) {
    const prdText = await fetchText(prdPath);
    selectedPrd = { path: prdPath, text: prdText };
    renderPane('prd', prdPath, prdText);
  } else {
    renderPane('prd', path, text, 'json');
  }
}

async function openLatestMap() {
  const latest = filesByArea.maps[0];
  if (!latest) {
    showToast('/maps 파일이 없습니다.');
    return;
  }
  currentArea = 'maps';
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.area === 'maps'));
  renderList();
  await openMap(latest.path);
}

async function postWebhook(url, payload) {
  if (!url) {
    throw new Error('Webhook URL이 비어 있습니다. CONFIG의 requirementSaveWebhook 또는 prdGenerateWebhook 값을 설정하세요.');
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Webhook 호출 실패: HTTP ${res.status} ${text}`);
  }

  return await res.json().catch(() => ({}));
}

async function saveRequirement() {
  const timestamp = makeTimestamp();
  const keyword = normalizeRequirementKeyword(el('requirement-id').value);
  const requirementId = keyword ? `REQ_${keyword}_${timestamp}` : '';
  const sourceType = el('source-type').value;
  const sourceOption = getSourceOption(sourceType);
  const sourceFilePath = requirementId ? `${CONFIG.folders.source}/${requirementId}.txt` : '';
  const promptFilePath = el('prompt-path').value.trim();
  const sourceDetail = el('source-detail').value.trim();
  const requirementText = el('requirement-text').value.trim();

  if (!keyword) return showToast('Requirement Keyword를 입력하세요.');
  if (!sourceType) return showToast('출처 정보를 선택하세요.');

  if ((sourceType === 'FILE' || sourceType === 'DIRECT') && !requirementText) {
    return showToast(sourceType === 'FILE' ? '파일을 불러오거나 요구사항 원문을 입력하세요.' : '요구사항 원문을 입력하세요.');
  }

  if ((sourceType === 'JIRA' || sourceType === 'SLACK') && !sourceDetail) {
    return showToast('JIRA 이슈 키 또는 Slack 링크 등 출처 상세 정보를 입력하세요.');
  }

  const sourceText = requirementText || `[${sourceOption.label}] ${sourceDetail}`;
  const sourceMetaBlock = [
    `source_type: ${sourceType}`,
    `source_label: ${sourceOption.badge}`,
    sourceDetail ? `source_detail: ${sourceDetail}` : '',
    ''
  ].filter(Boolean).join('\n');

  try {
    el('btn-save-req').disabled = true;
    if (el('source-path')) el('source-path').value = sourceFilePath;

    await postWebhook(CONFIG.requirementSaveWebhook, {
      action: 'requirement_save',
      requirementKeyword: keyword,
      requirementId,
      sourceType,
      sourceLabel: sourceOption.badge,
      sourceDetail,
      sourceFilePath,
      promptFilePath,
      requirementText: `${sourceMetaBlock}${sourceText}`,
      sourceText: `${sourceMetaBlock}${sourceText}`,
      githubOwner: CONFIG.owner,
      githubRepo: CONFIG.repo,
      githubBranch: CONFIG.branch,
      folders: CONFIG.folders
    });

    sourceBadgeCache[sourceFilePath.replace(/^source\//, `${CONFIG.folders.req}/`).replace(/\.txt$/i, '.md')] = sourceType;
    showToast(`요구사항 등록 요청을 보냈습니다. ${requirementId}`);
    await refreshAll();
  } catch (e) {
    showToast(e.message);
  } finally {
    el('btn-save-req').disabled = false;
  }
}

async function runPrdGenerate() {
  const keyword = normalizeRequirementKeyword(el('requirement-id').value);
  const promptFilePath = el('prompt-path').value.trim();
  const selectedReqPath = selectedReq?.path || '';
  const requirementId = selectedReqPath
    ? selectedReqPath.split('/').pop().replace(/\.(md|markdown|txt)$/i, '')
    : '';

  if (!keyword && !requirementId) return showToast('Requirement Keyword를 입력하거나 /Req 파일을 선택하세요.');
  if (!selectedReqPath) return showToast('/Req 파일을 먼저 선택하세요.');

  try {
    el('btn-run-prd').disabled = true;
    await postWebhook(CONFIG.prdGenerateWebhook, {
      action: 'agent1_prd_generate',
      requirementKeyword: keyword,
      requirementId,
      requirementFilePath: selectedReqPath,
      promptFilePath,
      sourceType: sourceBadgeCache[selectedReqPath] || parseSourceTypeFromText(selectedReq.text) || '',
      githubOwner: CONFIG.owner,
      githubRepo: CONFIG.repo,
      githubBranch: CONFIG.branch,
      folders: CONFIG.folders
    });
    showToast('PRD 생성 요청을 보냈습니다.');
    await refreshAll();
  } catch (e) {
    showToast(e.message);
  } finally {
    el('btn-run-prd').disabled = false;
  }
}

function copyText(side) {
  const value = el(`${side}-raw`).value;
  if (!value) return showToast('복사할 내용이 없습니다.');
  navigator.clipboard.writeText(value).then(() => showToast('복사 완료'));
}

function toggleRaw() {
  rawMode = !rawMode;
  ['req', 'prd'].forEach((side) => {
    el(`${side}-raw`).style.display = rawMode ? 'block' : 'none';
    el(`${side}-preview`).style.display = rawMode ? 'none' : 'block';
  });
  el('btn-toggle-raw').textContent = rawMode ? 'Markdown 보기' : 'Raw 보기';
}

function bindEvents() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentArea = btn.dataset.area;
      document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
      btn.classList.add('active');
      renderList();
    });
  });

  search.addEventListener('input', renderList);
  el('btn-refresh').addEventListener('click', refreshAll);
  el('btn-refresh-top').addEventListener('click', refreshAll);
  el('btn-open-latest').addEventListener('click', openLatestMap);
  el('btn-open-map').addEventListener('click', () => {
    if (selectedMap?.path) renderPane('prd', selectedMap.path, selectedMap.text, 'json');
    else showToast('선택된 매핑 정보가 없습니다.');
  });
  el('btn-save-req').addEventListener('click', saveRequirement);
  el('btn-run-prd').addEventListener('click', runPrdGenerate);
  el('btn-copy-left').addEventListener('click', () => copyText('req'));
  el('btn-copy-right').addEventListener('click', () => copyText('prd'));
  el('btn-toggle-raw').addEventListener('click', toggleRaw);
  el('btn-clear').addEventListener('click', () => {
    el('requirement-id').value = '';
    el('source-type').value = '';
    el('source-detail').value = '';
    if (el('source-path')) el('source-path').value = '';
    el('requirement-text').value = '';
    el('local-file').value = '';
    setSourceInputState();
    showToast('입력값을 초기화했습니다.');
  });

  el('requirement-id').addEventListener('input', updateSourcePathPreview);
  el('source-type').addEventListener('change', () => {
    setSourceInputState();
    updateSourcePathPreview();
  });

  el('local-file').addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    el('requirement-text').value = text;
    el('source-detail').value = file.name;
    updateSourcePathPreview();
    showToast('파일 내용을 불러왔습니다.');
  });
}

initLabels();
bindEvents();
setSourceInputState();
updateSourcePathPreview();
refreshAll();
