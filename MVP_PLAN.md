# StyleFit MVP 구현 계획 및 이슈 정리

## MVP 목표 플로우 (현재 설계 기준)

```text
사용자 진입
→ 익명 쿠키 발급 (없는 경우)
→ 상품 선택
→ DB에서 (쿠키 + 상품 타입)으로 기존 분석 결과 조회
  ├── 없음: 사진 업로드 → 사진 검증 → AI 분석 모듈 호출 → 결과를 DB에 저장
  └── 있음: DB에서 결과 조회 → AI 분석 모듈에 기존 데이터 전달
→ AI 리포트 이미지 생성 모듈 호출
→ 클라이언트에 이미지 반환
```

---

## 잠재적 문제점

### 1. 플로우 분기 불완전 — "있는 경우" 경로가 미정의

현재 설계에서 DB 결과가 있는 경우 "DB에서 데이터를 가져와 AI 모듈 호출"까지는 있지만,
그 이후 이미지 생성 → 클라이언트 반환이 동일하게 적용되는지 명시되어 있지 않습니다.

**권장:** 두 경로 모두 이미지 생성 → 반환을 공통으로 타도록 명시적으로 통합해야 합니다.

---

### 2. AI 모듈이 두 번 호출되는 구조 — 실패 지점이 두 곳

step 2에서 "분석 AI 모듈", step 4에서 "리포트 이미지 생성 AI 모듈"로 총 두 번 호출합니다.
step 3에서 분석 결과를 DB에 저장했지만 step 4 이미지 생성이 실패하면,
DB에는 분석 결과가 있는데 사용자는 결과를 받지 못하는 중간 상태가 됩니다.

**권장:** DB 저장 후 이미지 생성 실패 시 재시도 정책을 명확히 정의해야 합니다.
(예: DB 결과가 있으면 항상 이미지 생성을 재시도할 수 있도록 처리)

---

### 3. 동시 요청 경쟁 조건 (Race Condition)

같은 쿠키로 두 요청이 동시에 들어오면 둘 다 DB에서 결과를 찾지 못하고,
두 요청 모두 AI 모듈을 호출한 뒤 DB에 중복 저장을 시도할 수 있습니다.

**권장:** DB에 (쿠키 + 상품 타입)에 UNIQUE 제약 조건을 걸거나,
처리 시작 시 `status = PROCESSING` 상태를 먼저 INSERT하는 낙관적 잠금 방식을 사용해야 합니다.

---

### 4. 사진 업로드 시점이 불명확

현재 설계에서 "상품 선택 → DB 확인 → 없으면 사진 검증" 흐름인데,
DB 결과가 있는 경우 사용자가 사진을 업로드할 필요가 없습니다.
이 분기를 프론트엔드가 어떻게 처리할지 명확히 정의가 필요합니다.

**권장:**
- DB 결과 없음: 클라이언트에 "사진 업로드 필요" 응답 → 업로드 후 분석 진행
- DB 결과 있음: 바로 이미지 생성 요청 진행 (사진 업로드 불필요)

이를 위해 분석 요청 API를 단일 엔드포인트로 처리하기보다 단계를 나누는 것이 좋습니다.

---

### 5. 익명 쿠키의 신뢰성

익명 쿠키는 사용자가 브라우저 쿠키를 직접 삭제하거나 다른 브라우저를 사용하면 그대로 사라집니다.
이 경우 DB에 분석 결과가 있어도 해당 사용자가 다시 조회할 방법이 없습니다.

**권장:**
- 쿠키 만료 정책을 명시적으로 설정해야 합니다 (예: 30일 HttpOnly Secure 쿠키).
- 장기적으로 로그인 기능 도입 시 기존 익명 결과와 연동하는 마이그레이션 전략이 필요합니다.

---

### 6. 사진 원본 저장 여부 미결정

분석에 사용한 사진을 어디에 얼마나 보관할지 정해지지 않았습니다.
AI 재분석이나 고객 문의 대응을 위해 보관이 필요할 수 있지만, 개인정보 처리 방침과 충돌할 수 있습니다.

**권장:** 사진 보관 여부와 보관 기간을 서비스 정책으로 먼저 결정해야 합니다.

---

### 7. AI 모듈 응답 지연 처리 없음

Python AI 분석은 수초~수십 초가 걸릴 수 있습니다.
현재 설계는 동기 HTTP 요청으로, 클라이언트가 응답을 기다리는 동안 연결이 끊길 수 있습니다.

**권장 (단기):** Spring `RestClient` timeout을 명시적으로 설정하고 클라이언트에 로딩 UX를 제공합니다.
**권장 (중기):** 요청 접수 → job ID 반환 → 클라이언트가 폴링하는 비동기 구조로 전환합니다.

---

## 구현이 필요한 항목

### 인프라

| 항목 | 설명 |
|------|------|
| DB (PostgreSQL 권장) | 분석 결과 저장용 |
| Object Storage | 리포트 이미지 저장 (S3 / MinIO) |
| Python AI 서버 | 분석 + 이미지 생성 모듈 |

---

### 백엔드 구현

#### 1. 익명 쿠키 발급 필터
- `OncePerRequestFilter` 구현
- 요청에 쿠키가 없으면 UUID 기반 쿠키를 자동 발급
- `HttpOnly`, `SameSite=Strict`, 만료기간 설정 (예: 30일)
- 경로: `com.stylefit.auth.AnonymousCookieFilter`

#### 2. DB 스키마

```sql
-- 익명 사용자
anonymous_user
  id UUID PRIMARY KEY
  created_at TIMESTAMP

-- 분석 요청
analysis_request
  id UUID PRIMARY KEY
  cookie_id UUID REFERENCES anonymous_user(id)
  product_type VARCHAR(50)
  status VARCHAR(20)  -- PROCESSING, COMPLETED, FAILED
  created_at TIMESTAMP
  updated_at TIMESTAMP
  UNIQUE (cookie_id, product_type)

-- 분석 결과
analysis_result
  id UUID PRIMARY KEY
  analysis_request_id UUID REFERENCES analysis_request(id)
  result_json JSONB
  created_at TIMESTAMP
```

#### 3. 분석 요청 API

```
POST /api/analysis/start
  Body: productType

응답 A (DB 결과 없음):
  { "status": "PHOTO_REQUIRED" }

응답 B (DB 결과 있음):
  { "status": "PROCESSING", "jobId": "..." }
```

```
POST /api/analysis/submit-photo
  Body: productType, file (multipart)

동작:
  1. 쿠키에서 userId 추출
  2. 사진 검증 (기존 PhotoValidationService 재사용)
  3. DB에 analysis_request PROCESSING 상태로 INSERT
  4. Python 분석 AI 호출
  5. analysis_result 저장, 상태 COMPLETED
  6. 이미지 생성 AI 호출
  7. 이미지를 Object Storage 업로드
  8. imageUrl 반환
```

```
GET /api/analysis/result?productType=...

동작:
  1. DB에서 COMPLETED 결과 확인 → 있으면 이미지 재생성
  2. 없으면 404
```

#### 4. Python AI 서버 연동 클라이언트
- `RestClient` 기반 HTTP 클라이언트
- 설정: `stylefit.ai.base-url`, `stylefit.ai.timeout-seconds`
- 경로: `com.stylefit.ai.AiClient`

#### 5. Object Storage 연동 (이미지 저장)
- AWS S3 SDK 또는 MinIO Java SDK
- 업로드/presigned URL 생성 유틸
- 경로: `com.stylefit.storage.ImageStorageService`

---

### 프론트엔드 협의 필요 사항

| 항목 | 내용 |
|------|------|
| 분석 결과 폴링 방식 | 동기 대기 vs 폴링 (비동기 흐름 도입 시) |
| 사진 업로드 타이밍 | DB 결과 없음 응답 후 업로드 화면 표시 |
| 로딩 UX | AI 처리 중 사용자에게 보여줄 인터랙션 |
| 쿠키 안내 | 쿠키 삭제 시 결과 재조회 불가 안내 필요 여부 |
| 에러 처리 | 사진 검증 실패, AI 실패, 타임아웃 등 각각의 에러 메시지 |

---

### 로그인 도입 이후 (Post-MVP)

| 항목 | 내용 |
|------|------|
| 카카오 로그인 / JWT | 기존 설계에 포함된 방향 |
| 익명 → 회원 마이그레이션 | 로그인 시 기존 쿠키 기반 분석 결과를 회원 계정에 연결 |
| 관리자 인증 | `/admin/**` 경로에 별도 인증 추가 |
| 결제/구매 연동 | `purchase` / `order` 도메인 추가 |

---

## 우선순위 추천 순서

1. 익명 쿠키 발급 필터
2. DB 스키마 + JPA 엔티티 (PostgreSQL)
3. `POST /api/analysis/start` + `POST /api/analysis/submit-photo` 스켈레톤
4. Python AI 서버 연동 클라이언트 (mock 응답으로 먼저 통합)
5. Object Storage 연동
6. 실제 Python AI 모듈 연결
