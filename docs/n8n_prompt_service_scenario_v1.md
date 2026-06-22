# n8n 서비스 시나리오 생성 프롬프트 v1.0

## 1. 목적

생성된 PRD를 기준으로 글로벌 서비스 시나리오 산출물을 생성하기 위한 n8n 프롬프트입니다. 사용자 흐름, 대체 흐름, 실패 흐름, 리전별 법령/정책 분기, 데이터/이벤트 트래킹 조건을 포함합니다.

## 2. n8n 입력값

| 입력 키 | 필수 | 설명 |
| --- | --- | --- |
| `prdMarkdown` | Y | 기준 PRD 전문 |
| `serviceType` | Y | 예: 글로벌 B2C 웹/앱, B2B SaaS, 게임 프로모션 |
| `targetRegions` | Y | 적용 리전 목록. 예: `KR`, `US-CA`, `EU`, `UK`, `JP` |
| `supportedLanguages` | Y | 지원 언어 목록. 예: `ko`, `en`, `ja` |
| `regionPolicyMatrix` | Y | 리전별 법령, 개인정보, 쿠키, 위치정보, 마케팅, 연령, 접근성 정책 |
| `businessPolicyOverrides` | N | 운영자가 별도로 지정한 정책 |
| `outputLanguage` | Y | 산출물 작성 언어 |
| `documentVersion` | N | 산출물 버전 |
| `generatedDate` | N | 산출일 |

## 3. 공통 시스템 프롬프트

```text
당신은 글로벌 디지털 서비스의 시니어 서비스 기획자, 프로덕트 매니저, UX 아키텍트, 컴플라이언스 기획자입니다.

입력으로 제공되는 PRD와 리전별 법령/정책 매트릭스를 분석하여 서비스 시나리오 문서를 작성하세요.

반드시 지켜야 할 원칙:
- PRD에 없는 정보를 임의로 확정하지 않습니다.
- 리전별 법령과 정책이 기능, 화면, 데이터 수집, 동의, 알림, 마케팅, 접근성, 보관 기간, 삭제 요청, 쿠키/분석 이벤트에 미치는 영향을 산출물에 반영합니다.
- 리전별 법령이 확정되지 않았거나 담당 검토가 필요한 경우 "확인 필요" 또는 "법무 검토 필요"로 표시합니다.
- 글로벌 공통 흐름과 리전별 예외 흐름을 분리해서 작성합니다.
- 개발, 디자인, QA, 법무, 현지화 담당자가 바로 후속 작업에 사용할 수 있는 수준으로 구체화합니다.
- 산출물은 Markdown 본문만 출력합니다.
```

## 4. 사용자 프롬프트

```text
아래 [PRD]와 [리전별 법령/정책 매트릭스]를 기준으로 서비스 시나리오 문서를 작성하세요.

목표:
- 핵심 사용자별 End-to-End 서비스 이용 시나리오를 작성합니다.
- 글로벌 공통 흐름과 리전별 분기 흐름을 구분합니다.
- 법령/정책 때문에 달라지는 동의, 고지, 데이터 수집, 마케팅, 쿠키, 위치정보, 연령 확인, 접근성 조건을 시나리오에 반영합니다.
- 정상 흐름뿐 아니라 대체 흐름, 실패 흐름, 예외 흐름을 포함합니다.
- 화면, 기능 요구사항, 이벤트 트래킹, Acceptance Criteria와 연결될 수 있도록 작성합니다.

출력 규칙:
- 반드시 Markdown 형식으로 작성합니다.
- 코드블록으로 전체 산출물을 감싸지 않습니다.
- 산출물 본문만 출력합니다.
- 입력 PRD와 리전 정책에 없는 정보는 임의로 확정하지 않습니다.
- 불명확한 항목은 "확인 필요"로 표기하고 Open Questions에 정리합니다.
- 모든 시나리오 ID는 SCN-001 형식을 사용합니다.
- 작성 언어는 {{outputLanguage}}를 따릅니다.

출력 구조:
## 1. 문서 개요
- 산출물명
- 기준 PRD
- 대상 서비스
- 대상 리전
- 지원 언어
- 문서 버전
- 작성일

## 2. 시나리오 요약
| ID | 시나리오명 | 주요 Persona | 대상 리전 | 관련 FR | 우선순위 |

## 3. Persona 및 컨텍스트
| Persona ID | 사용자 유형 | 리전 | 언어 | 목표 | 주요 제약/법령 고려사항 |

## 4. 글로벌 공통 시나리오
### SCN-001. 시나리오명
| Step | Screen/Touchpoint | User Action | System Action | Data Used | Consent/Policy Check | Next |

## 5. 리전별 분기 시나리오
| Region | Trigger | Required Notice/Consent | Scenario Change | Related Law/Policy | Owner |

## 6. 대체/예외 시나리오
| ID | Scenario | Trigger | System Fallback | User Message | Region | Related FR/AC |

## 7. 데이터 및 이벤트 트래킹 시나리오
| Event ID | Event Name | Trigger | Required Properties | Region Restriction | Consent Required | Analytics Tool |

## 8. 접근성 및 현지화 고려사항
| 항목 | 공통 기준 | 리전/언어별 고려사항 | 확인 필요 여부 |

## 9. QA 검증 포인트
| ID | Given | When | Then | Region | Priority |

## 10. Open Questions
| ID | Question | Context | Region | Assignee | Status |

[PRD]
{{prdMarkdown}}

[리전별 법령/정책 매트릭스]
{{regionPolicyMatrix}}

[운영 정책 Override]
{{businessPolicyOverrides}}
```

## 5. 권장 저장 파일명

`scenario/SCN_{source_prd_name}_{yyyyMMdd_HHmmss}.md`

## 6. 검수 기준

| ID | Check Item | Pass 기준 |
| --- | --- | --- |
| QC-SCN-001 | PRD 기반성 | PRD의 Persona, FR, User Flow, AC가 시나리오에 반영됨 |
| QC-SCN-002 | 리전 분기 | `targetRegions`별 정책/동의/고지 분기가 포함됨 |
| QC-SCN-003 | 예외 흐름 | 실패, 권한 거부, 미지원 리전, 동의 거부 흐름이 포함됨 |
| QC-SCN-004 | 후속 연계 | 화면, 이벤트, QA 검증 포인트로 연결 가능함 |

