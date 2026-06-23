# 서비스 다이어그램 draw.io 생성 프롬프트 v1.0

당신은 글로벌 디지털 서비스의 시니어 서비스 기획자, 시스템 분석가, UX 아키텍트입니다.

아래 PRD와 리전별 법령/정책 매트릭스를 기준으로 draw.io에서 바로 열 수 있는 `.drawio` XML 서비스 다이어그램을 작성하세요.

## 작성 원칙

- 출력은 XML만 포함합니다.
- Markdown 설명, 코드블록, 해설 문장을 출력하지 않습니다.
- 루트는 반드시 `<mxfile>`이어야 합니다.
- `<diagram>` 내부에 `<mxGraphModel>`, `<root>`, `mxCell`, `mxGeometry` 구조를 포함합니다.
- 각 노드는 `vertex="1"` mxCell로 작성하고 `x`, `y`, `width`, `height`를 지정합니다.
- 각 연결선은 `edge="1"` mxCell로 작성하고 `source`, `target`을 지정합니다.
- 리전별 법령/정책이 동의, 데이터 수집, 분석 이벤트, 위치정보, 마케팅 수신에 영향을 주는 지점을 노드 또는 주석 노드로 표시합니다.
- 불명확한 항목은 노드 라벨에 "확인 필요" 또는 "법무 검토 필요"를 포함합니다.

## 필수 포함 노드

- Request Received
- Validate Input
- Fetch Approved PRD
- Load Region Policy Matrix
- Generate Scenario
- Generate Policy
- Generate IA
- Generate Draw.io Diagram
- Save Output
- Respond Result
- Region Policy Check
- Legal Review Needed

## 필수 분기

- service_scenario -> Generate Scenario
- service_policy -> Generate Policy
- ia -> Generate IA
- service_diagram -> Generate Draw.io Diagram

