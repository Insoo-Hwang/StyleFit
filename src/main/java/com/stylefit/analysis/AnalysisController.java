package com.stylefit.analysis;

import com.stylefit.auth.AnonymousCookieFilter;
import com.stylefit.ban.BanService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

@RestController
@RequestMapping("/api/analysis")
@RequiredArgsConstructor
public class AnalysisController {

    private final AnalysisService analysisService;
    private final BanService banService;

    /**
     * 기존 분석 결과 여부를 확인한다.
     * - PHOTO_REQUIRED: 사진 업로드 필요 (프론트에서 업로드 화면 표시)
     * - PROCESSING:     처리 중
     * - COMPLETED:      결과 있음 (result, reportImageUrl 포함)
     */
    @PostMapping("/start")
    public ResponseEntity<AnalysisResponse> start(HttpServletRequest request) {
        String cookieId = (String) request.getAttribute(AnonymousCookieFilter.REQUEST_ATTR);
        return ResponseEntity.ok(analysisService.start(cookieId));
    }

    /**
     * 사진을 업로드해 분석을 요청한다.
     * - VALIDATION_FAILED: 사진 검증 실패 (validationWarnings 포함)
     * - COMPLETED:         분석 완료 (result 포함, reportImageUrl 없음 — 결제 확인 후 별도 생성)
     * - 409 Conflict:      이미 처리 중
     * - 429 Too Many:      글로벌/쿠키/IP 일일 한도 초과
     */
    @PostMapping("/submit-photo")
    public ResponseEntity<AnalysisResponse> submitPhoto(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "gender", defaultValue = "unisex") String gender,
            HttpServletRequest request) {
        String cookieId = (String) request.getAttribute(AnonymousCookieFilter.REQUEST_ATTR);
        String clientIp = banService.extractClientIp(request);
        return ResponseEntity.ok(analysisService.submitPhoto(cookieId, clientIp, file, gender));
    }

    /**
     * 사용자가 결제 확인("예")을 누른 후 호출.
     * 이미 생성된 이미지가 있으면 캐시 URL을 반환하고, 없으면 AI 모듈을 호출해 생성·저장 후 반환.
     * 응답: { reportImageUrl: string, cached: boolean }
     */
    @PostMapping("/report-image")
    public ResponseEntity<Map<String, Object>> generateReportImage(HttpServletRequest request) {
        String cookieId = (String) request.getAttribute(AnonymousCookieFilter.REQUEST_ATTR);
        String clientIp = banService.extractClientIp(request);
        return ResponseEntity.ok(analysisService.generateReportImage(cookieId, clientIp));
    }

    /**
     * 본인 진단 결과를 삭제한다. 삭제 후 같은 쿠키로 재진단이 가능해진다.
     * 응답: { deleted: boolean } — 삭제 대상이 실제 존재했는지 여부.
     */
    @DeleteMapping("/result")
    public ResponseEntity<Map<String, Object>> deleteResult(HttpServletRequest request) {
        String cookieId = (String) request.getAttribute(AnonymousCookieFilter.REQUEST_ATTR);
        boolean deleted = analysisService.deleteResult(cookieId);
        return ResponseEntity.ok(Map.of("deleted", deleted));
    }
}
