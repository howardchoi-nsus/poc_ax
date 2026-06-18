# ID / Class 네이밍 규칙

## Prefix

| Prefix | 영역 |
|---|---|
| `header_*` | 헤더 영역 |
| `content` | 전체 컨텐츠 래퍼 |
| `section1_*` | 1컬럼: 요구사항 등록/목록 영역 |
| `section2_*` | 2컬럼: PRD Workspace 영역 |
| `section3_*` | 3컬럼: Phase Output 영역 |
| `common_*` | 여러 영역에서 재사용되는 공통 UI |
| `modal_*` | 상세 모달 |
| `toast_*` | 토스트 메시지 |
| `is_*` | 상태 클래스 |

## 대표 변경 예시

| 기존 | 변경 |
|---|---|
| `app-shell` | `common_app_shell` |
| `app-header` | `header` |
| `header-brand` | `header_brand` |
| `brand-mark` | `header_logo` |
| `workspace` | `content` |
| `column column-1` | `section section1` |
| `column column-2` | `section section2` |
| `column column-3` | `section section3` |
| `source-search` | `section1_search_input` |
| `select-all` | `section1_select_all` |
| `requirement-list` | `section1_requirement_list` |
| `selected-list` | `section1_selected_list` |
| `btn-confirm-selection` | `section1_btn_confirm` |
| `target-count` | `section2_target_count` |
| `selected-summary` | `section2_selected_summary` |
| `prompt-template` | `section2_prompt_template` |
| `btn-generate` | `section2_btn_generate` |
| `prd-preview` | `section2_prd_preview` |
| `prd-raw` | `section2_prd_raw` |
| `phase-content` | `section3_content` |
| `artifact-list` | `section3_artifact_list` |
| `detail-modal` | `modal_detail` |
| `toast` | `toast_message` |
| `hidden` | `is_hidden` |
| `active` | `is_active` |
| `selected` | `is_selected` |
| `closed` | `is_closed` |
