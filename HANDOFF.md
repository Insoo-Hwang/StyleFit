# StyleFit Handoff

이 문서는 StyleFit 백엔드의 현재 구현 상태와 앞으로의 MVP 방향을 다음 작업자 또는 AI가 바로 이어받을 수 있게 정리한 인수인계 문서입니다.

## 현재 제품 방향

MVP에서는 로그인을 구현하지 않습니다. 사용자는 로그인 없이 서비스에 들어와 상품을 고르고, 구매가 완료된 것으로 간주된 이후 사진을 업로드합니다. 백엔드는 사진을 먼저 검증하고, 검증을 통과한 사진을 나중에 구현될 Python AI 서버로 넘긴 뒤 결과를 클라이언트에 전달하는 구조로 갈 예정입니다.

현재 목표 흐름:

```text
React 사용자 진입
→ 상품 2개 중 선택
→ 구매 단계는 MVP에서 생략 또는 mock 처리
→ 사진 업로드
→ Spring Boot가 사진 품질 검증
→ Python AI 서버로 HTTP 요청
→ Python 응답을 React로 전달
→ 향후 백업 DB에 요청/결과 저장 및 트랜잭션 처리
```

현재 백엔드에는 다음까지만 구현되어 있습니다.

- 상품 목록 API
- 사진 검증 API
- OpenCV + YuNet 기반 얼굴/밝기 검사
- 공개 사용자 API 허용
- `/admin/**`, `/internal/**` 차단

아직 구현되지 않은 것:

- 구매/결제
- Python AI 서버 연동
- 분석 결과 저장
- 백업 DB
- 트랜잭션 설계
- 관리자 인증
- 로그인/JWT/카카오 로그인

## 기술 스택

- Java 17
- Spring Boot 3.4.0
- Gradle
- Spring Web
- Spring Security
- OpenCV Java: `org.openpnp:opencv:4.9.0-0`
- YuNet ONNX 모델: `src/main/resources/models/face_detection_yunet_2023mar.onnx`

현재는 DB 의존성이 없습니다. 이전에 있던 H2/JPA/user/JWT 코드는 MVP 방향에 맞지 않아 제거되었습니다.

## 실행

프로젝트 루트에서:

```bash
./gradlew bootRun
```

서버 주소:

```text
http://localhost:8080
```

테스트:

```bash
./gradlew test
```

## 현재 파일 구조

주요 파일:

- [StyleFitApplication.java](src/main/java/com/stylefit/StyleFitApplication.java): Spring Boot main
- [SecurityConfig.java](src/main/java/com/stylefit/config/SecurityConfig.java): 공개 API/차단 경로/CORS 설정
- [OpenCvConfig.java](src/main/java/com/stylefit/config/OpenCvConfig.java): OpenCV 네이티브 라이브러리 로딩
- [ProductController.java](src/main/java/com/stylefit/product/ProductController.java): 상품 목록 API
- [ProductType.java](src/main/java/com/stylefit/product/ProductType.java): MVP 상품 타입
- [ProductResponse.java](src/main/java/com/stylefit/product/ProductResponse.java): 상품 응답 DTO
- [PhotoValidationController.java](src/main/java/com/stylefit/vision/PhotoValidationController.java): 사진 검증 API
- [PhotoValidationService.java](src/main/java/com/stylefit/vision/PhotoValidationService.java): OpenCV/YuNet 사진 검증 로직
- [PhotoValidationResponse.java](src/main/java/com/stylefit/vision/PhotoValidationResponse.java): 사진 검증 응답 DTO
- [application.properties](src/main/resources/application.properties): 앱/사진 검증 설정

## Security 정책

MVP에서는 사용자가 로그인하지 않아도 일반 기능을 사용할 수 있어야 합니다. 따라서 대부분의 요청은 공개합니다.

현재 정책:

```text
OPTIONS /**       공개
/admin/**         차단
/internal/**      차단
그 외 모든 요청    공개
```

관련 코드:

[SecurityConfig.java](src/main/java/com/stylefit/config/SecurityConfig.java)

```java
.authorizeHttpRequests(auth -> auth
    .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
    .requestMatchers("/admin/**", "/internal/**").denyAll()
    .anyRequest().permitAll()
)
```

주의:

- 현재는 관리자 인증이 없으므로 `/admin/**`은 전부 403입니다.
- 시스템 내부 API를 만들 경우 `/internal/**` 아래에 두면 외부에서 접근할 수 없습니다.
- 나중에 관리자 기능이 필요하면 admin 인증 방식을 별도로 설계해야 합니다.

## CORS

React 개발 서버를 위해 다음 origin을 허용합니다.

```text
http://localhost:3000
http://localhost:5173
http://127.0.0.1:3000
http://127.0.0.1:5173
```

Vite React는 보통 `5173`, CRA는 보통 `3000`을 사용합니다.

## 상품 API

상품 목록:

```text
GET /api/products
```

curl:

```bash
curl http://localhost:8080/api/products
```

응답 예시:

```json
[
  {
    "type": "PERSONAL_COLOR_DIAGNOSIS",
    "name": "퍼스널 컬러 진단",
    "description": "얼굴 사진을 기반으로 퍼스널 컬러 진단 결과를 제공합니다."
  },
  {
    "type": "STYLING_REPORT",
    "name": "스타일링 리포트",
    "description": "얼굴 사진과 진단 정보를 바탕으로 스타일링 리포트를 제공합니다."
  }
]
```

현재 상품 가격, 구매 상태, 주문 ID는 없습니다. 결제/구매가 붙으면 `order` 또는 `purchase` 도메인을 별도로 추가하는 것이 좋습니다.

## 사진 검증 API

사진 검증:

```text
POST /api/photos/validate
```

인증 없이 호출합니다.

curl:

```bash
curl -X POST http://localhost:8080/api/photos/validate \
  -F 'file=@/Users/ishwang/Pictures/1.png'
```

정상 응답 예시:

```json
{
  "valid": true,
  "faceCount": 1,
  "faceAreaRatio": 0.142,
  "brightness": 163.7,
  "warnings": []
}
```

실패 응답 예시:

```json
{
  "valid": false,
  "faceCount": 0,
  "faceAreaRatio": 0.0,
  "brightness": 128.2,
  "warnings": ["얼굴이 보이지 않습니다."]
}
```

## 사진 검증 동작 원리

관련 코드:

[PhotoValidationService.java](src/main/java/com/stylefit/vision/PhotoValidationService.java)

처리 흐름:

```text
MultipartFile
→ OpenCV Mat으로 decode
→ YuNet FaceDetectorYN으로 얼굴 검출
→ 얼굴 개수 계산
→ 가장 큰 얼굴 박스 면적 비율 계산
→ grayscale 평균 밝기 계산
→ warnings 생성
→ PhotoValidationResponse 반환
```

YuNet은 별도 Java 라이브러리가 아니라 ONNX 모델 파일입니다.

```text
src/main/resources/models/face_detection_yunet_2023mar.onnx
```

OpenCV의 `FaceDetectorYN`이 이 모델을 읽어서 얼굴을 검출합니다.

OpenCV는 파일 경로를 필요로 하므로, 서비스 생성자에서 classpath resource인 ONNX 모델을 temp file로 복사한 뒤 그 경로를 사용합니다.

## 사진 검증 기준

설정:

[application.properties](src/main/resources/application.properties)

```properties
stylefit.vision.yunet-model=classpath:models/face_detection_yunet_2023mar.onnx
stylefit.vision.min-brightness=60
stylefit.vision.max-brightness=210
stylefit.vision.face-score-threshold=0.9
stylefit.vision.min-face-area-ratio=0.08
```

판정 규칙:

```text
이미지 파일을 읽을 수 없음                  → invalid
faceCount == 0                         → 얼굴이 보이지 않습니다.
faceCount > 1                          → 한 명만 촬영된 사진을 업로드해주세요.
faceCount == 1 && faceAreaRatio < 0.08 → 얼굴이 너무 작게 촬영되었습니다.
brightness < 60                        → 사진이 너무 어둡습니다.
brightness > 210                       → 사진이 너무 밝습니다.
```

`warnings`가 비어 있으면 `valid=true`, 하나라도 있으면 `valid=false`입니다.

조정 가이드:

- 얼굴 검출이 너무 빡빡하면 `stylefit.vision.face-score-threshold=0.8`
- 얼굴 크기 기준이 너무 엄격하면 `stylefit.vision.min-face-area-ratio=0.05`
- 얼굴 중심 사진만 받고 싶으면 `stylefit.vision.min-face-area-ratio=0.10` 또는 `0.12`
- 밝기 기준은 실제 사용자 샘플을 쌓으면서 조정

## 앞으로 추가할 Python AI 서버 연동

현재 Python 서버는 아직 없습니다. 추천 흐름은 Spring Boot에 `analysis` 도메인을 추가하는 것입니다.

권장 API:

```text
POST /api/analysis/requests
```

요청:

- `productType`: `PERSONAL_COLOR_DIAGNOSIS` 또는 `STYLING_REPORT`
- `file`: 사용자 얼굴 사진

Spring Boot 처리:

```text
1. productType 검증
2. 사진 검증
3. 검증 실패 시 즉시 400 또는 valid=false 응답
4. 검증 성공 시 Python 서버로 multipart 또는 binary HTTP 요청
5. Python 응답을 표준 응답 DTO로 변환
6. 클라이언트에 반환
7. 향후 DB에 요청/결과/상태 백업
```

Python 서버 URL은 설정으로 분리하는 것이 좋습니다.

```properties
stylefit.ai.base-url=http://localhost:8000
stylefit.ai.timeout-seconds=60
```

Spring 쪽 HTTP client는 Spring Boot 3.4 기준으로 `RestClient`를 쓰면 충분합니다. 비동기 처리나 긴 분석 시간이 필요해지면 queue/job 구조로 바꾸는 것이 좋습니다.

## 앞으로 추가할 DB/트랜잭션 방향

현재는 DB가 없습니다. 백업 DB를 붙일 때 추천하는 도메인:

- `analysis_request`
- `analysis_result`
- `uploaded_photo` 또는 object storage metadata
- `purchase` 또는 `order`
- `product`

초기에는 다음 정도를 저장하면 됩니다.

```text
analysis_request
- id
- product_type
- status: REQUESTED, VALIDATION_FAILED, PROCESSING, COMPLETED, FAILED
- validation_result_json
- python_request_id 또는 trace_id
- created_at
- updated_at

analysis_result
- id
- analysis_request_id
- result_json
- created_at
```

트랜잭션 추천:

```text
사진 검증 결과 저장
→ Python 요청 전 PROCESSING 상태 저장
→ Python 응답 성공 시 COMPLETED + result 저장
→ Python 실패 시 FAILED + error 저장
```

Python 호출이 오래 걸릴 수 있으므로, 실제 서비스에서는 DB 트랜잭션을 Python HTTP 요청 전체 동안 열어두지 않는 것이 좋습니다. 상태를 먼저 저장하고, 외부 호출 후 짧은 트랜잭션으로 결과를 업데이트하는 방식이 안전합니다.

## curl 테스트 실수 주의

파일 업로드에는 `@`가 필요합니다.

잘못된 예:

```bash
-F 'file=/Users/ishwang/Pictures/1.png'
```

올바른 예:

```bash
-F 'file=@/Users/ishwang/Pictures/1.png'
```

터미널에서 `quote>`가 뜨면 따옴표가 닫히지 않은 상태입니다. 스마트 따옴표 `’`가 들어가면 zsh가 일반 작은따옴표로 인식하지 못합니다. `Ctrl + C`로 빠져나온 뒤 일반 따옴표 `'`로 다시 입력하세요.

코드 변경 후에는 서버를 재시작해야 합니다.

```bash
Ctrl + C
./gradlew bootRun
```

## 검증된 내용

마지막 정리 시점에 확인한 내용:

- `./gradlew test` 성공
- `GET /api/products` 인증 없이 200
- `GET /admin/check` 403
- `GET /internal/check` 403

사진 검증 API는 코드상 인증 없이 호출되도록 바뀌었습니다. 실제 이미지 파일을 넣어 다시 확인하려면 서버 실행 후 다음 명령을 사용하세요.

```bash
curl -X POST http://localhost:8080/api/photos/validate \
  -F 'file=@/Users/ishwang/Pictures/1.png'
```

## 다음 작업 추천

1. `POST /api/analysis/requests` 스켈레톤 추가
2. Python 서버 응답 DTO 계약 정의
3. 사진 검증 실패 응답을 HTTP 200으로 둘지 400으로 둘지 결정
4. 업로드 이미지 최대 용량 제한 설정
5. OpenCV 처리 전 이미지 리사이즈 최적화
6. DB 도입 시 요청/결과 백업 테이블 설계
7. 외부 Python 호출 실패/timeout/retry 정책 설계
8. admin 인증 방식은 MVP 이후 별도 설계
