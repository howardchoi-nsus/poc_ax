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
      prompts: 'prompts/output/prd',
      prd: 'prd',
      maps: 'maps',
      approvedPrd: 'prd-approved',
      logs: 'logs'
    }
  },
  webhooks: {
    requirementSave: '/api/requirement-save',
    prdGenerate: 'https://kolchohoohu.app.n8n.cloud/webhook/agent1-prd-generate',
    prdRevise: '/api/prd-revise',
    secret: ''
  },
  ui: {
    min: { section1: 300, section2: 440, section3: 320 },
    max: { section1: 660, section2: 960, section3: 720 },
    closedRail: 48
  }
};

const query = new URLSearchParams(location.search);

APP_CONFIG.mock = query.get('mock') === '1' || query.get('demo') === '1';

APP_CONFIG.storage.folders.req =
  query.get('reqFolder') ||
  localStorage.getItem('agent1_req_folder') ||
  APP_CONFIG.storage.folders.req;

const storedPromptFolder = localStorage.getItem('agent1_prompt_folder');
APP_CONFIG.storage.folders.prompts =
  query.get('promptFolder') ||
  (storedPromptFolder && storedPromptFolder !== 'prompts' ? storedPromptFolder : '') ||
  APP_CONFIG.storage.folders.prompts;

APP_CONFIG.storage.folders.prd =
  query.get('prdFolder') ||
  localStorage.getItem('agent1_prd_folder') ||
  APP_CONFIG.storage.folders.prd;

APP_CONFIG.storage.folders.maps =
  query.get('mapFolder') ||
  localStorage.getItem('agent1_map_folder') ||
  APP_CONFIG.storage.folders.maps;

APP_CONFIG.storage.folders.approvedPrd =
  query.get('approvedPrdFolder') ||
  localStorage.getItem('agent1_approved_prd_folder') ||
  APP_CONFIG.storage.folders.approvedPrd;

APP_CONFIG.storage.folders.logs =
  query.get('logFolder') ||
  localStorage.getItem('agent1_log_folder') ||
  APP_CONFIG.storage.folders.logs;

APP_CONFIG.webhooks.requirementSave =
  query.get('reqWebhook') ||
  APP_CONFIG.webhooks.requirementSave;

APP_CONFIG.webhooks.prdGenerate =
  query.get('prdWebhook') ||
  localStorage.getItem('agent1_prd_webhook') ||
  APP_CONFIG.webhooks.prdGenerate;

APP_CONFIG.webhooks.prdRevise =
  query.get('reviseWebhook') ||
  APP_CONFIG.webhooks.prdRevise;

APP_CONFIG.webhooks.secret =
  query.get('webhookSecret') ||
  localStorage.getItem('agent1_webhook_secret') ||
  APP_CONFIG.webhooks.secret;

const state = {
  requirements: [],
  prompts: [],
  prds: [],
  maps: [],
  logs: [],
  mockFiles: {},
  requirementMetaLoadId: 0,
  selectedReqPaths: new Set(),
  activeFilter: 'all',
  activePrd: null,
  rawMode: false,
  generation: {
    active: false,
    startedAt: null,
    requestId: null,
    estimatedMs: null,
    knownPaths: new Set(),
    knownLogPaths: new Set(),
    timer: null,
    elapsedTimer: null,
    lastCheckedAt: null,
    attempts: 0,
    maxAttempts: 120,
    pollIntervalMs: 5000
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
  selectedCountMini: $('section1_selected_count_mini'),
  totalCount: $('section1_total_count'),

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
  generationEta: $('section2_generation_eta'),
  generationMessage: $('section2_generation_message'),
  generationBar: $('section2_generation_bar'),
  generationMeta: $('section2_generation_meta'),
  generationSummary: $('section2_generation_summary'),
  generationModalOpen: $('section2_btn_generation_modal'),
  generationModal: $('modal_generation'),
  generationModalClose: $('modal_generation_btn_close'),
  generationModalBackground: $('modal_generation_btn_background'),
  generationModalStop: $('modal_generation_btn_stop'),
  generationModalConfirm: $('modal_generation_btn_confirm'),
  prdFileList: $('section2_prd_file_list'),
  refreshPrd: $('section2_btn_refresh_prd'),
  prdPreview: $('section2_prd_preview'),
  prdRaw: $('section2_prd_raw'),
  prdRequirements: $('section3_prd_requirements'),
  prdRequirementsCount: $('section3_prd_requirements_count'),
  prdRequirementList: $('section3_prd_requirement_list'),
  prdTemplate: $('section3_prd_template'),
  prdTemplateName: $('section3_prd_template_name'),
  copyPrd: $('section2_btn_copy_prd'),
  downloadPrd: $('section2_btn_download_prd'),
  feedbackToggle: $('section2_btn_feedback_toggle'),
  feedbackPanel: $('section2_feedback_panel'),
  feedbackClose: $('section2_btn_feedback_close'),
  feedbackInput: $('section2_feedback_input'),
  feedback: $('section2_btn_feedback'),
  revise: $('section2_btn_revise'),
  approvePrd: $('section3_btn_approve_prd'),
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

  elements.generatePrd.addEventListener('click', requestPrdGenerate);
  elements.generationModalOpen?.addEventListener('click', openGenerationModal);
  elements.generationModalClose?.addEventListener('click', closeGenerationModal);
  elements.generationModalBackground?.addEventListener('click', closeGenerationModal);
  elements.generationModalStop?.addEventListener('click', stopPrdGenerationByUser);
  elements.generationModalConfirm?.addEventListener('click', closeGenerationModal);
  elements.refreshPrd.addEventListener('click', refreshPrdFiles);
  elements.copyPrd.addEventListener('click', () => copyToClipboard(elements.prdRaw.value));
  elements.downloadPrd.addEventListener('click', () =>
    downloadText(state.activePrd?.name || 'PRD.md', elements.prdRaw.value)
  );

  elements.feedback.addEventListener('click', submitFeedback);
  elements.revise.addEventListener('click', requestPrdRevise);
  elements.feedbackToggle.addEventListener('click', toggleFeedbackPanel);
  elements.feedbackClose.addEventListener('click', closeFeedbackPanel);
  elements.approvePrd?.addEventListener('click', approveActivePrd);

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
  if (APP_CONFIG.mock) {
    const files = Object.keys(state.mockFiles)
      .filter((path) => path.startsWith(`${cleanFolder}/`))
      .map((path) => {
        const content = state.mockFiles[path] || '';
        return {
          name: path.split('/').pop(),
          path,
          pathname: path,
          size: content.length,
          uploadedAt: '2026-06-23T09:00:00.000Z'
        };
      });
    if (!files.length && required) return [];
    return normalizeFileList(files, cleanFolder);
  }

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
  return `agent1_req_meta:v2:${path}`;
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

function getRequirementSourceBadgeLabel(file) {
  const source = getRequirementSource(file);
  if (source === 'FILE') return 'File';
  if (source === 'DIRECT') return 'Direct';
  if (source === 'SLACK') return 'Slack';
  return source;
}

function getRequirementSourceLabel(file) {
  const source = getRequirementSource(file);
  const detail = [file?.sourceLabel, file?.sourceDetail].filter(Boolean).join(' · ');
  return detail || getRequirementSourceBadgeLabel(file);
}

function cleanRequirementListText(value) {
  return String(value || '').replace(/\s*\(\s*삭제\s*\)\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function getRequirementDisplayTitle(file) {
  const title = cleanRequirementListText(file?.name || '')
    .replace(/\.md$/i, '')
    .replace(/^REQ_/i, '')
    .replace(/_\d{6,8}_\d{6}$/g, '')
    .replace(/_/g, ' ')
    .trim();

  return title || cleanRequirementListText(file?.name || '');
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
  if (APP_CONFIG.mock && Object.prototype.hasOwnProperty.call(state.mockFiles, cleanPath)) {
    return state.mockFiles[cleanPath];
  }

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
  if (APP_CONFIG.mock) {
    await loadMockData();
    showToast('Mock 데이터로 화면을 표시합니다.');
    return;
  }
  showToast('Vercel Blob 데이터를 불러오는 중입니다.');

  await Promise.allSettled([
    refreshRequirements(),
    refreshPrompts(),
    refreshPrdFiles(),
    refreshMaps(),
    refreshLogs()
  ]);

  showToast('Vercel Blob 데이터 갱신 완료');
}

async function loadMockData() {
  const now = '2026-06-23T09:00:00.000Z';
  state.mockFiles = {
    'req/REQ_GGTweets_vs_GGPoker_260622_005548.md': [
      '---',
      'source_type: FILE',
      'source_label: GGTweets',
      'source_detail: Campaign analysis',
      'created_at: "2026-06-22T00:55:48.000Z"',
      '---',
      '',
      '# 요구사항',
      '',
      '- GGTweets 캠페인과 GGPoker 유입 성과를 비교한다.',
      '- 채널별 클릭, 가입, 전환율을 한 화면에서 확인한다.',
      '- 캠페인 기간과 기준 통화를 필터로 제공한다.'
    ].join('\n'),
    'req/REQ_Agent2_Approved_PRD_List_260623_101500.md': [
      '---',
      'source_type: DIRECT',
      'source_label: Product Review',
      'created_at: "2026-06-23T10:15:00.000Z"',
      '---',
      '',
      '# 요구사항',
      '',
      '- 승인된 PRD만 Agent2 입력 목록에 노출한다.',
      '- 승인 해제 시 Agent2 목록에서 즉시 제외한다.',
      '- 승인 상태를 PRD 목록에서 배지로 표시한다.'
    ].join('\n'),
    'prompts/output/prd/prd-template-v1.md': '# PRD Template\n\n요구사항을 기반으로 PRD를 작성한다.',
    'prd/PRD_GGTweets_vs_GGPoker_260623_103000.md': [
      '# GGTweets vs GGPoker 성과 분석 PRD',
      '',
      '## 1. 목적',
      'GGTweets 캠페인과 GGPoker 유입 성과를 비교하고 승인된 PRD만 후속 Agent2 단계로 전달한다.',
      '',
      '## 2. 주요 기능',
      '- 캠페인 성과 비교 대시보드',
      '- 승인된 PRD 목록 관리',
      '- 승인/해제 상태 변경',
      '',
      '## 3. 예외 케이스',
      '- 요구사항 매핑 정보가 없는 PRD는 안내 문구를 표시한다.',
      '- 승인 해제 실패 시 기존 승인 상태를 유지한다.'
    ].join('\n'),
    'maps/MAP_GGTweets_vs_GGPoker_260623_103000.json': JSON.stringify({
      requestId: 'mock_prd_request_001',
      requirementSetId: 'REQ_SET_MOCK_001',
      requirementFilePaths: [
        'req/REQ_GGTweets_vs_GGPoker_260622_005548.md',
        'req/REQ_Agent2_Approved_PRD_List_260623_101500.md'
      ],
      promptFilePath: 'prompts/output/prd/prd-template-v1.md',
      prdFilePath: 'prd/PRD_GGTweets_vs_GGPoker_260623_103000.md',
      mapFilePath: 'maps/MAP_GGTweets_vs_GGPoker_260623_103000.json',
      status: 'success',
      createdAt: now
    }, null, 2),
    'logs/LOG_GGTweets_vs_GGPoker_260623_103000.json': JSON.stringify({
      status: 'success',
      prdFilePath: 'prd/PRD_GGTweets_vs_GGPoker_260623_103000.md',
      endedAt: now
    }, null, 2)
  };

  state.requirements = await fetchBlobFolder(APP_CONFIG.storage.folders.req);
  state.prompts = await fetchBlobFolder(APP_CONFIG.storage.folders.prompts);
  state.prds = await fetchBlobFolder(APP_CONFIG.storage.folders.prd);
  state.maps = await fetchBlobFolder(APP_CONFIG.storage.folders.maps);
  state.logs = await fetchBlobFolder(APP_CONFIG.storage.folders.logs);
  state.requirements.forEach((file) => Object.assign(file, parseRequirementMeta(state.mockFiles[file.path])));

  renderRequirementList();
  renderPromptOptions();
  renderPrdFiles();
  renderLogs();
  updateSelectedView();
  if (state.prds[0]) {
    await openPrd(state.prds[0].path);
  } else {
    renderActivePrdRequirements([]);
  }
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

async function refreshMaps() {
  try {
    state.maps = await fetchBlobFolder(APP_CONFIG.storage.folders.maps);
  } catch {
    state.maps = [];
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
      const sourceBadgeLabel = getRequirementSourceBadgeLabel(file);
      const displayTitle = getRequirementDisplayTitle(file);
      const selected = state.selectedReqPaths.has(file.path);

      return `
        <article class="section1_req_item ${selected ? 'is_selected' : ''}" data-path="${escapeHtml(file.path)}">
          <div class="section1_req_main">
            <div class="section1_req_title_row">
              <input
                type="checkbox"
                class="section1_req_checkbox"
                ${selected ? 'checked' : ''}
                aria-label="${escapeHtml(displayTitle)} 선택"
              />
              <button class="section1_req_title_button" type="button">
                ${escapeHtml(displayTitle)}
              </button>
            </div>
            <div class="section1_req_meta">
              <span class="common_badge ${source}">${sourceBadgeLabel}</span>
              <span>등록일 ${escapeHtml(file.registeredAtLabel)}</span>
              <span>${formatSize(file.size)}</span>
            </div>
          </div>
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

function getGenerationLimitMs() {
  return state.generation.maxAttempts * state.generation.pollIntervalMs;
}

function createPrdRequestId() {
  const random = Math.random().toString(36).slice(2, 8);
  return `prd_${Date.now().toString(36)}_${random}`;
}

function estimatePrdGenerationMs(paths = []) {
  const selectedRequirements = paths
    .map((path) => state.requirements.find((file) => file.path === path))
    .filter(Boolean);
  const prompt = state.prompts.find((file) => file.path === elements.promptTemplate?.value);
  const requirementBytes = selectedRequirements.reduce((sum, file) => sum + Number(file.size || 0), 0);
  const promptBytes = Number(prompt?.size || 0);
  const totalKb = Math.ceil((requirementBytes + promptBytes) / 1024);
  const estimate =
    45 * 1000 +
    selectedRequirements.length * 15 * 1000 +
    totalKb * 2500;

  return Math.max(90 * 1000, Math.min(getGenerationLimitMs(), estimate));
}

function getGenerationEstimateMs() {
  return state.generation.estimatedMs || getGenerationLimitMs();
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
  if (elements.generationEta) {
    if (status === 'complete') {
      elements.generationEta.textContent = '완료';
    } else if (status === 'error' || status === 'unknown' || status === 'stopped') {
      elements.generationEta.textContent = '확인 필요';
    }
  }
  updateGenerationSummary(status);
}

function updateGenerationElapsed() {
  if (!state.generation.startedAt) {
    elements.generationElapsed.textContent = '00:00';
    if (elements.generationEta) {
      elements.generationEta.textContent = formatDuration(getGenerationEstimateMs());
    }
    return;
  }

  const elapsed = Date.now() - state.generation.startedAt;
  const estimateMs = getGenerationEstimateMs();
  const remaining = Math.max(0, estimateMs - elapsed);
  const progress = Math.min(92, (elapsed / estimateMs) * 100);

  elements.generationElapsed.textContent = formatDuration(elapsed);
  if (elements.generationEta) {
    elements.generationEta.textContent = remaining > 0 ? formatDuration(remaining) : '완료 확인 중';
  }
  elements.generationBar.style.width = `${progress}%`;
  updateGenerationSummary(elements.generationStatus?.dataset.status || 'idle');
}

function openGenerationModal() {
  if (!elements.generationModal) return;
  if (!elements.generationModal.open) {
    elements.generationModal.showModal();
  }
}

function closeGenerationModal() {
  elements.generationModal?.close();
}

function updateGenerationSummary(status = 'idle') {
  if (!elements.generationSummary) return;

  const title = elements.generationTitle?.textContent || 'PRD 생성 대기';
  const elapsed = elements.generationElapsed?.textContent || '00:00';
  const eta = elements.generationEta?.textContent || formatDuration(getGenerationLimitMs());

  if (status === 'running') {
    elements.generationSummary.textContent = `${title} · 남은 시간 ${eta}`;
    elements.generationModalOpen?.classList.add('is_active');
    return;
  }

  elements.generationSummary.textContent = title;
  elements.generationModalOpen?.classList.toggle('is_active', status === 'complete' || status === 'stopped');
}

function stopPrdGenerationByUser() {
  if (!state.generation.active) {
    closeGenerationModal();
    return;
  }

  const confirmed = window.confirm(
    'PRD 생성 자동 확인을 중단할까요?\n이미 전송된 n8n 작업은 계속 실행될 수 있으며, 나중에 /prd 새로고침으로 결과를 확인할 수 있습니다.'
  );

  if (!confirmed) return;

  stopPrdGenerationWatch();
  setGenerationStatus('stopped', {
    title: 'PRD 생성 확인 중단됨',
    message: '자동 확인을 중단했습니다. 이미 전송된 n8n 작업은 계속 실행될 수 있으므로, 잠시 후 /prd 새로고침으로 결과를 확인하세요.',
    meta: `중단 시각 ${new Date().toLocaleTimeString()}`,
    progress: 100
  });
  showToast('PRD 생성 자동 확인을 중단했습니다.');
}

function startPrdGenerationWatch(knownPaths, options = {}) {
  stopPrdGenerationWatch(false);

  state.generation.active = true;
  state.generation.startedAt = Date.now();
  state.generation.requestId = options.requestId || createPrdRequestId();
  state.generation.estimatedMs = options.estimatedMs || getGenerationLimitMs();
  state.generation.knownPaths = new Set(knownPaths);
  state.generation.knownLogPaths = new Set(options.knownLogPaths || []);
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
  setGenerationStatus('running', {
    meta: `예상 ${formatDuration(state.generation.estimatedMs)} · 최대 ${formatDuration(getGenerationLimitMs())}`
  });
  updateGenerationElapsed();
  openGenerationModal();

  state.generation.elapsedTimer = window.setInterval(updateGenerationElapsed, 1000);
  state.generation.timer = window.setInterval(pollGeneratedPrdFiles, state.generation.pollIntervalMs);
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

function isGenerationErrorLogCandidate(file) {
  const requestId = state.generation.requestId;
  if (!file?.path || state.generation.knownLogPaths.has(file.path)) return false;

  const text = `${file.path} ${file.name || ''}`.toLowerCase();
  if (requestId && text.includes(requestId.toLowerCase())) return true;
  if (!text.includes('error') && !text.includes('err')) return false;

  const uploadedAt = file.uploadedAt ? new Date(file.uploadedAt).getTime() : 0;
  const startedAt = state.generation.startedAt || 0;
  return !uploadedAt || !startedAt || uploadedAt >= startedAt - 5000;
}

async function findPrdGenerationErrorLog() {
  const logs = await fetchBlobFolder(APP_CONFIG.storage.folders.logs);
  state.logs = logs;

  const candidates = logs
    .filter(isGenerationErrorLogCandidate)
    .sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0))
    .slice(0, 5);

  for (const file of candidates) {
    try {
      const text = await fetchBlobText(file.path);
      const data = JSON.parse(text);
      const requestMatches =
        !state.generation.requestId ||
        data.requestId === state.generation.requestId ||
        data.requirementSetId === state.generation.requestId;
      const failed = data.status === 'error' || data.success === false || data.error;

      if (requestMatches && failed) {
        return {
          file,
          data,
          message: data.message || data.error?.message || data.error || 'n8n workflow error'
        };
      }
    } catch (error) {
      // Ignore unreadable/non-JSON logs while polling for workflow errors.
    }
  }

  return null;
}

async function pollGeneratedPrdFiles() {
  if (!state.generation.active) return;

  state.generation.attempts += 1;
  state.generation.lastCheckedAt = new Date();
  setGenerationStatus('running', {
    meta: `자동 확인 중 · ${state.generation.lastCheckedAt.toLocaleTimeString()}`
  });

  try {
    const errorLog = await findPrdGenerationErrorLog();
    if (errorLog) {
      stopPrdGenerationWatch();
      setGenerationStatus('error', {
        title: 'PRD 생성 실패',
        message: errorLog.message,
        meta: `n8n error log: ${errorLog.file.path}`,
        progress: 100
      });
      renderLogs();
      showToast(`PRD 생성 실패: ${errorLog.message}`);
      return;
    }

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

/* 선택 뷰 업데이트 */
function updateSelectedView() {
  const count = state.selectedReqPaths.size;
  elements.selectedCountMini.textContent = String(count);

  // Section2 요약
  elements.targetCount.textContent = `${count}개`;

  if (!count) {
    elements.targetStatus.textContent = '대상 선택 필요';
    elements.targetStatus.className = '';
    elements.selectedSummary.innerHTML = '<div class="section2_empty_target">좌측 패널에서 요구사항을 선택하면 이곳에 표시됩니다.</div>';
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
      const sourceBadgeLabel = getRequirementSourceBadgeLabel(file);
      const date = file?.registeredAtLabel || '등록일 확인 필요';
      return `
        <article class="section2_summary_item">
          <div>
            <strong>${escapeHtml(name)}</strong>
            <span>${escapeHtml(p)}</span>
          </div>
          <em class="common_badge ${source}">${sourceBadgeLabel}</em>
          <small>${escapeHtml(date)}</small>
          <button type="button" class="section2_selected_remove" data-remove-path="${escapeHtml(p)}" title="선택 해제">×</button>
        </article>
      `;
    })
    .join('');

  $$('.section2_selected_remove', elements.selectedSummary).forEach((button) => {
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
async function findPrdMapping(prdPath) {
  for (const file of state.maps || []) {
    try {
      const text = await fetchBlobText(file.path);
      const mapping = JSON.parse(text);
      if (mapping.prdFilePath === prdPath) return mapping;
    } catch {
      // Ignore malformed map files.
    }
  }
  return null;
}

function getRequirementTitleByPath(path) {
  const file = state.requirements.find((item) => item.path === path);
  if (file) return getRequirementDisplayTitle(file);
  return getRequirementDisplayTitle({ name: String(path || '').split('/').pop() });
}

function getPromptTemplateTitleByPath(path) {
  const file = state.prompts.find((item) => item.path === path);
  const name = file?.name || String(path || '').split('/').pop();
  return String(name || '')
    .replace(/\.md$/i, '')
    .replace(/_/g, ' ')
    .trim() || '확인 필요';
}

function renderActivePrdTemplate(promptFilePath, options = {}) {
  if (!elements.prdTemplateName) return;

  if (options.loading) {
    elements.prdTemplateName.textContent = '확인 중';
    elements.prdTemplateName.removeAttribute('title');
    return;
  }

  if (!promptFilePath) {
    elements.prdTemplateName.textContent = options.message || '매핑 정보 없음';
    elements.prdTemplateName.removeAttribute('title');
    return;
  }

  elements.prdTemplateName.textContent = getPromptTemplateTitleByPath(promptFilePath);
  elements.prdTemplateName.title = promptFilePath;
}

function renderActivePrdRequirements(paths = [], options = {}) {
  if (!elements.prdRequirementList || !elements.prdRequirementsCount) return;

  const count = paths.length;
  elements.prdRequirementsCount.textContent = count ? `${count}건` : '0건';

  if (options.loading) {
    elements.prdRequirementList.innerHTML = '<div class="common_empty">반영 요구사항을 확인하는 중입니다.</div>';
    return;
  }

  if (!count) {
    elements.prdRequirementList.innerHTML = `<div class="common_empty">${escapeHtml(options.message || '매핑 정보가 없습니다.')}</div>`;
    return;
  }

  elements.prdRequirementList.innerHTML = paths
    .map((path) => {
      const file = state.requirements.find((item) => item.path === path);
      const source = getRequirementSource(file);
      const sourceBadgeLabel = getRequirementSourceBadgeLabel(file);
      return `
      <div class="section3_prd_requirement_item" role="button" tabindex="0" data-path="${escapeHtml(path)}">
        <span class="section3_prd_requirement_text">
          <span class="section3_prd_requirement_title">${escapeHtml(getRequirementTitleByPath(path))}</span>
          <span class="section3_prd_requirement_path">${escapeHtml(path)}</span>
        </span>
        <span class="common_badge ${source}">${sourceBadgeLabel}</span>
      </div>
    `;
    })
    .join('');

  $$('.section3_prd_requirement_item', elements.prdRequirementList).forEach((item) => {
    const openItem = () => openRequirementModal(item.dataset.path);
    item.addEventListener('click', openItem);
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openItem();
      }
    });
  });
}

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
  updateApprovePrdButton('ready');
  renderActivePrdRequirements([], { loading: true });
  renderActivePrdTemplate('', { loading: true });

  try {
    const text = await fetchBlobText(path);
    elements.prdRaw.value = text;
    elements.prdPreview.innerHTML = simpleMarkdown(text);
    const mapping = await findPrdMapping(path);
    renderActivePrdRequirements(mapping?.requirementFilePaths || [], {
      message: '이 PRD의 요구사항 매핑 정보가 없습니다.'
    });
    renderActivePrdTemplate(mapping?.promptFilePath, {
      message: '매핑 정보 없음'
    });
  } catch (error) {
    elements.prdPreview.innerHTML = renderError(error.message);
    renderActivePrdRequirements([], { message: 'PRD를 불러오지 못해 요구사항을 표시할 수 없습니다.' });
    renderActivePrdTemplate('', { message: '표시할 수 없음' });
    updateApprovePrdButton('disabled');
  }
}

function updateApprovePrdButton(status = 'disabled') {
  if (!elements.approvePrd) return;

  const labels = {
    disabled: '문서승인',
    ready: '문서승인',
    saving: '승인 중...',
    complete: '승인완료',
    error: '재시도'
  };

  elements.approvePrd.textContent = labels[status] || labels.disabled;
  elements.approvePrd.disabled = status === 'disabled' || status === 'saving' || !state.activePrd;
  elements.approvePrd.dataset.status = status;
}

async function approveActivePrd() {
  if (!state.activePrd) {
    showToast('승인할 PRD 문서를 먼저 선택해주세요.');
    updateApprovePrdButton('disabled');
    return;
  }

  const sourceText = elements.prdRaw.value || await fetchBlobText(state.activePrd.path);
  const approvedName = `APPROVED_${state.activePrd.name || state.activePrd.path.split('/').pop()}`;
  const approvedPath = `${APP_CONFIG.storage.folders.approvedPrd}/${approvedName}`.replace(/\/+/g, '/');
  const approvedAt = new Date();
  const metadata = [
    '---',
    'approval_status: approved',
    `approved_at: "${approvedAt.toISOString()}"`,
    'approved_by: "확인 필요"',
    `source_prd_path: "${escapeYamlValue(state.activePrd.path)}"`,
    `prd_version: "확인 필요"`,
    '---',
    ''
  ].join('\n');
  const approvedContent = sourceText.startsWith('---\n')
    ? sourceText.replace(/^---\n([\s\S]*?)\n---\n?/, `${metadata}`)
    : `${metadata}${sourceText}`;

  updateApprovePrdButton('saving');
  showToast('PRD 승인 처리 중...');

  try {
    await saveBlobText(approvedPath, approvedContent, 'text/markdown; charset=utf-8');
    updateApprovePrdButton('complete');
    showToast('PRD 승인 완료. Agent2에서 확인할 수 있습니다.');
  } catch (error) {
    updateApprovePrdButton('error');
    showToast(`승인 실패: ${error.message}`);
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
  const file = state.requirements.find((f) => f.path === path) || {
    name: String(path || '').split('/').pop(),
    path,
    size: 0,
    registeredAtLabel: '확인 필요',
    ...getDefaultRequirementMeta()
  };

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
  const knownLogPaths = new Set(state.logs.map((file) => file.path));
  const requestId = createPrdRequestId();
  const estimatedMs = estimatePrdGenerationMs(paths);
  startPrdGenerationWatch(knownPaths, { requestId, estimatedMs, knownLogPaths });
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
        requestId,
        estimatedSeconds: Math.ceil(estimatedMs / 1000),
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
  const endpoint = APP_CONFIG.webhooks.prdRevise;
  if (!endpoint) { showToast('수정 요청 API가 설정되지 않았습니다.'); return; }
  if (!state.activePrd) { showToast('수정할 PRD를 선택해주세요.'); return; }

  showToast('PRD 수정 요청 중...');

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prdPath: state.activePrd.path,
        feedback: elements.feedbackInput.value.trim(),
        secret: APP_CONFIG.webhooks.secret
      })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.success === false) {
      throw new Error(result.message || `HTTP ${response.status}`);
    }

    showToast('수정 요청이 전송되었습니다.');
  } catch (error) {
    showToast(`요청 실패: ${error.message}`);
  }
}

/* 파일 요구사항 등록 */
function requestFileRequirementSave() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.md,.txt';
  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;

    showToast(`${file.name} 업로드 중...`);
    try {
      const requirementKeyword = createRequirementKeyword(file.name);
      const sourceText = await readRequirementFileText(file);

      if (!sourceText) {
        throw new Error('파일 등록은 현재 .md 또는 .txt만 지원합니다.');
      }

      await saveTextRequirementFile({
        file,
        requirementKeyword,
        sourceText
      });

      showToast(`${file.name} 등록 완료`);
      await refreshRequirements();
    } catch (error) {
      showToast(`업로드 실패: ${error.message}`);
    }
  };
  input.click();
}

async function readRequirementFileText(file) {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  if (['md', 'txt'].includes(extension) || file.type.startsWith('text/')) {
    return file.text();
  }

  return '';
}

async function saveTextRequirementFile({ file, requirementKeyword, sourceText }) {
  const now = new Date();
  const timestamp = formatFileTimestamp(now);
  const reqPath = `${APP_CONFIG.storage.folders.req}/REQ_${requirementKeyword}_${timestamp}.md`;
  const sourcePath = `source/REQ_${requirementKeyword}_${timestamp}.txt`;
  const markdown = buildRequirementMarkdown({
    title: requirementKeyword,
    sourceText,
    sourceDetail: file.name,
    sourcePath,
    generatedAt: now
  });

  await saveBlobText(sourcePath, sourceText, 'text/plain; charset=utf-8');
  await saveBlobText(reqPath, markdown, 'text/markdown; charset=utf-8');
}

async function saveBlobText(path, content, contentType) {
  const response = await fetch('/api/blob-save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      path,
      content,
      contentType,
      access: 'private'
    })
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.success === false) {
    throw new Error(result.message || `Blob 저장 실패 HTTP ${response.status}`);
  }

  return result;
}

function buildRequirementMarkdown({ title, sourceText, sourceDetail, sourcePath, generatedAt }) {
  return [
    '---',
    `title: "${escapeYamlValue(title)}"`,
    'source_type: FILE',
    'source_label: File',
    `source_detail: "${escapeYamlValue(sourceDetail)}"`,
    `source_path: "${escapeYamlValue(sourcePath)}"`,
    `created_at: "${generatedAt.toISOString()}"`,
    '---',
    '',
    `# ${title}`,
    '',
    '## 요구사항 내용',
    '',
    sourceText.trim()
  ].join('\n');
}

function escapeYamlValue(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function formatFileTimestamp(date) {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yy}${mm}${dd}_${hh}${mi}${ss}`;
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
  const endpoint = APP_CONFIG.webhooks.requirementSave;

  if (!endpoint) {
    showToast('저장 API가 설정되지 않았습니다.');
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

  const requirementKeyword = createRequirementKeyword(keywordSeed || 'direct');

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
    const response = await fetch(endpoint, {
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

function createRequirementKeyword(value) {
  return String(value || 'requirement')
    .replace(/\.[^.]+$/, '')
    .replace(/^REQ_/i, '')
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9가-힣_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || 'requirement';
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
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (isMarkdownTableStart(lines, index)) {
      const tableLines = [];
      while (index < lines.length && isMarkdownTableRow(lines[index])) {
        tableLines.push(lines[index]);
        index += 1;
      }
      blocks.push(renderMarkdownTable(tableLines));
      continue;
    }

    if (/^###\s+/.test(line)) {
      blocks.push(`<h4>${formatInlineMarkdown(line.replace(/^###\s+/, ''))}</h4>`);
      index += 1;
      continue;
    }

    if (/^##\s+/.test(line)) {
      blocks.push(`<h3>${formatInlineMarkdown(line.replace(/^##\s+/, ''))}</h3>`);
      index += 1;
      continue;
    }

    if (/^#\s+/.test(line)) {
      blocks.push(`<h2>${formatInlineMarkdown(line.replace(/^#\s+/, ''))}</h2>`);
      index += 1;
      continue;
    }

    if (/^-\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^-\s+/.test(lines[index])) {
        items.push(`<li>${formatInlineMarkdown(lines[index].replace(/^-\s+/, ''))}</li>`);
        index += 1;
      }
      blocks.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    const paragraphLines = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^#{1,3}\s+/.test(lines[index]) &&
      !/^-\s+/.test(lines[index]) &&
      !isMarkdownTableStart(lines, index)
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    blocks.push(`<p>${formatInlineMarkdown(paragraphLines.join('<br>'))}</p>`);
  }

  return blocks.join('');
}

function isMarkdownTableStart(lines, index) {
  return isMarkdownTableRow(lines[index]) && isMarkdownTableDivider(lines[index + 1]);
}

function isMarkdownTableRow(line) {
  return /^\s*\|.*\|\s*$/.test(String(line || ''));
}

function isMarkdownTableDivider(line) {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(String(line || ''));
}

function renderMarkdownTable(lines) {
  const [headerLine, , ...bodyLines] = lines;
  const headers = splitMarkdownTableRow(headerLine);
  const rows = bodyLines.map(splitMarkdownTableRow);

  return `
    <table>
      <thead><tr>${headers.map((cell) => `<th>${formatInlineMarkdown(cell)}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows.map((row) => `<tr>${row.map((cell) => `<td>${formatInlineMarkdown(cell)}</td>`).join('')}</tr>`).join('')}
      </tbody>
    </table>
  `;
}

function splitMarkdownTableRow(line) {
  return String(line || '')
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function formatInlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

/* ── 앱 시작 ── */
document.addEventListener('DOMContentLoaded', init);
