package com.stylefit.survey;

import com.stylefit.auth.AnonymousCookieFilter;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/survey/satisfaction")
@RequiredArgsConstructor
public class SatisfactionSurveyController {

    private final SatisfactionSurveyService service;

    /**
     * 익명 쿠키 기준 본인의 만족도 평가를 조회한다.
     * - exists=false: 아직 작성하지 않은 사용자 (다이얼로그를 새로 작성 모드로 노출)
     * - exists=true:  기존 평가 존재 (rating/comment 채워 수정 모드로 노출)
     */
    @GetMapping
    public ResponseEntity<SatisfactionSurveyResponse> get(HttpServletRequest request) {
        String cookieId = (String) request.getAttribute(AnonymousCookieFilter.REQUEST_ATTR);
        return ResponseEntity.ok(service.get(cookieId));
    }

    /**
     * 만족도 평가를 저장한다. 기존 평가가 있으면 덮어쓴다.
     */
    @PostMapping
    public ResponseEntity<SatisfactionSurveyResponse> upsert(
            @RequestBody SatisfactionSurveyRequest req,
            HttpServletRequest request) {
        String cookieId = (String) request.getAttribute(AnonymousCookieFilter.REQUEST_ATTR);
        return ResponseEntity.ok(service.upsert(cookieId, req));
    }
}
