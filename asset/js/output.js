const OUTPUT_CONFIG = {
  storage: {
    baseUrl: location.origin,
    folders: {
      approvedPrd: 'prd-approved',
      prompts: {
        scenario: 'prompts/output/scenario',
        policy: 'prompts/output/policy',
        ia: 'prompts/output/ia',
        diagram: 'prompts/output/diagram'
      },
      scenario: 'scenario',
      policy: 'policy',
      ia: 'ia',
      diagram: 'diagram'
    }
  },
  webhooks: {
    outputGenerate: '/api/output-generate'
  },
  fallbackPrds: [
    {
      name: 'APPROVED_PRD_Ares_Server_Promotion.md',
      path: 'sample/APPROVED_PRD_Ares_Server_Promotion.md',
      registeredAtLabel: '샘플',
      content: [
        '---',
        'approval_status: approved',
        'approved_at: "2026-06-22T00:00:00.000Z"',
        'approved_by: "HOWARD.CHOI"',
        '---',
        '',
        '## 1. 문서 개요',
        '* 프로젝트명: 신규 서버 아레스 오픈 기념 이벤트 웹 프로모션',
        '* 서비스 대상 국가/지역: 글로벌',
        '',
        '## 2. Executive Summary',
        '신규 서버 오픈 소식을 전달하고 신규/복귀 유저 유입을 확대합니다.',
        '',
        '## 9. Functional Requirements',
        '| ID | Action | Output |',
        '| -- | ------ | ------ |',
        '| FR-001 | 메인 배너 클릭 | 이벤트 상세 페이지 |',
        '| FR-002 | 이벤트 상세 확인 | 보상 및 참여 정보 |'
      ].join('\n')
    }
  ]
};

const outputState = {
  approvedPrds: [],
  prompts: {
    service_scenario: [],
    service_policy: [],
    ia: [],
    service_diagram: []
  },
  selectedPrd: null,
  prdDetailTarget: null,
  selectedOutputType: 'service_scenario',
  scenario: null,
  generated: {},
  rawMode: false,
  generationStartedAt: null,
  generationTimer: null,
  closedCols: new Set(),
  widths: {
    section1: localStorage.getItem('agent2_section1_width') || '30%'
  }
};

const $ = (id) => document.getElementById(id);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const outputElements = {
  repoBadge: $('header_repo_badge'),
  refreshAll: $('header_btn_refresh'),
  serviceMenu: $('header_btn_services'),
  search: $('output_search_input'),
  prdList: $('output_approved_prd_list'),
  prdCount: $('output_prd_total_count'),
  selectedHint: $('output_selected_prd_hint'),
  selectedStatus: $('output_selected_prd_status'),
  selectedSummary: $('output_selected_prd_summary'),
  promptTemplate: $('output_prompt_template'),
  policyPromptTemplate: $('output_policy_prompt_template'),
  iaPromptTemplate: $('output_ia_prompt_template'),
  diagramPromptTemplate: $('output_diagram_prompt_template'),
  generate: $('output_btn_generate'),
  modeButtons: $$('.output_mode_button'),
  secondaryButtons: $$('.output_followup_button'),
  scenarioPreview: $('output_scenario_preview'),
  scenarioRaw: $('output_scenario_raw'),
  copyScenario: $('output_btn_copy_scenario'),
  downloadScenario: $('output_btn_download_scenario'),
  generationModal: $('output_modal_generation'),
  generationModalOpen: $('output_btn_generation_modal'),
  generationModalClose: $('output_modal_generation_close'),
  generationSummary: $('output_generation_summary'),
  generationStatus: $('output_generation_status'),
  generationTitle: $('output_generation_title'),
  generationElapsed: $('output_generation_elapsed'),
  generationMessage: $('output_generation_message'),
  generationBar: $('output_generation_bar'),
  generationMeta: $('output_generation_meta'),
  resultModal: $('output_modal_result'),
  resultModalClose: $('output_modal_result_close'),
  resultModalTitle: $('output_modal_title'),
  resultModalBadge: $('output_modal_badge'),
  resultModalMeta: $('output_modal_meta'),
  resultModalBody: $('output_modal_body'),
  resultModalCopy: $('output_modal_copy'),
  prdDetailModal: $('output_modal_prd_detail'),
  prdDetailModalClose: $('output_prd_modal_close'),
  prdDetailModalTitle: $('output_prd_modal_title'),
  prdDetailModalMeta: $('output_prd_modal_meta'),
  prdDetailModalBody: $('output_prd_modal_body'),
  prdDetailModalSelect: $('output_prd_modal_select'),
  toast: $('toast_message')
};

document.addEventListener('DOMContentLoaded', initOutput);

function initOutput() {
  outputElements.repoBadge.textContent = `vercel_blob · ${OUTPUT_CONFIG.storage.baseUrl}`;
  applyOutputLayout();
  bindOutputEvents();
  refreshOutputData();
}

function applyOutputLayout() {
  document.documentElement.style.setProperty('--output_section1_width', outputState.widths.section1);
}

function bindOutputEvents() {
  outputElements.serviceMenu.addEventListener('click', () => { window.location.href = './index.html'; });
  outputElements.refreshAll.addEventListener('click', refreshOutputData);
  outputElements.search.addEventListener('input', renderApprovedPrdList);
  outputElements.generate.addEventListener('click', () => requestOutputGenerate(outputState.selectedOutputType));
  outputElements.secondaryButtons.forEach((button) => {
    button.addEventListener('click', () => requestOutputGenerate(button.dataset.outputType));
  });
  outputElements.modeButtons.forEach((button) => {
    button.addEventListener('click', () => selectOutputType(button.dataset.outputType));
  });
  outputElements.copyScenario.addEventListener('click', () => copyToClipboard(outputElements.scenarioRaw.value));
  outputElements.downloadScenario.addEventListener('click', () => downloadText('service-scenario.md', outputElements.scenarioRaw.value, 'text/markdown;charset=utf-8'));
  outputElements.generationModalOpen.addEventListener('click', () => outputElements.generationModal.showModal());
  outputElements.generationModalClose.addEventListener('click', () => outputElements.generationModal.close());
  outputElements.resultModalClose.addEventListener('click', () => outputElements.resultModal.close());
  outputElements.resultModalCopy.addEventListener('click', () => copyToClipboard(outputElements.resultModalBody.textContent));
  outputElements.prdDetailModalClose.addEventListener('click', () => outputElements.prdDetailModal.close());
  outputElements.prdDetailModalSelect.addEventListener('click', () => {
    if (outputState.prdDetailTarget) {
      selectApprovedPrd(outputState.prdDetailTarget.path);
    }
    outputElements.prdDetailModal.close();
  });

  $$('.section2_viewer_tab').forEach((button) => {
    button.addEventListener('click', () => {
      outputState.rawMode = button.dataset.view === 'raw';
      $$('.section2_viewer_tab').forEach((item) => item.classList.remove('is_active'));
      button.classList.add('is_active');
      outputElements.scenarioPreview.classList.toggle('is_hidden', outputState.rawMode);
      outputElements.scenarioRaw.classList.toggle('is_hidden', !outputState.rawMode);
    });
  });

  $$('.header_column_switch').forEach((button) => {
    button.addEventListener('click', () => toggleColumn(button.dataset.toggleCol));
  });
  $$('[data-close-col]').forEach((button) => button.addEventListener('click', () => closeColumn(button.dataset.closeCol)));
  $$('[data-reopen-col]').forEach((button) => button.addEventListener('click', () => openColumn(button.dataset.reopenCol)));
  $$('.output_content .common_resizer').forEach((resizer) => {
    resizer.addEventListener('pointerdown', startOutputResize);
  });
}

async function refreshOutputData() {
  showToast('Agent2 데이터를 불러오는 중입니다.');
  await Promise.allSettled([refreshApprovedPrds(), refreshOutputPrompts()]);
  showToast('Agent2 화면 갱신 완료');
}

async function fetchBlobFolder(folder) {
  const response = await fetch(`/api/blob-list?folder=${encodeURIComponent(folder)}&limit=1000`);
  if (!response.ok) throw new Error(`/${folder} 목록 조회 실패`);
  const data = await response.json();
  if (data.success === false) throw new Error(data.message || `/${folder} 목록 조회 실패`);
  return normalizeFileList(data.files || [], folder);
}

async function fetchBlobText(path) {
  if (path.startsWith('sample/')) {
    const file = OUTPUT_CONFIG.fallbackPrds.find((item) => item.path === path);
    return file?.content || '';
  }
  const response = await fetch(`/api/blob-file?path=${encodeURIComponent(path)}`);
  if (!response.ok) throw new Error(`${path} 파일 조회 실패`);
  const data = await response.json();
  return data.content || data.text || '';
}

function normalizeFileList(files, folder) {
  return files.map((item) => ({
    name: item.name || String(item.path || '').split('/').pop(),
    path: item.path || item.pathname || `${folder}/${item.name}`,
    size: item.size || 0,
    uploadedAt: item.uploadedAt || '',
    registeredAtLabel: item.uploadedAt ? new Date(item.uploadedAt).toLocaleString() : '등록일 확인 필요'
  })).sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)));
}

async function refreshApprovedPrds() {
  try {
    outputState.approvedPrds = await fetchBlobFolder(OUTPUT_CONFIG.storage.folders.approvedPrd);
  } catch (error) {
    outputState.approvedPrds = OUTPUT_CONFIG.fallbackPrds;
    showToast('승인 PRD API가 없어 샘플 데이터로 화면을 표시합니다.');
  }
  renderApprovedPrdList();
}

async function refreshOutputPrompts() {
  const promptFolders = OUTPUT_CONFIG.storage.folders.prompts;
  const fallbackPrompts = getFallbackPromptsByType();

  const entries = [
    ['service_scenario', promptFolders.scenario],
    ['service_policy', promptFolders.policy],
    ['ia', promptFolders.ia],
    ['service_diagram', promptFolders.diagram]
  ];

  const results = await Promise.allSettled(
    entries.map(async ([type, folder]) => [type, await fetchBlobFolder(folder)])
  );

  outputState.prompts = results.reduce((acc, result, index) => {
    const type = entries[index][0];
    acc[type] = result.status === 'fulfilled' && result.value[1].length
      ? result.value[1]
      : fallbackPrompts[type];
    return acc;
  }, {});

  renderAllPromptOptions();
}

function getFallbackPromptsByType() {
  return {
    service_scenario: [
      {
        name: '서비스 시나리오 기본 프롬프트',
        path: 'prompts/output/scenario/scenario-prompt-v1.md'
      }
    ],
    service_policy: [
      {
        name: '서비스 정책서 기본 프롬프트',
        path: 'prompts/output/policy/policy-prompt-v1.md'
      }
    ],
    ia: [
      {
        name: '서비스 IA 기본 프롬프트',
        path: 'prompts/output/ia/ia-prompt-v1.md'
      }
    ],
    service_diagram: [
      {
        name: 'Draw.io 다이어그램 기본 프롬프트',
        path: 'prompts/output/diagram/drawio-diagram-prompt-v1.md'
      }
    ]
  };
}

function getPromptSelectForType(type) {
  return {
    service_scenario: outputElements.promptTemplate,
    service_policy: outputElements.policyPromptTemplate,
    ia: outputElements.iaPromptTemplate,
    service_diagram: outputElements.diagramPromptTemplate
  }[type];
}

function renderPromptOptions(type) {
  const list = outputState.prompts[type] || [];
  const select = getPromptSelectForType(type);
  if (!select) return;
  select.innerHTML = list
    .map((item) => `<option value="${escapeHtml(item.path)}">${escapeHtml(item.name)}</option>`)
    .join('') || '<option value="">프롬프트 없음</option>';
}

function renderAllPromptOptions() {
  ['service_scenario', 'service_policy', 'ia', 'service_diagram'].forEach(renderPromptOptions);
}

function renderApprovedPrdList() {
  const keyword = outputElements.search.value.trim().toLowerCase();
  const files = outputState.approvedPrds.filter((file) => !keyword || file.name.toLowerCase().includes(keyword) || file.path.toLowerCase().includes(keyword));
  outputElements.prdCount.textContent = String(files.length);
  outputElements.prdList.innerHTML = files.length ? files.map((file) => `
    <article class="section1_req_item ${outputState.selectedPrd?.path === file.path ? 'is_selected' : ''}">
      <div class="section1_req_main">
        <div class="section1_req_title_row">
          <button class="section1_req_title_button" type="button" data-prd-path="${escapeHtml(file.path)}">${escapeHtml(file.name)}</button>
          <button class="common_small_button output_prd_detail_button" type="button" data-prd-detail-path="${escapeHtml(file.path)}">상세</button>
        </div>
        <div class="section1_req_meta">
          <em class="common_badge DIRECT">APPROVED</em>
          <span>${escapeHtml(file.registeredAtLabel)}</span>
        </div>
      </div>
    </article>
  `).join('') : '<div class="common_empty">승인된 PRD 문서가 없습니다.</div>';
  $$('[data-prd-path]', outputElements.prdList).forEach((button) => button.addEventListener('click', () => selectApprovedPrd(button.dataset.prdPath)));
  $$('[data-prd-detail-path]', outputElements.prdList).forEach((button) => button.addEventListener('click', () => openApprovedPrdDetail(button.dataset.prdDetailPath)));
}

function selectApprovedPrd(path) {
  outputState.selectedPrd = outputState.approvedPrds.find((file) => file.path === path);
  outputElements.selectedStatus.textContent = '생성 준비 완료';
  outputElements.selectedStatus.className = 'is_ready';
  outputElements.selectedHint.textContent = '선택된 승인 PRD를 기준으로 산출물을 생성합니다.';
  outputElements.selectedSummary.innerHTML = `
    <article class="section2_summary_item">
      <div>
        <strong>${escapeHtml(outputState.selectedPrd.name)}</strong>
        <span>${escapeHtml(outputState.selectedPrd.path)}</span>
      </div>
      <em class="common_badge DIRECT">APPROVED</em>
      <small>${escapeHtml(outputState.selectedPrd.registeredAtLabel)}</small>
      <button type="button" class="section2_selected_remove" data-selected-prd-detail="${escapeHtml(outputState.selectedPrd.path)}" title="상세 보기">보기</button>
    </article>
  `;
  outputElements.generate.disabled = false;
  $$('[data-selected-prd-detail]', outputElements.selectedSummary).forEach((button) => {
    button.addEventListener('click', () => openApprovedPrdDetail(button.dataset.selectedPrdDetail));
  });
  renderApprovedPrdList();
}

async function openApprovedPrdDetail(path) {
  const file = outputState.approvedPrds.find((item) => item.path === path);
  if (!file) return;

  outputState.prdDetailTarget = file;
  outputElements.prdDetailModalTitle.textContent = file.name;
  outputElements.prdDetailModalMeta.innerHTML = `
    <div>경로: <b>${escapeHtml(file.path)}</b></div>
    <div>승인 상태: APPROVED · 등록일: ${escapeHtml(file.registeredAtLabel)}</div>
  `;
  outputElements.prdDetailModalBody.textContent = '불러오는 중...';
  outputElements.prdDetailModal.showModal();

  try {
    outputElements.prdDetailModalBody.textContent = await fetchBlobText(file.path);
  } catch (error) {
    outputElements.prdDetailModalBody.textContent = `오류: ${error.message}`;
  }
}

function selectOutputType(type) {
  if (type !== 'service_scenario' && !outputState.scenario) {
    showToast('서비스 시나리오 생성 후 후속 산출물을 만들 수 있습니다.');
    return;
  }
  outputState.selectedOutputType = type;
  outputElements.modeButtons.forEach((button) => button.classList.toggle('is_active', button.dataset.outputType === type));
  outputElements.generate.textContent = `▶ ${getOutputTypeLabel(type)} 생성`;
  renderPromptOptions(type);
}

async function requestOutputGenerate(type) {
  if (!outputState.selectedPrd) { showToast('승인 PRD를 먼저 선택해주세요.'); return; }
  if (type !== 'service_scenario' && !outputState.scenario) { showToast('서비스 시나리오를 먼저 생성해주세요.'); return; }

  outputState.selectedOutputType = type;
  startGenerationStatus(`${getOutputTypeLabel(type)} 생성 중`);

  try {
    const prdMarkdown = await fetchBlobText(outputState.selectedPrd.path);
    const promptTemplate = getPromptSelectForType(type)?.value || '';
    const payload = {
      targetOutputType: type,
      sourcePrdPath: outputState.selectedPrd.path,
      serviceScenarioPath: outputState.scenario?.path || '',
      serviceType: 'global_b2c_web_promotion',
      targetRegions: getSelectedRegions(),
      supportedLanguages: ['ko', 'en', 'ja'],
      outputLanguage: 'ko',
      promptTemplate,
      promptTemplateType: type,
      promptTemplateUrl: promptTemplate ? `${OUTPUT_CONFIG.storage.baseUrl}/${promptTemplate}` : '',
      prdMarkdown
    };

    const result = await callOutputGenerate(payload);
    const content = result.content || result.output || result.generatedContent || createSampleOutput(type);
    completeGenerationStatus(`${getOutputTypeLabel(type)} 생성 완료`);

    if (type === 'service_scenario') {
      outputState.scenario = { content, path: result.path || '' };
      outputElements.scenarioRaw.value = content;
      outputElements.scenarioPreview.innerHTML = simpleMarkdown(content);
      enableSecondaryOutputs();
    } else {
      outputState.generated[type] = { content, path: result.path || '', url: result.url || '' };
      openResultModal(type, content, result);
    }
  } catch (error) {
    const content = createSampleOutput(type);
    completeGenerationStatus(`${getOutputTypeLabel(type)} 샘플 표시`);
    showToast(`생성 API 미연결: 샘플 산출물을 표시합니다.`);
    if (type === 'service_scenario') {
      outputState.scenario = { content, path: '' };
      outputElements.scenarioRaw.value = content;
      outputElements.scenarioPreview.innerHTML = simpleMarkdown(content);
      enableSecondaryOutputs();
    } else {
      openResultModal(type, content, { path: 'local-preview' });
    }
  }
}

async function callOutputGenerate(payload) {
  const response = await fetch(OUTPUT_CONFIG.webhooks.outputGenerate, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function enableSecondaryOutputs() {
  outputElements.secondaryButtons.forEach((button) => { button.disabled = false; });
}

function getSelectedRegions() {
  return ['KR', 'US-CA', 'EU', 'UK', 'JP'];
}

function getOutputTypeLabel(type) {
  return {
    service_scenario: '서비스 시나리오',
    service_policy: '서비스 정책서',
    ia: '서비스 IA',
    service_diagram: '서비스 다이어그램'
  }[type] || '산출물';
}

function createSampleOutput(type) {
  if (type === 'service_diagram') {
    return '<mxfile host="app.diagrams.net"><diagram name="Service Diagram"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="start" value="Approved PRD" vertex="1" parent="1"><mxGeometry x="80" y="80" width="140" height="60" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>';
  }
  return [
    `## 1. ${getOutputTypeLabel(type)} 문서 개요`,
    '',
    `- 기준 PRD: ${outputState.selectedPrd?.name || '확인 필요'}`,
    '- 대상 리전: KR, US-CA, EU, UK, JP',
    '- 법무/정책 검토: 리전별 확인 필요',
    '',
    '## 2. 주요 내용',
    '| ID | 항목 | 내용 |',
    '| -- | -- | -- |',
    '| ITEM-001 | 글로벌 공통 | 승인된 PRD를 기준으로 후속 산출물을 생성합니다. |',
    '| ITEM-002 | 리전 정책 | 개인정보, 쿠키, 위치정보, 마케팅 동의 조건을 반영합니다. |',
    '',
    '## 3. Open Questions',
    '| ID | Question | Region | Status |',
    '| -- | -- | -- | -- |',
    '| OQ-001 | 리전별 법무 검토 담당자는 누구인가? | 전체 | 확인 필요 |'
  ].join('\n');
}

function openResultModal(type, content, result = {}) {
  outputElements.resultModalBadge.textContent = type === 'service_diagram' ? 'DRAW.IO' : 'OUTPUT';
  outputElements.resultModalTitle.textContent = `${getOutputTypeLabel(type)} 보기`;
  outputElements.resultModalMeta.innerHTML = `
    <div>경로: <b>${escapeHtml(result.path || 'local-preview')}</b></div>
    <div>형식: ${type === 'service_diagram' ? '.drawio XML' : 'Markdown'}</div>
  `;
  outputElements.resultModalBody.textContent = content;
  outputElements.resultModal.showModal();
}

function startGenerationStatus(title) {
  outputState.generationStartedAt = Date.now();
  clearInterval(outputState.generationTimer);
  outputElements.generationStatus.dataset.status = 'running';
  outputElements.generationTitle.textContent = title;
  outputElements.generationMessage.textContent = 'n8n에서 요청 산출물을 생성하고 있습니다.';
  outputElements.generationMeta.textContent = '요청 처리 중';
  outputElements.generationBar.style.width = '35%';
  outputElements.generationSummary.textContent = title;
  outputElements.generationModal.showModal();
  outputState.generationTimer = setInterval(updateGenerationElapsed, 1000);
  updateGenerationElapsed();
}

function completeGenerationStatus(title) {
  clearInterval(outputState.generationTimer);
  outputElements.generationStatus.dataset.status = 'complete';
  outputElements.generationTitle.textContent = title;
  outputElements.generationMessage.textContent = '산출물 생성 결과를 화면에 반영했습니다.';
  outputElements.generationMeta.textContent = `완료 시각 ${new Date().toLocaleTimeString()}`;
  outputElements.generationBar.style.width = '100%';
  outputElements.generationSummary.textContent = title;
}

function updateGenerationElapsed() {
  const elapsed = Date.now() - (outputState.generationStartedAt || Date.now());
  const sec = Math.floor(elapsed / 1000);
  outputElements.generationElapsed.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

function closeColumn(col) {
  $(`section${col}`)?.classList.add('is_closed');
  outputState.closedCols.add(String(col));
  updateColumnSwitches();
}

function openColumn(col) {
  $(`section${col}`)?.classList.remove('is_closed');
  outputState.closedCols.delete(String(col));
  updateColumnSwitches();
}

function toggleColumn(col) {
  outputState.closedCols.has(String(col)) ? openColumn(col) : closeColumn(col);
}

function updateColumnSwitches() {
  $$('.header_column_switch').forEach((button) => button.classList.toggle('is_active', !outputState.closedCols.has(button.dataset.toggleCol)));
}

let outputResizeState = null;

function startOutputResize(event) {
  event.preventDefault();

  const section1 = $('section1');
  const sectionB = $('section2');
  const content = $('content');

  if (!section1 || !sectionB || !content) return;

  outputResizeState = {
    startX: event.clientX,
    startLeftW: section1.getBoundingClientRect().width,
    startRightW: sectionB.getBoundingClientRect().width,
    totalWidth: content.getBoundingClientRect().width
  };

  document.body.classList.add('is_resizing');
  document.addEventListener('pointermove', onOutputResizeMove);
  document.addEventListener('pointerup', stopOutputResize, { once: true });
}

function onOutputResizeMove(event) {
  if (!outputResizeState) return;

  const { startX, startLeftW, startRightW, totalWidth } = outputResizeState;
  const delta = event.clientX - startX;
  const minLeft = 280;
  const minRight = 620;
  const available = startLeftW + startRightW;
  const nextLeft = Math.max(minLeft, Math.min(startLeftW + delta, available - minRight));
  const nextPct = `${((nextLeft / totalWidth) * 100).toFixed(2)}%`;

  outputState.widths.section1 = nextPct;
  document.documentElement.style.setProperty('--output_section1_width', nextPct);
}

function stopOutputResize() {
  document.body.classList.remove('is_resizing');
  document.removeEventListener('pointermove', onOutputResizeMove);

  if (outputResizeState) {
    localStorage.setItem('agent2_section1_width', outputState.widths.section1);
  }

  outputResizeState = null;
}

function showToast(message) {
  outputElements.toast.textContent = message;
  outputElements.toast.classList.add('is_show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => outputElements.toast.classList.remove('is_show'), 2200);
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text || '');
    showToast('클립보드에 복사되었습니다.');
  } catch {
    showToast('복사에 실패했습니다.');
  }
}

function downloadText(filename, text, type) {
  const blob = new Blob([text || ''], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function simpleMarkdown(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');
  let html = '';
  let inTable = false;
  lines.forEach((line) => {
    if (/^##\s+/.test(line)) html += `<h3>${escapeHtml(line.replace(/^##\s+/, ''))}</h3>`;
    else if (/^#\s+/.test(line)) html += `<h2>${escapeHtml(line.replace(/^#\s+/, ''))}</h2>`;
    else if (/^\|.*\|$/.test(line)) {
      if (/^\|\s*-/.test(line)) return;
      const cells = line.replace(/^\||\|$/g, '').split('|').map((cell) => `<td>${escapeHtml(cell.trim())}</td>`).join('');
      if (!inTable) { html += '<table><tbody>'; inTable = true; }
      html += `<tr>${cells}</tr>`;
    } else {
      if (inTable) { html += '</tbody></table>'; inTable = false; }
      if (/^-\s+/.test(line)) html += `<p>• ${escapeHtml(line.replace(/^-\s+/, ''))}</p>`;
      else if (line.trim()) html += `<p>${escapeHtml(line)}</p>`;
    }
  });
  if (inTable) html += '</tbody></table>';
  return html;
}
