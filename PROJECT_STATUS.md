# StyleFit

> AI 퍼스널컬러 진단 모바일 웹앱 · 최종 정리: 2026-06-07

사진 한 장을 업로드하면 AI가 퍼스널컬러(봄웜·여름쿨·가을웜·겨울쿨)를 분석해
**컬러 · 코디 추천 리포트**를 보여주는 모바일 우선 웹앱. 로그인 없이 **익명 쿠키** 기반으로 동작한다.

**핵심 사용자 흐름**
```
홈(/) → 사진 업로드(/upload) → AI 분석 로딩(/loading) → 결과 리포트(/result)
                                                       └ 검증 실패 시 /error
```
> 한 쿠키당 진단 1회. 이미 완료한 사용자가 다시 들어오면 로딩 없이 저장된 결과를 바로 보여준다.

---

## 1. 기술 스택

| 영역 | 기술 |
|---|---|
| 백엔드 | Spring Boot 3.4.0, Java 17, Gradle |
| DB | PostgreSQL 14+ (`localhost:5432/stylefit`) / DDL: `ddl/schema-postgres.sql` |
| 비전 | OpenCV 4.9.0 (openpnp) + YuNet ONNX (얼굴 탐지·사진 품질 검증) |
| AI 분석 | 외부 Python 모듈 `POST /personal-color/analyze` (HTTP 연동) |
| 프론트 | React 18, Vite 5, React Router 7 |
| 보안 | Spring Security (STATELESS) + Origin 화이트리스트 CSRF 방어 + 익명 쿠키 |
| 분석 | Google Analytics 4 (`analytics.js`) |

빌드 산출물: 프론트(`npm run build`) → `src/main/resources/static/`로 번들 → `bootJar`가 한 JAR로 패키징.

---

## 2. 빠른 시작 (로컬 개발)

```bash
# 백엔드 (포트 8080)
./gradlew bootRun

# 프론트 (포트 5173, /api 요청은 8080으로 프록시)
cd frontend && npm install && npm run dev
```

- 모바일 동일 Wi-Fi 테스트: Vite `host: true` 설정됨 → `http://<PC_IP>:5173`
- DB: PostgreSQL (`localhost:5432/stylefit`, 계정 `ddalkkak`)
- 환경 변수: `frontend/.env` (`.env.example` 참고) — `VITE_GA_ID`, `VITE_KAKAO_APP_KEY`

---

## 3. 아키텍처

### 백엔드 패키지 (`com.stylefit`)

| 패키지 | 역할 | 주요 엔드포인트 |
|---|---|---|
| `analysis` | 진단 오케스트레이션(검증→AI호출→저장) | `POST /api/analysis/start`, `/submit-photo` |
| `vision` | YuNet 얼굴 탐지 + 밝기 기반 사진 품질 검증 | — (analysis 내부 + 별도 검증 엔드포인트) |
| `share` | 공유 토큰 + 동적 OG 메타 태그 + OG 이미지 생성 | `POST /api/share/create`, `GET /share/{token}`, `/og-image.png` |
| `survey` | 리포트 만족도 평가 (별점·성별·코멘트) | `GET·POST /api/survey/satisfaction` |
| `purchase` | 유료 리포트 결제 의향 측정 (MVP) | `GET /api/purchase-intent`, `/open`, `/yes` |
| `behavior` | 사용자 행동 신호 5종 수집 (MVP 분석용) | `GET /api/user-behavior` + 5개 POST |
| `auth` | `AnonymousCookieFilter` — `stylefit_uid` 쿠키 자동 발급/검증 | (모든 요청) |
| `ban` | 악성 사용자 쿠키/IP 차단 | `GET /api/ban/check` (+ `/api/analysis/**` 가드) |
| `ratelimit` | 일일 AI 호출 한도 (글로벌·쿠키별·IP별) | (analysis 내부 소비) |
| `admin` | 어드민 대시보드 통계 + 차단 관리 | `GET /api/admin/stats/*` |
| `product` | 메뉴/상품 메타 | `GET /api/products` |
| `config` | 보안/CORS/정적리소스/SPA 폴백/OpenCV 설정 | — |

### 분석 플로우 (`AnalysisService.submitPhoto`)

```
요청 → AnonymousCookieFilter(쿠키 확인/발급)
     → BanGuardInterceptor(/api/analysis/** 차단 검사 → 403)
     → AnalysisService
         ├ 기존 레코드: COMPLETED면 재사용 / PROCESSING이면 409
         ├ PhotoValidationService: 디코드 → 640px 리사이즈 → YuNet 얼굴탐지 → 밝기
         ├ 검증 실패 → VALIDATION_FAILED (한도 소비 X)
         ├ RateLimitService.tryConsume() — AI 호출 직전에만 한도 소비
         ├ 얼굴 이미지 저장(./face-images) → AI 분석 호출 → 리포트 이미지 캐싱(./report-images)
         └ status=COMPLETED 저장 + 응답
```

**한도 소비 원칙**: 실제 AI 모듈을 호출하는 경우에만 카운트를 깎는다. (캐시 재사용·사진 미첨부·검증 실패·PROCESSING 충돌은 소비 X)

### 프론트 페이지

| 경로 | 컴포넌트 | 역할 |
|---|---|---|
| `/` | HomePage | 랜딩 (히어로 + 무료 결과 미리보기 + CTA) |
| `/upload` | UploadPage | 사진 1장 + 성별 선택, 클라이언트 검증(JPG/PNG/HEIC) |
| `/loading` | LoadingPage | 분석 진행 바 + 계절 타입 티저 (이탈 방지 UX) |
| `/error` | ErrorPage | 사진 검증 실패 / 한도 초과 안내 + 재시도 |
| `/result` | ResultPage | 리포트 (타입·베스트/워스트 컬러·코디·실패방지·저장&공유) |
| `/share/:token` | SharePage | 공유 링크 진입 (외부 방문자용 결과 뷰) |
| `/compare/...` | ComparePage | 내 결과 vs 공유 결과 비교 |
| `/admin`, `/admin/ban` | AdminPage 등 | 어드민 대시보드 / 차단 관리 |
| `*` | NotFoundPage | 404 |

공용: `ScrollToTop`, `AnalyticsTracker`(GA page_view), `useReportCheck`(탭바 "내 리포트"), 다이얼로그들(`NoReport`/`Satisfaction`/`PurchaseIntent`/`Share`).

### 디자인 시스템
- `oklch()` 그린 팔레트 + 골드(`#e7d8a8`) 포인트, 종이톤 카드, 점선 보더
- 모바일 우선 `max-width: 420px` 가운데 정렬, 하단 고정 탭바(홈/진단하기/내 리포트)
- 폰트: Pretendard Variable (본문), Caveat (포인트 손글씨)

---

## 4. 인증 · 유입 추적

- **로그인 없음.** `AnonymousCookieFilter`가 모든 요청에 `stylefit_uid` 쿠키 발급 (HttpOnly, 30일, SameSite, HTTPS면 Secure).
- **한 쿠키 + 한 상품 = 진단 1건** (DB unique 제약).
- **유입 추적(ref)**: 링크에 `?ref=instagram` 등을 붙이면 sessionStorage→`X-Ref` 헤더→쿠키 발급 시 `<uuid>_instagram` 형태로 내장. 이후 모든 데이터의 `cookie_id`가 유입 채널을 내포한다.
  - ref 규칙: 영소문자/숫자/`-`/`_`, 20자 이내. **최초 1회만 기록**(쿠키 발급 후 변경 불가).
  - 공유 링크 유입은 `<ref>_share` suffix로 별도 추적.
  - 어드민 "유입 경로 분석" 섹션에서 채널별 제출/완료/완료율 확인.

---

## 5. Google Analytics (GA4) 측정

> ### ⚠ 신규 기능 추가 시 필수 규칙 (세션 공통 — 반드시 유지)
> **이 프로젝트의 모든 새 기능에는 GA 이벤트를 함께 추가하고, 아래 5.2 표에 한 줄 등록한다.**
> - 새 버튼/CTA → `trackEvent('xxx_click', { location, ... })`
> - 새 API → 성공/실패 분기마다 이벤트 (`xxx_submitted` / `xxx_failed` with `reason`)
> - 새 다이얼로그 → `xxx_open`, `xxx_action`
> - **PII(사진·얼굴·코멘트 원문·쿠키 raw값·이메일)는 절대 파라미터로 보내지 않는다.** 카테고리값·길이값·사유 코드만 전송.
> - 측정 누락은 코드가 동작해도 "미완성"으로 간주한다.

### 5.1 설정
- 측정 ID: `G-C7C57TNDKQ` (`frontend/.env`의 `VITE_GA_ID`, 비어 있으면 자동 NO-OP)
- 헬퍼: `analytics.js` (`initGA/trackPageView/trackEvent/setUserId`), SPA 추적: `AnalyticsTracker.jsx`
- `?ref=` 접속 시 모든 이벤트에 `ref` 자동 첨부

### 5.2 커스텀 이벤트

| 이벤트 | 주요 파라미터 | 트리거 |
|---|---|---|
| `cta_click` | `cta`, `location` | 홈 히어로/탭바 진단 CTA |
| `photo_selected` / `photo_rejected_client` | `size_kb` / `reason` | 사진 첨부 성공/거부 |
| `photo_replaced` / `photo_dwell_time` | `count` / `elapsed_ms` | 사진 교체·망설임 시간 |
| `analysis_submitted` | `resized_kb`, `gender` | 분석 시도 (퍼널 핵심) |
| `analysis_reused` | `source` | 캐시 결과 재사용 |
| `analysis_completed` | `personal_color`, `main_type`, `elapsed_ms`, `gender`, `face_image_saved` | 분석 성공 |
| `analysis_failed` | `reason`, `elapsed_ms`, `attempt_no` | 분석 실패 |
| `retry_clicked` | `reason`, `location` | 실패 후 재시도 |
| `loading_teaser_shown` | `expected_seconds` | 로딩 티저 노출 |
| `result_view` / `result_action` | `personal_color` / `action` | 결과 진입 / 만족도 버튼 |
| `result_scroll_depth` | `section`, `index` | 결과 섹션 50% 노출 |
| `my_report_click` / `no_report_dialog_action` | `has_report` / `action` | 탭바 "내 리포트" 흐름 |
| `survey_open` / `survey_submit` / `survey_submit_failed` | `is_edit`, `rating`, `gender`, `comment_length` | 만족도 평가 |
| `purchase_dialog_open` / `purchase_choice` | `choice` (yes/no) | 결제 의향 (MVP 핵심) |
| `report_download_click/success/failed` | `location`, `size_kb`, `reason` | 리포트 이미지 다운로드 |
| `report_image_resolved` | `source` (generated/cached) | 리포트 이미지 캐시 적중률 |
| `share_create_click/failed` | `has_token`, `reason` | 공유 토큰 발급 |
| `share_kakao_click` / `share_link_copied` | — | 카카오 공유 / URL 복사 |
| `share_view` / `share_view_failed` | `personal_color`, `is_owner` / `reason` | 공유 페이지 진입 |
| `share_diagnose_click` / `share_compare_click` / `share_compare_view` | `has_my_report`, `my_color`, `other_color` | 공유→진단·비교 전환 |
| `ban_blocked` / `rate_limit_blocked` | `location`, `elapsed_ms` | 차단/한도 도달 |
| `not_found_view` / `not_found_action` | `path_length` / `action` | 404 |

### 5.3 핵심 퍼널
`page_view(/)` → `page_view(/upload)` → `photo_selected` → `analysis_submitted` → `result_view`
- 검증 통과율 = `analysis_completed` / `analysis_submitted`
- 실패 후 재시도율 = `retry_clicked` / `analysis_failed`

---

## 6. 배포 (운영 서버)

### 6.1 빌드 (로컬)

```bash
# 1) 프론트 빌드 → src/main/resources/static/ 에 번들 산출
cd StyleFit/frontend
npm run build

# 2) 실행 가능 JAR 생성 (프론트 static 번들 포함)
cd ..
./gradlew bootJar
# 산출물: build/libs/StyleFit-0.0.1-SNAPSHOT.jar
```

> 프론트를 수정했다면 **반드시 `npm run build` → `./gradlew bootJar`** 순서로 진행한다.

### 6.2 서버 전송 & 실행

```bash
# JAR 전송 (데이터 디렉토리 report-images/ face-images/ 는 건드리지 않음)
scp build/libs/StyleFit-0.0.1-SNAPSHOT.jar <USER>@<SERVER>:~/stylefit/

# SSH 접속 후 ~/stylefit 에서
ssh <USER>@<SERVER>

# 8080 포트를 누가 점유 중인지 확인
sudo lsof -i :8080

# 기존 프로세스 종료 (있으면)
pkill -f "StyleFit-0.0.1-SNAPSHOT.jar"

# nohup 백그라운드 실행 (prod 프로파일)
nohup java -jar StyleFit-0.0.1-SNAPSHOT.jar --spring.profiles.active=prod > nohup.out 2>&1 &
```

### 6.3 운영 환경 변수 (prod 프로파일)

`application-prod.properties`가 읽는 주요 변수 — 실행 전 export 권장:

| 변수 | 용도 |
|---|---|
| `STYLEFIT_DB_URL` | PostgreSQL JDBC URL (기본 `jdbc:postgresql://localhost:5432/stylefit`) |
| `STYLEFIT_DB_USERNAME` | DB 사용자 (기본 `ddalkkak`) |
| `STYLEFIT_DB_PASSWORD` | DB 비밀번호 |
| `STYLEFIT_ALLOWED_ORIGINS` | 운영 도메인 화이트리스트 (CSRF/CORS). 콤마 구분 |
| `STYLEFIT_BASE_URL` | OG 태그·공유 링크 절대 URL (기본 `http://www.lu-bello.com:8080`) |
| `STYLEFIT_TRUSTED_PROXIES` | Nginx 등 리버스 프록시 IP (XFF 신뢰) |
| `STYLEFIT_RATE_GLOBAL/COOKIE/IP` | 일일 호출 한도 (기본 50/5/10) |
| `PORT` | 서버 포트 (기본 8080) |

prod 프로파일은 H2 콘솔·SQL 로그 비활성, 쿠키 Secure 강제, `X-Forwarded-Proto`로 HTTPS 인식.

### 6.4 확인 / 종료

```bash
tail -f nohup.out                                  # 로그 실시간 추적
curl -s http://localhost:8080 | head -5            # 응답 확인
sudo lsof -i :8080                                 # 포트 점유 확인
kill $(pgrep -f "StyleFit-0.0.1-SNAPSHOT.jar")     # 종료
```

> `report-images/` `face-images/`는 앱 실행 디렉토리에 자동 생성된다. H2(create-drop)는 재부팅 시 DB가 초기화되므로 운영 영속화는 **Postgres + 영속 볼륨** 전환이 필요하다.

---

## 7. 디렉토리 구조 (요약)

```
StyleFit/
├── build.gradle
├── src/main/
│   ├── java/com/stylefit/        # 백엔드 (analysis/vision/share/survey/purchase/
│   │                             #         behavior/auth/ban/ratelimit/admin/config)
│   └── resources/
│       ├── application.properties / application-prod.properties
│       ├── models/face_detection_yunet_2023mar.onnx
│       ├── ddl/schema-postgres.sql, schema.sql
│       └── static/               # Vite 빌드 산출물 (npm run build 시 자동 갱신)
├── frontend/
│   ├── vite.config.js            # /api 프록시, host: true
│   ├── index.html                # OG 메타 태그 + 폰트 CDN
│   ├── .env / .env.example       # VITE_GA_ID, VITE_KAKAO_APP_KEY
│   └── src/
│       ├── analytics.js          # GA4 헬퍼
│       ├── paths.js              # base/origin 경로 헬퍼
│       ├── components/           # 다이얼로그·트래커 등 공용
│       ├── hooks/useReportCheck.jsx
│       └── pages/                # Home/Upload/Loading/Error/Result/Share/Compare/Admin/NotFound
└── PROJECT_STATUS.md             # 이 문서
```

---

## 8. 남은 작업

**백엔드/AI**
- [ ] `callAiReportGenerator()` 실 연동 (현재 리포트 이미지 = `placehold.co` mock)
- [ ] PROCESSING/COMPLETED 저장 트랜잭션 분리 (현재 한 트랜잭션이라 PROCESSING 미커밋)
- [ ] AI 호출 타임아웃/재시도 정책

**프론트**
- [ ] 헤어&액세서리 / 상황별 코디 / 쇼핑 검색어 (현재 Coming Soon)
- [ ] "내 리포트" 다건 보관 / 히스토리
- [ ] **카카오 공유 설정**: `VITE_KAKAO_APP_KEY` 발급(JavaScript 키) + 카카오 개발자 콘솔에 서비스 도메인 등록
  - ⚠ **공유 버튼은 OG 태그가 아닌 `content.imageUrl`(현재 mock 리포트 이미지)을 사용** → 미리보기가 OG 이미지와 다르게 뜸. 리포트 이미지 실연동(HTTPS) 전까지는 OG 이미지(`/og-image.png`) 사용 검토.

**인프라**
- [x] Postgres 연결 완료 (개발: `localhost:5432/stylefit`)
- [ ] 운영 서버 영속 볼륨 연결
- [ ] HTTPS 적용 (쿠키 Secure 활성, 카카오 이미지 수집 정상화)

**운영**
- [ ] GA4 콘솔: `result_view`/`analysis_submitted` 전환 이벤트 지정 + 운영 도메인 등록 + 개인정보처리방침 GA 고지
- [ ] 만족도/결제의향/행동신호 어드민 집계·export

---

> 상세 변경 이력(2026-05-11 ~ 최근)은 git log 및 커밋 메시지를 참고. 이 문서는 현재 구조와 운영 기준의 스냅샷이다.
