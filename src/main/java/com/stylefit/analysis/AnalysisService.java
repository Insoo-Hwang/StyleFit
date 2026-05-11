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
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AnalysisService {

    private final AnalysisResultRepository repository;
    private final PhotoValidationService photoValidationService;

    private static final String PRODUCT_CODE = "PERSONAL_COLOR_DIAGNOSIS";

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
    public AnalysisResponse submitPhoto(String cookieId, MultipartFile file) {
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
