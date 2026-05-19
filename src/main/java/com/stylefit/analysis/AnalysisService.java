package com.stylefit.analysis;

import com.stylefit.ratelimit.RateLimitService;
import com.stylefit.vision.PhotoValidationResponse;
import com.stylefit.vision.PhotoValidationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AnalysisService {

    private final AnalysisResultRepository repository;
    private final PhotoValidationService photoValidationService;
    private final RateLimitService rateLimitService;

    @Value("${stylefit.report.storage-dir}")
    private String reportStorageDir;

    @Value("${stylefit.face.storage-dir}")
    private String faceStorageDir;

    /**
     * AI 모듈(같은 도메인 다른 포트) URL 화이트리스트. 콤마 구분.
     * 예: "localhost:5000,localhost:5001"
     * 비어 있으면(dev) 호스트 검증 skip — 운영에선 반드시 설정해 SSRF 차단.
     */
    @Value("${stylefit.security.ai-allowed-hosts:}")
    private String aiAllowedHosts;

    private static final String PRODUCT_CODE = "PERSONAL_COLOR_DIAGNOSIS";
    private static final String REPORT_URL_PREFIX = "/report-images/";

    // -----------------------------------------------------------------------
    // Mock 데이터 — Python AI 서버 연동 시 교체
    // -----------------------------------------------------------------------
    private static final long MOCK_AI_DELAY_MS = 15_000L;

    private static final String MOCK_RESULT_JSON = """
            {
              "personalColor": "쿨톤 · 윈터 계열",
              "tagline": "딥 · 클리어 무드",
              "heroLede": "차분하고 선명한 컬러가 얼굴 윤곽을 또렷하게 만들어줄 가능성이 높습니다.",
              "mainType": "윈터",
              "mainPercent": 80,
              "secondaryType": "섬머",
              "secondaryPercent": 20,
              "bestColors": [
                {"hex": "#3a3f44", "name": "차콜 그레이", "use": "상의 · 아우터 전반"},
                {"hex": "#1b2a4a", "name": "딥 네이비", "use": "셔츠 · 데님"},
                {"hex": "#1f3d2e", "name": "딥 그린", "use": "맨투맨 · 후드"}
              ],
              "worstColors": [
                {"hex": "#f7c7d6", "name": "밝은 파스텔 핑크", "reason": "얼굴이 창백해 보일 수 있음"},
                {"hex": "#c8e34a", "name": "형광 라임", "reason": "피부톤과 충돌"},
                {"hex": "#f1d960", "name": "밝은 옐로우", "reason": "피부 노란기 강조"}
              ],
              "clothing": {
                "top": ["차콜 니트", "네이비 옥스포드 셔츠", "딥그린 맨투맨", "블랙 미니멀 자켓"],
                "bottom": ["인디고 데님", "차콜 슬랙스", "네이비 치노 팬츠", "블랙 조거 팬츠"]
              },
              "hair": {
                "title": "투블럭 · 슬릭백",
                "description": "선명하고 깔끔한 실루엣이 잘 맞습니다.",
                "colorNote": "컬러: 내추럴 블랙 또는 다크 브라운 권장"
              },
              "accessories": "실버 시계 · 블랙 프레임 안경 · 실버 · 건메탈 목걸이",
              "situations": [
                {"name": "출근룩", "outfit": "차콜 슬랙스 + 네이비 셔츠 + 블랙 더비슈즈", "description": "깔끔하고 신뢰감 있는 인상. 실버 시계 포인트 추천."},
                {"name": "데이트룩", "outfit": "딥그린 니트 + 인디고 데님 + 화이트 스니커즈", "description": "편안하면서 정돈된 분위기. 가벼운 무드의 데이트룩."},
                {"name": "데일리룩", "outfit": "블랙 후드 + 차콜 조거 + 블랙 캡", "description": "편안한 데일리 무드. 미니멀하지만 톤이 잘 맞는 조합."}
              ],
              "shopKeywords": [
                "차콜 니트 남성", "네이비 옥스포드 셔츠", "딥그린 맨투맨", "블랙 미니멀 자켓",
                "인디고 슬림 데님", "실버 메탈 시계", "블랙 더비슈즈 남성", "투블럭 헤어 왁스",
                "건메탈 목걸이 남성", "차콜 울 코트"
              ],
              "avoidRules": [
                "밝은 파스텔 단색 상하의 세트는 피하세요",
                "형광기 있는 색은 포인트 아이템으로도 피하세요",
                "흰 셔츠 + 밝은 베이지 팬츠 조합은 칙칙해 보일 수 있습니다"
              ]
            }
            """;

    private static final String MOCK_REPORT_IMAGE_URL =
            "https://placehold.co/800x1200/1f3d2e/e7d8a8?text=STYLE+Report";
    // -----------------------------------------------------------------------

    /**
     * 기존 분석 결과 여부를 확인해 다음 단계를 안내한다.
     */
    public AnalysisResponse start(String cookieId) {
        return repository.findByCookieIdAndProductCode(cookieId, PRODUCT_CODE)
                .map(this::toResponse)
                .orElseGet(AnalysisResponse::photoRequired);
    }

    /**
     * 사진을 검증하고 AI 분석을 수행한 뒤 결과를 DB에 저장한다.
     *
     * NOTE: 현재 PROCESSING 저장과 COMPLETED 저장이 같은 트랜잭션 안에 있어
     *       PROCESSING 상태가 실제로 DB에 커밋되지 않는다.
     *       Python AI 서버 연동 시 두 단계를 별도 트랜잭션으로 분리해야 한다.
     *       (saveProcessing → [트랜잭션 종료] → AI 호출 → saveCompleted)
     */
    @Transactional
    public AnalysisResponse submitPhoto(String cookieId, String clientIp, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            return AnalysisResponse.validationFailed(List.of("사진을 1장 업로드해주세요."));
        }

        Optional<AnalysisResult> existing =
                repository.findByCookieIdAndProductCode(cookieId, PRODUCT_CODE);

        if (existing.isPresent()) {
            AnalysisResult record = existing.get();
            if (record.getStatus() == AnalysisStatus.COMPLETED) {
                return toResponse(record);
            }
            if (record.getStatus() == AnalysisStatus.PROCESSING) {
                throw new ResponseStatusException(
                        HttpStatus.CONFLICT, "이미 처리 중입니다. 잠시 후 다시 시도해주세요.");
            }
            // FAILED → 재시도 허용 (기존 레코드 재사용)
        }

        List<String> warnings = validatePhoto(file);
        if (!warnings.isEmpty()) {
            return AnalysisResponse.validationFailed(warnings);
        }

        // 이미지 바이트를 한 번만 읽어 saveFaceImage 에 전달.
        // MultipartFile 스트림을 중복 소비하지 않기 위함.
        byte[] imageBytes;
        try {
            imageBytes = file.getBytes();
        } catch (IOException e) {
            return AnalysisResponse.validationFailed(List.of("사진을 읽을 수 없습니다."));
        }

        AnalysisResult entity = existing.orElseGet(() -> AnalysisResult.of(cookieId));
        entity.setStatus(AnalysisStatus.PROCESSING);
        if (clientIp != null && !clientIp.isBlank()) {
            entity.setLastIp(clientIp);
        }
        repository.save(entity);

        // 검증 통과한 얼굴 원본 이미지를 디스크에 저장. AI 학습·어드민 검토용.
        String faceFilename = saveFaceImage(imageBytes, file.getContentType());
        entity.setFaceImagePath(faceFilename);

        // AI 분석 모듈 호출 (mock)
        String resultJson = callAiAnalysis();

        entity.setStatus(AnalysisStatus.COMPLETED);
        entity.setResultJson(resultJson);
        repository.save(entity);

        return AnalysisResponse.completed(resultJson, null, null, faceFilename != null);
    }

    /**
     * 사용자가 결제 확인("예")을 누른 시점에 호출.
     * 이미 생성된 이미지가 있으면 캐시를 반환하고, 없으면 AI 모듈을 호출해 생성·저장 후 반환.
     */
    @Transactional
    public Map<String, Object> generateReportImage(String cookieId, String clientIp) {
        AnalysisResult entity = repository.findByCookieIdAndProductCode(cookieId, PRODUCT_CODE)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "분석 결과가 없습니다."));
        if (entity.getStatus() != AnalysisStatus.COMPLETED) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "분석이 완료되지 않았습니다.");
        }

        // 이미 생성된 이미지가 있으면 카운터 소모 없이 캐시 반환
        if (entity.getReportImagePath() != null) {
            Map<String, Object> cached = new java.util.HashMap<>();
            cached.put("reportImageUrl", REPORT_URL_PREFIX + entity.getReportImagePath());
            cached.put("cached", true);
            return cached;
        }

        // 일일 호출 한도는 AI 리포트 이미지를 실제로 생성하는 시점에만 소모
        try {
            if (!rateLimitService.tryConsume(cookieId, clientIp)) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "오늘 리포트 생성 한도에 도달했어요.");
            }
        } catch (RateLimitService.RateLimitExceededException e) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "오늘 리포트 생성 한도에 도달했어요.");
        }

        byte[] faceBytes = loadFaceImage(entity.getFaceImagePath());
        String generatedUrl = callAiReportGenerator(entity.getResultJson(), faceBytes);
        String storedFilename = downloadAndStoreReportImage(generatedUrl);

        entity.setReportImagePath(storedFilename);
        repository.save(entity);

        String responseUrl = (storedFilename != null) ? REPORT_URL_PREFIX + storedFilename : generatedUrl;
        Map<String, Object> result = new java.util.HashMap<>();
        result.put("reportImageUrl", responseUrl);
        result.put("cached", false);
        return result;
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private List<String> validatePhoto(MultipartFile file) {
        try {
            PhotoValidationResponse result = photoValidationService.validate(file);
            return result.valid() ? List.of() : List.copyOf(result.warnings());
        } catch (IOException e) {
            return List.of("사진을 읽을 수 없습니다.");
        }
    }

    private String callAiAnalysis() {
        // TODO: Python AI 서버로 HTTP 요청 (RestClient)
        // 실제 AI 처리 시간을 흉내내기 위해 잠깐 대기 — 프론트 로딩 UX 검증용
        try {
            Thread.sleep(MOCK_AI_DELAY_MS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return MOCK_RESULT_JSON;
    }

    private String callAiReportGenerator(String resultJson, byte[] imageBytes) {
        // TODO: Python AI 서버로 HTTP 요청 (RestClient)
        // 전달 항목:
        //   - resultJson  : callAiAnalysis() 결과 JSON (퍼스널컬러 타입·추천 색상·코디 등)
        //   - imageBytes  : 검증 통과한 사용자 얼굴 원본 이미지 바이트
        //     → 리포트 이미지 안에 사용자 사진을 합성하거나, 피부톤 재확인 등 후처리에 활용
        return MOCK_REPORT_IMAGE_URL;
    }

    /**
     * 검증 통과한 사용자 업로드 이미지를 face-images 디렉토리에 저장하고 파일명만 반환한다.
     * 실패 시 null — DB에 경로 없이 저장되고 분석 흐름엔 영향 없음.
     */
    private String saveFaceImage(byte[] imageBytes, String contentType) {
        try {
            String ext = pickExtension(contentType);
            String filename = UUID.randomUUID() + "." + ext;
            Path dir = Paths.get(faceStorageDir).toAbsolutePath();
            Files.createDirectories(dir);
            Files.write(dir.resolve(filename), imageBytes);
            log.info("face image saved: {}", filename);
            return filename;
        } catch (IOException e) {
            log.warn("face image save failed: {}", e.getMessage());
            return null;
        }
    }

    private byte[] loadFaceImage(String faceImagePath) {
        if (faceImagePath == null) return new byte[0];
        try {
            return Files.readAllBytes(Paths.get(faceStorageDir).toAbsolutePath().resolve(faceImagePath));
        } catch (IOException e) {
            log.warn("face image load failed: {}", e.getMessage());
            return new byte[0];
        }
    }

    /**
     * AI 모듈에서 받은 URL을 fetch 해 디스크에 저장하고 파일명만 반환한다.
     * 실패 시 null (호출부에서 원본 URL 로 폴백).
     *
     * SSRF 방어:
     * - http/https 스킴만 허용
     * - host:port 가 stylefit.security.ai-allowed-hosts 화이트리스트에 있어야 함
     * - HttpURLConnection.setInstanceFollowRedirects(false) 로 redirect 차단
     *   (redirect 응답은 실패로 처리해 우회 차단)
     * 화이트리스트가 비어 있으면(dev) 호스트 검증 없음.
     */
    private String downloadAndStoreReportImage(String sourceUrl) {
        try {
            URI uri = URI.create(sourceUrl);
            if (!isAllowedAiUrl(uri)) {
                log.warn("blocked SSRF candidate URL: scheme={} host={} port={}",
                        uri.getScheme(), uri.getHost(), uri.getPort());
                return null;
            }
            java.net.HttpURLConnection conn =
                    (java.net.HttpURLConnection) uri.toURL().openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(5_000);
            conn.setReadTimeout(15_000);
            int code = conn.getResponseCode();
            if (code >= 300 && code < 400) {
                log.warn("redirect blocked from AI module: code={}", code);
                return null;
            }
            if (code != 200) {
                log.warn("AI module returned non-200: code={}", code);
                return null;
            }
            String contentType = conn.getContentType();
            String ext = pickExtension(contentType);
            String filename = UUID.randomUUID() + "." + ext;

            Path dir = Paths.get(reportStorageDir).toAbsolutePath();
            Files.createDirectories(dir);
            Path target = dir.resolve(filename);

            try (InputStream in = conn.getInputStream()) {
                Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
            }
            return filename;
        } catch (IOException e) {
            log.warn("report image download failed: {}", e.getMessage());
            return null;
        }
    }

    private boolean isAllowedAiUrl(URI uri) {
        if (uri == null) return false;
        String scheme = uri.getScheme();
        if (scheme == null) return false;
        if (!scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https")) return false;
        if (uri.getHost() == null || uri.getHost().isBlank()) return false;
        if (aiAllowedHosts == null || aiAllowedHosts.isBlank()) {
            // dev 모드 — 화이트리스트 미설정이면 호스트 검증 skip (운영에선 반드시 설정)
            return true;
        }
        String hostPort = uri.getPort() < 0
                ? uri.getHost()
                : uri.getHost() + ":" + uri.getPort();
        String hostOnly = uri.getHost();
        for (String entry : aiAllowedHosts.split(",")) {
            String e = entry.trim();
            if (e.isEmpty()) continue;
            if (e.equalsIgnoreCase(hostPort) || e.equalsIgnoreCase(hostOnly)) return true;
        }
        return false;
    }

    private static String pickExtension(String contentType) {
        if (contentType == null) return "img";
        String ct = contentType.toLowerCase();
        if (ct.contains("png")) return "png";
        if (ct.contains("jpeg") || ct.contains("jpg")) return "jpg";
        if (ct.contains("svg")) return "svg";
        if (ct.contains("webp")) return "webp";
        if (ct.contains("gif")) return "gif";
        return "img";
    }

    private AnalysisResponse toResponse(AnalysisResult record) {
        return switch (record.getStatus()) {
            case COMPLETED -> {
                String stored = record.getReportImagePath();
                String url = (stored != null) ? REPORT_URL_PREFIX + stored : null;
                Boolean cached = (stored != null) ? true : null;
                yield AnalysisResponse.completed(record.getResultJson(), url, cached, record.getFaceImagePath() != null);
            }
            case PROCESSING -> AnalysisResponse.processing();
            case FAILED -> AnalysisResponse.photoRequired();
        };
    }
}
