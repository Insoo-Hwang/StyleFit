package com.stylefit.analysis;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
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
    private final ObjectMapper objectMapper;

    @Value("${stylefit.report.storage-dir}")
    private String reportStorageDir;

    @Value("${stylefit.face.storage-dir}")
    private String faceStorageDir;

    @Value("${stylefit.ai.base-url:http://168.107.32.164:8000}")
    private String aiBaseUrl;

    /**
     * AI 모듈(같은 도메인 다른 포트) URL 화이트리스트. 콤마 구분.
     * 비어 있으면(dev) 호스트 검증 skip — 운영에선 반드시 설정해 SSRF 차단.
     */
    @Value("${stylefit.security.ai-allowed-hosts:}")
    private String aiAllowedHosts;

    private static final String PRODUCT_CODE = "PERSONAL_COLOR_DIAGNOSIS";
    private static final String REPORT_URL_PREFIX = "/report-images/";
    private static final String MOCK_REPORT_IMAGE_URL =
            "https://placehold.co/800x1200/1f3d2e/e7d8a8?text=STYLE+Report";

    // 컬러 카테고리명 → hex 코드 조회 테이블 (AI 응답에 hex 없음 → 근사값 사용)
    private static final Map<String, String> COLOR_HEX_MAP;
    static {
        Map<String, String> m = new LinkedHashMap<>();
        // 쿨톤 계열
        m.put("딥 네이비", "#1b2a4a");
        m.put("다크 네이비", "#0d1b3e");
        m.put("네이비", "#1f3864");
        m.put("차콜 그레이", "#3a3f44");
        m.put("차콜", "#3a3f44");
        m.put("다크 그레이", "#424242");
        m.put("그레이", "#757575");
        m.put("라이트 그레이", "#e0e0e0");
        m.put("블랙", "#1a1a1a");
        m.put("화이트", "#f5f5f5");
        m.put("아이보리", "#fffff0");
        m.put("딥 그린", "#1f3d2e");
        m.put("다크 그린", "#1b5e20");
        m.put("그린", "#388e3c");
        m.put("올리브 그린", "#558b2f");
        m.put("올리브", "#708238");
        m.put("버건디", "#7b1831");
        m.put("와인", "#722f37");
        m.put("다크 레드", "#b71c1c");
        m.put("레드", "#c62828");
        m.put("블루", "#1565c0");
        m.put("스카이 블루", "#4fc3f7");
        m.put("라이트 블루", "#64b5f6");
        m.put("퍼플", "#7b1fa2");
        m.put("라벤더", "#ce93d8");
        m.put("플럼", "#6a1b4d");
        // 웜톤 계열
        m.put("베이지", "#d4c5a9");
        m.put("카멜", "#c19a6b");
        m.put("카키", "#6b6b3a");
        m.put("브라운", "#795548");
        m.put("다크 브라운", "#4e342e");
        m.put("테라코타", "#c0713b");
        m.put("오렌지", "#e65100");
        m.put("코랄", "#f08080");
        m.put("살몬", "#fa8072");
        m.put("옐로우", "#f9a825");
        m.put("골드", "#ffc107");
        m.put("머스타드", "#f4c20d");
        m.put("핑크", "#f48fb1");
        m.put("로즈", "#e91e63");
        m.put("파스텔 핑크", "#f7c7d6");
        m.put("밝은 파스텔 핑크", "#f7c7d6");
        m.put("형광 라임", "#c8e34a");
        m.put("밝은 옐로우", "#f1d960");
        m.put("연두", "#8bc34a");
        COLOR_HEX_MAP = Collections.unmodifiableMap(m);
    }

    // -----------------------------------------------------------------------

    public AnalysisResponse start(String cookieId) {
        return repository.findByCookieIdAndProductCode(cookieId, PRODUCT_CODE)
                .map(this::toResponse)
                .orElseGet(AnalysisResponse::photoRequired);
    }

    /**
     * 사진을 검증하고 AI 분석을 수행한 뒤 결과를 DB에 저장한다.
     *
     * NOTE: PROCESSING 저장과 COMPLETED 저장이 같은 트랜잭션 안에 있어
     *       PROCESSING 상태가 실제로 DB에 커밋되지 않는다.
     *       AI 서버 호출 시간이 길어지면 별도 트랜잭션으로 분리 고려.
     */
    @Transactional
    public AnalysisResponse submitPhoto(String cookieId, String clientIp, MultipartFile file, String gender) {
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

        // 이미지 바이트를 한 번만 읽는다
        byte[] imageBytes;
        try {
            imageBytes = file.getBytes();
        } catch (IOException e) {
            return AnalysisResponse.validationFailed(List.of("사진을 읽을 수 없습니다."));
        }

        // 검증 통과한 이미지를 먼저 디스크에 저장한다. AI 서버에 파일 경로를 전달하기 위함.
        String faceFilename = saveFaceImage(imageBytes, file.getContentType());
        if (faceFilename == null) {
            return AnalysisResponse.validationFailed(List.of("사진을 저장하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."));
        }

        AnalysisResult entity = existing.orElseGet(() -> AnalysisResult.of(cookieId));
        entity.setStatus(AnalysisStatus.PROCESSING);
        if (clientIp != null && !clientIp.isBlank()) {
            entity.setLastIp(clientIp);
        }
        repository.save(entity);

        // 저장된 파일을 바이너리로 읽어 AI 서버에 업로드
        String safeGender = (gender != null && !gender.isBlank()) ? gender : "unisex";
        Path imagePath = Paths.get(faceStorageDir).toAbsolutePath().resolve(faceFilename);
        String resultJson = callAiAnalysis(imagePath, safeGender);

        if (resultJson == null) {
            // AI 분석 실패 — 저장한 사진 삭제 후 FAILED 기록
            deleteFaceImage(faceFilename);
            entity.setStatus(AnalysisStatus.FAILED);
            repository.save(entity);
            return AnalysisResponse.validationFailed(
                    List.of("AI 모듈이 이미지를 분석하지 못했습니다. 더 선명한 정면 사진으로 다시 시도해주세요."));
        }

        // AI 분석 성공 — 경로를 DB에 저장
        entity.setFaceImagePath(faceFilename);
        entity.setStatus(AnalysisStatus.COMPLETED);
        entity.setResultJson(resultJson);
        repository.save(entity);

        return AnalysisResponse.completed(resultJson, null, null, true);
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
    // AI 모듈 호출
    // -----------------------------------------------------------------------

    /**
     * 디스크에 저장된 이미지 파일을 AI 서버에 업로드해 퍼스널컬러 분석 결과를 받는다.
     *
     * 전송 형식: multipart/form-data
     *   - "image"  (application/octet-stream) = 실제 이미지 파일 바이너리
     *   - "gender" (text/plain) = male | female | unisex
     *
     * @return 매핑된 JSON 문자열, 또는 null (AI 422 — 이미지 처리 불가)
     * @throws ResponseStatusException (500) AI 서버 오류 또는 네트워크 장애 시
     */
    private String callAiAnalysis(Path imageFile, String gender) {
        String boundary = "----FormBoundary" + UUID.randomUUID().toString().replace("-", "");
        String filename = imageFile.getFileName().toString();
        String ext = filename.contains(".") ? filename.substring(filename.lastIndexOf('.') + 1).toLowerCase() : "jpg";
        String mimeType = switch (ext) {
            case "png"  -> "image/png";
            case "webp" -> "image/webp";
            case "gif"  -> "image/gif";
            default     -> "image/jpeg";
        };

        byte[] imageBytes;
        try {
            imageBytes = Files.readAllBytes(imageFile);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "이미지 파일 읽기 오류");
        }

        byte[] multipartBody;
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            // image field — 실제 파일 바이너리
            baos.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.ISO_8859_1));
            baos.write(("Content-Disposition: form-data; name=\"image\"; filename=\"" + filename + "\"\r\n").getBytes(StandardCharsets.ISO_8859_1));
            baos.write(("Content-Type: " + mimeType + "\r\n").getBytes(StandardCharsets.ISO_8859_1));
            baos.write("\r\n".getBytes(StandardCharsets.ISO_8859_1));
            baos.write(imageBytes);
            baos.write("\r\n".getBytes(StandardCharsets.ISO_8859_1));
            // gender field
            baos.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.ISO_8859_1));
            baos.write("Content-Disposition: form-data; name=\"gender\"\r\n".getBytes(StandardCharsets.ISO_8859_1));
            baos.write("Content-Type: text/plain; charset=utf-8\r\n".getBytes(StandardCharsets.ISO_8859_1));
            baos.write("\r\n".getBytes(StandardCharsets.ISO_8859_1));
            baos.write(gender.getBytes(StandardCharsets.UTF_8));
            baos.write("\r\n".getBytes(StandardCharsets.ISO_8859_1));
            baos.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.ISO_8859_1));
            multipartBody = baos.toByteArray();
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "multipart 빌드 오류");
        }

        log.info("AI call — image_file={}, size={}bytes, gender={}", filename, imageBytes.length, gender);

        String rawJson;
        try {
            URL url = new URL(aiBaseUrl + "/personal-color/analyze");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setDoOutput(true);
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
            conn.setRequestProperty("Content-Length", String.valueOf(multipartBody.length));
            conn.setConnectTimeout(10_000);
            conn.setReadTimeout(60_000);

            try (OutputStream out = conn.getOutputStream()) {
                out.write(multipartBody);
            }

            int status = conn.getResponseCode();
            if (status == 422) {
                InputStream err = conn.getErrorStream();
                String body = err != null ? new String(err.readAllBytes(), StandardCharsets.UTF_8) : "";
                log.warn("AI module 422 — image not processable: {}", body);
                return null;
            }
            if (status >= 400) {
                InputStream err = conn.getErrorStream();
                String body = err != null ? new String(err.readAllBytes(), StandardCharsets.UTF_8) : "";
                log.error("AI module error {}: {}", status, body);
                throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "AI 분석 중 오류가 발생했습니다.");
            }

            rawJson = new String(conn.getInputStream().readAllBytes(), StandardCharsets.UTF_8);

        } catch (ResponseStatusException e) {
            throw e;
        } catch (IOException e) {
            log.error("AI module call failed: {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "AI 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
        }

        try {
            return mapAiResponse(rawJson);
        } catch (Exception e) {
            log.error("AI response mapping failed: {} | raw={}", e.getMessage(), rawJson);
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "AI 응답 처리 중 오류가 발생했습니다.");
        }
    }

    private String callAiReportGenerator(String resultJson, byte[] imageBytes) {
        // TODO: Python AI 서버로 HTTP 요청 (RestClient)
        return MOCK_REPORT_IMAGE_URL;
    }

    // -----------------------------------------------------------------------
    // AI 응답 → 프론트엔드 JSON 매핑
    // -----------------------------------------------------------------------

    /**
     * AI 모듈 응답(report 구조)을 ResultPage 가 소비하는 JSON 형식으로 변환한다.
     *
     * AI 응답 구조:
     *   report.personal_color.{type, representative_color, representative_hex, confidence, reason, attributes, season_scores}
     *   report.recommended_colors[{name, hex, reason}]
     *   report.avoid_colors[{name, hex, reason}]
     *   report.color_rules[]
     *   report.recommended_tops[{item, color, fit, reason}]
     *   report.avoid_tops[{item, color, fit, reason}]
     *
     * 매핑 결과 구조 (프론트 기대값):
     *   personalColor, tagline, heroLede, confidence, representativeHex,
     *   mainType, mainPercent, secondaryType, secondaryPercent,
     *   bestColors[{hex, name, use}], worstColors[{hex, name, reason}],
     *   clothing.{top[]}, avoidRules[]
     */
    private String mapAiResponse(String rawJson) throws Exception {
        JsonNode report = objectMapper.readTree(rawJson).path("report");
        JsonNode pc = report.path("personal_color");

        String type = pc.path("type").asText("");
        String reason = pc.path("reason").asText("");
        String representativeHex = nullIfBlank(pc.path("representative_hex").asText(null));
        int confidence = pc.path("confidence").asInt(0);

        JsonNode attrs = pc.path("attributes");
        String temperature = attrs.path("temperature").path("value").asText("");
        String lightness   = attrs.path("lightness").path("value").asText("");
        String saturation  = attrs.path("saturation").path("value").asText("");
        String clarity     = attrs.path("clarity").path("value").asText("");

        // season_scores → 비율 내림차순 정렬
        List<JsonNode> scores = new ArrayList<>();
        pc.path("season_scores").forEach(scores::add);
        scores.sort((a, b) -> b.path("percent").asInt() - a.path("percent").asInt());

        String mainType    = scores.isEmpty()  ? null : nullIfBlank(scores.get(0).path("season").asText(null));
        int    mainPercent = scores.isEmpty()  ? 0    : scores.get(0).path("percent").asInt();
        String secType     = scores.size() < 2 ? null : nullIfBlank(scores.get(1).path("season").asText(null));
        int    secPercent  = scores.size() < 2 ? 0    : scores.get(1).path("percent").asInt();

        // bestColors from recommended_colors array [{name, hex, reason}]
        List<Map<String, Object>> bestColors = new ArrayList<>();
        for (JsonNode color : report.path("recommended_colors")) {
            String name = color.path("name").asText("").trim();
            if (name.isBlank()) continue;
            String hex = nullIfBlank(color.path("hex").asText(null));
            if (hex == null) hex = lookupHex(name);
            Map<String, Object> c = new LinkedHashMap<>();
            c.put("hex", hex);
            c.put("name", name);
            c.put("use", truncate(color.path("reason").asText(""), 40));
            bestColors.add(c);
        }

        // worstColors from avoid_colors array [{name, hex, reason}]
        List<Map<String, Object>> worstColors = new ArrayList<>();
        for (JsonNode color : report.path("avoid_colors")) {
            String name = color.path("name").asText("").trim();
            if (name.isBlank()) continue;
            String hex = nullIfBlank(color.path("hex").asText(null));
            if (hex == null) hex = lookupHex(name);
            Map<String, Object> c = new LinkedHashMap<>();
            c.put("hex", hex);
            c.put("name", name);
            c.put("reason", truncate(color.path("reason").asText(""), 40));
            worstColors.add(c);
        }

        // clothing.top from recommended_tops
        List<String> topList = new ArrayList<>();
        for (JsonNode top : report.path("recommended_tops")) {
            String item      = top.path("item").asText("").trim();
            String color     = top.path("color").asText("").trim();
            String fit       = top.path("fit").asText("").trim();
            String topReason = top.path("reason").asText("").trim();
            if (item.isBlank()) continue;
            StringBuilder sb = new StringBuilder(item);
            if (!color.isBlank() || !fit.isBlank()) {
                sb.append(" (");
                if (!color.isBlank()) sb.append(color);
                if (!color.isBlank() && !fit.isBlank()) sb.append(", ");
                if (!fit.isBlank()) sb.append(fit);
                sb.append(")");
            }
            if (!topReason.isBlank()) sb.append(" — ").append(truncate(topReason, 30));
            topList.add(sb.toString());
        }

        // avoidRules: color_rules 먼저, 이후 avoid_tops 설명 추가
        List<String> avoidRules = new ArrayList<>();
        for (JsonNode rule : report.path("color_rules")) {
            String r = rule.asText().trim();
            if (!r.isBlank()) avoidRules.add(r);
        }
        for (JsonNode top : report.path("avoid_tops")) {
            String item      = top.path("item").asText("").trim();
            String topReason = top.path("reason").asText("").trim();
            if (item.isBlank()) continue;
            avoidRules.add(topReason.isBlank()
                    ? item + "은(는) 피하세요"
                    : item + " — " + topReason);
        }

        // 결과 맵 조립
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("personalColor", type);
        result.put("tagline", buildTagline(temperature, lightness, saturation, clarity));
        result.put("heroLede", reason);
        result.put("confidence", confidence);
        if (representativeHex != null) result.put("representativeHex", representativeHex);
        result.put("mainType", mainType);
        result.put("mainPercent", mainPercent);
        if (secType != null) {
            result.put("secondaryType", secType);
            result.put("secondaryPercent", secPercent);
        }
        result.put("bestColors", bestColors);
        result.put("worstColors", worstColors);
        result.put("clothing", Map.of("top", topList));
        result.put("avoidRules", avoidRules);

        return objectMapper.writeValueAsString(result);
    }

    private String buildTagline(String temperature, String lightness, String saturation, String clarity) {
        List<String> parts = new ArrayList<>();
        if (temperature != null && !temperature.isBlank()) parts.add(temperature);
        if (lightness   != null && !lightness.isBlank())   parts.add(lightness);
        if (saturation  != null && !saturation.isBlank())  parts.add(saturation);
        if (clarity     != null && !clarity.isBlank())     parts.add(clarity);
        return parts.isEmpty() ? "" : String.join(" · ", parts) + " 무드";
    }

    private String truncate(String s, int maxLen) {
        if (s == null || s.isBlank()) return "";
        return s.length() > maxLen ? s.substring(0, maxLen) + "…" : s;
    }

    private String nullIfBlank(String s) {
        return (s == null || s.isBlank()) ? null : s;
    }

    /** 컬러 이름으로 hex 코드를 조회한다. 정확한 일치 → 부분 일치 → fallback #888888 */
    private String lookupHex(String colorName) {
        if (colorName == null || colorName.isBlank()) return "#888888";
        String trimmed = colorName.trim();
        String hit = COLOR_HEX_MAP.get(trimmed);
        if (hit != null) return hit;
        for (Map.Entry<String, String> entry : COLOR_HEX_MAP.entrySet()) {
            if (trimmed.contains(entry.getKey()) || entry.getKey().contains(trimmed)) {
                return entry.getValue();
            }
        }
        return "#888888";
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

    /**
     * AI 분석 실패 시 저장해뒀던 얼굴 이미지를 삭제한다.
     * 파일이 없거나 삭제에 실패해도 분석 흐름 자체는 영향받지 않는다.
     */
    private void deleteFaceImage(String filename) {
        if (filename == null) return;
        try {
            Path path = Paths.get(faceStorageDir).toAbsolutePath().resolve(filename);
            boolean deleted = Files.deleteIfExists(path);
            if (deleted) log.info("face image deleted (AI failed): {}", filename);
            else log.warn("face image not found for deletion: {}", filename);
        } catch (IOException e) {
            log.warn("face image delete failed: {}", e.getMessage());
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
     * - redirect 차단
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
        if (ct.contains("png"))  return "png";
        if (ct.contains("jpeg") || ct.contains("jpg")) return "jpg";
        if (ct.contains("svg"))  return "svg";
        if (ct.contains("webp")) return "webp";
        if (ct.contains("gif"))  return "gif";
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
            case FAILED     -> AnalysisResponse.photoRequired();
        };
    }
}
