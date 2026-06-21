/*
  AGENT1 PRD Workspace - Vercel Blob Version
  - 더미데이터 없음
  - Vercel Blob의 실제 파일 목록/파일 내용을 Web에서 조회
  - 생성 문서 저장은 n8n → Vercel API → Blob으로 처리
  - 저장소 접근을 Blob 기준으로 정리한 버전

*/
const APP_CONFIG = {
  storage: {
    type: 'vercel_blob',
    baseUrl: location.origin,
    folders: {
      req: 'req',
      prompts: 'prompts',
      prd: 'prd',
      logs: 'logs'
    }
  },
  webhooks: {
    requirementSave: 'https://kolchohoohu.app.n8n.cloud/webhook/agent1-requirement-save',
    prdGenerate: 'https://kolchohoohu.app.n8n.cloud/webhook/agent1-prd-generate',
    prdRevise: '',
    secret: ''
  },
  ui: {
    min: { section1: 300, section2: 440, section3: 320 },
    max: { section1: 660, section2: 960, section3: 720 },
    closedRail: 48
  }
};

const query = new URLSearchParams(location.search);

APP_CONFIG.storage.folders.req =
  query.get('reqFolder') ||
  localStorage.getItem('agent1_req_folder') ||
  APP_CONFIG.storage.folders.req;

APP_CONFIG.storage.folders.prompts =
  query.get('promptFolder') ||
  localStorage.getItem('agent1_prompt_folder') ||
  APP_CONFIG.storage.folders.prompts;

APP_CONFIG.storage.folders.prd =
  query.get('prdFolder') ||
  localStorage.getItem('agent1_prd_folder') ||
  APP_CONFIG.storage.folders.prd;

APP_CONFIG.storage.folders.logs =
  query.get('logFolder') ||
  localStorage.getItem('agent1_log_folder') ||
  APP_CONFIG.storage.folders.logs;

APP_CONFIG.webhooks.requirementSave =
  query.get('reqWebhook') ||
  localStorage.getItem('agent1_req_webhook') ||
  APP_CONFIG.webhooks.requirementSave;

APP_CONFIG.webhooks.prdGenerate =
  query.get('prdWebhook') ||
  localStorage.getItem('agent1_prd_webhook') ||
  APP_CONFIG.webhooks.prdGenerate;

APP_CONFIG.webhooks.prdRevise =
  query.get('reviseWebhook') ||
  localStorage.getItem('agent1_revise_webhook') ||
  APP_CONFIG.webhooks.prdRevise;

APP_CONFIG.webhooks.secret =
  query.get('webhookSecret') ||
  localStorage.getItem('agent1_webhook_secret') ||
  APP_CONFIG.webhooks.secret;

const state = {
  requirements: [],
  prompts: [],
  prds: [],
  logs: [],
  requirementMetaLoadId: 0,
  selectedReqPaths: new Set(),
  activeFilter: 'all',
  activePrd: null,
  rawMode: false,
  generation: {
    active: false,
    startedAt: null,
    knownPaths: new Set(),
    timer: null,
    elapsedTimer: null,
    lastCheckedAt: null,
    attempts: 0,
    maxAttempts: 60
  },
  closedCols: new Set(),
  widths: {
    section1: getComputedStyle(document.documentElement).getPropertyValue('--section1_width').trim(),
    section2: getComputedStyle(document.documentElement).getPropertyValue('--section2_width').trim(),
    section3: getComputedStyle(document.documentElement).getPropertyValue('--section3_width').trim()
  }
};

const $ = (id) => document.getElementById(id);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const elements = {
  repoBadge: $('header_repo_badge'),
  refreshAll: $('header_btn_refresh'),
  serviceMenu: $('header_btn_services'),
  blobStatus: $('header_blob_status'),

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
  targetStatus: $('section2_target_status'),
  selectedSummary: $('section2_selected_summary'),
  promptTemplate: $('section2_prompt_template'),
  modelSelect: $('section2_model_select'),
  docTitle: $('section2_doc_title'),
  generatePrd: $('section2_btn_generate'),
  generationStatus: $('section2_generation_status'),
  generationTitle: $('section2_generation_title'),
  generationElapsed: $('section2_generation_elapsed'),
  generationMessage: $('section2_generation_message'),
  generationBar: $('section2_generation_bar'),
  generationMeta: $('section2_generation_meta'),
  prdFileList: $('section2_prd_file_list'),
  refreshPrd: $('section2_btn_refresh_prd'),
  prdPreview: $('section2_prd_preview'),
  prdRaw: $('section2_prd_raw'),
  copyPrd: $('section2_btn_copy_prd'),
  downloadPrd: $('section2_btn_download_prd'),
  feedbackToggle: $('section2_btn_feedback_toggle'),
  feedbackPanel: $('section2_feedback_panel'),
  feedbackClose: $('section2_btn_feedback_close'),
  feedbackInput: $('section2_feedback_input'),
  feedback: $('section2_btn_feedback'),
  revise: $('section2_btn_revise'),
  logList: $('section2_log_list'),
  refreshLogs: $('section2_btn_refresh_logs'),
  logsModal: $('modal_logs'),
  logsModalClose: $('modal_logs_btn_close'),
  logsModalRefresh: $('modal_logs_btn_refresh'),

  modal: $('modal_detail'),
  modalBadge: $('modal_badge'),
  modalTitle: $('modal_title'),
  modalMeta: $('modal_meta'),
  modalBody: $('modal_body'),
  modalSelect: $('modal_btn_select'),

  directModal: $('modal_direct_register'),
  directModalClose: $('modal_direct_btn_close'),
  directSourceType: $('direct_source_type'),
  directSourceDetail: $('direct_source_detail'),
  directRequirementText: $('direct_requirement_text'),
  directReset: $('direct_btn_reset'),
  directSubmit: $('direct_btn_submit'),

  toast: $('toast_message')
};

function init() {
  initBlobLabel();
  initBlobControls();
  applyInitialWidths();
  bindEvents();
  refreshBlobData();
}

function initBlobLabel() {
  elements.repoBadge.textContent = `${APP_CONFIG.storage.type} · ${APP_CONFIG.storage.baseUrl}`;
}

function initBlobControls() {
  updateBlobStatus();
}

function updateBlobStatus() {
  if (!elements.blobStatus) return;
  elements.blobStatus.textContent = 'Blob Storage ON';
  elements.blobStatus.classList.add('is_connected');
}

function applyInitialWidths() {
  document.documentElement.style.setProperty('--section1_width', state.widths.section1);
  document.documentElement.style.setProperty('--section2_width', state.widths.section2);
  document.documentElement.style.setProperty('--section3_width', state.widths.section3);
}

function bindEvents() {
  elements.refreshAll.addEventListener('click', refreshBlobData);
  elements.serviceMenu?.addEventListener('click', () => {
    window.location.href = './index.html';
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
  elements.feedbackToggle.addEventListener('click', toggleFeedbackPanel);
  elements.feedbackClose.addEventListener('click', closeFeedbackPanel);

  elements.refreshLogs.addEventListener('click', openLogsModal);
  elements.logsModalClose?.addEventListener('click', () => elements.logsModal.close());
  elements.logsModalRefresh?.addEventListener('click', refreshLogs);

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
  $('section1_btn_direct_source').addEventListener('click', openDirectRequirementModal);

  elements.directModalClose?.addEventListener('click', () => elements.directModal.close());
  elements.directSourceType?.addEventListener('change', updateDirectSourceDetailState);
  elements.directReset?.addEventListener('click', resetDirectRequirementForm);
  elements.directSubmit?.addEventListener('click', submitDirectRequirementSave);
}

async function fetchBlobFolder(folder, options = {}) {
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
        registeredAtLabel: formatRegisteredDate(registeredAt),
        ...getCachedRequirementMeta(path, item.uploadedAt, item.size || 0)
      };
    })
    .filter((item) => item.name && item.path)
    .sort(sortByRegisteredDateDesc);
}

function getRequirementMetaCacheKey(path) {
  return `agent1_req_meta:${path}`;
}

function getRequirementMetaSignature(uploadedAt, size) {
  return `${uploadedAt || ''}:${size || 0}`;
}

function normalizeSourceType(value) {
  const source = String(value || '').trim().toUpperCase();
  if (source === 'JIRA') return 'JIRA';
  if (source === 'SLACK') return 'SLACK';
  if (source === 'DIRECT') return 'DIRECT';
  if (source === 'FILE') return 'FILE';
  return 'FILE';
}

function getCachedRequirementMeta(path, uploadedAt, size) {
  try {
    const cached = sessionStorage.getItem(getRequirementMetaCacheKey(path));
    if (!cached) return getDefaultRequirementMeta();

    const meta = JSON.parse(cached);
    if (meta.signature !== getRequirementMetaSignature(uploadedAt, size)) {
      return getDefaultRequirementMeta();
    }

    return {
      sourceType: normalizeSourceType(meta.sourceType),
      sourceLabel: meta.sourceLabel || '',
      sourceDetail: meta.sourceDetail || '',
      metaLoaded: true
    };
  } catch {
    return getDefaultRequirementMeta();
  }
}

function setCachedRequirementMeta(file, meta) {
  try {
    sessionStorage.setItem(
      getRequirementMetaCacheKey(file.path),
      JSON.stringify({
        signature: getRequirementMetaSignature(file.uploadedAt, file.size),
        sourceType: meta.sourceType,
        sourceLabel: meta.sourceLabel || '',
        sourceDetail: meta.sourceDetail || ''
      })
    );
  } catch {
    // Cache failure should not block requirement rendering.
  }
}

function getDefaultRequirementMeta() {
  return {
    sourceType: 'FILE',
    sourceLabel: '',
    sourceDetail: '',
    metaLoaded: false
  };
}

function parseFrontMatter(text) {
  const value = String(text || '');
  const match = value.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return {};

  return match[1]
    .split('\n')
    .reduce((acc, line) => {
      const item = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
      if (!item) return acc;
      acc[item[1]] = item[2].trim();
      return acc;
    }, {});
}

function parseRequirementMeta(text) {
  const meta = parseFrontMatter(text);
  return {
    sourceType: normalizeSourceType(meta.source_type),
    sourceLabel: meta.source_label || '',
    sourceDetail: meta.source_detail || '',
    metaLoaded: true
  };
}

function getRequirementSource(file) {
  return normalizeSourceType(file?.sourceType);
}

function getRequirementSourceLabel(file) {
  const source = getRequirementSource(file);
  const detail = [file?.sourceLabel, file?.sourceDetail].filter(Boolean).join(' · ');
  return detail || source;
}

async function enrichRequirementMetadata(files, loadId) {
  const targets = files.filter((file) =>
    file.path &&
    file.name.toLowerCase().endsWith('.md') &&
    !file.metaLoaded
  );

  const chunkSize = 5;

  for (let index = 0; index < targets.length; index += chunkSize) {
    if (loadId !== state.requirementMetaLoadId) return;

    const chunk = targets.slice(index, index + chunkSize);

    await Promise.all(
      chunk.map(async (file) => {
        try {
          const text = await fetchBlobText(file.path);
          const meta = parseRequirementMeta(text);
          Object.assign(file, meta);
          setCachedRequirementMeta(file, meta);
        } catch {
          Object.assign(file, {
            sourceType: 'FILE',
            sourceLabel: '',
            sourceDetail: '',
            metaLoaded: true
          });
        }
      })
    );

    if (loadId !== state.requirementMetaLoadId) return;
    renderRequirementList();
  }
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

async function fetchBlobFolderWithFallback(primaryFolder, fallbackFolders = [], options = {}) {
  const tried = [];
  const candidates = [primaryFolder, ...fallbackFolders].filter(Boolean);

  for (const folder of candidates) {
    try {
      tried.push(folder);

      const files = await fetchBlobFolder(folder, {
        ...options,
        required: true
      });

      if (folder !== primaryFolder) {
        APP_CONFIG.storage.folders.req = folder;
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
    `확인값: Vercel Blob · ${APP_CONFIG.storage.baseUrl}`,
    'Vercel Blob은 prefix를 기준으로 조회합니다. /req 파일이 있는지 확인하세요.',
    'Blob이 private이면 api/blob-list.js와 BLOB_READ_WRITE_TOKEN 적용 여부를 확인하세요.'
  ].join('\n'));
}

async function fetchBlobText(path) {
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
    refreshLogs()
  ]);

  showToast('Vercel Blob 데이터 갱신 완료');
}

async function refreshRequirements() {
  try {
    const loadId = state.requirementMetaLoadId + 1;
    state.requirementMetaLoadId = loadId;
    state.requirements = await fetchBlobFolderWithFallback(
      APP_CONFIG.storage.folders.req,
      ['Req', 'REQ', 'requirements', 'Requirements'],
      { label: '요구사항' }
    );

    renderRequirementList();
    enrichRequirementMetadata(state.requirements, loadId);
  } catch (error) {
    elements.requirementList.innerHTML = renderError(error.message);
  }
}

async function refreshPrompts() {
  try {
    state.prompts = await fetchBlobFolder(APP_CONFIG.storage.folders.prompts);
    renderPromptOptions();
  } catch (error) {
    elements.promptTemplate.innerHTML = `<option value="">프롬프트 로딩 실패</option>`;
  }
}

async function refreshPrdFiles() {
  try {
    state.prds = await fetchBlobFolder(APP_CONFIG.storage.folders.prd);
    renderPrdFiles();
  } catch (error) {
    elements.prdFileList.innerHTML = renderError(error.message);
  }
}

async function refreshLogs() {
  try {
    state.logs = await fetchBlobFolder(APP_CONFIG.storage.folders.logs);
    renderLogs();
  } catch (error) {
    elements.logList.innerHTML = renderError(error.message);
  }
}

async function openLogsModal() {
  elements.logList.innerHTML = '<div class="common_empty">Vercel Blob에서 로그를 불러오는 중입니다.</div>';
  elements.logsModal.showModal();
  await refreshLogs();
}

function renderRequirementList() {
  const keyword = elements.search.value.trim().toLowerCase();

  const files = state.requirements.filter((file) => {
    const source = getRequirementSource(file);
    const matchFilter = state.activeFilter === 'all' || source === state.activeFilter;
    const matchKeyword =
      !keyword ||
      file.name.toLowerCase().includes(keyword) ||
      file.path.toLowerCase().includes(keyword) ||
      getRequirementSource(file).toLowerCase().includes(keyword) ||
      getRequirementSourceLabel(file).toLowerCase().includes(keyword);

    return matchFilter && matchKeyword;
  });

  elements.totalCount.textContent = String(files.length);

  elements.selectAll.checked =
    files.length > 0 && files.every((file) => state.selectedReqPaths.has(file.path));

  if (!files.length) {
    elements.requirementList.innerHTML = `
      <div class="common_empty">
        /${APP_CONFIG.storage.folders.req} 폴더에 표시할 요구사항 파일이 없습니다.
        md 파일이 있다면 Blob prefix, api/blob-list.js 배포, BLOB_READ_WRITE_TOKEN 적용 여부를 확인하세요.
      </div>
    `;

    updateSelectedView();
    return;
  }

  elements.requirementList.innerHTML = files
    .map((file) => {
      const source = getRequirementSource(file);
      const sourceLabel = getRequirementSourceLabel(file);
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
              <span>${escapeHtml(sourceLabel)}</span>
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
/* ============================================================
   누락된 UI 함수 추가 (CSS/HTML 클래스명 기준)
   ============================================================ */

/* 토스트 */
let _toastTimer = null;
function showToast(msg) {
  const el = elements.toast;
  if (!el) return;
  el.textContent = msg;
  el.classList.add('is_show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('is_show'), 3000);
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function setGenerationStatus(status, options = {}) {
  if (!elements.generationStatus) return;

  const {
    title,
    message,
    meta,
    progress
  } = options;

  elements.generationStatus.dataset.status = status;
  if (title) elements.generationTitle.textContent = title;
  if (message) elements.generationMessage.textContent = message;
  if (meta) elements.generationMeta.textContent = meta;
  if (typeof progress === 'number') {
    elements.generationBar.style.width = `${Math.max(0, Math.min(100, progress))}%`;
  }
}

function updateGenerationElapsed() {
  if (!state.generation.startedAt) {
    elements.generationElapsed.textContent = '00:00';
    return;
  }

  const elapsed = Date.now() - state.generation.startedAt;
  const progress = Math.min(92, (elapsed / (state.generation.maxAttempts * 5000)) * 100);

  elements.generationElapsed.textContent = formatDuration(elapsed);
  elements.generationBar.style.width = `${progress}%`;
}

function startPrdGenerationWatch(knownPaths) {
  stopPrdGenerationWatch(false);

  state.generation.active = true;
  state.generation.startedAt = Date.now();
  state.generation.knownPaths = new Set(knownPaths);
  state.generation.lastCheckedAt = null;
  state.generation.attempts = 0;

  elements.generatePrd.disabled = true;
  elements.generatePrd.textContent = 'PRD 생성 중...';
  setGenerationStatus('running', {
    title: 'PRD 생성 중',
    message: 'n8n에서 문서를 작성하고 있습니다. 완료되면 목록이 자동 갱신됩니다.',
    meta: '자동 확인 준비 중',
    progress: 8
  });
  updateGenerationElapsed();

  state.generation.elapsedTimer = window.setInterval(updateGenerationElapsed, 1000);
  state.generation.timer = window.setInterval(pollGeneratedPrdFiles, 5000);
  window.setTimeout(pollGeneratedPrdFiles, 1200);
}

function stopPrdGenerationWatch(resetButton = true) {
  if (state.generation.timer) {
    clearInterval(state.generation.timer);
    state.generation.timer = null;
  }

  if (state.generation.elapsedTimer) {
    clearInterval(state.generation.elapsedTimer);
    state.generation.elapsedTimer = null;
  }

  state.generation.active = false;
  if (resetButton) {
    elements.generatePrd.textContent = '▶ 선택 요구사항으로 PRD 생성 요청';
    updateSelectedView();
  }
}

async function pollGeneratedPrdFiles() {
  if (!state.generation.active) return;

  state.generation.attempts += 1;
  state.generation.lastCheckedAt = new Date();
  setGenerationStatus('running', {
    meta: `자동 확인 중 · ${state.generation.lastCheckedAt.toLocaleTimeString()}`
  });

  try {
    const files = await fetchBlobFolder(APP_CONFIG.storage.folders.prd);
    const newFiles = files.filter((file) => !state.generation.knownPaths.has(file.path));

    if (newFiles.length) {
      state.prds = files;
      renderPrdFiles();
      completePrdGeneration(newFiles[0]);
      return;
    }

    if (state.generation.attempts >= state.generation.maxAttempts) {
      stopPrdGenerationWatch();
      setGenerationStatus('unknown', {
        title: '생성 상태 확인 필요',
        message: '요청은 전송되었지만 제한 시간 안에 새 PRD 문서를 찾지 못했습니다. 생성 로그 또는 n8n 실행 상태를 확인하세요.',
        meta: '자동 확인 종료',
        progress: 100
      });
    }
  } catch (error) {
    setGenerationStatus('running', {
      meta: `자동 확인 재시도 예정 · ${error.message}`
    });
  }
}

function completePrdGeneration(file) {
  stopPrdGenerationWatch();
  setGenerationStatus('complete', {
    title: 'PRD 생성 완료',
    message: `${file.name} 문서가 생성되었습니다. 3번 섹션에서 내용을 확인할 수 있습니다.`,
    meta: `완료 시각 ${new Date().toLocaleTimeString()}`,
    progress: 100
  });
  showToast('새 PRD 문서가 생성되었습니다.');
  openPrd(file.path);
}

async function completePrdGenerationFromResponse(data) {
  if (!data?.prdFilePath) return false;

  const files = await fetchBlobFolder(APP_CONFIG.storage.folders.prd);
  state.prds = files;
  renderPrdFiles();

  const file = files.find((item) => item.path === data.prdFilePath) || {
    name: data.prdFilePath.split('/').pop(),
    path: data.prdFilePath
  };

  completePrdGeneration(file);
  return true;
}

/* 컬럼 닫기 */
function closeColumn(col) {
  const section = $(`section${col}`);
  if (!section) return;
  section.classList.add('is_closed');
  state.closedCols.add(String(col));
  updateResizers();
  updateColumnSwitches();
}

/* 컬럼 열기 */
function openColumn(col) {
  const section = $(`section${col}`);
  if (!section) return;
  section.classList.remove('is_closed');
  state.closedCols.delete(String(col));
  updateResizers();
  updateColumnSwitches();
}

/* 컬럼 토글 */
function toggleColumn(col) {
  if (state.closedCols.has(String(col))) {
    openColumn(col);
  } else {
    closeColumn(col);
  }
}

/* 리사이저 표시/숨김 */
function updateResizers() {
  const resizers = $$('.common_resizer');
  resizers.forEach((r, i) => {
    const leftCol = String(i + 1);
    const rightCol = String(i + 2);
    const hidden = state.closedCols.has(leftCol) || state.closedCols.has(rightCol);
    r.style.display = hidden ? 'none' : '';
  });
}

/* 컬럼 스위치 버튼 상태 동기화 */
function updateColumnSwitches() {
  $$('.header_column_switch').forEach((btn) => {
    const col = btn.dataset.toggleCol;
    if (state.closedCols.has(col)) {
      btn.classList.remove('is_active');
    } else {
      btn.classList.add('is_active');
    }
  });
}

/* 드래그 리사이즈 */
let _resizeState = null;

function startResize(event) {
  event.preventDefault();
  const resizer = event.currentTarget;
  const resizerIndex = Number(resizer.dataset.resizer); // 1 or 2

  const leftSection  = $(`section${resizerIndex}`);
  const rightSection = $(`section${resizerIndex + 1}`);
  const content      = elements.content;

  if (!leftSection || !rightSection || !content) return;

  const totalWidth   = content.getBoundingClientRect().width;
  const startX       = event.clientX;
  const startLeftW   = leftSection.getBoundingClientRect().width;
  const startRightW  = rightSection.getBoundingClientRect().width;

  _resizeState = { resizerIndex, startX, startLeftW, startRightW, totalWidth };
  document.body.classList.add('is_resizing');

  document.addEventListener('pointermove', onResizeMove);
  document.addEventListener('pointerup', stopResize, { once: true });
}

function onResizeMove(event) {
  if (!_resizeState) return;
  const { resizerIndex, startX, startLeftW, startRightW, totalWidth } = _resizeState;

  const delta    = event.clientX - startX;
  const minLeft  = APP_CONFIG.ui.min[`section${resizerIndex}`]  || 260;
  const minRight = APP_CONFIG.ui.min[`section${resizerIndex + 1}`] || 260;

  const newLeft  = Math.max(minLeft,  Math.min(startLeftW  + delta, startLeftW + startRightW - minRight));
  const newRight = startLeftW + startRightW - newLeft;

  const leftPct  = ((newLeft  / totalWidth) * 100).toFixed(2) + '%';
  const rightPct = ((newRight / totalWidth) * 100).toFixed(2) + '%';

  const propLeft  = `--section${resizerIndex}_width`;
  const propRight = `--section${resizerIndex + 1}_width`;

  document.documentElement.style.setProperty(propLeft,  leftPct);
  document.documentElement.style.setProperty(propRight, rightPct);

  state.widths[`section${resizerIndex}`]     = leftPct;
  state.widths[`section${resizerIndex + 1}`] = rightPct;
}

function stopResize() {
  document.body.classList.remove('is_resizing');
  document.removeEventListener('pointermove', onResizeMove);

  if (_resizeState) {
    const { resizerIndex } = _resizeState;
    localStorage.setItem(`agent1_section${resizerIndex}_width`,     state.widths[`section${resizerIndex}`]);
    localStorage.setItem(`agent1_section${resizerIndex + 1}_width`, state.widths[`section${resizerIndex + 1}`]);
  }

  _resizeState = null;
}

/* 요구사항 선택 토글 */
function toggleRequirementSelection(path, selected) {
  if (selected) {
    state.selectedReqPaths.add(path);
  } else {
    state.selectedReqPaths.delete(path);
  }
  updateSelectedView();
  renderRequirementList();
}

/* 전체 선택 */
function onSelectAll(event) {
  const keyword = elements.search.value.trim().toLowerCase();
  const filtered = state.requirements.filter((file) => {
    const source = getRequirementSource(file);
    const matchFilter = state.activeFilter === 'all' || source === state.activeFilter;
    const matchKeyword =
      !keyword ||
      file.name.toLowerCase().includes(keyword) ||
      file.path.toLowerCase().includes(keyword) ||
      getRequirementSource(file).toLowerCase().includes(keyword) ||
      getRequirementSourceLabel(file).toLowerCase().includes(keyword);
    return matchFilter && matchKeyword;
  });

  if (event.target.checked) {
    filtered.forEach((f) => state.selectedReqPaths.add(f.path));
  } else {
    filtered.forEach((f) => state.selectedReqPaths.delete(f.path));
  }

  updateSelectedView();
  renderRequirementList();
}

/* 선택 해제 */
function clearSelection() {
  state.selectedReqPaths.clear();
  updateSelectedView();
  renderRequirementList();
}

/* 선택 뷰 업데이트 */
function updateSelectedView() {
  const count = state.selectedReqPaths.size;
  elements.selectedCount.textContent = String(count);
  elements.selectedCountMini.textContent = String(count);
  elements.confirmSelection.disabled = count === 0;

  // Section2 요약
  elements.targetCount.textContent = `${count}개`;

  if (!count) {
    elements.targetStatus.textContent = '대상 선택 필요';
    elements.targetStatus.className = '';
    elements.selectedSummary.innerHTML = '<div class="section2_empty_target">좌측 패널에서 요구사항을 선택하면 이곳에 표시됩니다.</div>';
    elements.selectedList.innerHTML = '<p class="common_muted">선택된 요구사항이 없습니다.</p>';
    elements.generatePrd.disabled = true;
    return;
  }

  elements.targetStatus.textContent = '생성 준비 완료';
  elements.targetStatus.className = 'is_ready';
  elements.generatePrd.disabled = state.generation.active;

  const paths = Array.from(state.selectedReqPaths);

  elements.selectedSummary.innerHTML = paths
    .map((p) => {
      const name = p.split('/').pop();
      const file = state.requirements.find((item) => item.path === p);
      const source = getRequirementSource(file);
      const date = file?.registeredAtLabel || '등록일 확인 필요';
      return `
        <article class="section2_summary_item">
          <div>
            <strong>${escapeHtml(name)}</strong>
            <span>${escapeHtml(p)}</span>
          </div>
          <em class="common_badge ${source}">${source}</em>
          <small>${escapeHtml(date)}</small>
          <button type="button" class="section2_selected_remove" data-remove-path="${escapeHtml(p)}" title="선택 해제">×</button>
        </article>
      `;
    })
    .join('');

  $$('.section2_selected_remove', elements.selectedSummary).forEach((button) => {
    button.addEventListener('click', () => toggleRequirementSelection(button.dataset.removePath, false));
  });

  elements.selectedList.innerHTML = paths
    .map((p) => {
      const name = p.split('/').pop();
      return `
        <div class="section1_selected_pill">
          <span>${escapeHtml(name)}</span>
          <button type="button" class="section1_selected_remove" data-remove-path="${escapeHtml(p)}" title="제거">×</button>
        </div>
      `;
    })
    .join('');

  $$('.section1_selected_remove', elements.selectedList).forEach((button) => {
    button.addEventListener('click', () => toggleRequirementSelection(button.dataset.removePath, false));
  });
}

/* 프롬프트 옵션 렌더 */
function renderPromptOptions() {
  if (!state.prompts.length) {
    elements.promptTemplate.innerHTML = '<option value="">프롬프트 없음</option>';
    return;
  }
  elements.promptTemplate.innerHTML = state.prompts
    .map((f) => `<option value="${escapeHtml(f.path)}">${escapeHtml(f.name)}</option>`)
    .join('');
}

/* PRD 파일 목록 렌더 */
function renderPrdFiles() {
  if (!state.prds.length) {
    elements.prdFileList.innerHTML = '<div class="common_empty">생성된 PRD 문서가 없습니다.</div>';
    return;
  }
  elements.prdFileList.innerHTML = state.prds
    .map((f) => `
      <div class="section2_prd_file_item ${state.activePrd?.path === f.path ? 'is_active' : ''}" data-path="${escapeHtml(f.path)}">
        <span>${escapeHtml(f.name)}</span>
        <span style="color:var(--muted);font-size:11px">${f.registeredAtLabel}</span>
      </div>
    `)
    .join('');

  $$('.section2_prd_file_item', elements.prdFileList).forEach((item) => {
    item.addEventListener('click', () => openPrd(item.dataset.path));
  });
}

/* PRD 열기 */
async function openPrd(path) {
  state.activePrd = state.prds.find((f) => f.path === path) || { name: path, path };
  renderPrdFiles();
  openColumn('3');
  elements.feedbackToggle.textContent = `PRD 피드백 / 수정 요청`;

  try {
    const text = await fetchBlobText(path);
    elements.prdRaw.value = text;
    elements.prdPreview.innerHTML = simpleMarkdown(text);
  } catch (error) {
    elements.prdPreview.innerHTML = renderError(error.message);
  }
}

function openFeedbackPanel() {
  if (!state.activePrd) {
    showToast('피드백을 남길 PRD 문서를 먼저 선택해주세요.');
    return;
  }

  elements.feedbackPanel.classList.add('is_open');
  elements.feedbackPanel.setAttribute('aria-hidden', 'false');
  elements.feedbackInput.focus();
}

function closeFeedbackPanel() {
  elements.feedbackPanel.classList.remove('is_open');
  elements.feedbackPanel.setAttribute('aria-hidden', 'true');
}

function toggleFeedbackPanel() {
  if (elements.feedbackPanel.classList.contains('is_open')) {
    closeFeedbackPanel();
  } else {
    openFeedbackPanel();
  }
}

/* 로그 렌더 */
function renderLogs() {
  if (!state.logs.length) {
    elements.logList.innerHTML = '<div class="common_empty">로그가 없습니다.</div>';
    return;
  }
  elements.logList.innerHTML = `
    <table>
      <thead><tr><th>파일명</th><th>등록일</th><th>크기</th></tr></thead>
      <tbody>
        ${state.logs.map((f) => `
          <tr>
            <td>${escapeHtml(f.name)}</td>
            <td>${escapeHtml(f.registeredAtLabel)}</td>
            <td>${formatSize(f.size)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

/* 요구사항 모달 열기 */
async function openRequirementModal(path) {
  const file = state.requirements.find((f) => f.path === path);
  if (!file) return;

  elements.modalBadge.className = `modal_badge ${getRequirementSource(file)}`;
  elements.modalBadge.textContent = getRequirementSource(file);
  elements.modalTitle.textContent = file.name;
  elements.modalMeta.innerHTML = `
    <div>경로: <b>${escapeHtml(file.path)}</b></div>
    <div>출처: ${escapeHtml(getRequirementSourceLabel(file))}</div>
    <div>등록일: ${escapeHtml(file.registeredAtLabel)} · 크기: ${formatSize(file.size)}</div>
  `;
  elements.modalBody.textContent = '불러오는 중...';
  elements.modalSelect.dataset.path = path;
  elements.modal.showModal();

  try {
    const text = await fetchBlobText(path);
    elements.modalBody.textContent = text;
  } catch (error) {
    elements.modalBody.textContent = `오류: ${error.message}`;
  }
}

/* PRD 생성 요청 */
async function requestPrdGenerate() {
  const paths = Array.from(state.selectedReqPaths);
  if (!paths.length) { showToast('요구사항을 선택해주세요.'); return; }
  if (state.generation.active) { showToast('이미 PRD 생성이 진행 중입니다.'); return; }

  const knownPaths = new Set(state.prds.map((file) => file.path));
  startPrdGenerationWatch(knownPaths);
  showToast('PRD 생성 요청을 전송했습니다.');

  try {
    const res = await fetch('/api/prd-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requirements: paths,
        promptTemplate: elements.promptTemplate.value,
        model: elements.modelSelect.value,
        docTitle: elements.docTitle.value,
        secret: APP_CONFIG.webhooks.secret
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.message || `HTTP ${res.status}`);
    }

    const openedFromResponse = await completePrdGenerationFromResponse(data);

    if (!openedFromResponse && state.generation.active) {
      setGenerationStatus('running', {
        title: 'PRD 생성 요청 접수',
        message: 'n8n 응답은 도착했습니다. 새 PRD 문서가 Blob에 반영되는지 계속 확인합니다.',
        meta: '목록 자동 확인 중'
      });
    }
  } catch (error) {
    stopPrdGenerationWatch();
    setGenerationStatus('error', {
      title: 'PRD 생성 요청 실패',
      message: error.message,
      meta: '요청 실패',
      progress: 100
    });
    showToast(`요청 실패: ${error.message}`);
  }
}

/* PRD 피드백 제출 */
async function submitFeedback() {
  const feedback = elements.feedbackInput.value.trim();
  if (!feedback) { showToast('피드백을 입력해주세요.'); return; }
  showToast(`피드백 저장됨: ${feedback}`);
  elements.feedbackInput.value = '';
}

/* PRD 수정 요청 */
async function requestPrdRevise() {
  const webhook = APP_CONFIG.webhooks.prdRevise;
  if (!webhook) { showToast('수정 웹훅 URL이 설정되지 않았습니다.'); return; }
  if (!state.activePrd) { showToast('수정할 PRD를 선택해주세요.'); return; }

  showToast('PRD 수정 요청 중...');

  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prdPath: state.activePrd.path,
        feedback: elements.feedbackInput.value.trim(),
        secret: APP_CONFIG.webhooks.secret
      })
    });
    showToast('수정 요청이 전송되었습니다.');
  } catch (error) {
    showToast(`요청 실패: ${error.message}`);
  }
}

/* 파일 요구사항 등록 */
function requestFileRequirementSave() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.md,.txt,.pdf,.docx';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;

    const webhook = APP_CONFIG.webhooks.requirementSave;
    if (!webhook) { showToast('저장 웹훅 URL이 설정되지 않았습니다.'); return; }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('secret', APP_CONFIG.webhooks.secret);

    showToast(`${file.name} 업로드 중...`);
    try {
      await fetch(webhook, { method: 'POST', body: formData });
      showToast(`${file.name} 등록 완료`);
      await refreshRequirements();
    } catch (error) {
      showToast(`업로드 실패: ${error.message}`);
    }
  };
  input.click();
}

/* 직접 요구사항 등록 모달 열기 */
function openDirectRequirementModal() {
  resetDirectRequirementForm();
  elements.directModal.showModal();
}

/* 직접 요구사항 등록 폼 초기화 */
function resetDirectRequirementForm() {
  if (!elements.directSourceType) return;

  elements.directSourceType.value = 'DIRECT';
  elements.directSourceDetail.value = '';
  elements.directRequirementText.value = '';

  updateDirectSourceDetailState();
  elements.directRequirementText.focus();
}

/* 요구사항 속성에 따른 추가 정보 입력 제어 */
function updateDirectSourceDetailState() {
  const sourceType = elements.directSourceType.value;

  if (sourceType === 'JIRA') {
    elements.directSourceDetail.disabled = false;
    elements.directSourceDetail.placeholder = 'JIRA 티켓번호 또는 URL을 입력하세요. 예: JIRA-1234';
  } else {
    elements.directSourceDetail.disabled = true;
    elements.directSourceDetail.value = '';
    elements.directSourceDetail.placeholder = 'JIRA 선택 시 티켓번호 또는 URL을 입력하세요.';
  }
}

/* 직접 요구사항 등록 저장 */
async function submitDirectRequirementSave() {
  const webhook = APP_CONFIG.webhooks.requirementSave;

  if (!webhook) {
    showToast('저장 웹훅 URL이 설정되지 않았습니다.');
    return;
  }

  const sourceType = elements.directSourceType.value;
  const sourceDetail = elements.directSourceDetail.value.trim();
  const sourceText = elements.directRequirementText.value.trim();

  if (!sourceText) {
    showToast('요구사항 내용을 입력해주세요.');
    elements.directRequirementText.focus();
    return;
  }

  if (sourceType === 'JIRA' && !sourceDetail) {
    showToast('JIRA 티켓번호 또는 URL을 입력해주세요.');
    elements.directSourceDetail.focus();
    return;
  }

  const sourceLabelMap = {
    DIRECT: '직접등록',
    JIRA: 'JIRA',
    SLACK: 'Slack'
  };

  const keywordSeed =
    sourceType === 'JIRA' && sourceDetail
      ? sourceDetail
      : sourceText.slice(0, 24);

  const requirementKeyword = String(keywordSeed || 'direct')
    .replace(/^REQ_/i, '')
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9가-힣_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || 'direct';

  const payload = {
    requirementKeyword,
    title: requirementKeyword,
    sourceType,
    sourceLabel: sourceLabelMap[sourceType] || sourceType,
    sourceDetail,
    sourceText,
    reqDir: APP_CONFIG.storage.folders.req,
    sourceDir: 'source',
    vercelBaseUrl: APP_CONFIG.storage.baseUrl,
    requestedBy: 'web',
    secret: APP_CONFIG.webhooks.secret
  };

  showToast('요구사항 등록 중...');

  try {
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.success === false) {
      throw new Error(result.message || `HTTP ${response.status}`);
    }

    showToast('요구사항 등록 완료');
    elements.directModal.close();
    await refreshRequirements();
  } catch (error) {
    showToast(`등록 실패: ${error.message}`);
  }
}

/* 클립보드 복사 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('클립보드에 복사되었습니다.');
  } catch {
    showToast('복사에 실패했습니다.');
  }
}

/* 파일 다운로드 */
function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* 파일 크기 포맷 */
function formatSize(bytes) {
  if (!bytes) return '0B';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/* HTML 이스케이프 */
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* 에러 렌더 */
function renderError(msg) {
  return `<div class="common_empty" style="color:var(--red)">${escapeHtml(msg)}</div>`;
}

/* 간단 마크다운 → HTML */
function simpleMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/^(?!<[h|u|l])(.+)$/gm, (m) => m ? `<p>${m}</p>` : '');
}

/* ── 앱 시작 ── */
document.addEventListener('DOMContentLoaded', init);
