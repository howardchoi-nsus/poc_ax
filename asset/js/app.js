/*
  AGENT1 PRD Workspace
  - 더미데이터 없음
  - GitHub Repository의 실제 파일 목록/파일 내용을 n8n Git Proxy Webhook으로 조회
  - GitHub Token은 브라우저에 노출하지 않고 n8n Credential에서만 사용
*/
const APP_CONFIG = {
  github: {
    owner: 'howardchoi-nsus',
    repo: 'poc_ax2',
    branch: 'main',
    folders: {
      req: 'req',
      prompts: 'prompts',
      prd: 'prd',
      logs: 'logs',
      phaseScenario: 'phase2/scenario',
      phaseFlow: 'phase2/flow',
      phaseSequence: 'phase2/sequence'
    }
  },
  webhooks: {
    // n8n Webhook URL은 query string 또는 localStorage로도 주입할 수 있습니다.
    // 예: index.html?reqWebhook=https://.../webhook/agent1-requirement-save&prdWebhook=https://.../webhook/agent1-prd-generate
    requirementSave: '',
    prdGenerate: '',
    gitList: '',
    gitFile: '',
    prdRevise: '',
    phaseGenerate: '',
    secret: ''
  },
  ui: {
    min: { section1: 300, section2: 440, section3: 320 },
    max: { section1: 660, section2: 960, section3: 720 },
    closedRail: 48
  }
};

const query = new URLSearchParams(location.search);
APP_CONFIG.github.owner = query.get('owner') || APP_CONFIG.github.owner;
APP_CONFIG.github.repo = query.get('repo') || APP_CONFIG.github.repo;
APP_CONFIG.github.branch = query.get('branch') || APP_CONFIG.github.branch;
APP_CONFIG.github.folders.req = query.get('reqFolder') || localStorage.getItem('agent1_req_folder') || APP_CONFIG.github.folders.req;
APP_CONFIG.github.folders.prompts = query.get('promptFolder') || localStorage.getItem('agent1_prompt_folder') || APP_CONFIG.github.folders.prompts;
APP_CONFIG.github.folders.prd = query.get('prdFolder') || localStorage.getItem('agent1_prd_folder') || APP_CONFIG.github.folders.prd;
APP_CONFIG.github.folders.logs = query.get('logFolder') || localStorage.getItem('agent1_log_folder') || APP_CONFIG.github.folders.logs;
APP_CONFIG.webhooks.requirementSave = query.get('reqWebhook') || localStorage.getItem('agent1_req_webhook') || APP_CONFIG.webhooks.requirementSave;
APP_CONFIG.webhooks.prdGenerate = query.get('prdWebhook') || localStorage.getItem('agent1_prd_webhook') || APP_CONFIG.webhooks.prdGenerate;
APP_CONFIG.webhooks.gitList = query.get('gitListWebhook') || localStorage.getItem('agent1_git_list_webhook') || APP_CONFIG.webhooks.gitList;
APP_CONFIG.webhooks.gitFile = query.get('gitFileWebhook') || localStorage.getItem('agent1_git_file_webhook') || APP_CONFIG.webhooks.gitFile;
APP_CONFIG.webhooks.prdRevise = query.get('reviseWebhook') || localStorage.getItem('agent1_revise_webhook') || APP_CONFIG.webhooks.prdRevise;
APP_CONFIG.webhooks.phaseGenerate = query.get('phaseWebhook') || localStorage.getItem('agent1_phase_webhook') || APP_CONFIG.webhooks.phaseGenerate;
APP_CONFIG.webhooks.secret = query.get('webhookSecret') || localStorage.getItem('agent1_webhook_secret') || APP_CONFIG.webhooks.secret;

const state = {
  requirements: [],
  prompts: [],
  prds: [],
  logs: [],
  artifacts: [],
  selectedReqPaths: new Set(),
  activeFilter: 'all',
  activePrd: null,
  activeArtifact: null,
  rawMode: false,
  closedCols: new Set(),
  widths: {
    section1: localStorage.getItem('agent1_section1_width') || getComputedStyle(document.documentElement).getPropertyValue('--section1_width').trim(),
    section2: localStorage.getItem('agent1_section2_width') || getComputedStyle(document.documentElement).getPropertyValue('--section2_width').trim(),
    section3: localStorage.getItem('agent1_section3_width') || getComputedStyle(document.documentElement).getPropertyValue('--section3_width').trim()
  }
};

const $ = (id) => document.getElementById(id);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const elements = {
  repoBadge: $('header_repo_badge'),
  refreshAll: $('header_btn_refresh'),
  content: $('content'),
  section1: $('section1'),
  section2: $('section2'),
  section3: $('section3'),
  search: $('section1_search_input'),
  selectAll: $('section1_select_all'),
  requirementList: $('section1_requirement_list'),
  selectedList: $('section1_selected_list'),
  selectedCount: $('section1_selected_count'),
  selectedCountMini: $('section1_selected_count_mini'),
  totalCount: $('section1_total_count'),
  clearSelection: $('section1_btn_clear_selection'),
  confirmSelection: $('section1_btn_confirm'),
  targetCount: $('section2_target_count'),
  selectedSummary: $('section2_selected_summary'),
  promptTemplate: $('section2_prompt_template'),
  modelSelect: $('section2_model_select'),
  docTitle: $('section2_doc_title'),
  generatePrd: $('section2_btn_generate'),
  prdFileList: $('section2_prd_file_list'),
  refreshPrd: $('section2_btn_refresh_prd'),
  prdPreview: $('section2_prd_preview'),
  prdRaw: $('section2_prd_raw'),
  copyPrd: $('section2_btn_copy_prd'),
  downloadPrd: $('section2_btn_download_prd'),
  feedbackInput: $('section2_feedback_input'),
  feedback: $('section2_btn_feedback'),
  revise: $('section2_btn_revise'),
  logList: $('section2_log_list'),
  refreshLogs: $('section2_btn_refresh_logs'),
  phaseSelect: $('section3_phase_select'),
  refreshArtifacts: $('section3_btn_refresh_artifacts'),
  artifactList: $('section3_artifact_list'),
  artifactPreview: $('section3_artifact_preview'),
  artifactRaw: $('section3_artifact_raw'),
  downloadArtifact: $('section3_btn_download_artifact'),
  modal: $('modal_detail'),
  modalBadge: $('modal_badge'),
  modalTitle: $('modal_title'),
  modalMeta: $('modal_meta'),
  modalBody: $('modal_body'),
  modalSelect: $('modal_btn_select'),
  toast: $('toast_message')
};

function init() {
  initRepoLabel();
  applyInitialWidths();
  bindEvents();
  refreshRepositoryData();
}

function initRepoLabel() {
  const { owner, repo, branch } = APP_CONFIG.github;
  elements.repoBadge.textContent = `${owner}/${repo} · ${branch}`;
}

function applyInitialWidths() {
  document.documentElement.style.setProperty('--section1_width', state.widths.section1);
  document.documentElement.style.setProperty('--section2_width', state.widths.section2);
  document.documentElement.style.setProperty('--section3_width', state.widths.section3);
}

function bindEvents() {
  elements.refreshAll.addEventListener('click', refreshRepositoryData);
  elements.search.addEventListener('input', renderRequirementList);
  elements.selectAll.addEventListener('change', onSelectAll);
  elements.clearSelection.addEventListener('click', clearSelection);
  elements.confirmSelection.addEventListener('click', () => showToast('선택이 완료되었습니다. 2컬럼에서 PRD 생성을 요청하세요.'));
  elements.generatePrd.addEventListener('click', requestPrdGenerate);
  elements.refreshPrd.addEventListener('click', refreshPrdFiles);
  elements.copyPrd.addEventListener('click', () => copyToClipboard(elements.prdRaw.value));
  elements.downloadPrd.addEventListener('click', () => downloadText(state.activePrd?.name || 'PRD.md', elements.prdRaw.value));
  elements.feedback.addEventListener('click', submitFeedback);
  elements.revise.addEventListener('click', requestPrdRevise);
  elements.refreshLogs.addEventListener('click', refreshLogs);
  elements.phaseSelect.addEventListener('change', refreshArtifacts);
  elements.refreshArtifacts.addEventListener('click', refreshArtifacts);
  elements.downloadArtifact.addEventListener('click', () => downloadText(state.activeArtifact?.name || 'artifact.md', elements.artifactRaw.value));
  elements.modalSelect.addEventListener('click', (event) => {
    event.preventDefault();
    const path = elements.modalSelect.dataset.path;
    if (path) toggleRequirementSelection(path, true);
    elements.modal.close();
  });

  $$('.section1_filter_button').forEach((button) => {
    button.addEventListener('click', () => {
      state.activeFilter = button.dataset.filter;
      $$('.section1_filter_button').forEach((item) => item.classList.remove('is_active'));
      button.classList.add('is_active');
      renderRequirementList();
    });
  });

  $$('.section2_viewer_tab').forEach((button) => {
    button.addEventListener('click', () => {
      state.rawMode = button.dataset.view === 'raw';
      $$('.section2_viewer_tab').forEach((item) => item.classList.remove('is_active'));
      button.classList.add('is_active');
      elements.prdPreview.classList.toggle('is_hidden', state.rawMode);
      elements.prdRaw.classList.toggle('is_hidden', !state.rawMode);
    });
  });

  $$('.header_preset_button').forEach((button) => {
    button.addEventListener('click', () => applyPreset(button.dataset.preset));
  });

  $$('.header_column_switch').forEach((button) => {
    button.addEventListener('click', () => toggleColumn(button.dataset.toggleCol));
  });
  $$('[data-close-col]').forEach((button) => button.addEventListener('click', () => closeColumn(button.dataset.closeCol)));
  $$('[data-reopen-col]').forEach((button) => button.addEventListener('click', () => openColumn(button.dataset.reopenCol)));
  $$('.common_resizer').forEach((resizer) => resizer.addEventListener('pointerdown', startResize));

  $('section1_btn_file_source').addEventListener('click', requestFileRequirementSave);
  $('section1_btn_direct_source').addEventListener('click', requestDirectRequirementSave);
}

function githubApiUrl(path = '') {
  const { owner, repo, branch } = APP_CONFIG.github;
  const normalized = path.replace(/^\/+/, '');
  return `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponentPath(normalized)}?ref=${encodeURIComponent(branch)}`;
}

function githubRawUrl(path) {
  const { owner, repo, branch } = APP_CONFIG.github;
  return `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponentPath(branch)}/${encodeURIComponentPath(path)}`;
}

function encodeURIComponentPath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

async function fetchGitHubFolder(folder, options = {}) {
  const { required = false, label = folder } = options;

  if (APP_CONFIG.webhooks.gitList) {
    const data = await postWebhook(APP_CONFIG.webhooks.gitList, {
      action: 'git_list',
      folder,
      githubOwner: APP_CONFIG.github.owner,
      githubRepo: APP_CONFIG.github.repo,
      githubBranch: APP_CONFIG.github.branch,
      requestedBy: 'web'
    });

    if (data.success === false) {
      if (required) throw new Error(data.message || `${label} 목록을 불러오지 못했습니다.`);
      return [];
    }

    return normalizeFileList(data.files || data.items || [], folder);
  }

  // n8n proxy URL이 없을 때만 GitHub API 직접 조회를 fallback으로 사용합니다.
  // Public repo에서만 권장하며, 인증 없는 GitHub API는 rate limit이 낮습니다.
  const url = githubApiUrl(folder);
  const response = await fetch(url, { headers: { Accept: 'application/vnd.github+json' } });

  if (response.status === 403) {
    throw new Error(`${label} 목록 조회가 GitHub rate limit 또는 권한 문제로 차단되었습니다. gitListWebhook을 설정해 n8n proxy로 조회하세요.`);
  }

  if (response.status === 404) {
    const message = [
      `${label} 폴더를 찾지 못했습니다.`,
      `확인값: ${APP_CONFIG.github.owner}/${APP_CONFIG.github.repo} · ${APP_CONFIG.github.branch} · /${folder}`,
      '가능한 원인: repo/branch/folder 대소문자 불일치, Private repo 인증 미적용, 폴더 경로 오류'
    ].join('\n');
    if (required) throw new Error(message);
    return [];
  }

  if (!response.ok) {
    throw new Error(`${label} 목록을 불러오지 못했습니다. HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data)) {
    if (required) throw new Error(`${label} 경로가 폴더가 아닙니다. 확인값: /${folder}`);
    return [];
  }

  return normalizeFileList(data, folder);
}

function normalizeFileList(items, folder = '') {
  return (Array.isArray(items) ? items : [])
    .filter((item) => (item.type || 'file') === 'file')
    .map((item) => ({
      name: item.name || String(item.path || '').split('/').pop(),
      path: item.path || `${folder}/${item.name}`.replace(/^\/+/, ''),
      size: item.size || 0,
      downloadUrl: item.downloadUrl || item.download_url || '',
      htmlUrl: item.htmlUrl || item.html_url || ''
    }))
    .filter((item) => item.name && item.path)
    .sort((a, b) => b.name.localeCompare(a.name));
}

async function fetchGitHubFolderWithFallback(primaryFolder, fallbackFolders = [], options = {}) {
  const tried = [];
  const candidates = [primaryFolder, ...fallbackFolders].filter(Boolean);

  for (const folder of candidates) {
    try {
      tried.push(folder);
      const files = await fetchGitHubFolder(folder, { ...options, required: true });
      if (folder !== primaryFolder) {
        APP_CONFIG.github.folders.req = folder;
        localStorage.setItem('agent1_req_folder', folder);
        showToast(`요구사항 폴더를 /${folder}로 자동 보정했습니다.`);
      }
      return files;
    } catch (error) {
      if (!String(error.message).includes('폴더를 찾지 못했습니다')) throw error;
    }
  }

  throw new Error([
    `${options.label || primaryFolder} 폴더를 찾지 못했습니다.`,
    `시도한 경로: ${tried.map((item) => '/' + item).join(', ')}`,
    `확인값: ${APP_CONFIG.github.owner}/${APP_CONFIG.github.repo} · ${APP_CONFIG.github.branch}`,
    'GitHub는 폴더 대소문자를 구분합니다. /Req에 있으면 reqFolder=Req로 접속하세요.',
    'Private repo라면 브라우저 직접 조회가 404로 보일 수 있으므로 Vercel API proxy 또는 n8n proxy 조회가 필요합니다.'
  ].join('\n'));
}

async function fetchGitHubText(path) {
  if (APP_CONFIG.webhooks.gitFile) {
    const data = await postWebhook(APP_CONFIG.webhooks.gitFile, {
      action: 'git_file',
      path,
      githubOwner: APP_CONFIG.github.owner,
      githubRepo: APP_CONFIG.github.repo,
      githubBranch: APP_CONFIG.github.branch,
      requestedBy: 'web'
    });
    if (data.success === false) throw new Error(data.message || `${path} 파일을 불러오지 못했습니다.`);
    return data.content || data.text || '';
  }

  const response = await fetch(githubRawUrl(path));
  if (response.status === 403) throw new Error(`${path} 파일 조회가 GitHub rate limit 또는 권한 문제로 차단되었습니다. gitFileWebhook을 설정해 n8n proxy로 조회하세요.`);
  if (!response.ok) throw new Error(`${path} 파일을 불러오지 못했습니다. HTTP ${response.status}`);
  return await response.text();
}

async function refreshRepositoryData() {
  showToast('Git Repository 데이터를 불러오는 중입니다.');
  await Promise.allSettled([refreshRequirements(), refreshPrompts(), refreshPrdFiles(), refreshLogs(), refreshArtifacts()]);
  showToast('Git Repository 데이터 갱신 완료');
}

async function refreshRequirements() {
  try {
    state.requirements = await fetchGitHubFolderWithFallback(APP_CONFIG.github.folders.req, ['Req', 'REQ', 'requirements', 'Requirements'], { label: '요구사항' });
    renderRequirementList();
  } catch (error) {
    elements.requirementList.innerHTML = renderError(error.message);
  }
}

async function refreshPrompts() {
  try {
    state.prompts = await fetchGitHubFolder(APP_CONFIG.github.folders.prompts);
    renderPromptOptions();
  } catch (error) {
    elements.promptTemplate.innerHTML = `<option value="">프롬프트 로딩 실패</option>`;
  }
}

async function refreshPrdFiles() {
  try {
    state.prds = await fetchGitHubFolder(APP_CONFIG.github.folders.prd);
    renderPrdFiles();
  } catch (error) {
    elements.prdFileList.innerHTML = renderError(error.message);
  }
}

async function refreshLogs() {
  try {
    state.logs = await fetchGitHubFolder(APP_CONFIG.github.folders.logs);
    renderLogs();
  } catch (error) {
    elements.logList.innerHTML = renderError(error.message);
  }
}

async function refreshArtifacts() {
  const selectedFolder = elements.phaseSelect.value;
  try {
    state.artifacts = await fetchGitHubFolder(selectedFolder);
    renderArtifacts();
  } catch (error) {
    elements.artifactList.innerHTML = renderError(error.message);
  }
}

function renderRequirementList() {
  const keyword = elements.search.value.trim().toLowerCase();
  const files = state.requirements.filter((file) => {
    const source = inferSourceType(file.name);
    const matchFilter = state.activeFilter === 'all' || source === state.activeFilter;
    const matchKeyword = !keyword || file.name.toLowerCase().includes(keyword) || file.path.toLowerCase().includes(keyword);
    return matchFilter && matchKeyword;
  });

  elements.totalCount.textContent = String(files.length);
  elements.selectAll.checked = files.length > 0 && files.every((file) => state.selectedReqPaths.has(file.path));

  if (!files.length) {
    elements.requirementList.innerHTML = `<div class="common_empty">/${APP_CONFIG.github.folders.req} 폴더에 표시할 요구사항 파일이 없습니다. md 파일이 있다면 repo/branch/folder 대소문자 또는 gitListWebhook 설정을 확인하세요.</div>`;
    updateSelectedView();
    return;
  }

  elements.requirementList.innerHTML = files.map((file) => {
    const source = inferSourceType(file.name);
    const selected = state.selectedReqPaths.has(file.path);
    return `
      <article class="section1_req_item ${selected ? 'is_selected' : ''}" data-path="${escapeHtml(file.path)}">
        <input type="checkbox" class="section1_req_checkbox" ${selected ? 'checked' : ''} aria-label="${escapeHtml(file.name)} 선택" />
        <div class="section1_req_main">
          <button class="section1_req_title_button" type="button">${escapeHtml(file.name)}</button>
          <div class="section1_req_meta">
            <span class="common_badge ${source}">${source}</span>
            <span>${formatSize(file.size)}</span>
            <span>${escapeHtml(file.path)}</span>
          </div>
          <p class="section1_req_snippet">Git Repository의 ${escapeHtml(file.path)} 파일입니다. 제목을 클릭하면 원문을 불러옵니다.</p>
        </div>
        <span class="common_status_badge success">Repo</span>
      </article>
    `;
  }).join('');

  $$('.section1_req_item', elements.requirementList).forEach((item) => {
    const path = item.dataset.path;
    item.querySelector('.section1_req_checkbox').addEventListener('change', (event) => toggleRequirementSelection(path, event.target.checked));
    item.querySelector('.section1_req_title_button').addEventListener('click', () => openRequirementModal(path));
  });
  updateSelectedView();
}

function renderPromptOptions() {
  const promptFiles = state.prompts.filter((file) => /\.(md|txt|markdown)$/i.test(file.name));
  if (!promptFiles.length) {
    elements.promptTemplate.innerHTML = `<option value="">/prompts 폴더에 프롬프트 없음</option>`;
    return;
  }
  elements.promptTemplate.innerHTML = promptFiles.map((file) => `<option value="${escapeHtml(file.path)}">${escapeHtml(file.name)}</option>`).join('');
}

function renderPrdFiles() {
  const prdFiles = state.prds.filter((file) => /\.(md|txt|markdown)$/i.test(file.name));
  if (!prdFiles.length) {
    elements.prdFileList.innerHTML = `<div class="common_empty">/prd 폴더에 PRD 문서가 없습니다.</div>`;
    return;
  }
  elements.prdFileList.innerHTML = prdFiles.map((file) => `
    <button class="section2_file_button" type="button" data-path="${escapeHtml(file.path)}">
      <span>${escapeHtml(file.name)}</span>
      <b>열기</b>
      <em>${escapeHtml(file.path)} · ${formatSize(file.size)}</em>
    </button>
  `).join('');
  $$('.section2_file_button', elements.prdFileList).forEach((button) => {
    button.addEventListener('click', () => openPrdFile(button.dataset.path));
  });
}

function renderLogs() {
  if (!state.logs.length) {
    elements.logList.innerHTML = `<div class="common_empty">/logs 폴더에 생성 로그가 없습니다.</div>`;
    return;
  }
  elements.logList.innerHTML = state.logs.slice(0, 10).map((file) => `
    <div class="section2_log_item">
      <strong>${escapeHtml(file.name)}</strong><br />
      <span>${escapeHtml(file.path)} · ${formatSize(file.size)}</span>
    </div>
  `).join('');
}

function renderArtifacts() {
  if (!state.artifacts.length) {
    elements.artifactList.innerHTML = `<div class="common_empty">선택한 Phase 폴더에 산출물이 없습니다.</div>`;
    return;
  }
  elements.artifactList.innerHTML = state.artifacts.map((file) => `
    <button class="section3_artifact_button" type="button" data-path="${escapeHtml(file.path)}">
      <span>${escapeHtml(file.name)}</span>
      <b>👁</b>
      <em>${escapeHtml(file.path)} · ${formatSize(file.size)}</em>
    </button>
  `).join('');
  $$('.section3_artifact_button', elements.artifactList).forEach((button) => {
    button.addEventListener('click', () => openArtifactFile(button.dataset.path));
  });
}

async function openRequirementModal(path) {
  try {
    const file = state.requirements.find((item) => item.path === path);
    const text = await fetchGitHubText(path);
    const source = parseSourceTypeFromText(text) || inferSourceType(file?.name || path);
    elements.modalBadge.textContent = source;
    elements.modalBadge.className = `modal_badge ${source}`;
    elements.modalTitle.textContent = file?.name || path;
    elements.modalMeta.innerHTML = `
      <strong>Path:</strong> ${escapeHtml(path)}<br />
      <strong>Source:</strong> ${escapeHtml(source)}<br />
      <strong>Size:</strong> ${formatSize(file?.size || 0)}
    `;
    elements.modalBody.textContent = text;
    elements.modalSelect.dataset.path = path;
    elements.modal.showModal();
  } catch (error) {
    showToast(error.message);
  }
}

async function openPrdFile(path) {
  try {
    const file = state.prds.find((item) => item.path === path);
    const text = await fetchGitHubText(path);
    state.activePrd = { ...(file || { name: path, path }), text };
    elements.prdRaw.value = text;
    elements.prdPreview.innerHTML = markdownToHtml(text);
    $$('.section2_file_button').forEach((button) => button.classList.toggle('is_active', button.dataset.path === path));
    showToast('PRD 문서를 열었습니다.');
  } catch (error) {
    showToast(error.message);
  }
}

async function openArtifactFile(path) {
  try {
    const file = state.artifacts.find((item) => item.path === path);
    const text = await fetchGitHubText(path);
    state.activeArtifact = { ...(file || { name: path, path }), text };
    elements.artifactRaw.value = text;
    elements.artifactPreview.innerHTML = markdownToHtml(text);
    $$('.section3_artifact_button').forEach((button) => button.classList.toggle('is_active', button.dataset.path === path));
    showToast('산출물을 열었습니다.');
  } catch (error) {
    showToast(error.message);
  }
}

function onSelectAll(event) {
  const checked = event.target.checked;
  $$('.section1_req_item', elements.requirementList).forEach((item) => toggleRequirementSelection(item.dataset.path, checked, false));
  renderRequirementList();
}

function toggleRequirementSelection(path, checked, rerender = true) {
  if (checked) state.selectedReqPaths.add(path);
  else state.selectedReqPaths.delete(path);
  if (rerender) renderRequirementList();
  updateSelectedView();
}

function clearSelection() {
  state.selectedReqPaths.clear();
  renderRequirementList();
}

function updateSelectedView() {
  const selected = state.requirements.filter((file) => state.selectedReqPaths.has(file.path));
  const count = selected.length;
  elements.selectedCount.textContent = String(count);
  elements.selectedCountMini.textContent = String(count);
  elements.targetCount.textContent = `${count}개`;
  elements.confirmSelection.disabled = count === 0;
  elements.generatePrd.disabled = count === 0;

  if (!count) {
    elements.selectedList.innerHTML = `<p class="common_muted">선택된 요구사항이 없습니다.</p>`;
    elements.selectedSummary.textContent = '좌측 패널에서 요구사항을 선택하면 이곳에 표시됩니다.';
    return;
  }

  elements.selectedList.innerHTML = selected.map((file) => `
    <div class="section1_selected_pill">
      <span>${escapeHtml(file.name)}</span>
      <button type="button" data-remove-path="${escapeHtml(file.path)}">×</button>
    </div>
  `).join('');
  $$('[data-remove-path]', elements.selectedList).forEach((button) => button.addEventListener('click', () => toggleRequirementSelection(button.dataset.removePath, false)));

  elements.selectedSummary.innerHTML = `<div class="section2_summary_tags">${selected.map((file) => `<span class="section2_summary_tag">${escapeHtml(file.name)}</span>`).join('')}</div>`;
}

async function requestPrdGenerate() {
  if (!APP_CONFIG.webhooks.prdGenerate) {
    showToast('PRD 생성 Webhook URL이 비어 있습니다. app.js 또는 URL query의 prdWebhook 값을 설정하세요.');
    return;
  }

  const selected = state.requirements.filter((file) => state.selectedReqPaths.has(file.path));
  if (!selected.length) return showToast('PRD 생성 대상 요구사항을 선택하세요.');
  if (!elements.promptTemplate.value) return showToast('PRD 프롬프트를 선택하세요.');

  const requirementSetId = buildRequirementSetId(selected);
  const payload = {
    action: 'agent1_prd_generate',
    requirementSetId,
    requirementFilePaths: selected.map((file) => file.path),
    promptFilePath: elements.promptTemplate.value,
    model: elements.modelSelect.value,
    documentTitle: elements.docTitle.value.trim(),
    githubOwner: APP_CONFIG.github.owner,
    githubRepo: APP_CONFIG.github.repo,
    githubBranch: APP_CONFIG.github.branch,
    githubOutputDir: APP_CONFIG.github.folders.prd,
    githubMapDir: 'maps',
    githubLogDir: APP_CONFIG.github.folders.logs,
    requestedBy: 'web'
  };

  try {
    elements.generatePrd.disabled = true;
    elements.generatePrd.textContent = 'PRD 생성 요청 중...';
    const result = await postWebhook(APP_CONFIG.webhooks.prdGenerate, payload);
    showToast(result.message || 'PRD 생성이 완료되었습니다.');
    await Promise.allSettled([refreshPrdFiles(), refreshLogs()]);
    if (result.prdFilePath) await openPrdFile(result.prdFilePath);
  } catch (error) {
    showToast(error.message);
  } finally {
    elements.generatePrd.textContent = '▶ 선택 요구사항으로 PRD 생성 요청';
    updateSelectedView();
  }
}

async function requestFileRequirementSave() {
  if (!APP_CONFIG.webhooks.requirementSave) {
    showToast('요구사항 저장 Webhook URL이 비어 있습니다. app.js 또는 URL query의 reqWebhook 값을 설정하세요.');
    return;
  }

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.txt,.md,.markdown,.doc,.docx';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    const keyword = window.prompt('Requirement Keyword를 입력하세요. 예: coupon_admin', file.name.replace(/\.[^.]+$/, ''));
    if (!keyword) return;
    const sourceText = await file.text();
    await requestRequirementSave({
      requirementKeyword: keyword,
      sourceType: 'FILE',
      sourceLabel: 'File',
      sourceDetail: file.name,
      sourceText
    });
  });
  input.click();
}

async function requestDirectRequirementSave() {
  if (!APP_CONFIG.webhooks.requirementSave) {
    showToast('요구사항 저장 Webhook URL이 비어 있습니다. app.js 또는 URL query의 reqWebhook 값을 설정하세요.');
    return;
  }

  const keyword = window.prompt('Requirement Keyword를 입력하세요. 예: coupon_admin');
  if (!keyword) return;
  const sourceText = window.prompt('요구사항 원문을 입력하세요. 긴 문서는 파일 등록을 권장합니다.');
  if (!sourceText) return;

  await requestRequirementSave({
    requirementKeyword: keyword,
    sourceType: 'DIRECT',
    sourceLabel: '직접등록',
    sourceDetail: '직접 입력',
    sourceText
  });
}

async function requestRequirementSave({ requirementKeyword, sourceType, sourceLabel, sourceDetail, sourceText }) {
  const payload = {
    action: 'requirement_save',
    requirementKeyword,
    sourceType,
    sourceLabel,
    sourceDetail,
    sourceText,
    githubOwner: APP_CONFIG.github.owner,
    githubRepo: APP_CONFIG.github.repo,
    githubBranch: APP_CONFIG.github.branch,
    githubSourceDir: 'source',
    githubReqDir: APP_CONFIG.github.folders.req,
    requestedBy: 'web'
  };

  try {
    showToast('요구사항을 Git Repository에 저장하는 중입니다.');
    const result = await postWebhook(APP_CONFIG.webhooks.requirementSave, payload);
    showToast(result.message || '요구사항 저장 완료');
    await refreshRequirements();
    if (result.requirementFilePath) {
      state.selectedReqPaths.add(result.requirementFilePath);
      updateSelectedView();
      renderRequirementList();
    }
  } catch (error) {
    showToast(error.message);
  }
}

async function postWebhook(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: getWebhookHeaders(),
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }

  if (!response.ok || data.success === false) {
    throw new Error(data.message || data.error || `Webhook 호출 실패 HTTP ${response.status}`);
  }
  return data;
}

function getWebhookHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (APP_CONFIG.webhooks.secret) headers['x-agent1-secret'] = APP_CONFIG.webhooks.secret;
  return headers;
}

function buildRequirementSetId(files) {
  const first = files[0]?.name || 'requirement_set';
  const key = first
    .replace(/^REQ_/i, '')
    .replace(/\.(md|txt|markdown)$/i, '')
    .replace(/_\d{6,8}_\d{6}$/i, '')
    .replace(/[^A-Za-z0-9가-힣_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `REQ_SET_${key}_${yy}${mm}${dd}_${hh}${mi}${ss}`;
}

function submitFeedback() {
  const feedback = elements.feedbackInput.value.trim();
  if (!feedback) return showToast('피드백 내용을 입력하세요.');
  showToast('피드백이 입력되었습니다. 수정 PRD 생성 Webhook 연결 후 전송됩니다.');
}

async function requestPrdRevise() {
  if (!APP_CONFIG.webhooks.prdRevise) {
    showToast('수정 PRD Webhook URL이 비어 있습니다.');
    return;
  }
  showToast('수정 PRD 요청을 보냈습니다.');
}

function applyPreset(preset) {
  $$('.header_preset_button').forEach((button) => button.classList.toggle('is_active', button.dataset.preset === preset));
  const presets = {
    balanced: ['32%', '36%', '32%'],
    focus: ['25%', '50%', '25%'],
    prd: ['22%', '56%', '22%'],
    spec: ['22%', '34%', '44%']
  };
  const [s1, s2, s3] = presets[preset] || presets.balanced;
  setWidths(s1, s2, s3);
}

function setWidths(s1, s2, s3) {
  document.documentElement.style.setProperty('--section1_width', s1);
  document.documentElement.style.setProperty('--section2_width', s2);
  document.documentElement.style.setProperty('--section3_width', s3);
  localStorage.setItem('agent1_section1_width', s1);
  localStorage.setItem('agent1_section2_width', s2);
  localStorage.setItem('agent1_section3_width', s3);
}

function closeColumn(col) {
  state.closedCols.add(col);
  updateColumnVisibility();
}

function openColumn(col) {
  state.closedCols.delete(col);
  updateColumnVisibility();
}

function toggleColumn(col) {
  if (state.closedCols.has(col)) openColumn(col);
  else closeColumn(col);
}

function updateColumnVisibility() {
  ['1', '2', '3'].forEach((col) => {
    const section = $(`section${col}`);
    const closed = state.closedCols.has(col);
    section.classList.toggle('is_closed', closed);
    document.querySelector(`[data-toggle-col="${col}"]`)?.classList.toggle('is_active', !closed);
  });

  $$('.common_resizer').forEach((resizer) => {
    const index = resizer.dataset.resizer;
    const shouldHide = state.closedCols.has(index) && state.closedCols.has(String(Number(index) + 1));
    resizer.classList.toggle('is_hidden', shouldHide);
  });
}

function startResize(event) {
  event.preventDefault();
  const resizerIndex = event.currentTarget.dataset.resizer;
  const left = resizerIndex === '1' ? elements.section1 : elements.section2;
  const right = resizerIndex === '1' ? elements.section2 : elements.section3;
  if (left.classList.contains('is_closed') || right.classList.contains('is_closed')) return;

  const startX = event.clientX;
  const leftStart = left.getBoundingClientRect().width;
  const rightStart = right.getBoundingClientRect().width;
  document.body.classList.add('is_resizing');

  const onMove = (moveEvent) => {
    const delta = moveEvent.clientX - startX;
    const leftTarget = clamp(leftStart + delta, getMin(left), getMax(left));
    const rightTarget = clamp(rightStart - delta, getMin(right), getMax(right));
    left.style.flexBasis = `${leftTarget}px`;
    right.style.flexBasis = `${rightTarget}px`;
  };
  const onUp = () => {
    document.body.classList.remove('is_resizing');
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    localStorage.setItem('agent1_section1_width', elements.section1.style.flexBasis || getComputedStyle(elements.section1).flexBasis);
    localStorage.setItem('agent1_section2_width', elements.section2.style.flexBasis || getComputedStyle(elements.section2).flexBasis);
    localStorage.setItem('agent1_section3_width', elements.section3.style.flexBasis || getComputedStyle(elements.section3).flexBasis);
  };
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

function getMin(section) {
  if (section.id === 'section1') return APP_CONFIG.ui.min.section1;
  if (section.id === 'section2') return APP_CONFIG.ui.min.section2;
  return APP_CONFIG.ui.min.section3;
}

function getMax(section) {
  if (section.id === 'section1') return APP_CONFIG.ui.max.section1;
  if (section.id === 'section2') return APP_CONFIG.ui.max.section2;
  return APP_CONFIG.ui.max.section3;
}

function inferSourceType(name) {
  const upper = String(name || '').toUpperCase();
  if (upper.includes('JIRA')) return 'JIRA';
  if (upper.includes('SLACK')) return 'SLACK';
  if (upper.includes('FILE')) return 'FILE';
  if (upper.includes('DIRECT')) return 'DIRECT';
  return 'REQ';
}

function parseSourceTypeFromText(text) {
  const patterns = [
    /source_type\s*:\s*["']?(JIRA|SLACK|FILE|DIRECT)["']?/i,
    /sourceType["']?\s*:\s*["'](JIRA|SLACK|FILE|DIRECT)["']/i,
    /출처\s*정보\s*[:：]\s*(JIRA|SLACK|파일업로드|직접등록)/i
  ];
  for (const pattern of patterns) {
    const match = String(text || '').match(pattern);
    if (!match) continue;
    const value = match[1].toUpperCase();
    if (value === '파일업로드') return 'FILE';
    if (value === '직접등록') return 'DIRECT';
    return value;
  }
  return '';
}

function markdownToHtml(markdown) {
  const escaped = escapeHtml(markdown || '');
  return escaped
    .replace(/^### (.*)$/gm, '<h3>$1</h3>')
    .replace(/^## (.*)$/gm, '<h2>$1</h2>')
    .replace(/^# (.*)$/gm, '<h1>$1</h1>')
    .replace(/^- (.*)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(.+)$/gm, '<p>$1</p>')
    .replace(/<p><h/g, '<h')
    .replace(/<\/h([123])><\/p>/g, '</h$1>')
    .replace(/<p><li>/g, '<ul><li>')
    .replace(/<\/li><\/p>/g, '</li></ul>')
    .replace(/<\/ul>\s*<ul>/g, '');
}

function renderError(message) {
  return `<div class="common_empty">${escapeHtml(message)}</div>`;
}

function formatSize(bytes) {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('is_show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => elements.toast.classList.remove('is_show'), 2600);
}

function copyToClipboard(value) {
  if (!value) return showToast('복사할 내용이 없습니다.');
  navigator.clipboard.writeText(value).then(() => showToast('복사 완료'));
}

function downloadText(filename, text) {
  if (!text) return showToast('다운로드할 내용이 없습니다.');
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

init();
