# StyleFit — 아키텍처 & 시스템 가이드

> 작성일: 2026-05-14
> 대상 독자: 처음 합류하는 개발자 / 기획자 / 운영자 — 이 프로젝트를 처음 보더라도 이 문서 하나로 전체 그림을 그릴 수 있도록 정리했다.

---

## 0. 한 줄 소개

**사용자가 사진 1장을 업로드하면 AI 모듈이 퍼스널 컬러를 진단해 결과 리포트(JSON + 이미지)를 돌려주는 모바일 웹앱.**
별도 회원가입 없이 익명 쿠키 기반으로 동작하며, 한 사용자(쿠키)당 1건만 진단할 수 있고 결과는 친구에게 공유할 수 있다.

---

## 1. 시스템 구성

```
                        ┌─────────────────────────────────────┐
                        │   Linux Server (단일 호스트, 직접 운영) │
                        │                                     │
   ┌───────────┐        │   ┌─────────────────┐               │
   │  사용자    │  HTTPS │   │  Nginx (예정)   │  ──┐          │
   │ (모바일/PC)│ ─────▶ │   │  reverse proxy   │    │         │
   └───────────┘        │   └─────────────────┘    │ 8080    │
                        │                            ▼         │
                        │              ┌──────────────────────┐│
                        │              │ Spring Boot Backend  ││
                        │              │ (StyleFit)           ││
                        │              │  - REST API          ││
                        │              │  - SPA index.html    ││
                        │              │    + Vite 산출물      ││
                        │              │  - 사진 검증(OpenCV)  ││
                        │              │  - 리포트 이미지 캐시 ││
                        │              └──────────────────────┘│
                        │                       │              │
                        │      same-host 다른포트 │   ┌──────────┐│
                        │                       └──▶│ AI 모듈 1  ││
                        │                            │ (분석)    ││
                        │                            └──────────┘│
                        │                            ┌──────────┐│
                        │                            │ AI 모듈 2  ││
                        │                            │ (이미지)  ││
                        │                            └──────────┘│
                        │                       │                │
                        │                       ▼                │
                        │              ┌──────────────────────┐  │
                        │              │ PostgreSQL (직접 운영)│  │
                        │              └──────────────────────┘  │
                        │                                        │
                        │              ./report-images/  (디스크) │
                        └────────────────────────────────────────┘
                                       │
                                       ▼
                              Google Analytics 4 (gtag)
```

- **단일 리눅스 서버**에 Spring Boot + Postgres + AI 모듈을 모두 올린다.
- **AI 모듈**은 같은 도메인 다른 포트로 띄운 별도 프로세스. 백엔드는 HTTP(REST)로 호출한다.
- AI 모듈 호출은 **비동기** 가 목표 — 현재 코드는 동기 호출(`Thread.sleep(15s)` mock)이라 실제 연동 시 콜백/폴링 구조로 전환 필요.
- 사진 raw 데이터는 저장하지 않는다. **리포트 이미지만** `./report-images/<UUID>.png` 형태로 디스크에 보관해 같은 사용자의 재요청에는 AI 호출 없이 디스크 캐시를 재사용한다.
- 운영 환경의 사용자 트래픽은 Nginx 등의 리버스 프록시 뒤에서 받는 것을 권장(현재 미정).

---

## 2. 백엔드 패키지 구조

| 패키지 | 책임 |
|---|---|
| `com.stylefit.analysis` | 진단 도메인. 사진 업로드 → 검증 → AI 호출 → 결과 저장 오케스트레이션 |
| `com.stylefit.vision` | 사진 검증. OpenCV + YuNet ONNX 로 얼굴 탐지·블러·각도·역광·채도 계산 |
| `com.stylefit.auth` | 익명 쿠키(`stylefit_uid`) 발급/조회 필터 |
| `com.stylefit.ban` | 쿠키/IP 기반 차단 목록 + 인터셉터 |
| `com.stylefit.ratelimit` | 일일 호출 한도 (글로벌 + 쿠키 + IP 3중 카운터) |
| `com.stylefit.share` | 결과 공유 토큰 발급/조회/폐기 |
| `com.stylefit.survey` | 리포트 만족도 평가 (별점/성별/코멘트) |
| `com.stylefit.purchase` | 유료 리포트 결제 의향 측정 (MVP — 베타 무료) |
| `com.stylefit.behavior` | 사용자 행동 신호 적재 (스크롤 깊이, 사진 망설임 등) |
| `com.stylefit.product` | 상품 메타 (현재 `PERSONAL_COLOR_DIAGNOSIS` 단일 코드) |
| `com.stylefit.admin` | 어드민 인증(평문 PW + 세션 쿠키) + 통계 API |
| `com.stylefit.config` | SecurityConfig / WebConfig / OriginGuardFilter / SpaController / OpenCvConfig |

---

## 3. DB 스키마

전체 운영 DDL: [src/main/resources/ddl/schema-postgres.sql](src/main/resources/ddl/schema-postgres.sql)
개발용 H2 부트 시 PK 없는 테이블만 [src/main/resources/schema.sql](src/main/resources/schema.sql)에서 별도 생성. 나머지는 JPA `create-drop` 으로 자동 생성된다.

### 3.1 테이블 요약

| 테이블 | PK | 의미 | 한 사용자당 |
|---|---|---|---|
| `analysis_result` | `id` (cookie_id + product_code unique) | 진단 결과 본체 — status / result_json / report_image_path | 1건 |
| `share_token` | `id` (token unique) | 결과 공유 URL 토큰. cookie_id 별 1건 재사용 (revoke 시 새 토큰 발급) | 1건 active |
| `satisfaction_survey` | `cookie_id` | 리포트 만족도 (별점 1~5, 성별, 코멘트 300자) | 1건 |
| `purchase_intent` | `cookie_id` | 결제 의향 (last_choice, dialog_count) | 1건 |
| `user_behavior` | `cookie_id` | 행동 신호 (스크롤/망설임/실패/재방문/사진교체) | 1건 |
| `banned_user` | (PK 없음) | 차단 목록. cookie_id 또는 ip_address 매칭 | 운영자 수동 INSERT |
| `api_call_quota` | `quota_day` | 서버 전체 일일 AI 호출 카운터 | 글로벌 1행/일 |
| `actor_quota` | (scope, actor_key, quota_day) | 쿠키/IP 단위 일일 카운터 (한도 우회 방지) | 사용자 1행/일 |

### 3.2 컬럼별 상세

#### `analysis_result` — 진단 결과 본체

| 컬럼 | 타입 | 제약 | 의미 |
|---|---|---|---|
| `id` | BIGSERIAL | PK | 자동 증가 ID |
| `cookie_id` | VARCHAR(36) | NOT NULL, UNIQUE(+product_code) | 익명 쿠키 UUID. 한 쿠키당 한 상품에 1건만 존재 |
| `product_code` | VARCHAR(50) | NOT NULL, default `'PERSONAL_COLOR_DIAGNOSIS'` | 진단 상품 식별자. 현재 단일 상품 |
| `status` | VARCHAR(20) | CHECK IN (`'PROCESSING'`, `'COMPLETED'`, `'FAILED'`) | 진단 진행 상태. PROCESSING 은 AI 호출 중, FAILED 는 재시도 허용 |
| `result_json` | TEXT/JSONB | NULL 허용 | AI 분석 모듈이 돌려준 JSON 원본 (personalColor / bestColors / clothing 등 그대로) |
| `report_image_path` | VARCHAR(500) | NULL 허용 | `./report-images/<UUID>.<ext>` 의 파일명만. 같은 사용자 재방문 시 외부 다운로드 안 함. NULL 이면 폴백 URL 사용 |
| `last_ip` | VARCHAR(45) | NULL 허용 | 마지막 `submit-photo` 요청의 클라이언트 IP. 어드민 차단 화면에서 cookie↔ip 페어 차단에 사용. IPv4/IPv6 모두 수용 |
| `created_at` | TIMESTAMP | NOT NULL, default NOW() | 최초 진단 시각 |
| `updated_at` | TIMESTAMP | NOT NULL, default NOW() | 트리거로 자동 갱신 — PROCESSING→COMPLETED 등 상태 변경 시각 추적용 |

#### `share_token` — 결과 공유 URL

| 컬럼 | 타입 | 제약 | 의미 |
|---|---|---|---|
| `id` | BIGSERIAL | PK | 자동 증가 ID |
| `token` | VARCHAR(64) | NOT NULL, UNIQUE | URL-safe Base64 16바이트(128bit) 랜덤. `/share/<token>` 경로에 그대로 사용. 추측 불가 |
| `cookie_id` | VARCHAR(36) | NOT NULL | 발행자 쿠키. revoke 시 cookieId 일치 검증에 사용 |
| `analysis_result_id` | BIGINT | NOT NULL, FK→analysis_result(id) ON DELETE CASCADE | 공유 대상 분석 결과 |
| `created_at` | TIMESTAMP | NOT NULL, default NOW() | 발급 시각 |
| `revoked_at` | TIMESTAMP | NULL 허용 | 폐기 시각. NULL = active, 값 있음 = 폐기됨(GET 시 404) |

> 한 사용자가 공유 버튼을 다시 눌러도 기존 active 토큰이 있고 같은 결과를 가리키면 그대로 재사용 → 토큰 폭증 방지.

#### `satisfaction_survey` — 리포트 만족도 평가

| 컬럼 | 타입 | 제약 | 의미 |
|---|---|---|---|
| `cookie_id` | VARCHAR(36) | PK | 한 쿠키당 1건. 재제출은 UPDATE |
| `rating` | SMALLINT | NOT NULL, CHECK 1~5 | 별점 |
| `gender` | VARCHAR(10) | NOT NULL, CHECK IN (`'MALE'`, `'FEMALE'`) | 응답자 성별. 성별별 만족도 분석용 |
| `comment` | VARCHAR(300) | NULL 허용 | 자유 코멘트. 300자 제한 (서비스 레이어 검증) |
| `created_at` / `updated_at` | TIMESTAMP | NOT NULL | 트리거 자동 갱신 |

> 서비스 레이어에서 본인이 `COMPLETED` 진단 결과를 가졌는지 검사 — 결과 없는 사용자는 평가 작성 불가(403).

#### `purchase_intent` — 유료 리포트 결제 의향 (MVP, 베타 무료)

| 컬럼 | 타입 | 제약 | 의미 |
|---|---|---|---|
| `cookie_id` | VARCHAR(36) | PK | 한 쿠키당 1건 |
| `last_choice` | VARCHAR(10) | NOT NULL, default `'NO'`, CHECK IN (`'YES'`,`'NO'`) | 최종 선택. 다이얼로그가 열릴 때마다 NO 로 리셋되고 "예" 클릭 시 YES |
| `dialog_count` | INTEGER | NOT NULL, default 0 | "예 누르기 전까지 몇 번 망설였는가" — YES 누른 후엔 증가 안 함 |
| `created_at` / `updated_at` | TIMESTAMP | NOT NULL | 트리거 자동 갱신 |

#### `user_behavior` — 사용자 행동 신호

| 컬럼 | 타입 | 제약 | 의미 |
|---|---|---|---|
| `cookie_id` | VARCHAR(36) | PK | 한 쿠키당 1행, 새 이벤트는 upsert |
| `max_scroll_section` | VARCHAR(30) | NULL 허용 | 결과 페이지에서 도달한 최대 섹션 이름 (`hero`/`type`/`best_colors`/`worst_colors`/`clothing`/`rules`/`hair_accessories`/`situation`/`shop`/`share`/`survey`/`purchase`) |
| `max_scroll_index` | SMALLINT | NULL 허용 | 섹션 순서 인덱스 0~11. 더 작은 값은 갱신하지 않음(최대 보존) |
| `last_photo_dwell_ms` | INTEGER | NULL 허용 | 마지막 진단의 사진 첨부→"분석 시작" 클릭 사이 ms |
| `failed_attempts` | INTEGER | NOT NULL, default 0 | 누적 검증 실패 횟수 |
| `result_revisit_count` | INTEGER | NOT NULL, default 0 | 결과 페이지 마운트 횟수 |
| `last_photo_replaced` | INTEGER | NOT NULL, default 0 | 마지막 세션의 사진 교체 횟수 |
| `created_at` / `updated_at` | TIMESTAMP | NOT NULL | 트리거 자동 갱신 |

#### `banned_user` — 차단 목록

| 컬럼 | 타입 | 제약 | 의미 |
|---|---|---|---|
| `cookie_id` | VARCHAR(36) | NULL 허용 | 차단할 쿠키 (없으면 IP 만 차단) |
| `ip_address` | VARCHAR(45) | NULL 허용 | IPv4(15) / IPv6(45) 둘 다 수용 |
| `reason` | VARCHAR(200) | NULL 허용 | 운영자 메모 |
| `created_at` | TIMESTAMP | NOT NULL, default NOW() | 추가 시각 |

> PK 없음. 한 사용자에 대해 cookie 와 ip 를 각각의 행으로, 또는 한 행에 둘 다 넣어도 됨. 부분 인덱스(`WHERE ... IS NOT NULL`)로 조회 최적화.

#### `api_call_quota` — 글로벌 일일 AI 호출 카운터

| 컬럼 | 타입 | 제약 | 의미 |
|---|---|---|---|
| `quota_day` | DATE | PK | 날짜. 자정 넘어가면 새 행 자동 생성. 이전 일자는 그대로 남아 히스토리 |
| `call_count` | INTEGER | NOT NULL, default 0, CHECK ≥ 0 | 그 날 누적 AI 호출 횟수. 기본 한도 50 (`stylefit.ratelimit.report-daily`) |
| `updated_at` | TIMESTAMP | NOT NULL | 트리거 자동 갱신 |

#### `actor_quota` — 사용자/IP 단위 일일 카운터 (한도 우회 방지)

| 컬럼 | 타입 | 제약 | 의미 |
|---|---|---|---|
| `scope` | VARCHAR(10) | CHECK IN (`'COOKIE'`,`'IP'`) | 카운터 종류 |
| `actor_key` | VARCHAR(64) | PK 구성 | 쿠키 UUID 또는 IP 문자열 |
| `quota_day` | DATE | PK 구성 | 날짜 |
| `call_count` | INTEGER | NOT NULL, default 0, CHECK ≥ 0 | 그 actor 의 누적 호출 횟수 |
| `updated_at` | TIMESTAMP | NOT NULL | 트리거 자동 갱신 |

> 글로벌 카운터(api_call_quota)와 별도. 한 사용자가 쿠키만 새로 발급해 글로벌 한도를 소진하는 것을 막는 2차 방어선. 기본 한도: 쿠키 5회/일, IP 10회/일.

### 3.3 ER (간략)

```
analysis_result ─┬─< share_token (cookie_id 동일 사용자, FK analysis_result_id)
                 └─ (cookie_id ⤴ 다른 모든 테이블의 식별자 — FK 는 명시하지 않고 코드에서 매칭)
```

쿠키 ID는 익명 UUID라 사용자 PII가 아니다. 그러나 다른 쿠키 데이터와 조합하면 추적 가능하므로 GA 이벤트로는 **절대 보내지 않는다**.

---

## 4. API 엔드포인트

베이스 경로 `/api`. 모든 응답은 JSON. 익명 쿠키가 자동 발급된다.

### 4.1 진단

| Method | Path | 인증 | 설명 | 주요 응답 |
|---|---|---|---|---|
| POST | `/api/analysis/start` | 쿠키 | 본인의 진단 상태 조회. 결과 있으면 그대로 반환 | `status: PHOTO_REQUIRED / PROCESSING / COMPLETED` |
| POST | `/api/analysis/submit-photo` | 쿠키 | 사진 1장(`file` multipart)을 받아 검증→AI→저장 | `status: VALIDATION_FAILED / COMPLETED` |

거부 케이스:
- `403 banned` — BanGuard 차단
- `409 Conflict` — 이미 처리 중
- `429 Too Many` — 글로벌/쿠키/IP 일일 한도 초과 중 하나
- `validationWarnings` — 사진 검증 실패 사유 배열 (얼굴 미검출, 흐림, 측면 회전, 역광 등)

### 4.2 공유

| Method | Path | 인증 | 설명 |
|---|---|---|---|
| POST | `/api/share/create` | 쿠키 | 본인 결과 → 공유 토큰 발급 (기존 active 토큰 재사용) |
| GET | `/api/share/me` | 쿠키 | 본인이 가진 active 토큰 조회 (없으면 token=null) |
| GET | `/api/share/{token}` | 익명 가능 | 공유된 결과 조회. `noindex`/`nofollow` 헤더 포함 |
| DELETE | `/api/share/{token}` | 쿠키 | 본인 토큰 폐기 (revoked_at 채움) |

### 4.3 만족도

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/survey/satisfaction` | 본인 평가 조회 |
| POST | `/api/survey/satisfaction` | 평가 upsert (별점 1~5, 성별, 코멘트 300자 제한) |

**COMPLETED 결과가 없으면 403 반환**.

### 4.4 결제 의향 (MVP — 베타 무료)

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/purchase-intent` | 본인 의향 조회 |
| POST | `/api/purchase-intent/open` | 다이얼로그 노출 시 호출 (dialog_count++) |
| POST | `/api/purchase-intent/yes` | "예" 클릭 시 호출 (last_choice='YES') |

### 4.5 행동 신호

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/user-behavior` | 본인 행동 신호 조회 |
| POST | `/api/user-behavior/scroll` | 결과 페이지 섹션 도달 (max 갱신) |
| POST | `/api/user-behavior/photo-dwell` | 사진 첨부→제출 ms |
| POST | `/api/user-behavior/analysis-failed` | 검증 실패 누적 +1 |
| POST | `/api/user-behavior/result-revisit` | 결과 페이지 진입 +1 |
| POST | `/api/user-behavior/photo-replaced` | 세션 사진 교체 횟수 |

### 4.6 차단 검사

| Method | Path | 설명 |
|---|---|---|
| GET | `/api/ban/check` | 현재 쿠키/IP 차단 여부 — UploadPage 마운트 시 호출 |

### 4.7 어드민 (운영자 전용)

| Method | Path | 설명 |
|---|---|---|
| POST | `/api/admin/login` | body `{password}` → 검증 성공 시 `stylefit_admin` 세션 쿠키 발급 (12시간) |
| POST | `/api/admin/logout` | 세션 무효화 + 쿠키 제거 |
| GET | `/api/admin/me` | 로그인 상태 확인 (인터셉터 통과 = 200) |
| GET | `/api/admin/stats/summary` | 핵심 지표 종합 (진단/만족도/결제의향/행동/공유/차단/한도) |
| GET | `/api/admin/stats/satisfaction` | 만족도 평가 목록 (쿠키 마스킹) |
| GET | `/api/admin/stats/purchase-intent` | 결제 의향 목록 |
| GET | `/api/admin/stats/behavior` | 행동 신호 목록 |
| GET | `/api/admin/stats/banned` | 차단 목록 |
| GET | `/api/admin/stats/shares` | 공유 토큰 목록 (active + revoked) |
| GET | `/api/admin/stats/recent-users` | 최근 활동 사용자 (cookie + lastIp 페어, 차단 여부 포함). query: `limit` (1~500, 기본 100) |
| POST | `/api/admin/ban` | 다중 차단. body `{ items: [{cookieId?, ip?, reason?}, ...] }` — 각 항목 둘 중 하나 필수 |
| DELETE | `/api/admin/ban` | 차단 해제. query `cookieId` / `ip` (둘 다 주면 OR 매칭으로 한 번에 삭제) |

`AdminAuthInterceptor` 가 login/logout 외 모든 요청에 세션 쿠키 검증. 미인증 시 401.

---

## 5. 사용자 데이터 수집 — 무엇을, 어디에, 왜 저장하는가

### 5.1 서버(DB)에 저장

| 데이터 | 어디 | 목적 |
|---|---|---|
| 익명 쿠키 UUID | `analysis_result.cookie_id`, 모든 부가 테이블 | 사용자 식별. 회원가입 없이 같은 사용자의 행동을 묶기 위함 |
| 진단 결과 JSON | `analysis_result.result_json` | 같은 사용자 재방문 시 AI 호출 없이 재사용 |
| 리포트 이미지 (파일) | `./report-images/<UUID>.<ext>` 디스크 | 같은 사용자 재방문 시 외부 다운로드 절감 |
| 만족도 (별점/성별/코멘트) | `satisfaction_survey` | 제품 개선 |
| 결제 의향 (예/아니오/노출 횟수) | `purchase_intent` | MVP 검증 — 유료화 가치 평가 |
| 행동 신호 | `user_behavior` | 스크롤/망설임/실패 등 결제 의향과 상관관계 분석 |
| IP 주소 | `banned_user`, `actor_quota` | 차단 매칭 / 쿠키 우회 방지 |

### 5.2 서버에 **저장하지 않는** 것

- **사용자 사진 raw 데이터** — 메모리에서 검증·AI 전달용으로만 사용하고 즉시 폐기. 디스크/DB에 절대 저장 안 함.
- **EXIF / GPS / 카메라 정보** — OpenCV `imdecode → imencode` 과정에서 자연스럽게 제거된다. 향후 AI 모듈로 사진을 보낼 때도 stripped 버전을 전달.
- **얼굴 임베딩/생체 데이터** — YuNet 출력(bbox, 5점 랜드마크)은 메모리에서만 사용되고 저장하지 않는다.
- **이메일/이름/전화번호** — 로그인이 없어 애초에 수집하지 않는다.

### 5.3 클라이언트(브라우저)에 저장

- `stylefit_uid` 쿠키 — UUID, HttpOnly, SameSite=Strict, Secure(운영), 30일.
- 그 외 로컬스토리지 사용 없음.

---

## 6. 사진 검증 파이프라인

사진을 검증하는 책임은 [PhotoValidationService.java](src/main/java/com/stylefit/vision/PhotoValidationService.java)에 모여 있다. 모든 임계치는 `application.properties` 의 `stylefit.vision.*` 키로 노출되어 운영 중 튜닝 가능.

```
업로드 바이트
  ▼
1) Magic byte 검증              ← JPEG/PNG 외 거부 (확장자 위조 차단)
  ▼
2) OpenCV imdecode              ← 디코드 자체로 EXIF 제거
  ▼
3) 640px 다운스케일 (옵션)
  ▼
4) YuNet 얼굴 탐지
   ├─ 0건       → "얼굴이 보이지 않습니다"
   ├─ 2건 이상  → "한 명만 촬영된 사진"
   └─ 1건 + 너무 작음 → "얼굴이 더 크게 보이도록"
  ▼ (단일 얼굴, 정상 크기)
5) 추가 정확도 검증 (얼굴 ROI 기반)
   ├─ Laplacian variance       → 흐릿한 사진 차단
   ├─ Yaw (코-눈중점 수평거리 / 얼굴너비)  → 측면 회전 차단
   ├─ Pitch (눈→코 / 코→입 비율)         → 상하 기울기 차단
   ├─ 역광 (얼굴평균 / 배경평균 밝기)      → 얼굴만 어두운 사진 차단
   └─ 채도 (얼굴 ROI HSV S 평균)          → 흑백/필터 떡칠 차단
  ▼
6) 전체 밝기 검증              ← 너무 어둡거나 밝은 사진 차단
  ▼
warnings 비어있으면 통과 → AI 호출
```

각 임계치(기본값) — `application.properties` 참고:

| 키 | 기본값 | 의미 |
|---|---|---|
| `min-blur-variance` | 80 | Laplacian variance. 작을수록 흐림 |
| `max-yaw-ratio` | 0.18 | 0.18 이상이면 측면 회전으로 간주 |
| `min-pitch-ratio` / `max-pitch-ratio` | 0.5 / 1.8 | 정면 약 1.0 근처 |
| `max-backlight-ratio` | 0.55 | 얼굴이 배경 평균의 55% 미만으로 어두우면 거부 |
| `min-face-saturation` / `max-face-saturation` | 20 / 180 | 흑백·필터 떡칠 차단 |

---

## 7. AI 모듈 인터페이스 (현재 mock, 향후 연동 가이드)

### 7.1 인터페이스 (정해진 사항)

- **프로토콜**: REST (HTTP)
- **호스트**: 같은 도메인 다른 포트 (예: `http://localhost:5000`, `:5001`)
- **호출 방식**: **비동기** — 백엔드는 요청을 보내고 즉시 응답하지 않을 가능성이 있다.
- **모듈 1 (분석)**: 사진 multipart → JSON 응답
- **모듈 2 (이미지)**: 분석 JSON → 리포트 이미지(URL 또는 바이너리)

### 7.2 현재 mock 상태

[AnalysisService.java](src/main/java/com/stylefit/analysis/AnalysisService.java) 의 `callAiAnalysis()` / `callAiReportGenerator()` 가 고정 JSON + `Thread.sleep(15s)` 로 채워져 있다.
실제 연동 시 다음과 같이 변경:

1. `MockAiClient` / `RealAiClient` 인터페이스 분리 (현재 미적용 — 향후 작업)
2. `Thread.sleep(15s)` 제거
3. **PROCESSING 저장 트랜잭션과 COMPLETED 저장 트랜잭션 분리** — 비동기 호출 중에는 PROCESSING 상태가 실제로 커밋되어 있어야 클라이언트 polling 이 동작
4. 클라이언트 polling 또는 webhook 콜백 구조 도입
5. AI 모듈 호스트:포트를 `stylefit.security.ai-allowed-hosts` 화이트리스트에 추가

### 7.3 SSRF 방어

`downloadAndStoreReportImage` 는 AI 모듈이 반환한 이미지 URL을 fetch 한다. 임의 URL 호출을 막기 위해:
- `http`/`https` 스킴만 허용
- `stylefit.security.ai-allowed-hosts` 화이트리스트에 등록된 host:port만 허용
- HTTP redirect 차단 (`setInstanceFollowRedirects(false)`)

운영 시 반드시 `application-prod.properties` 의 `STYLEFIT_AI_ALLOWED_HOSTS` 환경변수에 AI 모듈 호스트를 등록해야 한다.

---

## 8. 인증 / 세션 / 보안 모델

### 8.1 인증

- **로그인 없음**. `AnonymousCookieFilter` 가 모든 요청에 `stylefit_uid` 쿠키를 자동 발급.
- 쿠키 속성: `HttpOnly`, `Path=/`, `MaxAge=30일`, `SameSite=Strict`, `Secure`(운영 always).
- 한 쿠키 + 한 상품(`PERSONAL_COLOR_DIAGNOSIS`) = 분석 1건 (DB unique 제약).

### 8.2 CORS

- 환경변수 `STYLEFIT_ALLOWED_ORIGINS` 에 콤마 구분으로 운영 도메인 주입.
- 비어 있으면(dev) `setAllowedOriginPatterns("*")` 으로 동작 — Vite 프록시·모바일 동일 Wi-Fi 호환.
- 운영에서는 **반드시 명시적 도메인을 주입**해야 한다.

### 8.3 CSRF

- Spring Security CSRF 토큰은 비활성. STATELESS + 쿠키 인증이라 토큰 관리가 부적합.
- 대신 두 계층 방어:
  - **SameSite=Strict 쿠키** — 외부 사이트에서 쿠키 동반 요청 자체가 가지 않음
  - **`OriginGuardFilter`** — POST/PUT/PATCH/DELETE 요청에 대해 `Origin`/`Referer` 헤더가 허용 도메인과 일치하는지 검증, 불일치 시 403

### 8.4 차단 (Ban)

- 운영자가 `banned_user` 테이블에 cookie_id/ip_address 를 직접 INSERT.
- `BanGuardInterceptor` 가 `/api/analysis/**` 진입 전 검사 → 매칭 시 403.
- IP 추출은 `stylefit.security.trusted-proxies` 에 등록된 프록시에서 온 요청에 한해서만 `X-Forwarded-For` 신뢰. 그 외에는 `request.getRemoteAddr()` 만 사용 → 헤더 위조 차단.

### 8.5 일일 호출 한도 (3중 카운터)

[RateLimitService.tryConsume(cookieId, ip)](src/main/java/com/stylefit/ratelimit/RateLimitService.java) 가 3개를 모두 통과해야 1건 소모:

| 카운터 | 기본값 | 환경변수 | 의도 |
|---|---|---|---|
| 글로벌 (`api_call_quota`) | 50회/일 | `STYLEFIT_RATE_GLOBAL` | 서버 전체 AI 호출 비용 보호 |
| 쿠키 (`actor_quota` scope=COOKIE) | 5회/일 | `STYLEFIT_RATE_COOKIE` | 한 사용자가 글로벌 한도를 다 먹는 것 방지 |
| IP (`actor_quota` scope=IP) | 10회/일 | `STYLEFIT_RATE_IP` | 쿠키 변경으로 우회하는 사용자에 대한 2차 방어선 |

소모 시점: AnalysisService.submitPhoto 에서 **사진 검증 통과 직후, AI 호출 직전**. DB 캐시 재사용/검증 실패/PROCESSING 충돌 케이스는 카운트하지 않음.

### 8.6 파일 업로드

- multipart 크기 제한: 20MB (request 전체 60MB).
- Magic byte 검증으로 JPEG/PNG 외 거부.
- OpenCV `imdecode` 가 EXIF 를 제거 (디코딩 결과 Mat 에 메타데이터 없음).

---

## 9. 프론트엔드 페이지 구조

| 경로 | 컴포넌트 | 역할 |
|---|---|---|
| `/` | `HomePage` | 랜딩. 무료 진단 CTA. dev 빌드에서만 디버그 박스 표시 |
| `/upload` | `UploadPage` | 사진 1장 업로드, 클라이언트 검증, 차단 사용자 가드 |
| `/loading` | `LoadingPage` | 분석 중 3단계 진행 (현재 mock 15초) |
| `/error` | `ErrorPage` | 검증 실패 / 한도 초과 안내 |
| `/result` | `ResultPage` | 본인 진단 결과 + 공유/만족도/결제 의향 |
| `/share/:token` | `SharePage` | 공유받은 결과 + "나도 검사해보기" CTA |
| `/compare/:token` | `ComparePage` | 본인 결과 vs 공유받은 결과 비교 |
| `*` | `NotFoundPage` | 404 |

라우팅은 React Router 7. SPA fallback 은 [SpaController.java](src/main/java/com/stylefit/config/SpaController.java) 가 처리.

디자인은 [PROJECT_STATUS.md](PROJECT_STATUS.md) §3 디자인 시스템 섹션 참고.

---

## 10. Google Analytics 4

GA 이벤트의 전체 목록과 트리거는 [PROJECT_STATUS.md §7.3](PROJECT_STATUS.md#73-커스텀-이벤트) 표가 단일 진실 원천. 새 이벤트를 추가할 때는 그 표도 함께 갱신한다.

### 10.1 어떤 데이터가 GA로 가는가

GA로는 PII가 절대 가지 않는다. 보내는 것은:

- **카테고리값**: `personal_color: '쿨톤 · 윈터 계열'` 같은 라벨, `tone: 'cool'`, `gender: 'MALE'/'FEMALE'`
- **길이값**: `comment_length: 24` (코멘트 원문은 보내지 않음)
- **사유 코드**: `reason: 'validation_failed'` / `'not_found'` / `'network'`
- **위치 식별자**: `location: 'home_hero_cta'` / `'upload_mount'`
- **시간/사이즈 측정값**: `elapsed_ms`, `size_kb`

### 10.2 무엇을 보내지 않는가

- 사진 raw 데이터 (애초에 클라이언트에서 GA로 보낼 수 없지만 명시적으로 금지)
- 얼굴 / 생체 정보
- 만족도 코멘트 원문
- 쿠키 UUID raw 값
- 이메일·이름·전화번호 (수집 자체가 없음)

### 10.3 핵심 퍼널

```
1. page_view (/)
2. page_view (/upload)
3. photo_selected
4. analysis_submitted
5. result_view
6. share_create_click          ← 공유 의향
7. share_view (외부 진입자)     ← 바이럴 진입
8. share_diagnose_click        ← 바이럴 전환 (가장 중요한 지표)
```

---

## 11. 운영 환경 구성 가이드

### 11.1 application-prod.properties 에서 주입할 환경변수

| 환경변수 | 예시 | 의미 |
|---|---|---|
| `STYLEFIT_ALLOWED_ORIGINS` | `https://stylefit.example.com` | CORS 허용 도메인. 비워두면 dev 모드로 떨어짐 |
| `STYLEFIT_TRUSTED_PROXIES` | `127.0.0.1,10.0.0.5` | XFF 헤더를 신뢰할 프록시(Nginx) IP |
| `STYLEFIT_AI_ALLOWED_HOSTS` | `localhost:5000,localhost:5001` | SSRF 화이트리스트 |
| `STYLEFIT_RATE_GLOBAL` | `50` | 글로벌 일일 한도 |
| `STYLEFIT_RATE_COOKIE` | `5` | 쿠키 일일 한도 |
| `STYLEFIT_RATE_IP` | `10` | IP 일일 한도 |
| `STYLEFIT_ADMIN_PASSWORD` | `ddalkkak01!` | 어드민 페이지 로그인 비밀번호. 미주입 시 코드 기본값 사용 |
| `VITE_GA_ID` (프론트 빌드) | `G-XXXXXXXXXX` | GA4 측정 ID |

### 11.2 디스크 자원

- `./report-images/` 디렉터리에 리포트 이미지 누적. 운영에선 영속 볼륨으로 마운트.
- H2 `create-drop` 환경에선 재부팅마다 DB가 초기화되어 orphan 파일이 쌓일 수 있다 — 운영 Postgres 전환 후엔 해소.

### 11.3 H2 콘솔

**운영(`application-prod.properties`)에서 `spring.h2.console.enabled=false` 로 비활성화되어 있다.** dev 프로필에서만 `/h2-console` 노출. 운영 도메인에 이 경로가 절대 응답하면 안 된다.

---

## 12. 미해결 / 향후 작업

### 12.1 이번 보안 라운드에서 의식적으로 미적용한 항목

- **익명 쿠키 HMAC 서명** — 현재 raw UUID. 사용자가 쿠키를 새로 발급해 "한 번 진단" 제약과 차단 정책을 우회할 수 있다. 본질적으로 익명 쿠키의 한계라 차단/한도 정책으로 완화 중 (per-IP rate limit 추가). 강화하려면 `HMAC(secret, uuid)` 형태로 변조 탐지 가능.
- **AI 모듈 `MockAiClient` / `RealAiClient` 인터페이스 분리** — 현재 `AnalysisService` 안에 mock JSON 과 `Thread.sleep(15s)` 가 섞여 있다. 실 AI 연동 시 diff 가 크므로 인터페이스로 분리 후 빈으로 주입하는 게 깔끔하나, 코드 변경 대비 이득이 작아 지금은 보류.
- **공유받은 사람의 차단 검사** — BanGuard 가 `/api/share/**` 에는 적용되지 않아 차단된 사용자도 공유 페이지는 열람 가능. 공유 페이지는 정보 노출이 제한적이라 의도적으로 허용.
- **이미지 perceptual hash 캐싱** — "같은 사진이면 AI 호출 없이 결과 재사용" 목표를 위해 pHash/dHash 도입 가능. 현재는 쿠키 단위로만 캐시. 추후 AI 비용이 실제 부담될 때 도입.

### 12.2 결정 안 된 인프라 항목 — 운영 직전 확정 필요

- **운영 도메인** — `STYLEFIT_ALLOWED_ORIGINS` 에 들어갈 도메인이 아직 미정.
- **리버스 프록시** — Nginx vs Caddy vs 직접 노출 미정. `STYLEFIT_TRUSTED_PROXIES` 에 등록할 프록시 IP 도 그에 따라 결정.
- **AI 모듈 포트** — 분석/이미지 모듈의 포트가 미정. 정해지면 `STYLEFIT_AI_ALLOWED_HOSTS` 에 등록.
- **AI 모듈 비동기 호출 방식** — webhook 콜백 vs 클라이언트 polling. 결정 후 `AnalysisService` 와 PROCESSING 트랜잭션 분리 작업이 함께 진행되어야 한다.
- **카카오페이 결제 게이트웨이 연동** — 베타 종료 후 작업. 현재 결제 의향은 측정만 하고 실제 결제는 일어나지 않는다.

### 12.3 어드민 관련 미적용 / 추후 작업

- **rate limit / 임계치 실시간 조정 UI** — 현재 application.properties 또는 환경변수로만 조정 가능.
- **어드민 비밀번호 평문 보관** — 사용자 요청으로 평문(`ddalkkak01!`) 코드 기본값 + 환경변수 override 형태. 운영 단계에선 환경변수만 사용하고 git에 들어간 기본값은 무력화하는 것이 안전.
- **어드민 계정 다중화 / RBAC** — 현재 단일 비밀번호 1명 운영자. 운영팀 확장 시 사용자별 계정 + 역할 분리 필요.

---

## 13. 어드민 페이지

### 13.1 접근 방법

- URL: `/admin`
- **로그인 비밀번호: `ddalkkak01!`** (평문, application.properties 기본값)
  - 운영에선 환경변수 `STYLEFIT_ADMIN_PASSWORD` 로 override 권장.
- 인증 방식: 비밀번호 검증 성공 시 서버 메모리에 SecureRandom 24바이트 토큰을 보관하고 `stylefit_admin` 쿠키로 발급 (HttpOnly, SameSite=Strict, 12시간 TTL).
- 서버 재시작 시 모든 어드민 세션이 무효화된다 — 운영자 1명 MVP 라 수용.

### 13.2 화면 구성

**로그인 화면** (`/admin`, 미인증 상태) — 비밀번호 단일 input + 제출 버튼. 실패 시 401 + 인라인 에러.

**대시보드** (`/admin`, 로그인 후)

1. **요약 카드 9개** — 한 화면에 핵심 지표가 모두 보이도록 그리드 배치
   - 총 진단 / 오늘 완료 진단 / 만족도 평균 / 결제 의향 YES 비율
   - 평균 스크롤 도달 / 결과 페이지 재방문 / 공유 토큰 활성 수
   - 차단 사용자 수 / 오늘 AI 호출 한도 사용량
2. **상세 데이터 테이블 (탭)** — 5개 탭으로 도메인별 raw 데이터 조회
   - 만족도 / 결제 의향 / 행동 신호 / 차단 / 공유 토큰
   - 쿠키 ID 는 마지막 8자만 표시되도록 마스킹 (`***xxxxxxxx`) — 어드민 화면 캡처 누설 시 사용자 사칭 차단
3. **운영 도구 링크** — 하단에 "사용자 차단 관리" 버튼 → `/admin/ban` 이동

**사용자 차단 페이지** (`/admin/ban`)

- 최근 진단 활동 기준 사용자 목록(기본 200건) — `analysis_result` 의 cookie + last_ip 페어
- 각 행: 체크박스 / 쿠키 ID (raw) / 마지막 IP / 분석 상태 / 마지막 활동 / 현재 차단 태그 / 해제 버튼
- **다중 선택 + 사유 input + 차단 버튼 3종**:
  - `선택 N건 차단 (쿠키+IP)` — 양쪽 모두 INSERT
  - `쿠키만` — IP 는 null 로 등록
  - `IP만` — 쿠키는 null 로 등록
- 이미 차단된 행은 "쿠키" / "IP" 태그가 표시되고 `해제` 버튼으로 즉시 unban
- 차단·해제 후 자동 새로고침, 작업 결과는 인라인 메시지(`N건 차단 완료` / `N건 해제`)

> 차단 화면에서는 쿠키 ID 가 **raw 로 노출**된다 — 운영자가 정확한 ID 를 선택해야 차단이 가능하기 때문. 캡처 누설 위험은 어드민 접근 자체를 운영자 1인으로 제한하고 SameSite=Strict 세션 쿠키로 완화.

### 13.3 보안 고려

- **CORS / OriginGuard**: 다른 보호와 동일하게 적용됨. 외부 사이트에서 `/api/admin/login` 호출 불가.
- **세션 쿠키는 HttpOnly + SameSite=Strict + Secure(운영)** — XSS / CSRF 양쪽 모두 방어.
- **타이밍 공격**: 비밀번호 비교는 `equals` — 운영자 1명 단일 비밀번호 MVP라 수용. 다중 계정 도입 시 `MessageDigest.isEqual` 같은 상수 시간 비교로 전환.
- **어드민 API 가드**: 모든 `/api/admin/**` (login/logout 제외) 에 `AdminAuthInterceptor` 가 세션 검증.

---

## 14. 현재 사용자가 할 수 있는 일 (기능 카탈로그)

### 14.1 일반 사용자 (익명)

**진단**
- 홈에서 무료 진단 CTA 클릭 → 사진 1장 업로드 → 약 15초 대기 후 결과 확인
- 한 쿠키당 1건만 진단 가능 (DB unique). 다시 진단 시도하면 기존 결과로 자동 이동
- 검증 실패 시 사유(흐림 / 측면 회전 / 역광 등) 안내와 재시도

**결과 보기**
- 베스트/워스트 컬러 3개씩 + 의류 추천 + 실패 방지 규칙 확인
- 리포트 이미지 다운로드 (결제 다이얼로그 Stage 2 에서)

**공유**
- 본인 결과로 공유 링크(`/share/<token>`) 발급 → 자동으로 클립보드 복사 → SNS/메신저로 전달
- 이미 active 토큰이 있으면 재발급 없이 같은 토큰 재사용
- 본인 토큰 폐기(revoke) 가능 — 폐기되면 공유받은 사람들이 더 이상 결과를 볼 수 없음 (404)

**공유받기**
- `/share/<token>` URL 진입 시 공유자 결과(JSON + 리포트 이미지) 열람
- "나도 검사해보기" 클릭 → `/upload` 로 이동해 본인 진단 시작
- 본인이 이미 진단 결과가 있는 경우 "내 결과와 비교해보기" 버튼이 추가로 표시됨 → `/compare/<token>` 으로 이동해 본인 vs 공유받은 결과를 좌우 비교

**평가**
- 본인 결과 페이지에서 만족도 평가 (별점 1~5 + 성별 + 자유 코멘트 300자) 작성·수정
- 결제 의향 다이얼로그에 "예/아니오" 응답 (베타는 무료 — 실제 결제 없음)

**기타**
- 결과 다운로드 (리포트 이미지)
- 잘못된 URL 진입 시 404 안내 페이지 + 홈/진단 CTA

### 14.2 운영자 (Admin)

`/admin` 접근, `ddalkkak01!` 로 로그인 후:

- 진단 / 만족도 / 결제 의향 / 행동 신호 / 공유 토큰 / 차단 / 호출 한도 **핵심 지표 요약** 한눈 확인
- 도메인별 **상세 raw 데이터** 테이블 조회
- `/admin/ban` 에서 **최근 사용자 다중 선택 차단** — 쿠키+IP / 쿠키만 / IP만 3가지 모드
- 기존 차단 해제 (한 행씩)
- rate limit · 검증 임계치 조정은 여전히 어드민에서 불가 — application.properties 또는 환경변수로만 가능

### 14.3 시스템이 자동으로 하는 일 (사용자가 직접 트리거하지 않음)

- 사진 검증 — 매직 바이트, EXIF 제거, 얼굴 탐지/크기/각도/블러/역광/채도
- AI 호출 카운터 — 글로벌 + 쿠키 + IP 3중 일일 한도
- 차단 가드 — `/api/analysis/**` 진입 시 쿠키/IP 매칭
- Origin/CSRF 가드 — POST/PUT/PATCH/DELETE 의 Origin/Referer 검증
- 리포트 이미지 로컬 캐싱 — 최초 1회 AI 모듈에서 받아 디스크 보관, 이후 같은 사용자는 캐시 재사용
- GA 이벤트 전송 — 페이지 이동, 주요 버튼 클릭, 분석 성공/실패, 공유 흐름 모두 자동 기록

### 12.3 PROJECT_STATUS.md §8 의 기존 백로그

- Python AI 분석 서버 연동 (`callAiAnalysis`/`callAiReportGenerator` 교체)
- PROCESSING/COMPLETED 트랜잭션 분리
- AI 호출 타임아웃 / 재시도 정책
- HEIC 등 미지원 포맷 처리
- 어드민 UI (만족도 조회, 차단 관리, 결제 의향 통계)
- 만족도 별점 임계치 알림
- 베타 종료 후 다이얼로그 Stage 2 문구/이미지 교체

---

## 부록 A — 디렉터리 트리 (요약)

```
StyleFit/
├── ARCHITECTURE.md              # 이 문서
├── PROJECT_STATUS.md            # 진행 현황 + GA 이벤트 단일 진실 원천
├── build.gradle
├── src/main/
│   ├── java/com/stylefit/
│   │   ├── admin/               # 어드민 인증 + 통계 API  ← 신규
│   │   ├── analysis/            # 진단 도메인
│   │   ├── auth/                # 익명 쿠키
│   │   ├── ban/                 # 차단
│   │   ├── behavior/            # 행동 신호
│   │   ├── config/              # SecurityConfig, OriginGuardFilter, WebConfig, ...
│   │   ├── product/             # 상품 메타
│   │   ├── purchase/            # 결제 의향
│   │   ├── ratelimit/           # 일일 한도 (글로벌 + per-cookie + per-IP)
│   │   ├── share/               # 결과 공유 토큰  ← 신규
│   │   ├── survey/              # 만족도
│   │   └── vision/              # 사진 검증 (OpenCV + YuNet)
│   └── resources/
│       ├── application.properties
│       ├── application-prod.properties
│       ├── models/face_detection_yunet_2023mar.onnx
│       ├── schema.sql           # H2 PK-없는 테이블만
│       ├── ddl/schema-postgres.sql  # 운영 DDL 전체
│       └── static/              # Vite 빌드 산출물
└── frontend/
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── analytics.js
        ├── components/
        └── pages/
            ├── HomePage, UploadPage, LoadingPage, ErrorPage, ResultPage
            ├── SharePage, ComparePage     ← 신규
            ├── AdminPage, AdminBanPage    ← 신규
            └── NotFoundPage
```
