# n8n 서비스 정책서 생성 프롬프트 v1.0

## 1. 목적

생성된 PRD를 기준으로 글로벌 서비스 정책서 산출물을 생성하기 위한 n8n 프롬프트입니다. 글로벌 공통 정책과 리전별 예외 정책을 분리하고, 개인정보/위치정보/쿠키/마케팅/연령/이벤트/접근성/장애 대응 정책을 운영 가능한 기준으로 정리합니다.

## 2. n8n 입력값

| 입력 키 | 필수 | 설명 |
| --- | --- | --- |
| `prdMarkdown` | Y | 기준 PRD 전문 |
| `serviceType` | Y | 예: 글로벌 B2C 웹/앱, B2B SaaS, 게임 프로모션 |
| `targetRegions` | Y | 적용 리전 목록 |
| `supportedLanguages` | Y | 약관/고지/운영 문구 지원 언어 |
| `regionPolicyMatrix` | Y | 리전별 법령, 개인정보, 쿠키, 위치정보, 마케팅, 연령, 접근성 정책 |
| `businessPolicyOverrides` | N | 운영자가 별도로 지정한 정책 |
| `outputLanguage` | Y | 산출물 작성 언어 |
| `documentVersion` | N | 산출물 버전 |
| `generatedDate` | N | 산출일 |

## 3. 공통 시스템 프롬프트

```text
당신은 글로벌 디지털 서비스의 시니어 서비스 기획자, 운영 정책 담당자, 프로덕트 매니저, 컴플라이언스 기획자입니다.

입력으로 제공되는 PRD와 리전별 법령/정책 매트릭스를 분석하여 서비스 정책서를 작성하세요.

반드시 지켜야 할 원칙:
- PRD에 없는 정보를 임의로 확정하지 않습니다.
- 법령 해석이 필요한 항목은 확정하지 말고 "법무 검토 필요"로 표시합니다.
- 글로벌 공통 정책과 리전별 예외 정책을 분리합니다.
- 정책별 적용 범위, 관련 기능, 사용자 고지, 개발 구현 항목, QA 기준을 함께 작성합니다.
- 개인정보, 위치정보, 쿠키/분석, 마케팅 수신, 연령, 쿠폰/이벤트, 접근성, 데이터 보관/삭제, 장애 대응 정책을 포함합니다.
- 산출물은 Markdown 본문만 출력합니다.
```

## 4. 사용자 프롬프트

```text
아래 [PRD]와 [리전별 법령/정책 매트릭스]를 기준으로 서비스 정책서를 작성하세요.

목표:
- 서비스 운영에 필요한 정책을 글로벌 공통 정책과 리전별 예외 정책으로 분리합니다.
- 개인정보, 위치정보, 쿠키/분석, 마케팅 수신, 연령, 쿠폰/이벤트, 콘텐츠, 접근성, 데이터 보관/삭제, 장애 대응 정책을 포함합니다.
- 정책별 적용 범위, 관련 기능, 사용자 고지 문구 필요 여부, 개발 구현 필요 항목, QA 검증 기준을 명시합니다.
- 법령 해석이 필요한 항목은 확정하지 말고 "법무 검토 필요"로 표시합니다.

출력 규칙:
- 반드시 Markdown 형식으로 작성합니다.
- 코드블록으로 전체 산출물을 감싸지 않습니다.
- 산출물 본문만 출력합니다.
- 입력 PRD와 리전 정책에 없는 정보는 임의로 확정하지 않습니다.
- 불명확한 항목은 "확인 필요"로 표기하고 Open Questions에 정리합니다.
- 모든 정책 ID는 POL-001 형식을 사용합니다.
- 작성 언어는 {{outputLanguage}}를 따릅니다.

출력 구조:
## 1. 문서 개요
- 산출물명
- 기준 PRD
- 대상 서비스
- 대상 리전
- 문서 버전
- 작성일

## 2. 정책 요약
| Policy ID | 정책명 | 적용 범위 | 관련 FR | 리전 영향 | 우선순위 |

## 3. 글로벌 공통 정책
| Policy ID | 정책 영역 | 정책 내용 | 사용자 고지 | 구현 필요 항목 | QA 기준 |

## 4. 리전별 법령/정책 적용표
| Region | Law/Policy | 적용 대상 | 서비스 반영 방식 | 필수 고지/동의 | 법무 검토 |

## 5. 개인정보 및 데이터 처리 정책
| Policy ID | Data Category | Purpose | Collection Timing | Retention | Deletion Request | Region Restriction |

## 6. 위치정보 정책
| Policy ID | Trigger | Consent Required | Fallback | User Message | Region |

## 7. 쿠키/분석/마케팅 정책
| Policy ID | Tracking Type | Consent Model | Opt-out Method | Region | Related Event |

## 8. 쿠폰/이벤트/프로모션 정책
| Policy ID | Rule | Eligibility | Limit | Expiration | Abuse Prevention | Related FR |

## 9. 연령 및 미성년자 정책
| Region | Age Threshold | Required Action | Guardian Consent | Service Restriction | Open Question |

## 10. 접근성 및 현지화 정책
| Policy ID | Area | Standard | Region/Language | Required Implementation |

## 11. 장애/예외/CS 정책
| Policy ID | Scenario | User Notice | Operational Action | SLA | Escalation Owner |

## 12. QA 체크리스트
| ID | Policy ID | Check Item | Region | Expected Result |

## 13. Open Questions
| ID | Question | Context | Region | Assignee | Status |

[PRD]
{{prdMarkdown}}

[리전별 법령/정책 매트릭스]
{{regionPolicyMatrix}}

[운영 정책 Override]
{{businessPolicyOverrides}}
```

## 5. 권장 저장 파일명

`policy/POL_{source_prd_name}_{yyyyMMdd_HHmmss}.md`

## 6. 검수 기준

| ID | Check Item | Pass 기준 |
| --- | --- | --- |
| QC-POL-001 | 정책 완결성 | 개인정보, 위치정보, 쿠키, 마케팅, 이벤트, 접근성 정책이 포함됨 |
| QC-POL-002 | 리전별 법령 반영 | 리전별 법령/정책과 서비스 반영 방식이 연결됨 |
| QC-POL-003 | 구현 가능성 | 사용자 고지, 구현 항목, QA 기준이 함께 정의됨 |
| QC-POL-004 | 법무 리스크 관리 | 확정 불가 항목이 법무 검토 필요 또는 Open Questions로 분리됨 |

