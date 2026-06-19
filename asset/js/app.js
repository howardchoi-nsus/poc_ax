/*
  AGENT1 PRD Workspace - Vercel Blob Version
  - 더미데이터 없음
  - Vercel Blob의 실제 파일 목록/파일 내용을 Web에서 조회
  - 생성 문서 저장은 n8n → Vercel API → Blob으로 처리
  - GitHub 인증/Rate Limit 이슈를 줄이기 위한 Blob 전환 버전

*/
const APP_CONFIG = {
  github: {
    owner: 'Vercel',
    repo: 'Blob',
    branch: 'private',
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
  storage: {
    type: 'vercel_blob',
    baseUrl: location.origin
  },
  webhooks: {
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

APP_CONFIG.github.owner =
  query.get('owner') || APP_CONFIG.github.owner;

APP_CONFIG.github.repo =
  query.get('repo') || APP_CONFIG.github.repo;

APP_CONFIG.github.branch =
  query.get('branch') || APP_CONFIG.github.branch;

APP_CONFIG.github.folders.req =
  query.get('reqFolder') ||
  localStorage.getItem('agent1_req_folder') ||
  APP_CONFIG.github.folders.req;

APP_CONFIG.github.folders.prompts =
  query.get('promptFolder') ||
  localStorage.getItem('agent1_prompt_folder') ||
  APP_CONFIG.github.folders.prompts;

APP_CONFIG.github.folders.prd =
  query.get('prdFolder') ||
  localStorage.getItem('agent1_prd_folder') ||
  APP_CONFIG.github.folders.prd;

APP_CONFIG.github.folders.logs =
  query.get('logFolder') ||
  localStorage.getItem('agent1_log_folder') ||
  APP_CONFIG.github.folders.logs;

APP_CONFIG.webhooks.requirementSave =
  query.get('reqWebhook') ||
  localStorage.getItem('agent1_req_webhook') ||
  APP_CONFIG.webhooks.requirementSave;

APP_CONFIG.webhooks.prdGenerate =
  query.get('prdWebhook') ||
  localStorage.getItem('agent1_prd_webhook') ||
  APP_CONFIG.webhooks.prdGenerate;

APP_CONFIG.webhooks.gitList =
  query.get('gitListWebhook') ||
  localStorage.getItem('agent1_git_list_webhook') ||
  APP_CONFIG.webhooks.gitList;

APP_CONFIG.webhooks.gitFile =
  query.get('gitFileWebhook') ||
  localStorage.getItem('agent1_git_file_webhook') ||
  APP_CONFIG.webhooks.gitFile;

APP_CONFIG.webhooks.prdRevise =
  query.get('reviseWebhook') ||
  localStorage.getItem('agent1_revise_webhook') ||
  APP_CONFIG.webhooks.prdRevise;

APP_CONFIG.webhooks.phaseGenerate =
  query.get('phaseWebhook') ||
  localStorage.getItem('agent1_phase_webhook') ||
  APP_CONFIG.webhooks.phaseGenerate;

APP_CONFIG.webhooks.secret =
  query.get('webhookSecret') ||
  localStorage.getItem('agent1_webhook_secret') ||
  APP_CONFIG.webhooks.secret;

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
    section1:
      localStorage.getItem('agent1_section1_width') ||
      getComputedStyle(document.documentElement).getPropertyValue('--section1_width').trim(),
    section2:
      localStorage.getItem('agent1_section2_width') ||
      getComputedStyle(document.documentElement).getPropertyValue('--section2_width').trim(),
    section3:
      localStorage.getItem('agent1_section3_width') ||
      getComputedStyle(document.documentElement).getPropertyValue('--section3_width').trim()
  }
};

const $ = (id) => document.getElementById(id);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const elements = {
  repoBadge: $('header_repo_badge'),
  refreshAll: $('header_btn_refresh'),
  githubTokenInput: $('header_github_token_input'),
  githubTokenSave: $('header_btn_save_github_token'),
  githubTokenClear: $('header_btn_clear_github_token'),
  githubAuthStatus: $('header_github_auth_status'),

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
  initBlobLabel();
  initGithubTokenControls();
  applyInitialWidths();
  bindEvents();
  refreshBlobData();
}

function initBlobLabel() {
  const { owner, repo, branch } = APP_CONFIG.github;
  elements.repoBadge.textContent = `${APP_CONFIG.storage.type} · ${APP_CONFIG.storage.baseUrl}`;
}

function initGithubTokenControls() {
  const token = getGithubToken();

  if (elements.githubTokenInput) {
    elements.githubTokenInput.value = token ? '********' : '';
  }

  updateGithubAuthStatus();
}

function getGithubToken() {
  return sessionStorage.getItem('agent1_github_token') || '';
}

function setGithubToken(token) {
  const value = String(token || '').trim();

  if (!value) {
    sessionStorage.removeItem('agent1_github_token');
  } else {
    sessionStorage.setItem('agent1_github_token', value);
  }

  initGithubTokenControls();
}

function updateGithubAuthStatus() {
  if (!elements.githubAuthStatus) return;
  elements.githubAuthStatus.textContent = 'Blob Storage ON';
  elements.githubAuthStatus.classList.add('is_authenticated');
}

function applyInitialWidths() {
  document.documentElement.style.setProperty('--section1_width', state.widths.section1);
  document.documentElement.style.setProperty('--section2_width', state.widths.section2);
  document.documentElement.style.setProperty('--section3_width', state.widths.section3);
}

function bindEvents() {
  elements.refreshAll.addEventListener('click', refreshBlobData);

  elements.githubTokenSave?.addEventListener('click', () => {
    const value = window.prompt(
      '현재 버전은 Vercel Blob을 사용합니다. GitHub Token 입력은 사용하지 않습니다.'
    );

    if (!value) return;

    setGithubToken(value);
    showToast('Blob 데이터를 다시 조회합니다.');
    refreshBlobData();
  });

  elements.githubTokenClear?.addEventListener('click', () => {
    setGithubToken('');
    showToast('Blob 조회 세션 정보를 초기화했습니다.');
    refreshBlobData();
  });

  elements.search.addEventListener('input', renderRequirementList);
  elements.selectAll.addEventListener('change', onSelectAll);
  elements.clearSelection.addEventListener('click', clearSelection);
  elements.confirmSelection.addEventListener('click', () =>
    showToast('선택이 완료되었습니다. 2컬럼에서 PRD 생성을 요청하세요.')
  );

  elements.generatePrd.addEventListener('click', requestPrdGenerate);
  elements.refreshPrd.addEventListener('click', refreshPrdFiles);
  elements.copyPrd.addEventListener('click', () => copyToClipboard(elements.prdRaw.value));
  elements.downloadPrd.addEventListener('click', () =>
    downloadText(state.activePrd?.name || 'PRD.md', elements.prdRaw.value)
  );

  elements.feedback.addEventListener('click', submitFeedback);
  elements.revise.addEventListener('click', requestPrdRevise);

  elements.refreshLogs.addEventListener('click', refreshLogs);
  elements.phaseSelect.addEventListener('change', refreshArtifacts);
  elements.refreshArtifacts.addEventListener('click', refreshArtifacts);
  elements.downloadArtifact.addEventListener('click', () =>
    downloadText(state.activeArtifact?.name || 'artifact.md', elements.artifactRaw.value)
  );

  elements.modalSelect.addEventListener('click', (event) => {
    event.preventDefault();

    const path = elements.modalSelect.dataset.path;

    if (path) {
      toggleRequirementSelection(path, true);
    }

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

  $$('[data-close-col]').forEach((button) =>
    button.addEventListener('click', () => closeColumn(button.dataset.closeCol))
  );

  $$('[data-reopen-col]').forEach((button) =>
    button.addEventListener('click', () => openColumn(button.dataset.reopenCol))
  );

  $$('.common_resizer').forEach((resizer) =>
    resizer.addEventListener('pointerdown', startResize)
  );

  $('section1_btn_file_source').addEventListener('click', requestFileRequirementSave);
  $('section1_btn_direct_source').addEventListener('click', requestDirectRequirementSave);
}

async function fetchGitHubFolder(folder, options = {}) {
  const { required = false, label = folder } = options;
  const cleanFolder = String(folder || '').replace(/^\/+|\/+$/g, '');
  const response = await fetch(`/api/blob-list?folder=${encodeURIComponent(cleanFolder)}&limit=1000`, {
    headers: { Accept: 'application/json' }
  });

  if (response.status === 404) {
    const message = [
      `${label} 폴더를 찾지 못했습니다.`,
      `확인값: Vercel Blob · /${cleanFolder}`,
      '가능한 원인: Blob에 해당 prefix 파일 없음, api/blob-list.js 미배포, BLOB_READ_WRITE_TOKEN 미적용'
    ].join('\n');
    if (required) throw new Error(message);
    return [];
  }

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(`${label} 목록을 불러오지 못했습니다. HTTP ${response.status} ${detail.message || ''}`.trim());
  }

  const data = await response.json();
  if (data.success === false) {
    throw new Error(data.message || `${label} 목록 조회 실패`);
  }

  const files = Array.isArray(data.files) ? data.files : [];
  if (!files.length && required) {
    return [];
  }

  return normalizeFileList(files, cleanFolder);
}

function normalizeFileList(items, folder = '') {
  return (Array.isArray(items) ? items : [])
    .map((item) => {
      const name = item.name || String(item.path || item.pathname || '').split('/').pop();
      const path = item.path || item.pathname || `${folder}/${name}`.replace(/^\/+/, '');
      const registeredAt = extractRegisteredDateFromFile(name, path, item.uploadedAt);

      return {
        name,
        path,
        size: item.size || 0,
        downloadUrl: item.downloadUrl || item.url || '',
        htmlUrl: item.htmlUrl || item.url || '',
        uploadedAt: item.uploadedAt || '',
        registeredAt,
        registeredAtLabel: formatRegisteredDate(registeredAt)
      };
    })
    .filter((item) => item.name && item.path)
    .sort(sortByRegisteredDateDesc);
}

function extractRegisteredDateFromFile(...values) {
  const joined = values.map((item) => String(item || '')).join(' ');

  const iso = values.find((item) => item && !Number.isNaN(new Date(item).getTime()));
  if (iso) return new Date(iso);

  const patterns = [
    /(20\d{2})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})/,
    /(^|[^\d])(\d{2})(\d{2})(\d{2})[_-](\d{2})(\d{2})(\d{2})([^\d]|$)/
  ];

  for (const pattern of patterns) {
    const match = joined.match(pattern);
    if (!match) continue;

    const isFullYear = pattern === patterns[0];
    const offset = isFullYear ? 0 : 1;
    const year = isFullYear ? Number(match[1]) : Number(`20${match[1 + offset]}`);
    const month = Number(match[2 + offset]);
    const day = Number(match[3 + offset]);
    const hour = Number(match[4 + offset]);
    const minute = Number(match[5 + offset]);
    const second = Number(match[6 + offset]);
    const date = new Date(year, month - 1, day, hour, minute, second);
    if (!Number.isNaN(date.getTime())) return date;
  }

  return null;
}

function sortByRegisteredDateDesc(a, b) {
  const aTime = a.registeredAt ? a.registeredAt.getTime() : 0;
  const bTime = b.registeredAt ? b.registeredAt.getTime() : 0;
  if (aTime !== bTime) return bTime - aTime;
  return String(b.name || '').localeCompare(String(a.name || ''));
}

function formatRegisteredDate(date) {
  if (!date) return '등록일 확인 필요';
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${yy}.${mm}.${dd} ${hh}:${mi}`;
}

async function fetchGitHubFolderWithFallback(primaryFolder, fallbackFolders = [], options = {}) {
  const tried = [];
  const candidates = [primaryFolder, ...fallbackFolders].filter(Boolean);

  for (const folder of candidates) {
    try {
      tried.push(folder);

      const files = await fetchGitHubFolder(folder, {
        ...options,
        required: true
      });

      if (folder !== primaryFolder) {
        APP_CONFIG.github.folders.req = folder;
        localStorage.setItem('agent1_req_folder', folder);
        showToast(`요구사항 폴더를 /${folder}로 자동 보정했습니다.`);
      }

      return files;
    } catch (error) {
      if (!String(error.message).includes('폴더를 찾지 못했습니다')) {
        throw error;
      }
    }
  }

  throw new Error([
    `${options.label || primaryFolder} 폴더를 찾지 못했습니다.`,
    `시도한 경로: ${tried.map((item) => '/' + item).join(', ')}`,
    `확인값: ${APP_CONFIG.github.owner}/${APP_CONFIG.github.repo} · ${APP_CONFIG.github.branch}`,
    'Vercel Blob은 prefix를 기준으로 조회합니다. /req 파일이 있는지 확인하세요.',
    'Blob이 private이면 api/blob-list.js와 BLOB_READ_WRITE_TOKEN 적용 여부를 확인하세요.'
  ].join('\n'));
}

async function fetchGitHubText(path) {
  const cleanPath = String(path || '').replace(/^\/+/, '');
  const response = await fetch(`/api/blob-file?path=${encodeURIComponent(cleanPath)}`, {
    headers: { Accept: 'application/json' }
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(`${cleanPath} 파일을 불러오지 못했습니다. HTTP ${response.status} ${detail.message || ''}`.trim());
  }

  const data = await response.json();
  if (data.success === false) {
    throw new Error(data.message || `${cleanPath} 파일 조회 실패`);
  }

  return data.content || data.text || '';
}

async function refreshBlobData() {
  showToast('Vercel Blob 데이터를 불러오는 중입니다.');

  await Promise.allSettled([
    refreshRequirements(),
    refreshPrompts(),
    refreshPrdFiles(),
    refreshLogs(),
    refreshArtifacts()
  ]);

  showToast('Vercel Blob 데이터 갱신 완료');
}

async function refreshRequirements() {
  try {
    state.requirements = await fetchGitHubFolderWithFallback(
      APP_CONFIG.github.folders.req,
      ['Req', 'REQ', 'requirements', 'Requirements'],
      { label: '요구사항' }
    );

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
    const matchKeyword =
      !keyword ||
      file.name.toLowerCase().includes(keyword) ||
      file.path.toLowerCase().includes(keyword);

    return matchFilter && matchKeyword;
  });

  elements.totalCount.textContent = String(files.length);

  elements.selectAll.checked =
    files.length > 0 && files.every((file) => state.selectedReqPaths.has(file.path));

  if (!files.length) {
    elements.requirementList.innerHTML = `
      <div class="common_empty">
        /${APP_CONFIG.github.folders.req} 폴더에 표시할 요구사항 파일이 없습니다.
        md 파일이 있다면 Blob prefix, api/blob-list.js 배포, BLOB_READ_WRITE_TOKEN 적용 여부를 확인하세요.
      </div>
    `;

    updateSelectedView();
    return;
  }

  elements.requirementList.innerHTML = files
    .map((file) => {
      const source = inferSourceType(file.name);
      const selected = state.selectedReqPaths.has(file.path);

      return `
        <article class="section1_req_item ${selected ? 'is_selected' : ''}" data-path="${escapeHtml(file.path)}">
          <input
            type="checkbox"
            class="section1_req_checkbox"
            ${selected ? 'checked' : ''}
            aria-label="${escapeHtml(file.name)} 선택"
          />
          <div class="section1_req_main">
            <button class="section1_req_title_button" type="button">
              ${escapeHtml(file.name)}
            </button>
            <div class="section1_req_meta">
              <span class="common_badge ${source}">${source}</span>
              <span>등록일 ${escapeHtml(file.registeredAtLabel)}</span>
              <span>${formatSize(file.size)}</span>
              <span>${escapeHtml(file.path)}</span>
            </div>
            <p class="section1_req_snippet">
              Vercel Blob의 ${escapeHtml(file.path)} 파일입니다. 제목을 클릭하면 원문을 불러옵니다.
            </p>
          </div>
          <span class="common_status_badge success">Blob</span>
        </article>
      `;
    })
    .join('');

  $$('.section1_req_item', elements.requirementList).forEach((item) => {
    const path = item.dataset.path;

    item
      .querySelector('.section1_req_checkbox')
      .addEventListener('change', (event) => toggleRequirementSelection(path, event.target.checked));

    item
      .querySelector('.section1_req_title_button')
      .addEventListener('click', () => openRequirementModal(path));
  });

  updateSelectedView();
}