# StyleFit 프로젝트 진행 현황

> 작성 기준일: 2026-05-15

퍼스널 컬러 진단을 시작으로 한 스타일링 추천 모바일 웹앱.
익명 쿠키 기반으로 사진을 업로드하면 AI가 퍼스널 컬러를 분석해 결과 리포트를 보여준다.

---

## 1. 기술 스택

| 영역 | 기술 |
|---|---|
| 백엔드 | Spring Boot 3.4.0, Java 17, Gradle |
| DB | H2 (개발용, 인메모리) / Postgres DDL 준비됨 |
| 보안 | Spring Security (CSRF off, STATELESS, 익명 쿠키) |
| 비전 | OpenCV 4.9.0 (openpnp), YuNet ONNX (얼굴 탐지) |
| 프론트 | React 18, Vite 5, React Router 7 |
| 빌드 | Vite → `src/main/resources/static`로 번들 |

---

## 2. 백엔드 구조

### 패키지 레이아웃

```
com.stylefit
├── StyleFitApplication           # 엔트리포인트
├── analysis                      # 분석 도메인
│   ├── AnalysisController        # /api/analysis/start, /submit-photo
│   ├── AnalysisService           # 검증→분석→저장 오케스트레이션
│   ├── AnalysisResult            # JPA 엔티티 (cookie_id + product_code unique)
│   ├── AnalysisResultRepository
│   ├── AnalysisResponse          # status / result / validationWarnings
│   └── AnalysisStatus            # PROCESSING / COMPLETED / FAILED
├── vision
│   ├── PhotoValidationService    # YuNet 얼굴 탐지 + 밝기 계산
│   ├── PhotoValidationResponse
│   └── PhotoValidationController # 별도 검증 엔드포인트
├── product                       # 메뉴/상품 메타
├── survey                        # 리포트 만족도 평가
│   ├── SatisfactionSurveyController  # /api/survey/satisfaction (GET, POST)
│   ├── SatisfactionSurveyService     # upsert + 검증(별점 1~5, 성별 필수, 코멘트 300자)
│   ├── SatisfactionSurvey            # JPA 엔티티 (cookie_id PK, 한 쿠키당 1건)
│   ├── SatisfactionSurveyRepository
│   ├── SatisfactionSurveyRequest     # rating, gender, comment
│   ├── SatisfactionSurveyResponse    # exists, rating, gender, comment
│   └── Gender                        # MALE / FEMALE enum
├── purchase                      # 유료 리포트 결제 의향 (MVP 검증)
│   ├── PurchaseIntentController      # /api/purchase-intent (GET, /open, /yes)
│   ├── PurchaseIntentService         # markOpened / markYes
│   ├── PurchaseIntent                # JPA 엔티티 (cookie_id PK, 한 쿠키당 1건)
│   ├── PurchaseIntentRepository
│   ├── PurchaseIntentResponse        # exists, lastChoice, dialogCount
│   └── PurchaseChoice                # YES / NO enum
├── behavior                      # 사용자 행동 신호 (MVP 결제 의향 결정 요인 분석)
│   ├── UserBehaviorController        # /api/user-behavior (GET + 5 POSTs)
│   ├── UserBehaviorService           # markScroll / markPhotoDwell / markAnalysisFailed / markResultRevisit / markPhotoReplaced
│   ├── UserBehavior                  # JPA 엔티티 (cookie_id PK, 행동 요약 1행)
│   ├── UserBehaviorRepository
│   └── UserBehaviorResponse          # exists + 5개 신호 필드
├── auth
│   └── AnonymousCookieFilter     # stylefit_uid 쿠키 (30일, HttpOnly, SameSite=Lax)
├── ban                           # 악성 사용자 차단 (쿠키/IP 밴 리스트)
│   ├── BanController             # /api/ban/check
│   ├── BanService                # JdbcTemplate 기반 isBanned + extractClientIp
│   ├── BanGuardInterceptor       # /api/analysis/** 진입 시 차단 여부 검사 → 403
│   └── BanCheckResponse          # { banned: boolean }
├── ratelimit                     # 서버 전체 일일 호출 한도 (AI 모듈 호출 카운터)
│   ├── ApiCallQuota              # JPA 엔티티 (quota_day PK — 하루 1행 글로벌 카운터)
│   ├── ApiCallQuotaRepository
│   └── RateLimitService          # @Transactional tryConsume() — AnalysisService 에서 AI 호출 직전에 호출
└── config
    ├── WebConfig                 # 인터셉터 등록 (Ban → /api/analysis/**), 정적 리소스(/report-images/**) 매핑
    ├── SecurityConfig            # CORS / 필터체인
    ├── OpenCvConfig              # 네이티브 라이브러리 로딩
    └── SpaController             # SPA fallback
```

### API 엔드포인트

| Method | Path | 설명 |
|---|---|---|
| `POST` | `/api/analysis/start` | 익명 쿠키 기준 기존 분석 상태 조회 (`PHOTO_REQUIRED` / `PROCESSING` / `COMPLETED`) |
| `POST` | `/api/analysis/submit-photo` | 사진 1장 업로드 → 검증 → AI 분석 → 결과 저장 |
| `GET`  | `/api/survey/satisfaction`   | 본인 만족도 평가 조회 (`exists`, `rating`, `comment`) |
| `POST` | `/api/survey/satisfaction`   | 만족도 평가 저장 (upsert — 기존 평가 있으면 덮어씀) |
| `GET`  | `/api/purchase-intent`       | 본인 결제 의향 조회 (`exists`, `lastChoice`, `dialogCount`) |
| `POST` | `/api/purchase-intent/open`  | 결제 다이얼로그 노출 시 호출 — `dialog_count++` + `last_choice='NO'` 리셋 |
| `POST` | `/api/purchase-intent/yes`   | "예" 클릭 시 호출 — `last_choice='YES'` |
| `GET`  | `/api/user-behavior`              | 본인 행동 신호 조회 (최대 스크롤 / 망설임 / 검증 실패 / 재방문 / 사진 교체) |
| `POST` | `/api/user-behavior/scroll`       | 결과 페이지 섹션 도달 — 인덱스가 더 클 때만 max 갱신 |
| `POST` | `/api/user-behavior/photo-dwell`  | 사진 첨부→제출 사이 소요 ms 기록 |
| `POST` | `/api/user-behavior/analysis-failed` | 검증 실패 누적 카운트 +1 (응답의 `failedAttempts`를 `attempt_no`로 GA에 함께 전송) |
| `POST` | `/api/user-behavior/result-revisit`  | 결과 페이지 마운트 시 +1 |
| `POST` | `/api/user-behavior/photo-replaced`  | 세션 내 사진 교체 횟수 기록 |
| `GET`  | `/api/ban/check`                     | 현재 쿠키/IP가 차단 목록에 있는지 확인 (`{ banned: boolean }`) |

> **인터셉터 가드**: `/api/analysis/**`는 `BanGuardInterceptor`가 진입 차단(403). 리포트 생성 일일 한도(429)는 `AnalysisService` 내부에서 **AI 모듈 호출 직전**에 `RateLimitService.tryConsume()`을 호출해 소모 — DB 캐시 재사용/사진 미첨부/검증 실패/PROCESSING 충돌 케이스는 카운트가 빠지지 않는다.

### 분석 플로우

```
요청 → AnonymousCookieFilter (쿠키 확인/발급)
     → AnalysisController
     → AnalysisService.submitPhoto
         ├─ 기존 레코드 검사 (COMPLETED면 재사용, PROCESSING이면 409)
         ├─ PhotoValidationService.validate
         │    ├─ 이미지 디코드
         │    ├─ 640px로 리사이즈 (옵션)
         │    ├─ YuNet 얼굴 탐지 (싱글톤 detector, synchronized)
         │    └─ 밝기 계산
         ├─ 검증 통과 시 status=PROCESSING 저장
         ├─ callAiAnalysis()         ← 현재 mock
         ├─ callAiReportGenerator()  ← 현재 mock
         └─ status=COMPLETED 저장 + 응답 반환
```

### 현재 mock인 부분
- `callAiAnalysis()` → 고정 JSON (쿨톤 · 윈터 계열, bestColors/worstColors 3개씩, clothing.top/bottom, hair, accessories, situations, shopKeywords, avoidRules 포함)
- 의도적인 `Thread.sleep(15_000)` 추가 — 프론트 LoadingPage 3단계 진행 UX 검증용 (Python 연동 시 제거)
- `callAiReportGenerator()` → `placehold.co` URL
- 추후 Python AI 서버 HTTP 호출로 교체 예정 (`AnalysisService.java` 주석 참고)

---

## 3. 프론트엔드 구조

### 페이지 & 플로우

| 경로 | 컴포넌트 | 역할 |
|---|---|---|
| `/` | `HomePage` | 랜딩 (StyleHomeMobile 디자인 — 히어로/Trust 3종/가치 카드/무료 결과 미리보기/CTA) |
| `/upload` | `UploadPage` | 사진 첨부 1장 (스텝 인디케이터, 드롭존, 개인정보 안내, 좋은 사진 가이드) |
| `/loading` | `LoadingPage` | AI 분석 중 (3단계 순차 진행 + 팩트 캐러셀, 15초 강제 최소 대기) |
| `/error` | `ErrorPage` | 사진 검증 실패 (X 마크, 재시도 CTA, 사진 가이드 팁) |
| `/result` | `ResultPage` | 리포트 (다크그린 히어로, 타입 그래프, 베스트/워스트 컬러 3개씩, 의류 추천, 실패 방지 규칙, Coming Soon 3종, 저장&공유) |
| `*` (catch-all) | `NotFoundPage` | 알 수 없는 경로 — "404" 손글씨 + 페이퍼 카드 + 홈/진단하기 CTA. 백엔드 SpaController가 단일 세그먼트 점 없는 경로를 index.html로 포워딩해 React Router가 받아 렌더링 |

**유저 플로우**: `/` → "지금 무료로 진단받기" → `/upload` → 사진 1장 + "분석 시작하기" → `/loading` (15s) → `/result` (성공) 또는 `/error` (검증 실패)

**한 번 진단 제한**: 동일 쿠키로 `COMPLETED` 레코드가 있으면 `/upload`에서 submit 시 또는 탭바 "내 리포트" 클릭 시 즉시 `/result`로 이동 (로딩 없이 DB 결과 재사용).

### 공용 컴포넌트 / 훅

| 파일 | 역할 |
|---|---|
| `components/ScrollToTop.jsx` | 라우트 변경 시 `window.scrollTo(0, 0)` — 페이지 이동마다 최상단에서 시작 |
| `components/NoReportDialog.jsx` | "아직 진단 결과가 없어요" 모달 — 디자인 톤(딥그린 보더 + 도장 그림자) |
| `hooks/useReportCheck.jsx` | `/api/analysis/start` 호출 → COMPLETED면 `/result`로, 아니면 `NoReportDialog` 노출. 탭바 "내 리포트" 공용 |

### 디자인 시스템

- **컬러**: `oklch()` 기반 그린 팔레트 (`--green-deep`, `--green-darker`, `--green-mid`, `--green-tint`) + `--gold: #e7d8a8` (히어로 강조)
- **배경**: body `oklch(0.32 0.04 155)` (어두운 그린 — 모바일 프레임 바깥), frame `--paper: #eef2ea`, paper-card `--paper-card: #f6f8f1`
- **폰트**: Pretendard Variable (메인 본문/헤딩), Caveat (포인트 영문 손글씨), Gowun Batang/Black Han Sans (제한적 사용)
- **레이아웃**: 모바일 우선, `max-width: 420px` 가운데 정렬(`margin: 0 auto`), `viewport-fit=cover`
- **하단 탭바**: `홈 / 진단하기 / 내 리포트` — `position: fixed`, 420px 가운데 정렬, 현재 페이지에 따라 active 인디케이터 자동 표시
- **무드**: 다크그린 히어로 + 종이톤 카드 + 점선 보더 + 골드 포인트 (Style Report Mobile 디자인 기반)

---

## 4. 인증/세션

- 별도 로그인 없음. `AnonymousCookieFilter`가 모든 요청에 대해 `stylefit_uid` 쿠키를 자동 발급/검증
- 쿠키 속성: `HttpOnly`, `Path=/`, `MaxAge=30일`, `SameSite=Lax`, `Secure`는 HTTPS일 때만
- 한 쿠키 + 한 상품(`PERSONAL_COLOR_DIAGNOSIS`) = 분석 1건 (DB unique 제약)

---

## 5. 진행 중 개발 환경 설정

### 실행 방법
- 백엔드: `./gradlew bootRun` (포트 8080)
- 프론트: `cd frontend && npm run dev` (포트 5173)
- 프론트는 `/api` 요청을 8080으로 프록시
- 모바일 동일 Wi-Fi 접속: Vite `host: true` 설정 → `http://<PC_IP>:5173` 로 접속

### 파일 업로드 제한
```properties
spring.servlet.multipart.max-file-size=20MB
spring.servlet.multipart.max-request-size=60MB
```

---

## 6. 최근 적용한 수정 (이슈 트래킹)

### 2026-05-19 — 유입 경로 추적 (UTM + ?ref=) + 어드민 대시보드 시각화

| 항목 | 변경 |
|---|---|
| **목적** | 채널별 진단 전환율 측정. GA4 UTM 자동 집계 + 커스텀 ref 파라미터 → 어드민 대시보드 실시간 확인 |
| **UTM** | `trackPageView`가 `page_location: window.location.href` 전송 → GA4가 UTM 파라미터를 세션 단위로 자동 어트리뷰션. 추가 코드 불필요 |
| **ref 추적 (프론트)** | `analytics.js`에 `initRef()` / `getRef()` 추가. 앱 초기화 시 `?ref=` 값을 `sessionStorage(sf_ref)`에 저장. `main.jsx`의 전역 fetch 인터셉터가 `X-Ref` 헤더를 모든 API 요청에 자동 첨부. `trackEvent()`가 ref를 GA 이벤트에도 자동 첨부 |
| **ref 추적 (백엔드)** | `AnonymousCookieFilter`가 신규 쿠키 발급 시 `X-Ref` 헤더를 읽어 `<uuid>_<ref>` 형태로 발급. 이후 모든 DB 테이블의 `cookie_id`가 유입 채널을 내포. ref 값은 `[a-z0-9_-]` 20자 이내로 자동 정제. `ref_param` 별도 컬럼 불필요 |
| **스키마 변경** | 모든 테이블 `cookie_id VARCHAR(36)` → `VARCHAR(100)`. JPA 엔티티 6종 + `schema.sql` + `schema-postgres.sql` 일괄 수정 |
| **어드민 대시보드** | `GET /api/admin/stats/acquisition` 신규 엔드포인트. `AdminStatsService.acquisitionBreakdown()`이 `cookie_id`의 `_` suffix로 ref를 추출해 집계. `AdminPage.jsx`에 "유입 경로 분석" 섹션 추가 |
| **GA 이벤트** | 신규 이벤트 없음. 기존 모든 이벤트에 `ref` 파라미터 자동 추가(ref 없는 접속은 파라미터 생략) |

### 2026-05-19 — 사용자 얼굴 이미지 저장

| 항목 | 변경 |
|---|---|
| **목적** | 검증 통과한 사용자 업로드 얼굴 사진을 서버 디스크에 보관. AI 모델 학습 데이터 및 어드민 검토용 — 공개 URL 없음 |
| **DDL** | `analysis_result` 테이블에 `face_image_path VARCHAR(500)` 컬럼 추가(NULL 허용 — 저장 실패 시에도 분석은 정상 완료) |
| **저장 디렉토리** | `stylefit.face.storage-dir=./face-images` (application.properties). `report-images/`와 분리. 운영에선 영속 볼륨 경로로 교체 권장 |
| **백엔드 흐름** | `AnalysisService.submitPhoto`: 사진 검증 통과 → Rate Limit 통과 → `saveFaceImage(file)` 호출 → UUID 파일명으로 `./face-images/`에 저장 → `entity.faceImagePath` 기록 → AI 분석 순서 |
| **보안** | `report-images/`와 달리 정적 핸들러 미등록 — 디렉토리를 알아도 외부에서 GET 불가. UUID 파일명으로 추측 방지 |
| **실패 처리** | `saveFaceImage()` IOException → `null` 반환 + 경고 로그. 분석 결과(COMPLETED)는 정상 저장되며 `face_image_path`만 NULL로 남음 |
| **응답 DTO** | `AnalysisResponse`에 `faceImageSaved: Boolean` 추가. `true` = 저장 성공, `false` = 저장 실패 또는 기존 COMPLETED 재사용(이미 저장됨) |
| **GA 이벤트** | `analysis_completed` 파라미터에 `face_image_saved` 추가 — 저장 성공률 모니터링. PII 없음(파일명·경로 비전송) |

### 2026-05-15 — 홈화면 디버그 박스 제거

| 항목 | 변경 |
|---|---|
| **목적** | MVP 검증용으로 임시 삽입했던 결제 의향·만족도·행동 신호 디버그 패널을 완전 제거. 운영 노출 방지 |
| **제거 범위** | `HomePage.jsx`의 `purchaseIntent` / `satisfaction` / `behavior` state 3개, 이를 로딩하는 `useEffect` (3 fetch), `<aside className="hm-debug">` JSX 블록 전체 (~75 lines). 이로 인해 불필요해진 `import { useEffect, useState }` 도 함께 제거 |
| **비고** | `!import.meta.env.PROD` 가드가 있었으나 dev에서도 노출 불필요하다는 판단으로 조건 없이 전면 삭제 |

### 2026-05-15 — 공유 기능 개편 (폐기 버튼 제거 + ShareDialog)

| 항목 | 변경 |
|---|---|
| **목적** | 공유 링크 폐기(revoke) 버튼 제거 + 공유 버튼 클릭 시 카카오톡/URL 복사 선택 팝업 제공 |
| **ResultPage 변경** | `shareCopied` state · `handleShareRevoke` 함수 제거. `shareDialogOpen` state 추가. `handleShareCreate`: 토큰 있으면 `setShareDialogOpen(true)`, 없으면 `/api/share/create` 호출 후 토큰 저장 → 오픈. `/api/share/me` useEffect에 AbortController 추가. ShareDialog는 `{shareToken && ...}`으로 가드 — 빈 URL이 전달되는 footgun 방지 |
| **ResultPage.css** | `.rp-share-revoke` / `.rp-share-revoke:disabled` 스타일 규칙 제거 |
| **ShareDialog.jsx** | 신규 컴포넌트. 모달 팝업(backdrop → card → X 버튼 → 아이콘 → 타이틀 → 2버튼). 카카오 SDK v2.7.4를 CDN에서 동적 로딩 (Promise singleton으로 race condition 방지 — `kakaoReady` null 시 retry 가능, 실패한 script 태그 자동 제거). `toAbsUrl` 헬퍼로 상대 URL → 절대 URL 정규화 (카카오 SDK 필요조건) |
| **ShareDialog.css** | 신규. `.shd-backdrop`(fade-in overlay), `.shd-card`(pop animation, 딥그린 보더), `.shd-kakao`(#FEE500 카카오 브랜드), `.shd-url`(var(--green-deep)) |
| **URL 복사 fallback 개선** | 기존: clipboard API 실패 시 `window.prompt()` → 사용자가 직접 Ctrl+C 필요. 변경: 실패 시 `<textarea>` + `document.execCommand('copy')` silent fallback → 버튼 클릭 즉시 복사 완료, prompt 없음 |
| **.env.example** | `VITE_KAKAO_APP_KEY=` 항목 추가 (JavaScript 키 발급 위치 주석 포함) |
| **GA 이벤트** | `share_kakao_click` 신규. `share_link_copied` — `fallback` 파라미터 제거 (execCommand fallback은 정상 복사로 간주), `share_revoke_click` / `share_revoke_failed` 제거 |

### 2026-05-15 — 어드민 사용자 차단/해제 로직 버그 수정

| 항목 | 변경 |
|---|---|
| **Bug 1 — collateral IP ban** | `BanService.COUNT_SQL`이 단순 `WHERE cookie_id = ? OR ip_address = ?` 조건이었음. 결과: "쿠키+IP 차단" 모드로 `(uuid-A, ::1)` 행을 INSERT하면, 사용자 B (uuid-B, ::1) 체크 시 `ip_address = ::1` 조건에 걸려 B도 차단됨. 로컬 개발 환경(모두 `::1`)에서 한 명 차단 시 전원 차단되는 현상 |
| **Bug 1 수정** | `COUNT_SQL`을 3-way 매칭으로 변경. `(cookie, NULL)` 행 → 쿠키만 일치, `(NULL, ip)` 행 → IP만 일치, `(cookie, ip)` 행 → **두 값 모두 일치**해야 차단. 이제 "쿠키+IP 차단"은 해당 (cookie, ip) 쌍에만 적용되고 같은 IP의 다른 사용자는 영향 없음 |
| **Bug 2 — unban 과도한 삭제** | `unban(cookieId, ip)` 양쪽 모두 있을 때 `DELETE WHERE cookie_id = ? OR ip_address = ?` → `::1`을 공유하는 모든 사용자 행이 한 번에 삭제됨 |
| **Bug 2 수정** | cookie+ip 모두 있을 때 두 개의 별도 쿼리로 분리: ① `DELETE WHERE cookie_id = ?` (이 사용자의 모든 ban 행) ② `DELETE WHERE ip_address = ? AND cookie_id IS NULL` (IP-only 행만). 다른 사용자의 `(uuid-B, ::1)` 행은 `cookie_id IS NULL` 조건에 걸리지 않아 보존됨 |
| **영향 없는 부분** | `banMany()` INSERT 로직, AdminBanPage.jsx UI, 어드민 차단 모드(쿠키만/IP만/둘다) 동작 방식은 변경 없음 |

### 2026-05-14 — 일일 호출 한도 카운트 위치를 AI 호출 직전으로 이동

| 항목 | 변경 |
|---|---|
| **목적** | 기존엔 `RateLimitInterceptor`가 `/api/analysis/submit-photo` 컨트롤러 진입 시점에 카운트를 소모 → DB에 COMPLETED 결과가 있어 AI 모듈 호출 없이 즉시 재사용되는 케이스도 한도를 깎았다. 한도의 의도는 "AI 모듈 호출량 제한"이지 "API 진입 횟수 제한"이 아니므로, 실제 AI 호출 직전으로 소모 시점을 옮긴다 |
| **제거** | `com.stylefit.ratelimit.RateLimitInterceptor` 클래스 삭제. `WebConfig.addInterceptors`에서 등록 제거 — 이제 BanGuard만 남음 |
| **`AnalysisService.submitPhoto` 흐름** | ① 사진 없음 → 카운트 X (`validationFailed`) / ② 기존 COMPLETED → 카운트 X (`toResponse` 재사용) / ③ PROCESSING 충돌 → 카운트 X (409) / ④ 사진 검증 실패 → 카운트 X / ⑤ 검증 통과 → `rateLimitService.tryConsume()` → 한도 초과면 `ResponseStatusException(TOO_MANY_REQUESTS)` / ⑥ 통과면 PROCESSING 저장 + AI 호출 + COMPLETED 저장 |
| **HTTP 응답 형식** | 한도 초과 시 status 429. 기존 인터셉터의 커스텀 JSON body(`{"error":"rate_limited", ...}`)는 사라지고 Spring 기본 에러 응답으로 바뀜 — 프론트(`LoadingPage`)는 body를 보지 않고 `res.status === 429`만 보므로 동작은 동일 |
| **GA 이벤트** | 변동 없음 — `rate_limit_blocked`(`location: 'analysis_submit'`, `elapsed_ms`)는 status 429 감지 분기에서 그대로 발사. 의미만 "AI 호출이 실제로 막힌 빈도"로 더 정확해짐 |

### 2026-05-14 — 리포트 이미지 캐싱 (1회만 AI 모듈 호출 후 디스크 저장)

| 항목 | 변경 |
|---|---|
| **목적** | 기존엔 `start` / `submitPhoto` 응답마다 mock URL(placehold.co)을 그대로 박아 같은 쿠키여도 외부 호출이 매번 발생. 운영(Python AI 서버) 전환 시 호출 비용이 그대로 노출됨. 분석 결과 캐싱(쿠키+상품 unique)과 동일한 패턴을 리포트 이미지에도 적용 — 최초 1회만 AI 모듈에서 받아 디스크에 저장하고, 같은 사용자가 다시 결과를 열면 DB에 보관된 파일을 재사용 |
| **DDL** | `analysis_result` 테이블에 `report_image_path VARCHAR(500)` 컬럼 1개 추가(별도 테이블 X). NULL 허용 — 다운로드 실패 시엔 원본 URL 폴백 |
| **저장 디렉토리** | `stylefit.report.storage-dir=./report-images` (application.properties). 운영에선 영속 볼륨 경로로 교체 가능. JPA `create-drop` 환경(H2)에선 재부팅 시 DB만 초기화되어 디스크에 orphan 파일이 쌓일 수 있음 — MVP 수준에서 수동 정리 |
| **백엔드 흐름** | `submitPhoto`: AI 모듈에서 받은 URL → `URLConnection.getInputStream()` → `./report-images/<UUID>.<ext>` 저장 → DB에 파일명만 보관. 응답엔 `/report-images/<filename>` 형태로 반환. `start` / 기존 COMPLETED 재사용 경로(`toResponse`): `report_image_path`가 있으면 그 URL, 없으면 mock URL 폴백 |
| **확장자 결정** | Content-Type 헤더로 분기(`png` / `jpg` / `svg` / `webp` / `gif`), 기타는 `.img`. placehold.co는 png 반환이라 정상 동작 |
| **정적 매핑** | `WebConfig.addResourceHandlers`로 `/report-images/**` → 디스크 디렉토리 file URI. 같은 origin이라 프론트 다운로드 핸들러의 cross-origin CORS 폴백이 더 이상 필요하지 않음(다만 외부 URL 폴백을 대비해 그대로 둠) |
| **응답 DTO** | `AnalysisResponse`에 `reportImageCached: Boolean` 추가. `true`=DB 캐시 재사용, `false`=이번 호출에서 새로 생성/저장. 프론트는 이 값을 state로 전달 |
| **프론트 전달** | UploadPage / LoadingPage / useReportCheck 3곳의 `navigate('/result', { state: ... })`에 `reportImageCached` 함께 전달. ResultPage 폴백 fetch(`/api/analysis/start`)도 동일 |
| **보안 메모** | UUID 파일명이라 추측 불가하지만, URL을 알면 누구나 GET 가능. 결제 게이트 뒤에 가두려면 별도 컨트롤러로 쿠키 매칭 후 스트림 — 현재 베타는 무료라 그대로 둠 |
| **GA 이벤트** | `report_image_resolved`(`source: 'generated'/'cached'`) — ResultPage 1회 박음. 캐시 적중률 = `cached / (generated + cached)`로 AI 모듈 호출 절감 효과 측정 |

### 2026-05-13 — 404 NotFoundPage + SPA 폴백 확장

| 항목 | 변경 |
|---|---|
| **목적** | 잘못된 URL/오타로 접근하는 사용자를 빈 화면이나 홈 리다이렉트로 보내지 않고, 디자인 톤에 맞는 전용 404 페이지로 안내 |
| **프론트 페이지** | `pages/NotFoundPage.jsx` + `.css` 신규 — 손글씨 "404" + 페이퍼 카드(점선 보더, 그림자) + 안내 카피 + "홈으로 돌아가기"/"진단 받으러 가기" 두 액션 + 탭바 |
| **라우팅** | `App.jsx`의 catch-all `<Route path="*" />`을 `<Navigate to="/" replace />`에서 `<NotFoundPage />`로 교체. 잘못된 경로가 그대로 URL 바에 남고 페이지 내에서 사용자에게 명시적으로 알려줌 |
| **SPA 폴백** | `SpaController`가 기존엔 `/upload`, `/result`만 처리 → `/loading`, `/error`, `/notfound`, 그리고 `/{path:[^.]+}` 패턴 추가. 단일 세그먼트의 점 없는 경로는 모두 index.html로 forward되어 React Router가 NotFoundPage 렌더링. 정적 파일(`.css`/`.js`/`.png`)과 API/H2 콘솔은 우선 매칭 규칙 덕에 영향 없음 |
| **GA 이벤트** | `not_found_view`(`path_length` — PII 회피 위해 길이만), `not_found_action`(`action: home/diagnose`, `location`) |

### 2026-05-13 — 리포트 생성 일일 호출 한도 (서버 전체 50회/일)

| 항목 | 변경 |
|---|---|
| **목적** | AI 호출 비용/리소스 보호 — 리포트 생성 모듈(`/api/analysis/submit-photo`)의 **서버 전체 호출 총합**을 하루 50회로 제한. 누가 호출하든 같은 글로벌 카운터를 소모 |
| **DDL** | `api_call_quota` 테이블 신규 — `quota_day` DATE PK, `call_count` INTEGER. **하루 1행**만 생성되고, 자정 넘어가면 새 날짜 행이 자동으로 만들어져 이전 일자는 그대로 히스토리로 남음 |
| **백엔드 도메인** | `com.stylefit.ratelimit` 패키지 신규 — `ApiCallQuota`(JPA, `quota_day` PK), `ApiCallQuotaRepository`, `RateLimitService`(@Transactional `tryConsume()` — 인자 없음), `RateLimitInterceptor`(429 + JSON 응답) |
| **소비 로직** | `tryConsume`: ① 오늘 행 없으면 INSERT(count=1), ② 있으면 `count >= dailyLimit`일 때 false 반환(증가 안 함), ③ 아니면 count++. 트랜잭션 안에서 read-modify-write |
| **설정** | `stylefit.ratelimit.report-daily=50` (application.properties). 운영 단계에서 조정 가능 |
| **인터셉터 적용 범위** | `/api/analysis/submit-photo` 한 곳에만 (start는 단순 조회라 부담 없음). WebConfig에서 BanGuard(order 0) → RateLimit(order 1) 순으로 등록 — 차단된 사용자의 카운트는 소모되지 않음 |
| **프론트 처리** | LoadingPage가 `res.status === 429`를 감지 → `reason='rate_limited'`로 ErrorPage 이동. ErrorPage가 reason 분기로 "오늘 리포트 생성 한도에 도달했어요" 카피 + 재시도 버튼/팁 숨김. `failed_attempts` 카운터는 증가시키지 않음(검증 실패 아님) |
| **GA 이벤트** | `rate_limit_blocked`(`location: 'analysis_submit'`, `elapsed_ms`) — 한도 도달 시점·빈도 분석. 사용자 단위 분석은 의미 없음(글로벌 카운터라 누가 막혔는지는 우연) |

### 2026-05-13 — 리포트 이미지 다운로드 버튼

| 항목 | 변경 |
|---|---|
| **목적** | PurchaseIntentDialog Stage 2에서 리포트 이미지를 보여주지만 저장 수단이 없었음. "다운로드" 버튼을 추가해 사용자가 이미지를 기기에 저장할 수 있게 함 |
| **PurchaseIntentDialog** | Stage 2 액션 영역을 `single` → 2-컬럼 그리드로 전환. `닫기`(ghost) / `다운로드`(primary, 아이콘 포함). `onDownload`, `downloading` props 추가. 진행 중이면 라벨 "저장 중…" + disable |
| **ResultPage 다운로드 핸들러** | `fetch(url, { mode: 'cors' }) → blob → URL.createObjectURL → anchor.click` 방식. cross-origin 이미지(placehold.co 등)도 받아진다. 파일명은 `stylefit_report_YYYYMMDD.<ext>` (Content-Type에서 확장자 추출, jpeg→jpg 정규화) |
| **실패 폴백** | CORS/네트워크 실패 시 `window.open(url, '_blank')`로 새 탭에서 직접 저장하도록 폴백 |
| **GA 이벤트** | `report_download_click`(`location: 'purchase_dialog_stage2'`), `report_download_success`(`size_kb`), `report_download_failed`(`reason: 'fetch_or_cors'`) |

### 2026-05-13 — 악성 사용자 차단 (쿠키/IP 밴 리스트)

| 항목 | 변경 |
|---|---|
| **목적** | 랜덤 쿠키만으로는 한 번 진단 제약을 우회하는 악성 사용자를 막을 수 없음. 운영자가 수동으로 쿠키/IP를 밴 리스트에 넣으면 사진 첨부 페이지 진입 + 분석 모듈 API 접근 자체를 차단 |
| **DDL** | `banned_user` 테이블 신규 — `cookie_id` / `ip_address` 둘 다 NULL 허용, **PK 없음**(한 사용자에 쿠키·IP를 각각의 행으로 또는 같은 행에 넣을 수 있도록). `reason` 컬럼으로 차단 사유 메모, `created_at` 자동. 부분 인덱스(`WHERE ... IS NOT NULL`)로 조회 최적화 |
| **H2 초기화** | JPA로 매핑하지 않은 PK-없는 테이블이라 `src/main/resources/schema.sql`에 별도 작성. `spring.jpa.defer-datasource-initialization=true` + `spring.sql.init.mode=embedded` 추가로 JPA 엔티티 생성 후에 실행 |
| **백엔드 도메인** | `com.stylefit.ban` 패키지 신규 — `BanService`(JdbcTemplate 기반 `isBanned(cookieId, ip)` + `extractClientIp` 헬퍼), `BanController`(`GET /api/ban/check`), `BanGuardInterceptor`, `BanCheckResponse` DTO. X-Forwarded-For/X-Real-IP 헤더 우선 처리 |
| **분석 API 전체 차단** | `BanGuardInterceptor`(HandlerInterceptor) + `WebConfig`로 등록 — `/api/analysis/**` 진입 시 차단 여부를 컨트롤러 진입 전에 검사, 매칭되면 `403 {"error":"banned"}` 즉시 반환. `start`/`submit-photo` 두 엔드포인트 모두 동일하게 가드되어 분석 비용(YuNet·AI 호출) 이전에 막힘 |
| **프론트 가드** | UploadPage 마운트 시 `/api/ban/check` → 차단이면 "이용 제한" 화면으로 교체(탭바 유지). 백엔드 인터셉터가 최종 방어선이라 우회 불가 |
| **차단 화면** | 기존 디자인 톤(딥그린 보더 + 페이퍼 카드) 재사용. X 아이콘 + "이용이 제한된 사용자입니다" + 홈으로 돌아가기 CTA. `up-banned*` 클래스 추가 |
| **GA 이벤트** | `ban_blocked`(`location: 'upload_mount'`) — 차단 사용자의 우회 시도 빈도 측정. PII 금지 원칙대로 cookie/IP raw값은 전송 안 함 |
| **운영 사용** | 어드민 UI 없음(MVP). 운영자가 H2 콘솔(`/h2-console`) 또는 Postgres에서 직접 `INSERT INTO banned_user (cookie_id, ip_address, reason) VALUES (...)`. 쿠키만 막을 땐 `ip_address`를 NULL, IP만 막을 땐 그 반대 |

### 2026-05-12 — 사용자 행동 신호 측정 (5종)

| 항목 | 변경 |
|---|---|
| **목적** | MVP 단계에서 "결제 의향을 무엇이 결정하는가"를 추정하기 위한 5가지 행동 신호를 GA + DB에 동시 적재. 홈 디버그 박스에서 한 사용자의 모든 신호를 한눈에 확인 가능 |
| **DDL** | `user_behavior` 테이블 신규 — `cookie_id` PK, `max_scroll_section/index`, `last_photo_dwell_ms`, `failed_attempts`, `result_revisit_count`, `last_photo_replaced` |
| **백엔드 도메인** | `com.stylefit.behavior` 패키지 — 엔티티/리포지토리/서비스(5개 메서드)/컨트롤러(GET + 5 POST)/응답 DTO |
| **신호 ①  스크롤 깊이** | ResultPage 각 N°XX 헤딩에 `data-rp-section/index` 박고 IntersectionObserver(threshold 0.5)로 도달 시 인덱스가 더 큰 경우만 서버/GA 전송. `result_scroll_depth` 이벤트 |
| **신호 ②  사진 망설임 시간** | UploadPage에서 처음 사진 첨부 시각을 ref로 기록, "분석 시작하기" 클릭 시 `Date.now()-attachedAt`을 ms로 전송. `photo_dwell_time` 이벤트 (`elapsed_ms`, `replaced`) |
| **신호 ③  검증 실패 누적** | LoadingPage `analysis_failed` 분기에서 `POST /api/user-behavior/analysis-failed` → 응답의 `failedAttempts`를 `analysis_failed` GA 이벤트의 `attempt_no` 파라미터로 함께 전송 |
| **신호 ④  결과 페이지 재방문** | ResultPage 마운트(데이터 로드 1회) 시 `POST /api/user-behavior/result-revisit`. 진단 후 며칠 후 돌아오는 사용자 비율 측정 |
| **신호 ⑤  사진 교체 횟수** | UploadPage `setFile`에서 기존 photo가 있던 상태에서 새 파일 들어오면 카운트++ + `photo_replaced` GA. 제출 시 마지막 카운트를 DB에 저장 |
| **홈 디버그 박스 확장** | `[DEBUG] 결제 의향` / `[DEBUG] 만족도 조사` / `[DEBUG] 행동 신호` 3개 섹션을 점선 구분선으로 분리. 만족도 코멘트는 ellipsis로 잘림. **운영 전 제거 대상** |

### 2026-05-12 — 만족도 평가에 성별 필드 추가

| 항목 | 변경 |
|---|---|
| **DDL** | `satisfaction_survey`에 `gender VARCHAR(10) NOT NULL` 컬럼 + `CHECK (gender IN ('MALE','FEMALE'))` 제약 추가. 이미 만들어진 컬럼이라 운영 마이그레이션 필요 시 별도 `ALTER TABLE` 스크립트 필요 |
| **백엔드** | `Gender` enum(`MALE`/`FEMALE`) 추가, `SatisfactionSurvey` 엔티티에 `@Enumerated(STRING)` 필드, `SatisfactionSurveyRequest`/`Response`에 `gender` 추가, `SatisfactionSurveyService.upsert`에 성별 null 검증 추가 |
| **다이얼로그 UI** | 별점/별점 라벨 아래에 남자/여자 토글 버튼 추가. `gender`가 `'MALE'`/`'FEMALE'` 둘 중 하나로 선택되어야 제출 활성화 |
| **GA 이벤트** | `survey_submit`/`survey_submit_failed` 파라미터에 `gender` 추가 — 성별별 만족도 분포·코멘트 작성률 분석 가능 |

### 2026-05-12 — 유료 리포트 결제 의향 측정 (MVP)

| 항목 | 변경 |
|---|---|
| **DB 스키마** | `purchase_intent` 테이블 추가 (`cookie_id` PK, `last_choice` ENUM 'YES'/'NO' default 'NO', `dialog_count` INTEGER default 0, `created_at`/`updated_at` + 트리거). 한 쿠키당 1건만 존재 |
| **백엔드 도메인** | `com.stylefit.purchase` 패키지 신규 — `PurchaseIntent`(엔티티), `PurchaseChoice`(YES/NO enum), `PurchaseIntentService`(markOpened/markYes), `PurchaseIntentRepository`, `PurchaseIntentController`, `PurchaseIntentResponse` |
| **API** | `GET /api/purchase-intent` (조회), `POST /api/purchase-intent/open` (다이얼로그 노출 — count++ & last_choice='NO'로 리셋), `POST /api/purchase-intent/yes` ("예" 클릭) |
| **ResultPage CTA 변경** | 기존 "이미지 다운로드 / 공유하기" 두 버튼 폐기 → 단일 CTA **"1,990원으로 이미지 리포트 받아보기"**. `result_action` GA 이벤트 중 `download`/`share` 분기도 함께 제거 |
| **결제 의향 다이얼로그** | `components/PurchaseIntentDialog.jsx` + `.css` — 2-stage 구조. Stage 1: "1,990원을 결제하시겠습니까?" + 예/아니오. Stage 2: "베타 테스트 기간이라 무료로 제공됩니다" + 리포트 이미지(`reportImageUrl`). 백드롭/아니오/X 클릭은 모두 stage 인자와 함께 `onClose(stage)` 호출 |
| **저장 정책** | 다이얼로그 노출 = `markOpened` (서버에 `NO` 기본값으로 미리 박음 → 사용자가 그냥 끄면 자연스럽게 'NO'로 남음). "예" 클릭 = `markYes` (덮어쓰기). 별도 "아니오" API 불필요. **이미 'YES'를 누른 사용자는 이후 `markOpened` 호출이 와도 count/state 모두 동결** — "예 누르기 전까지 몇 번 망설였는가"만 의미 있다는 MVP 측정 목적에 맞춤 |
| **HomePage 미리보기 카드 가리기** | `.hm-preview-hero` 하단에 그라디언트 페이드(`::after`) + 자물쇠 SVG + "결과는 진단 후 확인할 수 있어요" 라벨 추가, `.hm-ph-meta`는 opacity/blur로 흐릿하게 — 비밀스러운(잠긴 결과) 무드로 진단 CTA 클릭률을 높임 |
| **HomePage 디버그 표시** | MVP 검증용 — 현재 쿠키 사용자의 `lastChoice`/`dialogCount`를 카드로 노출. 데이터 없으면 "아직 누르지 않음". `hm-debug` 스타일은 점선 보더의 페이퍼 카드. **운영 전 제거 대상** |
| **GA 이벤트** | `purchase_dialog_open`, `purchase_choice` (`choice`: 'yes'/'no'). Stage 2에서 닫는 경우는 이미 'yes'를 박았으므로 'no'를 중복 전송하지 않도록 stage 분기 |

### 2026-05-12 — 리포트 만족도 평가

| 항목 | 변경 |
|---|---|
| **DB 스키마** | `satisfaction_survey` 테이블 추가 (`cookie_id` PK, `rating` SMALLINT 1~5, `comment` VARCHAR(300), `created_at`/`updated_at` + 트리거). `schema-postgres.sql`에 정의 — 한 쿠키당 1건만 존재(재제출 시 UPDATE) |
| **백엔드 도메인** | `com.stylefit.survey` 패키지 신규 — `SatisfactionSurvey`(엔티티), `SatisfactionSurveyRepository`, `SatisfactionSurveyService`(별점/코멘트 검증 포함 upsert), `SatisfactionSurveyController`, Request/Response DTO |
| **API** | `GET /api/survey/satisfaction` → 본인 평가 조회 (`exists`=false면 미작성), `POST /api/survey/satisfaction` → upsert. 둘 다 `AnonymousCookieFilter`가 주입한 `stylefit_uid` 기준 |
| **만족도 다이얼로그** | `components/SatisfactionDialog.jsx` + `.css` 신규 — 별 5개(반개 없음, 클릭으로 1~5 토글), textarea(300자 제한 + 글자수 카운터), `NoReportDialog` 톤(딥그린 보더 + 도장 그림자) |
| **ResultPage 연동** | "만족도 평가 →" 버튼 클릭 시 GET으로 기존 평가 조회 → 있으면 수정 모드(타이틀 "평가 수정하기" + 기존 값 채움), 없으면 신규 모드 → 제출 시 POST로 upsert |
| **GA 이벤트 추가** | `survey_open` (`is_edit`), `survey_submit` (`rating`, `comment_length`, `is_edit`), `survey_submit_failed` (`rating`) |
| **알려진 제약 (정책 미결)** | `SatisfactionSurveyService.upsert`는 `analysis_result`에 COMPLETED 레코드가 있는지 확인하지 않는다. 프론트 흐름상 ResultPage(결과 보유자만 접근)에서만 호출되므로 현재는 안전. "결과 없는 사용자가 평가 못 하게" 막을지는 추후 정책 결정 필요 — 막을 경우 `AnalysisResultRepository`를 주입해 COMPLETED 체크 후 `400`/`403` 반환 |

### 2026-05-12 — Google Analytics 4 적용

| 항목 | 변경 |
|---|---|
| **GA4 측정 코드 도입** | `frontend/src/analytics.js` 신규 — 외부 의존성 없이 gtag 스크립트 동적 로딩. `initGA / trackPageView / trackEvent / setUserId` 4개 API. `VITE_GA_ID`가 비어 있으면 NO-OP (dev 환경 자동 비활성) |
| **SPA 라우트 추적** | `components/AnalyticsTracker.jsx` 추가 — `useLocation` 기반 page_view 수동 전송. `App.jsx`에 `<AnalyticsTracker />` 마운트 |
| **퍼널 이벤트 박음** | HomePage: `cta_click` / UploadPage: `photo_selected`, `photo_rejected_client`, `analysis_submitted`, `analysis_reused`, `photo_resize_failed` / LoadingPage: `analysis_completed`(tone+elapsed), `analysis_failed`(reason) / ErrorPage: `retry_clicked` / ResultPage: `result_view`, `result_action`(download/share/survey) / useReportCheck: `my_report_click`, `no_report_dialog_action` |
| **환경 변수 분리** | `frontend/.env`에 `VITE_GA_ID=G-C7C57TNDKQ`. `.gitignore`에 이미 `frontend/.env` 등록되어 있어 안전. `.env.example` 템플릿 추가 |

### 2026-05-11 — 디자인 전면 교체 & UX 정비

| 항목 | 변경 |
|---|---|
| **디자인 패키지 적용** | Claude Design 핸드오프(StyleHomeMobile/UploadMobile/LoadingMobile/ErrorMobile/ReportMobile)를 React로 포팅. 기존 EntryPage/MenuPage는 폐기하고 HomePage로 통합 |
| **사진 업로드 1장 전용** | 백엔드: `submitPhoto(MultipartFile)` 단일 파라미터(`file`)로 변경, `MAX_PHOTOS` 상수 제거. 프론트: 상태 `photos[]` → `photo` 단일, `multiple` 속성 제거 |
| **15초 로딩 + 3단계 진행** | LoadingPage가 `submit-photo` 호출과 동시에 3단계 인디케이터 진행(5s씩). 응답 도착 + 최소 대기 둘 다 완료되면 `/result` 또는 `/error`로 이동. 백엔드는 `callAiAnalysis()`에 `Thread.sleep(15_000)` 삽입 |
| **한 번만 진단** | UploadPage `handleSubmit`에서 `/api/analysis/start` 선체크 → COMPLETED면 로딩/분석 스킵하고 바로 `/result`. 탭바 "내 리포트"도 동일 체크(공용 `useReportCheck` 훅) |
| **카메라 강제 열림 제거** | `<input>`의 `capture="user"` 제거. 모바일에서 OS 선택 시트로 카메라/갤러리 선택 가능 |
| **클라이언트 파일 검증** | JPG/PNG MIME + 확장자 더블 체크, 10MB 초과 거부. 거부 시 인라인 경고(`⚠`) 표시. `accept` 속성도 `image/jpeg,image/png`로 좁힘 |
| **가로 사진 짤림 해결** | UploadPage 프리뷰에서 `aspect-ratio: 3/4` 제거, `object-fit: contain` + `max-width/max-height`로 변경. 비율 그대로 표시 |
| **탭바 인디케이터 정확 매핑** | 각 페이지의 현재 탭만 active. `.X-tab.active::before`로 인디케이터 룰 통일(이전엔 `cta-tab` 한정) |
| **라우트 변경 시 스크롤 리셋** | `components/ScrollToTop.jsx` 추가 — `useLocation` pathname 변경마다 `window.scrollTo(0, 0)` |
| **레이아웃 / 모바일 프레임** | body 배경을 어두운 그린(`oklch(0.32 0.04 155)`)으로 변경하고 `display: flex` 제거. 각 `.X-frame`에 `margin: 0 auto`로 명시적 가운데 정렬 → 데스크톱에서 420px 모바일 프레임이 또렷이 보임 |
| **타이포그래피 정리** | Caveat(손글씨)/Black Han Sans(블록체) 일부 사용처 → Pretendard Variable 기반으로 교체. "쿨톤 계열"(weight 900) 등 볼드 가독성 확보. Upload 페이지의 "JPG · PNG · 최대 10MB", "또는 카메라로 바로 촬영" 라벨도 Pretendard로 통일 |
| **ResultPage 컴팩트화** | 베스트/워스트 컬러 5→3개씩(mock 데이터 단축). 헤어&액세서리/상황별 코디/쇼핑 검색어 → 컴팩트한 `ComingSoonCard`로 교체. 실패 방지 규칙은 Coming Soon 위로 이동(N°05). 하단 "더 받아보기" 업셀 섹션 제거 |
| **HomePage 무료 결과 미리보기 = 실 리포트 히어로 클론** | 기존 카드(추정 타입/무드 칩/팔레트 블러) 제거하고 ResultPage `.rp-hero`와 동일한 다크그린 카드로 교체. 메타 우측을 "🔒 preview"로 표기해 미리보기임을 명시 |
| **헤더 정리** | UploadPage/ResultPage 상단의 좌측 뒤로가기 / 상하 점프 아이콘 버튼 모두 제거, 타이틀만 가운데 표시 |
| **"내 리포트" 다이얼로그** | 결과가 없는 상태에서 탭바 "내 리포트" 클릭 시 디자인 톤의 모달(`NoReportDialog`) 노출 — "닫기"/"진단 받기" 버튼 |
| **UploadPage 섹션 재배치** | "좋은 사진 조건" 가이드 그리드를 CTA 아래(탭바 위) 맨 밑으로 이동 |

### 그 전 이슈 정리

| 이슈 | 원인 | 수정 |
|---|---|---|
| 사진 분석이 너무 오래 걸림 | `FaceDetectorYN.create()`를 사진마다 호출 → ONNX 모델을 반복 로딩 | 생성자에서 한 번만 로딩하고 `synchronized`로 재사용 |
| 서버 부팅 시 `UnsatisfiedLinkError` | 생성자에서 OpenCV 호출 시점에 네이티브 라이브러리 미로딩 (`OpenCvConfig`의 `@PostConstruct`보다 빠름) | 생성자 맨 앞에서 `nu.pattern.OpenCV.loadLocally()` 직접 호출 |
| 모바일 사진 분석이 매우 느림 | 모바일 카메라 원본(4000×3000 / 8MB)을 그대로 업로드/탐지 | 프론트에서 캔버스로 1280px JPEG 리사이즈 후 업로드 + 백엔드에서도 640px 다운스케일 후 YuNet 입력 |
| Spring Boot 기본 1MB 업로드 제한 | `application.properties`에 multipart 설정 없음 | `max-file-size=20MB`, `max-request-size=60MB` 추가 |
| 서버 500 응답 시 프론트 무한 로딩 | `data.status` 분기에서 매칭 안 되면 `setUploading(false)`가 호출 안 됨 | `else` 분기 추가 |
| 모바일에서만 "서버 연결 실패" | `SecurityConfig`의 CORS 허용 origin이 `localhost`/`127.0.0.1` 고정 → 모바일은 `192.168.x.x` origin으로 보내서 403 차단 | `setAllowedOriginPatterns(List.of("*"))` 로 변경 |
| Vite proxy 모바일 노출 | 기본은 localhost-only | `host: true` 추가 |

---

## 7. Google Analytics (GA4) 측정 항목

GA4를 통해 익명 사용자의 행동을 수집해 퍼널 이탈률·검증 실패 사유·디바이스 분포 등을 파악한다.
**개인정보(사진 데이터, 얼굴 정보, 쿠키 raw값, 이메일 등)는 절대 이벤트 파라미터로 보내지 않는다.**

> ### ⚠ 신규 기능 추가 시 필수 규칙 — Claude 세션 공통
>
> **이 프로젝트의 모든 새 기능에는 반드시 GA 이벤트도 함께 추가한다.** 다음 세션·다음 작업에서도 이 규칙은 유지된다.
>
> - 새 버튼/CTA → `trackEvent('xxx_click', { location, ... })` 박기
> - 새 API 호출 → 성공/실패 분기마다 이벤트 (예: `xxx_submitted`, `xxx_failed` with `reason`)
> - 새 다이얼로그/모달 → `xxx_open`, `xxx_action` (close/confirm 등)
> - 새 페이지 → 별도 코드 불필요 (`AnalyticsTracker`가 자동으로 `page_view` 전송) — 단, 페이지 내 핵심 행동에는 커스텀 이벤트 박기
> - 7.3 표(커스텀 이벤트)에 **새 이벤트를 반드시 한 줄 추가**해 문서와 코드를 일치시킨다
> - PII(사진, 얼굴, 코멘트 원문, 쿠키 raw값 등)는 절대 파라미터로 보내지 않는다. 카테고리값(`personal_color: '쿨톤'`)·길이값(`comment_length`)·사유 코드(`reason: 'validation_failed'`)만 보낸다
> - 이 규칙을 어기면 퍼널 분석에 빈 구간이 생겨 의사결정이 불가능해진다 — 코드가 동작해도 "측정 누락"은 미완성으로 간주

### 7.1 설정

- **측정 ID**: `G-C7C57TNDKQ`
- **환경 변수**: `frontend/.env`의 `VITE_GA_ID` (값이 비어 있으면 `analytics.js`가 자동으로 NO-OP — dev 환경에서 통계 오염 방지)
- **헬퍼**: `frontend/src/analytics.js`
- **SPA 추적**: `components/AnalyticsTracker.jsx`가 `useLocation`으로 라우트 변경마다 `page_view` 수동 전송 (`send_page_view: false`로 자동 전송은 꺼둠)

### 7.2 자동 수집 정보 (page_view 기반)

| 영역 | 보이는 것 |
|---|---|
| 페이지 트래픽 | `/`, `/upload`, `/loading`, `/error`, `/result` 각 페이지의 조회수·체류시간·이탈률 |
| 사용자 | DAU/WAU, 신규 vs 재방문 |
| 디바이스 | OS·브라우저·해상도 (모바일 우선 앱이라 iOS Safari vs Android Chrome 비율 핵심) |
| 유입 | 소스(검색/직접/SNS), UTM 캠페인 |
| 지역/시간대 | 어느 지역·어느 시간대에 진단 시도가 몰리는지 |

### 7.3 커스텀 이벤트

> **공통 파라미터**: `?ref=` 파라미터가 있는 접속에서는 모든 이벤트에 `ref` 값이 자동 첨부됨 (`analytics.js trackEvent` 레벨에서 주입). GA4 맞춤 측정기준으로 등록하면 ref별 퍼널 분석 가능.

| 이벤트 | 파라미터 | 트리거 위치 | 알 수 있는 인사이트 |
|---|---|---|---|
| `cta_click` | `cta`, `location` | HomePage 히어로 CTA, 탭바 진단하기 | 어느 위치 CTA가 진단 전환에 더 기여하는가 |
| `photo_selected` | `size_kb` | UploadPage 사진 첨부 성공 | 업로드 페이지 도달 → 실제 첨부 비율 |
| `photo_rejected_client` | `reason` (`mime_or_ext`/`size`), `file_type`, `size_mb` | UploadPage 클라이언트 검증 거부 | 거부 사유 분포 — HEIC 등 미지원 포맷 비율, 10MB 초과 비율 |
| `analysis_submitted` | `resized_kb` | UploadPage `handleSubmit` 후 `/loading` 진입 | 진단 시도 수 (퍼널 핵심 지표) |
| `analysis_reused` | `source` | UploadPage에서 기존 COMPLETED 발견 시 | "한 번 진단" 제약으로 캐시 결과 보는 횟수 (재방문 의도 지표) |
| `photo_resize_failed` | — | UploadPage 캔버스 리사이즈 실패 | 브라우저/이미지 호환성 이슈 |
| `analysis_completed` | `personal_color`, `main_type`, `elapsed_ms`, `face_image_saved` | LoadingPage 백엔드 응답 성공 | 톤 카테고리 분포, 평균 분석 소요시간, 얼굴 이미지 저장 성공률 |
| `analysis_failed` | `reason` (`validation_failed`/`in_progress_409`/`network`/`unknown`), `elapsed_ms`, `attempt_no` | LoadingPage 백엔드 응답 실패 | 백엔드 검증 실패 사유 분포, 누적 실패 횟수별 이탈 비교(2·3회차 좌절 시그널) |
| `retry_clicked` | `reason`, `location` (`error_cta`/`error_tabbar`) | ErrorPage 재시도 CTA | 검증 실패 후 재시도율 — 이탈 vs 재도전 |
| `result_view` | `personal_color`, `main_type` | ResultPage 최초 진입 (1회만) | 결과 페이지 진입 수 (실 완료자 수) |
| `result_action` | `action` (`survey_click`) | ResultPage 만족도 평가 버튼 | 만족도 평가 시도 클릭 수 |
| `my_report_click` | `location`, `has_report` | 탭바 "내 리포트" | 결과 보유자 vs 미보유자 클릭 비율 |
| `no_report_dialog_action` | `action` (`close`/`go_diagnose`), `location` | NoReportDialog 버튼 | 다이얼로그가 미진단자를 진단으로 유도하는가 |
| `survey_open` | `is_edit` | ResultPage 만족도 평가 버튼 → GET 조회 후 | 평가 다이얼로그 노출 횟수, 수정/신규 비율 |
| `survey_submit` | `rating` (1~5), `gender` (`MALE`/`FEMALE`), `comment_length`, `is_edit` | SatisfactionDialog 제출 성공 | 별점 분포, 성별별 만족도, 코멘트 작성률, 평균 만족도 |
| `survey_submit_failed` | `rating`, `gender` | 저장 실패 (네트워크/서버 오류) | 만족도 저장 실패율 |
| `purchase_dialog_open` | — | ResultPage "1,990원 받아보기" CTA 클릭 | 결제 다이얼로그 노출 수 (CTA 매력도) |
| `purchase_choice` | `choice` (`yes`/`no`) | Stage 1에서 "예" 또는 닫기 | 결제 의향 비율 — MVP 결제 가치 검증 핵심 지표 |
| `result_scroll_depth` | `section` (`hero`/`type`/`best_colors`/`worst_colors`/`clothing`/`rules`/`hair_accessories`/`situation`/`shop`/`survey`/`purchase`), `index` (0~10) | ResultPage 섹션이 viewport 50% 이상 노출 | 결제 다이얼로그 열기 전까지 도달한 섹션 — 어떤 콘텐츠가 결제 동기를 만드는지 추론 |
| `photo_dwell_time` | `elapsed_ms`, `replaced` | 사진 첨부 → "분석 시작하기" 클릭 사이 | 사진 선택 망설임 시간 + 가이드 카드 효과 측정 |
| `photo_replaced` | `count` (세션 누적) | UploadPage에서 사진 첨부된 상태에서 다시 다른 파일 첨부 | "사진 한 장이면 충분" 카피의 부담 완화 효과 |
| `ban_blocked` | `location` (`upload_mount`, `analysis_submit`) | UploadPage 마운트 시 또는 submit-photo 호출 시 백엔드가 403 banned 반환 | 차단된 사용자의 우회 시도 빈도 — 차단 정책 효과 측정 |
| `rate_limit_blocked` | `location` (`analysis_submit`), `elapsed_ms` | submit-photo 호출이 429로 거부됨 | 일일 한도(기본 50)에 도달한 사용자 비율 — 한도값 튜닝 근거 |
| `not_found_view` | `path_length` | NotFoundPage 마운트 (잘못된 경로 진입) | 404 발생 빈도 — 외부 링크 깨짐/오타 패턴 추정 (`path_length`만 보내 PII 회피) |
| `not_found_action` | `action` (`home`/`diagnose`), `location` (`nf_cta`/`nf_link`/`nf_tabbar`) | NotFoundPage 버튼 클릭 | 404 → 정상 흐름 복귀율, 어느 버튼이 효과적인지 |
| `report_download_click` | `location` (`purchase_dialog_stage2`) | PurchaseIntentDialog Stage 2 "다운로드" 클릭 | 리포트 이미지 저장 시도 비율 — 결제 가치 검증 보조 지표 |
| `report_download_success` | `size_kb` | 이미지 blob 다운로드 성공 | 실제 저장까지 도달 비율, 이미지 크기 분포 |
| `report_download_failed` | `reason` (`fetch_or_cors`) | blob fetch 실패 → 새 탭 폴백 | 다운로드 실패율(CORS·네트워크) — 운영 도메인 추가 시 0에 수렴해야 정상 |
| `report_image_resolved` | `source` (`generated`/`cached`) | ResultPage 첫 마운트 1회 (응답에 `reportImageCached` 들어있을 때) | 리포트 이미지 캐시 적중률 — 첫 진단 vs 재방문 비율, AI 모듈 호출 절감 효과 측정 |
| `share_create_click` | `has_token` (true/false) | ResultPage 공유 섹션 버튼 클릭 | 공유 시도 클릭 수, 첫 발급 vs 재공유 비율 |
| `share_create_failed` | `reason` (`network`) | 공유 토큰 발급 API 실패 | 공유 발급 실패율 |
| `share_kakao_click` | — | ShareDialog "카카오톡으로 공유" 버튼 클릭 | 카카오 vs URL 복사 선택 비율 |
| `share_link_copied` | — | ShareDialog "URL 복사" 클릭 성공 (clipboard API 실패 시 execCommand silent fallback) | URL 복사 선택 비율 |
| `share_view` | `personal_color`, `main_type`, `is_owner` (true/false) | SharePage 마운트 성공 | 공유 링크 클릭 → 페이지 진입 수, 본인 재방문 vs 외부 진입 비율, 어떤 톤이 가장 많이 공유되는지 |
| `share_view_failed` | `reason` (`not_found`/`network`/`error`) | SharePage 결과 조회 실패 | 폐기된 링크 클릭 빈도, 네트워크 오류 등 |
| `share_diagnose_click` | `has_my_report` (true/false) | SharePage "나도 검사해보기" CTA | 공유 → 진단 전환율 (바이럴 핵심 지표) |
| `share_compare_click` | — | SharePage "내 결과와 비교해보기" 클릭 | 비교 기능 진입 시도 |
| `share_compare_view` | `my_color`, `other_color` | ComparePage 마운트 성공 | 비교 페이지 도달 수, 같은 톤 vs 다른 톤 매칭 분포 |

### 7.4 핵심 퍼널 (GA4 "탐색" 메뉴에서 구성)

```
1. page_view  (page_path = "/")
2. page_view  (page_path = "/upload")
3. photo_selected
4. analysis_submitted
5. result_view
```

각 단계 이탈률로 어느 구간에서 사용자가 가장 많이 떠나는지 확인.
보조 분기:
- `analysis_submitted` → `analysis_failed` vs `analysis_completed` 비율 = **검증 통과율**
- `analysis_failed` → `retry_clicked` 비율 = **실패 후 재시도율**
- `my_report_click` `has_report=false` → `no_report_dialog_action` `action=go_diagnose` 비율 = **다이얼로그 전환율**

### 7.5 GA4 콘솔에서 추가 설정할 항목 (선택)

- **주요 이벤트(전환) 지정**: `result_view`, `analysis_submitted`를 전환 이벤트로 표시 → 광고/캠페인 효과 측정
- **DebugView 활성화**: 적용 직후 [Google Analytics Debugger 확장](https://chrome.google.com/webstore/detail/google-analytics-debugger/jnkmfdileelhofjcijamephohjechhna) 켜고 이벤트 1건씩 검증
- **데이터 보존 기간**: 기본 2개월 → 14개월로 늘리는 것 권장 (관리 → 데이터 설정 → 데이터 보존)
- **IP 익명화**: 코드에서 `anonymize_ip: true` 이미 설정됨

### 7.6 운영 단계 체크리스트

- [ ] 개인정보처리방침에 "Google Analytics 사용" 명시
- [ ] 운영 도메인을 GA4 속성의 웹 스트림에 추가 등록
- [ ] CI/CD에서 `VITE_GA_ID` 환경변수로 주입 (또는 `.env.production` 별도 운영)
- [ ] CSP 도입 시 `https://www.googletagmanager.com`, `https://www.google-analytics.com` 허용
- [ ] `stylefit_uid` 쿠키를 `setUserId()`로 매핑 (장기 사용자 추적, 선택)

---

## 8. 유입 경로 추적 운영 가이드

### 8.1 링크 만드는 법

공유할 URL 뒤에 `?ref=<채널명>`을 붙이면 된다.

```
https://stylefit.com/?ref=instagram
https://stylefit.com/?ref=kakao-story
https://stylefit.com/?ref=naver-blog
https://stylefit.com/?ref=youtube
https://stylefit.com/?ref=thread
```

**ref 값 규칙**
- 영소문자 `a-z`, 숫자 `0-9`, 하이픈 `-`, 언더스코어 `_` 만 허용
- 최대 20자 (초과 시 자동 절삭)
- 대문자·한글·특수문자는 서버에서 자동 제거 → 남은 값이 없으면 ref 미기록 (direct 처리)

### 8.2 데이터 수집 원리

```
사용자가 /?ref=instagram 으로 최초 접속
        ↓
브라우저 sessionStorage 에 sf_ref = "instagram" 저장
        ↓
첫 API 요청 (fetch 인터셉터) → X-Ref: instagram 헤더 자동 첨부
        ↓
AnonymousCookieFilter → 쿠키 없음 → <uuid>_instagram 발급 (HttpOnly, 30일)
        ↓
이후 모든 DB 저장 (analysis_result, satisfaction_survey, user_behavior 등)
cookie_id = "<uuid>_instagram"
```

**중요: ref는 최초 1회만 기록된다**
- 쿠키가 이미 존재하면 `?ref=` 값이나 `X-Ref` 헤더는 **완전히 무시**된다
- 쿠키는 HttpOnly이므로 JS에서 읽거나 수정 불가 → 브라우저 쿠키 삭제 전까지 ref 변경 불가
- 직접 접속(ref 없음) 후 쿠키가 발급된 사용자는 나중에 ref 링크를 눌러도 `direct`로 유지

### 8.3 어드민 대시보드에서 확인하는 법

1. `/admin` 접속 → 로그인
2. **"유입 경로 분석"** 섹션 확인
   - **유입 경로 (ref)**: 링크에 붙인 채널명. ref 없는 사용자는 `direct`
   - **분석 제출**: 해당 채널에서 온 사용자 중 실제로 분석을 시도한 수
   - **완료**: 검증 통과 후 결과를 받은 수
   - **완료율**: 완료 / 제출 × 100

### 8.4 ref 별 퍼널 분석 (GA4)

`trackEvent`가 모든 이벤트에 `ref` 파라미터를 자동 첨부하므로 GA4에서도 채널별 분석이 가능하다.

1. GA4 콘솔 → **맞춤 측정기준** → `ref` 등록 (이벤트 범위)
2. **탐색** → 자유 형식 → 측정기준에 `ref`, 측정항목에 `이벤트 수` 추가
3. `analysis_completed` 이벤트만 필터링하면 채널별 진단 완료 수 확인 가능

---

## 9. 남은 작업

### 백엔드
- [ ] Python AI 분석 서버 연동 (`callAiAnalysis`, `callAiReportGenerator` 교체 + 임시 `Thread.sleep(15s)` 제거)
- [ ] PROCESSING 저장과 COMPLETED 저장을 별도 트랜잭션으로 분리 (현재 한 트랜잭션이라 PROCESSING 상태가 실제 커밋되지 않음)
- [ ] AI 호출 타임아웃 / 재시도 정책
- [ ] 운영용 CORS 설정 (현재 `*`은 개발 전용)

### 프론트엔드
- [ ] 헤어 & 액세서리 / 상황별 코디 / 쇼핑 검색어 — 현재 Coming Soon. 실제 데이터 연동 시 디자인 복원
- [ ] "내 리포트" 탭 — 다건 보관 / 리포트 히스토리 UI (현재는 단건만)
- [ ] 리포트 이미지 실제 URL 연동 (현재 placehold.co)
- [ ] HEIC 등 미지원 포맷 처리 분기 (현재는 JPG/PNG만 허용, HEIC는 클라이언트에서 거부)
- [ ] 분석 진행 상태 폴링 (Python 서버 연동 후 — 현재는 단일 동기 호출 + 최소 15초 대기)
- [ ] **카카오 공유 설정** — `frontend/.env`에 `VITE_KAKAO_APP_KEY` 발급 및 등록 필요. ① [developers.kakao.com](https://developers.kakao.com) 로그인 → 앱 추가 → **JavaScript 키** 복사 → `.env`에 입력. ② 앱 설정 → 플랫폼 → Web에 서비스 도메인 등록 (개발: `http://localhost:5173`, 운영: `https://내도메인.com`). 키 없이는 카카오 공유 버튼 클릭 시 "설정이 되어 있지 않습니다" 오류 표시됨

### 인프라/배포
- [ ] Postgres 연결 (`schema-postgres.sql` 준비됨)
- [ ] 운영용 application-prod.properties 마무리
- [ ] HTTPS 적용 (쿠키 Secure 활성화)

### 측정/분석 (GA4)
- [ ] GA4 콘솔에서 `result_view`, `analysis_submitted`, `survey_submit`을 전환 이벤트로 지정
- [ ] 운영 도메인 등록 + 개인정보처리방침 GA 사용 고지
- [ ] `stylefit_uid` 쿠키 → `setUserId()` 매핑으로 장기 사용자 추적 (선택)

### 만족도 평가
- [ ] 운영자용 만족도 평가 조회 화면 / 어드민 export (CSV 등)
- [ ] 별점 임계치(예: 1~2점) 알림 — 운영팀 슬랙 등으로 푸시
- [ ] 코멘트 텍스트 마이닝 / 키워드 추출 (집계용)

### 유료 리포트 (결제 의향 측정 이후)
- [ ] 베타 종료 후 다이얼로그 Stage 2 문구/이미지 교체 (실제 결제 → 결제 게이트웨이 연동)
- [ ] 결제 의향 데이터(`purchase_intent`) 어드민 대시보드 / 집계 쿼리 (전환율 = YES / dialog_count)
- [ ] 단가 A/B 테스트(1,990 vs 2,990 등) — 결정 후 GA 파라미터에 가격 추가
- [ ] 행동 신호(`user_behavior`) ⇄ 결제 의향 상관관계 분석 — 어느 스크롤 도달 사용자가 'YES' 많이 누르는가, 검증 실패 N회차 사용자의 결제 의향, 사진 망설임 길이별 의향 등

---

## 10. 디렉토리 트리 (요약)

```
StyleFit/
├── build.gradle
├── src/main/
│   ├── java/com/stylefit/        # 백엔드 소스
│   └── resources/
│       ├── application.properties
│       ├── application-prod.properties
│       ├── models/face_detection_yunet_2023mar.onnx
│       ├── pictures/             # 테스트 이미지
│       ├── ddl/schema-postgres.sql
│       └── static/               # 프론트 빌드 산출물 (Vite 빌드 시 자동 갱신)
├── frontend/
│   ├── package.json
│   ├── vite.config.js            # /api 프록시, host: true
│   ├── index.html                # Pretendard Variable CDN + Google Fonts
│   ├── .env                      # VITE_GA_ID (gitignore, 커밋 안 됨)
│   ├── .env.example              # env 템플릿
│   └── src/
│       ├── App.jsx               # 라우터 + ScrollToTop + AnalyticsTracker
│       ├── App.css               # 디자인 토큰(:root vars), 모바일 프레임 가운데 정렬
│       ├── main.jsx              # initGA() 호출
│       ├── analytics.js          # GA4 gtag 동적 로딩 헬퍼 (트리거: initGA/trackPageView/trackEvent/setUserId)
│       ├── components/
│       │   ├── ScrollToTop.jsx         # 라우트 변경 시 최상단 스크롤
│       │   ├── AnalyticsTracker.jsx    # 라우트 변경 시 GA page_view 전송
│       │   ├── NoReportDialog.jsx + .css      # "결과 없음" 모달
│       │   ├── SatisfactionDialog.jsx + .css  # 만족도 평가(별 5개 + 300자 textarea)
│       │   ├── PurchaseIntentDialog.jsx + .css # 결제 의향(2-stage: 확인 → 베타 무료 안내+이미지)
│       │   └── ShareDialog.jsx + .css  # 공유 팝업 (카카오톡 / URL 복사)
│       ├── hooks/
│       │   └── useReportCheck.jsx    # 탭바 "내 리포트" 클릭 공용 훅 (GA 이벤트 포함)
│       └── pages/
│           ├── HomePage.jsx + .css       # 랜딩 (Entry+Menu 통합)
│           ├── UploadPage.jsx + .css     # 사진 1장 업로드 + 클라이언트 검증
│           ├── LoadingPage.jsx + .css    # 3단계 진행 + 팩트 캐러셀
│           ├── ErrorPage.jsx + .css      # 검증 실패 화면
│           ├── ResultPage.jsx + .css     # Style Report Mobile + Coming Soon 카드
│           ├── AdminPage.jsx + .css      # 어드민 대시보드
│           └── AdminBanPage.jsx + .css   # 사용자 차단 관리 (쿠키/IP 밴)
└── PROJECT_STATUS.md             # 이 문서
```
