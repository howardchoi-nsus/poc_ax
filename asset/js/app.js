const requirements = [
  {
    id: 'REQ-001',
    source: 'JIRA',
    path: 'JIRA-2041 · 2026. 6. 15.',
    title: '쿠폰 관리 시스템 - 쿠폰 발급 및 금액 한도 제어 기능',
    date: '2026-06-18',
    status: 'PRD 생성완료',
    statusType: 'success',
    body: '관리자는 신규 가입자 대상의 10% 웰컴 쿠폰을 발행할 수 있어야 한다. 단, 부분별한 발행을 막기 위해 1일 전체 쿠폰 발행 한도는 1,000만 원을 초과할 수 없다. 쿠폰의 유효기간은 발급일로부터 즉시 30일이다.'
  },
  {
    id: 'REQ-002',
    source: 'Slack',
    path: '#project-payment · 2026. 6. 16.',
    title: '결제 이벤트 - VIP 혜택 배너 노출 조건 기획',
    date: '2026-06-18',
    status: 'PRD 생성완료',
    statusType: 'success',
    body: '이벤트 기획서 검토해주세요. VIP 사용자가 마이페이지나 결제 완료 페이지에 접근할 때 상위 3% VIP 전용 특별 배너를 크게 보여주고 싶어요. 영화, 아, 고객 혜택으로 조건은 최근 3개월간 누적 결제금액 기준입니다.'
  },
  {
    id: 'REQ-003',
    source: 'File',
    path: 'security_policy_v2.md · 2026. 6. 17.',
    title: '로그인 유지 정책 - 보안 가이드라인 및 예외 처리',
    date: '2026-06-17',
    status: '등록완료',
    statusType: '',
    body: '사용자의 자동 로그인 유지 기간은 최대 14일이다. 단, 금융거래나 개인정보 조회 화면 돌입 시 서비스에 노출될 경우에는 마지막 활성 시점 기준 30분이 지난 후 재로그인 또는 생체인증 세션을 요구해야 한다.'
  },
  {
    id: 'REQ-004',
    source: 'Direct',
    path: '직접 등록 · 2026. 6. 18.',
    title: '[중요도:중] 상시 신규 웰컴 쿠폰 무제한 발급',
    date: '2026-06-17',
    status: '등록완료',
    statusType: '',
    body: '신규 가입 유저를 극대화하기 위해, 신규 유저가 가입할 때마다 즉시 10% 웰컴 쿠폰을 어떠한 전체 한도 제한 없이 실시간 무제한 발급받을 수 있어야 하며, 쿠폰의 사용 한도 역시 상황 조정되어야 한다.'
  },
  {
    id: 'REQ-005',
    source: 'JIRA',
    path: 'REQ_login_security_260617_150000',
    title: '로그인 보안 강화',
    date: '2026-06-17',
    status: '오류',
    statusType: 'error',
    body: '비정상 로그인 감지 시 이메일 및 Slack 알림을 동시에 발송하고, 관리자 승인 전까지 계정 권한을 제한한다.'
  }
];

const colConfig = {
  1: { min: 300, max: 660, basis: 32 },
  2: { min: 440, max: 960, basis: 34 },
  3: { min: 320, max: 680, basis: 34 }
};

const state = {
  filter: 'all',
  query: '',
  selectedIds: new Set(),
  activeDetailId: null,
  generated: false,
  step: 1,
  view: 'preview',
  closed: new Set(JSON.parse(localStorage.getItem('closedColumns') || '[]')),
  widths: JSON.parse(localStorage.getItem('columnWidths') || '{}')
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

function sourceClass(source) {
  return `badge ${source}`;
}

function getFilteredRequirements() {
  const query = state.query.toLowerCase();
  return requirements.filter((item) => {
    const filterOk = state.filter === 'all' || item.source === state.filter;
    const queryOk = !query || [item.id, item.source, item.title, item.path, item.body]
      .join(' ')
      .toLowerCase()
      .includes(query);
    return filterOk && queryOk;
  });
}

function renderRequirements() {
  const list = $('#requirement-list');
  const filtered = getFilteredRequirements();
  $('#source-count').textContent = `${requirements.length}건`;
  $('#total-count').textContent = String(filtered.length);

  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state"><p>검색 결과가 없습니다.</p></div>';
    updateSelectionUI();
    return;
  }

  list.innerHTML = filtered.map((item) => {
    const checked = state.selectedIds.has(item.id) ? 'checked' : '';
    const selected = state.selectedIds.has(item.id) ? 'selected' : '';
    const statusClass = item.statusType ? `status-badge ${item.statusType}` : 'status-badge';
    return `
      <article class="req-item ${selected}" data-req-id="${item.id}">
        <input type="checkbox" class="req-check" ${checked} aria-label="${escapeHtml(item.title)} 선택" />
        <div class="req-main">
          <span class="badge-id">${item.id}</span>
          <button class="open-detail" type="button">${escapeHtml(item.title)}</button>
          <div class="req-meta">
            <span class="${sourceClass(item.source)}">${item.source}</span>
            <span>${escapeHtml(item.path)}</span>
          </div>
          <p class="req-snippet">${escapeHtml(item.body)}</p>
        </div>
        <span class="${statusClass}">${escapeHtml(item.status)}</span>
      </article>
    `;
  }).join('');

  $$('.req-item', list).forEach((node) => {
    const id = node.dataset.reqId;
    $('.req-check', node).addEventListener('change', (event) => {
      if (event.target.checked) state.selectedIds.add(id);
      else state.selectedIds.delete(id);
      renderRequirements();
    });
    $('.open-detail', node).addEventListener('click', () => openDetail(id));
  });

  const allVisibleSelected = filtered.length > 0 && filtered.every((item) => state.selectedIds.has(item.id));
  $('#select-all').checked = allVisibleSelected;
  updateSelectionUI();
}

function updateSelectionUI() {
  const selected = requirements.filter((item) => state.selectedIds.has(item.id));
  const count = selected.length;
  $('#selected-count').textContent = String(count);
  $('#selected-count-mini').textContent = String(count);
  $('#target-count').textContent = `${count}개`;
  $('#btn-confirm-selection').disabled = count === 0;
  $('#btn-generate').disabled = count === 0;

  $('#selected-list').innerHTML = count
    ? selected.map((item) => `
      <div class="selected-pill">
        <span><span class="${sourceClass(item.source)}">${item.source}</span> ${escapeHtml(item.title)}</span>
        <button type="button" data-remove-id="${item.id}">×</button>
      </div>
    `).join('')
    : '<p class="muted">선택된 요구사항이 없습니다.</p>';

  $$('[data-remove-id]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedIds.delete(button.dataset.removeId);
      renderRequirements();
    });
  });

  $('#selected-summary').innerHTML = count
    ? `<div class="summary-tags">${selected.map((item) => `<span class="summary-tag"><span class="${sourceClass(item.source)}">${item.source}</span> ${escapeHtml(item.title)}</span>`).join('')}</div>`
    : '좌측 패널에서 기획 요건을 선택하면 이곳에 로드 및 실시간 상충 분석이 기동됩니다.';
}

function openDetail(id) {
  const item = requirements.find((req) => req.id === id);
  if (!item) return;
  state.activeDetailId = id;
  $('#modal-badge').className = sourceClass(item.source);
  $('#modal-badge').textContent = item.source;
  $('#modal-title').textContent = item.title;
  $('#modal-meta').innerHTML = `
    <strong>Requirement ID:</strong> ${item.id}<br />
    <strong>Source Detail:</strong> ${escapeHtml(item.path)}<br />
    <strong>등록일:</strong> ${item.date}<br />
    <strong>상태:</strong> ${item.status}
  `;
  $('#modal-body').textContent = item.body;
  $('#detail-modal').showModal();
}

function generatePrdMarkdown() {
  const selected = requirements.filter((item) => state.selectedIds.has(item.id));
  const title = $('#doc-title').value.trim() || '쿠폰 관리자 기능 개선';
  const conflict = selected.some((item) => item.id === 'REQ-001') && selected.some((item) => item.id === 'REQ-004');
  return `# PRD: ${title}\n\n## 1. 개요\n본 문서는 선택된 ${selected.length}개 요구사항을 기반으로 자동 작성된 PRD 초안입니다.\n\n## 2. 배경 및 목적\n운영 정책과 사용자 혜택 요구사항을 통합하여 일관된 쿠폰/혜택 관리 기능을 제공하는 것을 목표로 합니다.\n\n## 3. 사용된 요구사항\n${selected.map((item) => `- ${item.id}: ${item.title}`).join('\n')}\n\n## 4. 주요 요구사항\n- 쿠폰 생성/수정/삭제 기능\n- 쿠폰 발행 이력 조회 기능\n- 조건별 쿠폰 정책 설정 기능\n- VIP 조건 기반 배너 노출 정책\n\n## 5. 충돌 검토\n${conflict ? '- 확인 필요: REQ-001은 1일 발행 한도 1,000만 원을 정의하지만, REQ-004는 무제한 발급을 요구합니다. 운영 정책 기준의 우선순위 결정이 필요합니다.' : '- 충돌 없음'}\n\n## 6. 성공 기준\n- 관리자가 쿠폰 정책을 등록하고 저장할 수 있다.\n- 발급 한도, 유효기간, 노출 조건이 정책에 따라 정상 반영된다.\n- 생성 이력과 오류 로그를 추적할 수 있다.\n`;
}

function markdownToHtml(markdown) {
  return markdown
    .split('\n')
    .map((line) => {
      if (line.startsWith('# ')) return `<h3>${escapeHtml(line.replace('# ', ''))}</h3>`;
      if (line.startsWith('## ')) return `<h4>${escapeHtml(line.replace('## ', ''))}</h4>`;
      if (line.startsWith('- ')) return `<li>${escapeHtml(line.replace('- ', ''))}</li>`;
      if (!line.trim()) return '';
      return `<p>${escapeHtml(line)}</p>`;
    })
    .join('');
}

function generatePrd() {
  const markdown = generatePrdMarkdown();
  state.generated = true;
  state.step = 6;
  $('#prd-raw').value = markdown;
  $('#prd-preview').innerHTML = markdownToHtml(markdown);
  $('#phase-empty').classList.add('hidden');
  $('#phase-content').classList.remove('hidden');
  renderSteps();
  renderLog();
  showToast('PRD 문서를 생성했습니다.');
}

function renderSteps() {
  $$('.step').forEach((step, index) => {
    step.classList.toggle('done', index + 1 < state.step);
    step.classList.toggle('active', index + 1 === state.step);
  });
}

function renderLog() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  $('#generation-log').innerHTML = `
    <tr>
      <td>2026-06-18 ${hh}:${mm}</td>
      <td>howard.choi</td>
      <td>${state.selectedIds.size}</td>
      <td>${$('#prompt-template').value}</td>
      <td>${$('#model-select').value}</td>
      <td><span class="status-badge success">성공</span></td>
      <td>/prd/PRD_coupon_admin_260618.md</td>
    </tr>
  `;
}

function applyColumnState() {
  [1, 2, 3].forEach((col) => {
    const column = $(`[data-col="${col}"]`);
    const headerCol = $(`[data-header-col="${col}"]`);
    const toggle = $(`[data-toggle-col="${col}"]`);
    const closed = state.closed.has(String(col));
    column.classList.toggle('closed', closed);
    headerCol.classList.toggle('hidden', closed);
    toggle.classList.toggle('active', !closed);
    if (state.widths[col]) {
      column.style.flexBasis = `${state.widths[col]}px`;
    }
  });

  $$('.column').forEach((node) => node.classList.remove('expander'));
  const openColumns = [1, 2, 3].map((col) => $(`[data-col="${col}"]`)).filter((node) => !node.classList.contains('closed'));
  if (openColumns.length) openColumns[0].classList.add('expander');

  const col1Closed = state.closed.has('1');
  const col2Closed = state.closed.has('2');
  const col3Closed = state.closed.has('3');
  $('[data-resizer="1"]').classList.toggle('hidden', col1Closed || col2Closed);
  $('[data-resizer="2"]').classList.toggle('hidden', col2Closed || col3Closed);

  localStorage.setItem('closedColumns', JSON.stringify([...state.closed]));
}

function setPreset(preset) {
  const workspaceWidth = $('#workspace').clientWidth - 16;
  const ratioMap = {
    balanced: [1, 1, 1],
    focus: [1, 2, 1],
    prd: [0.85, 1.75, 0.9],
    spec: [0.85, 1.05, 1.55]
  };
  const ratios = ratioMap[preset] || ratioMap.balanced;
  const sum = ratios.reduce((a, b) => a + b, 0);
  [1, 2, 3].forEach((col, i) => {
    const px = Math.round(workspaceWidth * ratios[i] / sum);
    state.widths[col] = clamp(px, colConfig[col].min, colConfig[col].max);
    $(`[data-col="${col}"]`).style.flexBasis = `${state.widths[col]}px`;
  });
  localStorage.setItem('columnWidths', JSON.stringify(state.widths));
  $$('.preset').forEach((button) => button.classList.toggle('active', button.dataset.preset === preset));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function initResizers() {
  $$('.resizer').forEach((resizer) => {
    resizer.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      const idx = Number(resizer.dataset.resizer);
      const leftCol = $(`[data-col="${idx}"]`);
      const rightCol = $(`[data-col="${idx + 1}"]`);
      if (!leftCol || !rightCol || leftCol.classList.contains('closed') || rightCol.classList.contains('closed')) return;

      const startX = event.clientX;
      const leftStart = leftCol.getBoundingClientRect().width;
      const rightStart = rightCol.getBoundingClientRect().width;
      document.body.classList.add('resizing');
      resizer.setPointerCapture(event.pointerId);

      const move = (moveEvent) => {
        const delta = moveEvent.clientX - startX;
        const leftWidth = clamp(leftStart + delta, colConfig[idx].min, colConfig[idx].max);
        const rightWidth = clamp(rightStart - delta, colConfig[idx + 1].min, colConfig[idx + 1].max);
        leftCol.style.flexBasis = `${leftWidth}px`;
        rightCol.style.flexBasis = `${rightWidth}px`;
        state.widths[idx] = leftWidth;
        state.widths[idx + 1] = rightWidth;
      };

      const up = () => {
        document.body.classList.remove('resizing');
        localStorage.setItem('columnWidths', JSON.stringify(state.widths));
        resizer.removeEventListener('pointermove', move);
        resizer.removeEventListener('pointerup', up);
        resizer.removeEventListener('pointercancel', up);
      };

      resizer.addEventListener('pointermove', move);
      resizer.addEventListener('pointerup', up);
      resizer.addEventListener('pointercancel', up);
    });
  });
}

function bindEvents() {
  $('#source-search').addEventListener('input', (event) => {
    state.query = event.target.value;
    renderRequirements();
  });

  $$('.filter').forEach((button) => {
    button.addEventListener('click', () => {
      state.filter = button.dataset.filter;
      $$('.filter').forEach((node) => node.classList.remove('active'));
      button.classList.add('active');
      renderRequirements();
    });
  });

  $('#select-all').addEventListener('change', (event) => {
    getFilteredRequirements().forEach((item) => {
      if (event.target.checked) state.selectedIds.add(item.id);
      else state.selectedIds.delete(item.id);
    });
    renderRequirements();
  });

  $('#clear-selection').addEventListener('click', () => {
    state.selectedIds.clear();
    renderRequirements();
  });

  $('#modal-select').addEventListener('click', () => {
    if (state.activeDetailId) state.selectedIds.add(state.activeDetailId);
    renderRequirements();
    showToast('요구사항을 선택했습니다.');
  });

  $('#btn-confirm-selection').addEventListener('click', () => {
    state.step = 4;
    renderSteps();
    showToast('선택 완료: 충돌 검토 단계로 이동했습니다.');
  });

  $('#btn-generate').addEventListener('click', generatePrd);

  $('#btn-next-step').addEventListener('click', () => {
    state.step = Math.min(6, state.step + 1);
    renderSteps();
    if (state.step === 5 && state.selectedIds.size) generatePrd();
  });

  $('#btn-copy-prd').addEventListener('click', async () => {
    const value = $('#prd-raw').value;
    if (!value) return showToast('복사할 PRD가 없습니다.');
    await navigator.clipboard.writeText(value);
    showToast('PRD 내용을 복사했습니다.');
  });

  $('#btn-download-prd').addEventListener('click', () => {
    const value = $('#prd-raw').value;
    if (!value) return showToast('다운로드할 PRD가 없습니다.');
    const blob = new Blob([value], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'PRD_coupon_admin_260618.md';
    a.click();
    URL.revokeObjectURL(url);
  });

  $$('.viewer-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      state.view = tab.dataset.view;
      $$('.viewer-tab').forEach((node) => node.classList.remove('active'));
      tab.classList.add('active');
      $('#prd-preview').classList.toggle('hidden', state.view === 'raw');
      $('#prd-raw').classList.toggle('hidden', state.view !== 'raw');
      if (state.view === 'history') {
        $('#prd-preview').classList.remove('hidden');
        $('#prd-raw').classList.add('hidden');
        $('#prd-preview').innerHTML = '<h4>버전 히스토리</h4><p>v1 · 최초 생성 · /prd/PRD_coupon_admin_260618.md</p>';
      } else if (state.view === 'preview' && $('#prd-raw').value) {
        $('#prd-preview').innerHTML = markdownToHtml($('#prd-raw').value);
      }
    });
  });

  $('#btn-feedback').addEventListener('click', () => {
    if (!$('#feedback-input').value.trim()) return showToast('피드백 내용을 입력하세요.');
    showToast('피드백을 저장했습니다.');
  });

  $('#btn-revise-prd').addEventListener('click', () => showToast('수정 PRD 생성 요청을 준비했습니다.'));
  $('#btn-update-prd').addEventListener('click', () => showToast('현재 문서 업데이트 요청을 준비했습니다.'));
  $('#btn-generate-phase').addEventListener('click', () => showToast('Phase 2 산출물 생성을 시작합니다.'));
  $('#btn-file-source').addEventListener('click', () => showToast('파일 등록 모달은 다음 단계에서 연결하면 됩니다.'));
  $('#btn-direct-source').addEventListener('click', () => showToast('직접 등록 모달은 다음 단계에서 연결하면 됩니다.'));

  $$('.switch').forEach((button) => {
    button.addEventListener('click', () => {
      const col = button.dataset.toggleCol;
      if (state.closed.has(col)) state.closed.delete(col);
      else state.closed.add(col);
      if (state.closed.size === 3) state.closed.delete(col);
      applyColumnState();
    });
  });

  $$('.close-col').forEach((button) => {
    button.addEventListener('click', () => {
      const col = button.dataset.closeCol;
      state.closed.add(col);
      if (state.closed.size === 3) state.closed.delete(col);
      applyColumnState();
    });
  });

  $$('.preset').forEach((button) => {
    button.addEventListener('click', () => setPreset(button.dataset.preset));
  });
}

function init() {
  bindEvents();
  initResizers();
  applyColumnState();
  renderRequirements();
  renderSteps();
}

init();
