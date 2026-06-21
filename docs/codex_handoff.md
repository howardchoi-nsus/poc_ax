# Codex 작업 인수인계

## 1. 현재 프로젝트 상태

- 프로젝트명: AX 기반 Design-to-Code 자동화 PoC
- 현재 목적: 요구사항 입력부터 PRD 생성/조회까지 이어지는 기획 자동화 PoC 구성
- 현재 브랜치: `main`
- 원격 기준 상태: `origin/main`과 동기화된 상태

## 2. 주요 파일 역할

| 파일/폴더 | 역할 |
| --- | --- |
| `index.html` | 로그인 및 서비스 선택 화면 |
| `prd.html` | PRD 생성 서비스 화면 |
| `asset/js/app.js` | PRD 화면 동작 로직 |
| `asset/css/styles.css` | PRD 화면 스타일 |
| `api/prd-generate.js` | PRD 생성 요청을 n8n Webhook으로 전달하는 API |
| `api/requirement-save.js` | 요구사항 저장 요청을 n8n Webhook으로 전달하는 API |
| `api/blob-list.js` | Vercel Blob 파일 목록 조회 |
| `api/blob-file.js` | Vercel Blob 파일 본문 조회 |
| `api/blob-save.js` | Vercel Blob 파일 저장 |
| `req/` | 요구사항 Markdown 문서 |
| `source/` | 요구사항 원문 텍스트 |
| `prompts/` | PRD 생성 프롬프트 템플릿 |
| `prd/` | 생성된 PRD 문서 |
| `logs/` | 생성 로그 |
| `maps/` | 요구사항-PRD 매핑 산출물 |
| `docs/` | 운영 문서 및 보고 문서 |

## 3. 현재 구현된 주요 기능

- 로그인 화면 구성
  - ID는 자유 입력
  - Password는 `1234`
  - NSUS 로고는 로그인 폼 내부에 배치

- 서비스 선택 화면 구성
  - `PRD` 메뉴는 사용 가능
  - `서비스 시나리오`, `UI 생성`, `코드 생성`, `TC` 메뉴는 준비중 상태

- PRD 서비스 화면 구성
  - 기존 3단 레이아웃 유지
  - 1번 섹션: 요구사항 등록/조회/선택
  - 2번 섹션: PRD 생성 요청 및 생성된 PRD 목록
  - 3번 섹션: PRD Viewer

- PRD 생성 UX 개선
  - n8n 처리 중 생성 상태 표시
  - 경과 시간 표시
  - 진행 바 표시
  - 생성 완료 여부 자동 확인

- 생성 문서 확인 기능
  - 생성된 PRD 선택 시 3번 섹션에서 확인
  - PRD View / Raw Markdown 전환
  - Markdown 다운로드
  - PRD 본문 복사

- 생성 로그 확인 기능
  - 생성 로그는 하단 버튼을 통해 별도 팝업으로 확인

- PRD 피드백/수정 요청 UI
  - 버튼 클릭 시 입력 폼이 열리는 구조
  - 피드백 제출 및 수정 PRD 생성 요청 버튼 구성

- 요구사항 출처 필터 개선
  - 파일명 추론이 아니라 Markdown front matter의 `source_type` 기준으로 분류
  - `DIRECT`는 Jira/Slack 출처가 아닌 직접 입력 또는 출처 불명 요구사항으로 취급

## 4. n8n 연동 검토 내용

- PRD 생성은 웹에서 `/api/prd-generate`로 요청하고, 해당 API가 n8n Webhook으로 전달하는 구조입니다.
- 요구사항 직접 등록은 현재 웹에서 n8n Webhook을 직접 호출하는 흐름이 남아 있어, 추후 `/api/requirement-save` 프록시를 사용하는 구조로 정리할 수 있습니다.
- 파일 요구사항 등록은 `FormData`로 n8n에 직접 업로드하는 방식이라, n8n의 JSON 기반 입력 구조와 정합성 확인이 필요합니다.
- n8n JSON 일부 노드에는 예전 GitHub 기준 필드명(`githubOutputDir`, `githubReqDir`, `githubSourceDir`)이 남아 있어 추후 정리가 필요합니다.
- 로컬 정적 서버에서는 `/api/...` 연동 확인이 제한되므로 Vercel dev 또는 배포 환경에서 end-to-end 검증이 필요합니다.

## 5. 보고 문서

- 1W 진행상황 보고 문서:
  - `docs/weekly_progress_report_1w.md`

보고 문서 작성 기준:

- 작업계획서에 있는 내용은 `작업계획서 일정 대비 진행 상황`에 포함
- 작업계획서에 없는 추가 구현은 `작업 확장 내용`으로 분리
- 전체 계획 완료 기준은 `100%`
- 금일까지 계획 기준 진행률과 실제 작업 진행률을 별도로 표기

## 6. 시연용 요구사항 운영 기준

- 시연용 요구사항은 repo에 커밋하지 않고 웹 화면에서 직접 등록합니다.
- PRD 생성 시연용으로 사용하기 좋은 주제:
  - 지도 기반 매장 선택 및 고객 커뮤니케이션
  - AI 개인 쇼핑 어시스턴트 기반 맞춤 매장/상품 추천
  - 매장/앱 연계 숏폼 콘텐츠와 로열티 쿠폰 캠페인

## 7. 다른 컴퓨터에서 이어서 작업하는 방법

1. GitHub Desktop에서 해당 repo를 열고 `Fetch origin` 또는 `Pull`을 실행합니다.
2. Codex에서 프로젝트 폴더를 엽니다.
3. Codex에게 아래처럼 요청합니다.

```text
docs/codex_handoff.md를 읽고, 이어서 작업해줘.
```

## 8. 다음 작업 후보

1. n8n end-to-end 연동 검증
2. 파일 요구사항 등록 방식 검토
3. PRD 수정 요청 Webhook 연계 확인
4. 서비스 시나리오 메뉴 화면 설계
5. UI 생성, 코드 생성, TC 메뉴별 서비스 흐름 정의
6. Vercel 배포 환경에서 `/api/...` 연동 최종 확인

## 9. 주의사항

- 요구사항 샘플 파일은 직접 등록 방식으로 운영할 예정이므로 커밋하지 않습니다.
- `.DS_Store` 같은 로컬 시스템 파일은 커밋하지 않습니다.
- 기존 작업계획서에 없는 내용은 보고서에서 작업계획 진행률에 섞지 말고 `작업 확장 내용`으로 분리합니다.
