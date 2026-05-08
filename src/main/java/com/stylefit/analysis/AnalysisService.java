package com.stylefit.analysis;

import com.stylefit.vision.PhotoValidationResponse;
import com.stylefit.vision.PhotoValidationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AnalysisService {

    private final AnalysisResultRepository repository;
    private final PhotoValidationService photoValidationService;

    private static final String PRODUCT_CODE = "PERSONAL_COLOR_DIAGNOSIS";
    private static final int MAX_PHOTOS = 3;

    // -----------------------------------------------------------------------
    // Mock 데이터 — Python AI 서버 연동 시 교체
    // -----------------------------------------------------------------------
    private static final String MOCK_RESULT_JSON = """
            {
              "personalColor": "SPRING_WARM",
              "tone": "WARM",
              "skinUndertone": "YELLOW_PEACH",
              "bestColors": ["#FFD700", "#FF8C00", "#FFA07A", "#FFDAB9", "#F4A460"],
              "worstColors": ["#708090", "#4682B4", "#6A5ACD", "#483D8B", "#2F4F4F"],
              "description": "봄 웜톤입니다. 밝고 따뜻한 노란빛 계열 색상이 피부를 생기있게 만들어줍니다.",
              "recommendedStyles": ["캐주얼", "로맨틱", "내추럴"],
              "makeupTips": "코럴이나 피치 계열 립 컬러가 잘 어울립니다."
            }
            """;

    private static final String MOCK_REPORT_IMAGE_URL =
            "https://placehold.co/800x1200/FFD700/333333?text=StyleFit+Report";
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
    public AnalysisResponse submitPhoto(String cookieId, List<MultipartFile> files) {
        if (files == null || files.isEmpty()) {
            return AnalysisResponse.validationFailed(List.of("사진을 1장 이상 업로드해주세요."));
        }
        if (files.size() > MAX_PHOTOS) {
            return AnalysisResponse.validationFailed(
                    List.of("사진은 최대 " + MAX_PHOTOS + "장까지 업로드할 수 있습니다. (현재 " + files.size() + "장)"));
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

        List<String> allWarnings = validatePhotos(files);
        if (!allWarnings.isEmpty()) {
            return AnalysisResponse.validationFailed(allWarnings);
        }

        AnalysisResult entity = existing.orElseGet(() -> AnalysisResult.of(cookieId));
        entity.setStatus(AnalysisStatus.PROCESSING);
        repository.save(entity);

        // AI 분석 모듈 호출 (mock)
        String resultJson = callAiAnalysis();

        // 리포트 이미지 생성 모듈 호출 (mock)
        String reportImageUrl = callAiReportGenerator(resultJson);

        entity.setStatus(AnalysisStatus.COMPLETED);
        entity.setResultJson(resultJson);
        repository.save(entity);

        return AnalysisResponse.completed(resultJson, reportImageUrl);
    }

    // -----------------------------------------------------------------------
    // Private helpers
    // -----------------------------------------------------------------------

    private List<String> validatePhotos(List<MultipartFile> files) {
        List<String> allWarnings = new ArrayList<>();
        boolean multipleFiles = files.size() > 1;

        for (int i = 0; i < files.size(); i++) {
            try {
                PhotoValidationResponse result = photoValidationService.validate(files.get(i));
                if (!result.valid()) {
                    String prefix = multipleFiles ? (i + 1) + "번 사진: " : "";
                    result.warnings().forEach(w -> allWarnings.add(prefix + w));
                }
            } catch (IOException e) {
                String prefix = multipleFiles ? (i + 1) + "번 사진: " : "";
                allWarnings.add(prefix + "사진을 읽을 수 없습니다.");
            }
        }

        return allWarnings;
    }

    private String callAiAnalysis() {
        // TODO: Python AI 서버로 HTTP 요청 (RestClient)
        return MOCK_RESULT_JSON;
    }

    private String callAiReportGenerator(String resultJson) {
        // TODO: Python AI 서버로 HTTP 요청 (RestClient)
        return MOCK_REPORT_IMAGE_URL;
    }

    private AnalysisResponse toResponse(AnalysisResult record) {
        return switch (record.getStatus()) {
            case COMPLETED -> AnalysisResponse.completed(record.getResultJson(), MOCK_REPORT_IMAGE_URL);
            case PROCESSING -> AnalysisResponse.processing();
            case FAILED -> AnalysisResponse.photoRequired();
        };
    }
}
