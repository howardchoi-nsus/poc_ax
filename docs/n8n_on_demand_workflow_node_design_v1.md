# n8n 요청별 산출물 생성 Node 구성 v1.0

## 1. 목적

이 문서는 PRD를 기준으로 사용자가 요청한 산출물 1개만 생성하는 n8n Workflow 구성을 정의합니다.

지원 산출물:

| 요청값 `targetOutputType` | 생성 산출물 | 기본 저장 경로 |
| --- | --- | --- |
| `service_scenario` | 서비스 시나리오 | `scenario/SCN_{sourcePrdName}_{timestamp}.md` |
| `service_policy` | 서비스 정책서 | `policy/POL_{sourcePrdName}_{timestamp}.md` |
| `service_diagram` | 서비스 다이어그램 | `diagram/DGM_{sourcePrdName}_{timestamp}.drawio` |
| `ia` | IA | `ia/IA_{sourcePrdName}_{timestamp}.md` |

기존 4개 일괄 생성 구조와 달리, 이 구조는 요청 Payload의 `targetOutputType`에 따라 필요한 생성 노드만 실행합니다.

## 2. draw.io 사용 기준

앞으로 Workflow 구조도와 서비스 다이어그램은 Mermaid가 아니라 draw.io 기준으로 작성합니다.

권장 방식:

| 방식 | 설명 | 권장도 |
| --- | --- | --- |
| `.drawio` XML 파일 생성 | n8n 또는 LLM이 draw.io XML을 생성하고 Blob/GitHub에 저장 | 높음 |
| draw.io용 Node/Edge 표 생성 | 표를 기준으로 사람이 draw.io에서 구성 | 중간 |
| diagrams.net URL로 열기 | 저장된 `.drawio` 파일 URL을 사용자가 diagrams.net에서 열기 | 중간 |
| draw.io 직접 API 제어 | 일반적인 REST API 형태의 직접 생성/수정 자동화는 제한적 | 낮음 |

직접 연동에 대한 결론:

draw.io(diagrams.net)는 `.drawio` XML 파일을 열고 편집하는 방식에 강합니다. 따라서 n8n에서 직접 draw.io 화면을 조작하기보다는, n8n이 `.drawio` XML 파일을 생성해 Blob, GitHub, Google Drive 등에 저장하고 사용자가 draw.io에서 여는 방식이 가장 안정적입니다. GitHub/Google Drive 같은 저장소 연동은 draw.io 앱 쪽에서 지원할 수 있으므로, 저장 위치를 그쪽으로 잡으면 사실상 연동형 운영이 가능합니다.

## 3. 전체 Node 구성

아래 표는 draw.io에서 구성할 때 사용할 수 있는 Node/Edge 설계표입니다.

### 3.1 Node 목록

| Node ID | Node Name | n8n Node Type | 역할 | 주요 입력 | 주요 출력 |
| --- | --- | --- | --- | --- | --- |
| N01 | Webhook Trigger | Webhook | 산출물 생성 요청 수신 | HTTP POST body | request body |
| N02 | Validate Input | Code | 필수값 검증, 기본값 설정 | request body | normalized payload |
| N03 | Fetch PRD Markdown | HTTP Request | PRD Markdown 조회 | `sourcePrdPath` | `prdMarkdown` |
| N04 | Load Region Policy Matrix | Code 또는 HTTP Request | 리전별 법령/정책 매트릭스 구성 | `targetRegions` | `regionPolicyMatrix` |
| N05 | Build Common Payload | Code | 공통 LLM 입력 Payload 구성 | PRD, 리전 정책 | common payload |
| N06 | Switch Output Type | Switch | 요청 산출물별 분기 | `targetOutputType` | selected branch |
| N07 | Generate Service Scenario | LLM | 서비스 시나리오 생성 | scenario prompt | Markdown |
| N08 | Generate Service Policy | LLM | 서비스 정책서 생성 | policy prompt | Markdown |
| N09 | Generate Service Diagram Drawio | LLM | draw.io XML 다이어그램 생성 | diagram prompt | draw.io XML |
| N10 | Resolve IA Dependencies | Code + optional HTTP | IA 생성용 시나리오/정책 입력 보강 | optional paths | enriched payload |
| N11 | Generate IA | LLM | IA 생성 | IA prompt | Markdown |
| N12 | Normalize Output | Code | 산출물 타입별 저장 경로/확장자/Content-Type 구성 | generated text/XML | save payload |
| N13 | Save Output to Blob | HTTP Request | 산출물 1개 저장 | save payload | blob result |
| N14 | Optional Save to GitHub | GitHub Node 또는 HTTP | 선택적으로 GitHub 저장 | save payload | GitHub result |
| N15 | Build Response | Code | 최종 응답 구성 | save result | response JSON |
| N16 | Respond to Webhook | Respond to Webhook | 호출자에게 결과 반환 | response JSON | HTTP response |

### 3.2 Edge 목록

| Edge ID | From | To | 조건 |
| --- | --- | --- | --- |
| E01 | N01 | N02 | Always |
| E02 | N02 | N03 | Input valid |
| E03 | N03 | N04 | PRD fetch success |
| E04 | N04 | N05 | Policy matrix ready |
| E05 | N05 | N06 | Payload ready |
| E06 | N06 | N07 | `targetOutputType = service_scenario` |
| E07 | N06 | N08 | `targetOutputType = service_policy` |
| E08 | N06 | N09 | `targetOutputType = service_diagram` |
| E09 | N06 | N10 | `targetOutputType = ia` |
| E10 | N10 | N11 | IA dependency payload ready |
| E11 | N07 | N12 | Scenario generated |
| E12 | N08 | N12 | Policy generated |
| E13 | N09 | N12 | Drawio XML generated |
| E14 | N11 | N12 | IA generated |
| E15 | N12 | N13 | Blob save enabled |
| E16 | N12 | N14 | GitHub save enabled |
| E17 | N13 | N15 | Save complete |
| E18 | N14 | N15 | Optional save complete |
| E19 | N15 | N16 | Response ready |

## 4. Webhook 입력 Payload

### 4.1 서비스 시나리오 생성 요청

```json
{
  "targetOutputType": "service_scenario",
  "sourcePrdPath": "prd/PRD_REQ_coupon_admin_20260611_20260617_184726.md",
  "serviceType": "global_b2c_web_promotion",
  "targetRegions": ["KR", "US-CA", "EU", "UK", "JP"],
  "supportedLanguages": ["ko", "en", "ja"],
  "outputLanguage": "ko",
  "documentVersion": "1.0"
}
```

### 4.2 서비스 정책서 생성 요청

```json
{
  "targetOutputType": "service_policy",
  "sourcePrdPath": "prd/PRD_REQ_coupon_admin_20260611_20260617_184726.md",
  "serviceType": "global_b2c_web_promotion",
  "targetRegions": ["KR", "US-CA", "EU", "UK", "JP"],
  "supportedLanguages": ["ko", "en", "ja"],
  "outputLanguage": "ko",
  "businessPolicyOverrides": {
    "promotionAbusePrevention": "중복 참여, 자동화 트래픽, 비정상 공유 이벤트는 제한한다."
  }
}
```

### 4.3 서비스 다이어그램 생성 요청

```json
{
  "targetOutputType": "service_diagram",
  "sourcePrdPath": "prd/PRD_REQ_coupon_admin_20260611_20260617_184726.md",
  "serviceType": "global_b2c_web_promotion",
  "targetRegions": ["KR", "US-CA", "EU", "UK", "JP"],
  "supportedLanguages": ["ko", "en"],
  "outputLanguage": "ko",
  "diagramFormat": "drawio_xml"
}
```

### 4.4 IA 생성 요청

IA는 PRD만으로도 생성할 수 있지만, 기존 생성된 시나리오/정책서를 함께 넣으면 품질이 좋아집니다.

```json
{
  "targetOutputType": "ia",
  "sourcePrdPath": "prd/PRD_REQ_coupon_admin_20260611_20260617_184726.md",
  "serviceScenarioPath": "scenario/SCN_PRD_REQ_coupon_admin_20260611_20260617_184726_20260622T030000.md",
  "servicePolicyPath": "policy/POL_PRD_REQ_coupon_admin_20260611_20260617_184726_20260622T031000.md",
  "serviceType": "global_b2c_web_promotion",
  "targetRegions": ["KR", "US-CA", "EU", "UK", "JP"],
  "supportedLanguages": ["ko", "en", "ja"],
  "outputLanguage": "ko"
}
```

## 5. Node 상세

## 5.1 N01. Webhook Trigger

| 항목 | 값 |
| --- | --- |
| Node Type | Webhook |
| Method | POST |
| Path | `agent2-output-generate` |
| Response Mode | Respond to Webhook Node |

## 5.2 N02. Validate Input

| 항목 | 값 |
| --- | --- |
| Node Type | Code |
| 목적 | `targetOutputType` 기준 필수값 검증 |

Code:

```javascript
const body = $json.body || $json;

const allowedTypes = ['service_scenario', 'service_policy', 'service_diagram', 'ia'];
const required = ['targetOutputType', 'sourcePrdPath', 'serviceType', 'targetRegions', 'supportedLanguages', 'outputLanguage'];
const missing = required.filter((key) => body[key] === undefined || body[key] === null || body[key] === '');

if (missing.length) {
  throw new Error(`Missing required fields: ${missing.join(', ')}`);
}

if (!allowedTypes.includes(body.targetOutputType)) {
  throw new Error(`Invalid targetOutputType: ${body.targetOutputType}`);
}

const sourcePrdName = body.sourcePrdName || String(body.sourcePrdPath).split('/').pop().replace(/\.md$/i, '');
const now = new Date();
const timestamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '');

return [
  {
    json: {
      ...body,
      sourcePrdName,
      generatedDate: body.generatedDate || now.toISOString().slice(0, 10),
      timestamp,
      documentVersion: body.documentVersion || '1.0',
      saveTargets: {
        blob: body.saveTargets?.blob !== false,
        github: body.saveTargets?.github === true
      }
    }
  }
];
```

## 5.3 N03. Fetch PRD Markdown

| 항목 | 값 |
| --- | --- |
| Node Type | HTTP Request |
| Method | GET |
| URL | `{{$env.APP_BASE_URL}}/api/blob-file?path={{encodeURIComponent($json.sourcePrdPath)}}` |

PRD가 GitHub에만 있는 경우:

```text
{{$env.APP_BASE_URL}}/api/github-file?path={{encodeURIComponent($json.sourcePrdPath)}}
```

## 5.4 N04. Load Region Policy Matrix

| 항목 | 값 |
| --- | --- |
| Node Type | Code 또는 HTTP Request |
| 목적 | `targetRegions`에 해당하는 정책만 추출 |

운영 초기에는 Code 노드에 정책 매트릭스를 넣고, 이후에는 Google Sheets, Notion DB, Blob JSON, GitHub JSON 중 하나로 분리합니다.

## 5.5 N05. Build Common Payload

| 항목 | 값 |
| --- | --- |
| Node Type | Code |
| 목적 | 모든 생성 노드가 사용할 공통 Payload 구성 |

Code:

```javascript
const input = $('Validate Input').first().json;
const prdResult = $('Fetch PRD Markdown').first().json;
const policyResult = $('Load Region Policy Matrix').first().json;

return [
  {
    json: {
      ...input,
      prdMarkdown: prdResult.content || prdResult.text || '',
      regionPolicyMatrix: policyResult.regionPolicyMatrix || [],
      businessPolicyOverrides: input.businessPolicyOverrides || {}
    }
  }
];
```

## 5.6 N06. Switch Output Type

| 항목 | 값 |
| --- | --- |
| Node Type | Switch |
| Value to check | `{{$json.targetOutputType}}` |

분기:

| Case | Value | Next Node |
| --- | --- | --- |
| 1 | `service_scenario` | N07 |
| 2 | `service_policy` | N08 |
| 3 | `service_diagram` | N09 |
| 4 | `ia` | N10 |

## 5.7 N07. Generate Service Scenario

| 항목 | 값 |
| --- | --- |
| Node Type | OpenAI Chat Model 또는 HTTP Request |
| Prompt Source | `docs/n8n_prompt_service_scenario_v1.md` |
| Output Key | `generatedContent` |

## 5.8 N08. Generate Service Policy

| 항목 | 값 |
| --- | --- |
| Node Type | OpenAI Chat Model 또는 HTTP Request |
| Prompt Source | `docs/n8n_prompt_service_policy_v1.md` |
| Output Key | `generatedContent` |

## 5.9 N09. Generate Service Diagram Drawio

| 항목 | 값 |
| --- | --- |
| Node Type | OpenAI Chat Model 또는 HTTP Request |
| Prompt Source | `docs/n8n_prompt_service_diagram_drawio_v1.md` |
| Output Key | `generatedContent` |
| Output Format | draw.io XML |

중요:

서비스 다이어그램은 Markdown이 아니라 `.drawio` XML로 생성합니다. 저장 시 Content-Type은 `application/xml; charset=utf-8`을 사용합니다.

## 5.10 N10. Resolve IA Dependencies

| 항목 | 값 |
| --- | --- |
| Node Type | Code + HTTP Request |
| 목적 | IA 생성 전에 기존 시나리오/정책서가 있으면 조회 |

입력에 `serviceScenarioPath`, `servicePolicyPath`가 있으면 `/api/blob-file`로 각각 조회합니다. 없으면 빈 문자열로 진행합니다.

## 5.11 N11. Generate IA

| 항목 | 값 |
| --- | --- |
| Node Type | OpenAI Chat Model 또는 HTTP Request |
| Prompt Source | `docs/n8n_prompt_ia_v1.md` |
| Output Key | `generatedContent` |

## 5.12 N12. Normalize Output

| 항목 | 값 |
| --- | --- |
| Node Type | Code |
| 목적 | 산출물 타입별 저장 경로, 파일 확장자, Content-Type 생성 |

Code:

```javascript
const base = $('Build Common Payload').first().json;
const generatedContent = $json.generatedContent || $json.output_text || $json.text || $json.message?.content || $json.choices?.[0]?.message?.content || '';

const config = {
  service_scenario: {
    prefix: 'scenario',
    code: 'SCN',
    extension: 'md',
    contentType: 'text/markdown; charset=utf-8'
  },
  service_policy: {
    prefix: 'policy',
    code: 'POL',
    extension: 'md',
    contentType: 'text/markdown; charset=utf-8'
  },
  service_diagram: {
    prefix: 'diagram',
    code: 'DGM',
    extension: 'drawio',
    contentType: 'application/xml; charset=utf-8'
  },
  ia: {
    prefix: 'ia',
    code: 'IA',
    extension: 'md',
    contentType: 'text/markdown; charset=utf-8'
  }
};

const selected = config[base.targetOutputType];
const path = `${selected.prefix}/${selected.code}_${base.sourcePrdName}_${base.timestamp}.${selected.extension}`;

return [
  {
    json: {
      targetOutputType: base.targetOutputType,
      path,
      content: generatedContent,
      contentType: selected.contentType,
      access: 'private',
      metadata: {
        sourcePrdPath: base.sourcePrdPath,
        sourcePrdName: base.sourcePrdName,
        targetRegions: base.targetRegions,
        supportedLanguages: base.supportedLanguages,
        generatedDate: base.generatedDate,
        documentVersion: base.documentVersion
      }
    }
  }
];
```

## 5.13 N13. Save Output to Blob

| 항목 | 값 |
| --- | --- |
| Node Type | HTTP Request |
| Method | POST |
| URL | `{{$env.APP_BASE_URL}}/api/blob-save` |

Body:

```json
{
  "path": "={{$json.path}}",
  "content": "={{$json.content}}",
  "contentType": "={{$json.contentType}}",
  "access": "={{$json.access}}",
  "metadata": "={{$json.metadata}}"
}
```

## 5.14 N14. Optional Save to GitHub

현재 프로젝트의 `api/github-file.js`는 읽기 전용입니다. GitHub 저장을 하려면 아래 중 하나가 필요합니다.

| 방식 | 설명 |
| --- | --- |
| n8n GitHub Node | Create or Update File 기능 사용 |
| 신규 Vercel API | `api/github-save.js`를 추가해 GitHub Contents API로 저장 |

## 5.15 N15. Build Response

| 항목 | 값 |
| --- | --- |
| Node Type | Code |
| 목적 | 생성된 단일 산출물 정보를 응답으로 구성 |

Code:

```javascript
const result = $json;

return [
  {
    json: {
      success: true,
      targetOutputType: result.targetOutputType,
      path: result.pathname || result.path,
      url: result.url || null,
      downloadUrl: result.downloadUrl || null,
      contentType: result.contentType,
      message: 'requested output generated'
    }
  }
];
```

## 5.16 N16. Respond to Webhook

| 항목 | 값 |
| --- | --- |
| Node Type | Respond to Webhook |
| Status Code | 200 |
| Body | `{{$json}}` |

## 6. draw.io 파일 생성 프롬프트 기준

서비스 다이어그램 요청은 `docs/n8n_prompt_service_diagram_drawio_v1.md`를 사용합니다. 이 프롬프트는 Markdown 다이어그램이 아니라 draw.io XML만 출력하도록 구성합니다.

draw.io XML의 기본 조건:

| 조건 | 기준 |
| --- | --- |
| Root | `<mxfile>` |
| Diagram | `<diagram>` |
| Graph Model | `<mxGraphModel>` |
| Cell Root | `<root>` |
| Node Cell | `vertex="1"` |
| Edge Cell | `edge="1"` |
| Geometry | 각 Node에 `x`, `y`, `width`, `height` 포함 |

## 7. 요청별 실행 예시

| 사용자 요청 | `targetOutputType` | 실행되는 생성 노드 |
| --- | --- | --- |
| 서비스 시나리오 생성 | `service_scenario` | N07만 실행 |
| 서비스 정책서 생성 | `service_policy` | N08만 실행 |
| 서비스 다이어그램 생성 | `service_diagram` | N09만 실행 |
| IA 생성 | `ia` | N10 후 N11 실행 |

## 8. 기존 일괄 생성 구조와 차이

| 항목 | 기존 구조 | 요청별 구조 |
| --- | --- | --- |
| 생성 방식 | 4개 산출물 일괄 생성 | 요청 산출물 1개만 생성 |
| n8n 분기 | 병렬 생성 중심 | Switch 분기 중심 |
| 응답 | 4개 결과 목록 | 단일 결과 |
| 저장 | 4개 파일 저장 | 1개 파일 저장 |
| 다이어그램 | Markdown/Mermaid 가능 | draw.io XML 권장 |
| IA 입력 | 시나리오/정책 생성 결과 직접 사용 | 기존 산출물 경로가 있으면 조회 |

## 9. draw.io 직접 연동 옵션

| 옵션 | 구성 | 장점 | 제약 |
| --- | --- | --- | --- |
| Blob에 `.drawio` 저장 | n8n이 XML 생성 후 Blob 저장 | 현재 구조와 가장 잘 맞음 | 사용자가 파일을 열어야 함 |
| GitHub에 `.drawio` 저장 | n8n GitHub Node로 저장 | draw.io의 GitHub 연동과 궁합 좋음 | GitHub 쓰기 권한 필요 |
| Google Drive에 `.drawio` 저장 | n8n Google Drive Node 사용 | 비기술 사용자 공유 쉬움 | Drive 권한/조직 정책 필요 |
| diagrams.net URL로 열기 | 저장 URL을 응답에 포함 | 사용자 진입이 쉬움 | private Blob은 직접 열기 어려울 수 있음 |
| draw.io UI 직접 조작 | Browser 자동화 또는 플러그인 | 완전 자동 편집 가능성 | 안정성 낮고 운영 복잡도 높음 |

권장안:

1차 PoC는 Blob에 `.drawio` XML을 저장합니다. 이후 실제 협업 단계에서는 GitHub 또는 Google Drive 저장을 추가해 draw.io 앱에서 바로 열고 수정하는 흐름으로 확장합니다.

## 10. 관련 파일

| 파일 | 역할 |
| --- | --- |
| `docs/n8n_prompt_service_scenario_v1.md` | 서비스 시나리오 생성 프롬프트 |
| `docs/n8n_prompt_service_policy_v1.md` | 서비스 정책서 생성 프롬프트 |
| `docs/n8n_prompt_service_diagram_drawio_v1.md` | draw.io XML 서비스 다이어그램 생성 프롬프트 |
| `docs/n8n_prompt_ia_v1.md` | IA 생성 프롬프트 |
| `docs/n8n_on_demand_workflow_v1.drawio` | draw.io에서 열 수 있는 요청별 Workflow 구조도 |

