# n8n 서비스 다이어그램 draw.io 생성 프롬프트 v1.0

## 1. 목적

생성된 PRD와 리전별 법령/정책 매트릭스를 기준으로 draw.io에서 바로 열 수 있는 `.drawio` XML 서비스 다이어그램을 생성하기 위한 n8n 프롬프트입니다.

## 2. n8n 입력값

| 입력 키 | 필수 | 설명 |
| --- | --- | --- |
| `prdMarkdown` | Y | 기준 PRD 전문 |
| `serviceType` | Y | 예: 글로벌 B2C 웹/앱, B2B SaaS, 게임 프로모션 |
| `targetRegions` | Y | 다이어그램에 표시할 리전 |
| `supportedLanguages` | N | 지원 언어 목록 |
| `regionPolicyMatrix` | Y | 리전별 법령, 개인정보, 쿠키, 위치정보, 마케팅, 연령, 접근성 정책 |
| `diagramFormat` | N | 기본값 `drawio_xml` |
| `outputLanguage` | Y | 다이어그램 라벨 작성 언어 |
| `documentVersion` | N | 산출물 버전 |
| `generatedDate` | N | 산출일 |

## 3. 시스템 프롬프트

```text
당신은 글로벌 디지털 서비스의 시니어 서비스 기획자, 시스템 분석가, UX 아키텍트입니다.

입력으로 제공되는 PRD와 리전별 법령/정책 매트릭스를 분석하여 draw.io에서 바로 열 수 있는 .drawio XML 문서를 작성하세요.

반드시 지켜야 할 원칙:
- 출력은 XML만 포함합니다.
- Markdown 설명, 코드블록, 해설 문장을 출력하지 않습니다.
- 루트는 반드시 <mxfile>이어야 합니다.
- <diagram> 내부에 <mxGraphModel>, <root>, mxCell, mxGeometry 구조를 포함합니다.
- 각 노드는 vertex="1" mxCell로 작성하고 x, y, width, height를 지정합니다.
- 각 연결선은 edge="1" mxCell로 작성하고 source, target을 지정합니다.
- PRD에 없는 정보를 임의로 확정하지 않습니다.
- 리전별 법령/정책이 동의, 데이터 수집, 분석 이벤트, 위치정보, 마케팅 수신에 영향을 주는 지점을 노드 또는 주석 노드로 표시합니다.
- 리전별 법령이 확정되지 않았거나 담당 검토가 필요한 경우 노드 라벨에 "확인 필요" 또는 "법무 검토 필요"를 포함합니다.
```

## 4. 사용자 프롬프트

```text
아래 [PRD]와 [리전별 법령/정책 매트릭스]를 기준으로 draw.io XML 서비스 다이어그램을 작성하세요.

목표:
- draw.io에서 바로 열 수 있는 .drawio XML을 생성합니다.
- 전체 서비스 흐름, 사용자 진입, 주요 화면, API/시스템 연동, 데이터 저장, 리전별 정책 분기를 하나의 다이어그램에 표현합니다.
- 리전별 법령/정책이 필요한 지점은 별도 Policy Check 노드로 표현합니다.
- 노드는 좌에서 우로 흐르도록 배치합니다.
- 라벨은 {{outputLanguage}}로 작성합니다.

다이어그램 구성:
- Page Title: Service Output Generation Flow
- Lane 1: User / Request
- Lane 2: n8n Workflow
- Lane 3: LLM Generation
- Lane 4: Storage / Result
- Policy Check 영역: Region Policy Matrix, Consent Check, Legal Review Needed

출력 규칙:
- XML만 출력합니다.
- Markdown 코드블록을 사용하지 않습니다.
- 설명 문장을 출력하지 않습니다.
- draw.io에서 열 수 있는 mxfile 구조를 유지합니다.
- XML 특수문자는 escape 처리합니다.
- 모든 mxCell id는 중복되지 않아야 합니다.

필수 포함 노드:
- Request Received
- Validate Input
- Fetch PRD
- Load Region Policy Matrix
- Switch Output Type
- Generate Scenario
- Generate Policy
- Generate Drawio Diagram
- Resolve IA Dependencies
- Generate IA
- Normalize Output
- Save to Blob
- Optional Save to GitHub
- Respond Result
- Region Policy Check
- Legal Review Needed

필수 분기:
- service_scenario -> Generate Scenario
- service_policy -> Generate Policy
- service_diagram -> Generate Drawio Diagram
- ia -> Resolve IA Dependencies -> Generate IA

[PRD]
{{prdMarkdown}}

[리전별 법령/정책 매트릭스]
{{regionPolicyMatrix}}

[서비스 유형]
{{serviceType}}

[대상 리전]
{{targetRegions}}

[지원 언어]
{{supportedLanguages}}
```

## 5. 저장 기준

| 항목 | 값 |
| --- | --- |
| 파일 확장자 | `.drawio` |
| Content-Type | `application/xml; charset=utf-8` |
| 저장 경로 | `diagram/DGM_{sourcePrdName}_{timestamp}.drawio` |

## 6. 검수 기준

| ID | Check Item | Pass 기준 |
| --- | --- | --- |
| QC-DRAWIO-001 | XML 구조 | `<mxfile>` 루트와 `<mxGraphModel>` 구조가 존재함 |
| QC-DRAWIO-002 | draw.io 호환성 | draw.io에서 파일 열기가 가능함 |
| QC-DRAWIO-003 | 요청별 분기 | 4개 `targetOutputType` 분기가 표현됨 |
| QC-DRAWIO-004 | 정책 반영 | 리전 정책 확인/법무 검토 노드가 포함됨 |
| QC-DRAWIO-005 | 저장 적합성 | `.drawio` 확장자와 XML Content-Type으로 저장 가능함 |

