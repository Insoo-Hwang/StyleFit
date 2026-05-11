# StyleFit 프로젝트 진행 현황

> 작성 기준일: 2026-05-11

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
├── auth
│   └── AnonymousCookieFilter     # stylefit_uid 쿠키 (30일, HttpOnly, SameSite=Lax)
└── config
    ├── SecurityConfig            # CORS / 필터체인
    ├── OpenCvConfig              # 네이티브 라이브러리 로딩
    └── SpaController             # SPA fallback
```

### API 엔드포인트

| Method | Path | 설명 |
|---|---|---|
| `POST` | `/api/analysis/start` | 익명 쿠키 기준 기존 분석 상태 조회 (`PHOTO_REQUIRED` / `PROCESSING` / `COMPLETED`) |
| `POST` | `/api/analysis/submit-photo` | 사진 1장 업로드 → 검증 → AI 분석 → 결과 저장 |

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

## 7. 남은 작업

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
- [ ] "리포트 만족도 평가" / "이미지 다운로드" / "공유하기" 실 동작 연결

### 인프라/배포
- [ ] Postgres 연결 (`schema-postgres.sql` 준비됨)
- [ ] 운영용 application-prod.properties 마무리
- [ ] HTTPS 적용 (쿠키 Secure 활성화)

---

## 8. 디렉토리 트리 (요약)

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
│   └── src/
│       ├── App.jsx               # 라우터 + ScrollToTop
│       ├── App.css               # 디자인 토큰(:root vars), 모바일 프레임 가운데 정렬
│       ├── main.jsx
│       ├── components/
│       │   ├── ScrollToTop.jsx       # 라우트 변경 시 최상단 스크롤
│       │   ├── NoReportDialog.jsx + .css   # "결과 없음" 모달
│       ├── hooks/
│       │   └── useReportCheck.jsx    # 탭바 "내 리포트" 클릭 공용 훅
│       └── pages/
│           ├── HomePage.jsx + .css       # 랜딩 (Entry+Menu 통합)
│           ├── UploadPage.jsx + .css     # 사진 1장 업로드 + 클라이언트 검증
│           ├── LoadingPage.jsx + .css    # 3단계 진행 + 팩트 캐러셀
│           ├── ErrorPage.jsx + .css      # 검증 실패 화면
│           └── ResultPage.jsx + .css     # Style Report Mobile + Coming Soon 카드
└── PROJECT_STATUS.md             # 이 문서
```
