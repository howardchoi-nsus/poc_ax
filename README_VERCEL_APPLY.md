# Vercel Agent1 Source Update

## 변경 내용
- Requirement ID 입력값을 키워드/업무명 전용으로 변경
- 파일명 자동 생성: `REQ_[키워드]_YYMMDD_HHMMSS.txt`
- 출처 정보 드롭다운 추가: JIRA / SLACK / 파일업로드 / 직접등록
- 출처 정보 배지 표시 추가: [ File ] / [ JIRA ] / [ Slack ] / [ 직접등록 ]
- 파일업로드 또는 직접등록 선택 시에만 요구사항 원문 입력 가능
- JIRA / SLACK 선택 시 요구사항 원문 입력 비활성화, 출처 상세 정보만 입력 가능
- Source File Path 자동 생성 및 읽기 전용 처리

## 적용 구조
repo-root/
├─ index.html
├─ styles.css
└─ api/
   ├─ github-list.js
   └─ github-file.js
