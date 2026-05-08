package com.stylefit.analysis;

import com.stylefit.auth.AnonymousCookieFilter;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/analysis")
@RequiredArgsConstructor
public class AnalysisController {

    private final AnalysisService analysisService;

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
     * - COMPLETED:         분석 완료 (result, reportImageUrl 포함)
     * - 409 Conflict:      이미 처리 중
     */
    @PostMapping("/submit-photo")
    public ResponseEntity<AnalysisResponse> submitPhoto(
            @RequestParam("files") List<MultipartFile> files,
            HttpServletRequest request) {
        String cookieId = (String) request.getAttribute(AnonymousCookieFilter.REQUEST_ATTR);
        return ResponseEntity.ok(analysisService.submitPhoto(cookieId, files));
    }
}
