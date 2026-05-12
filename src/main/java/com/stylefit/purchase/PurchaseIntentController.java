package com.stylefit.purchase;

import com.stylefit.auth.AnonymousCookieFilter;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/purchase-intent")
@RequiredArgsConstructor
public class PurchaseIntentController {

    private final PurchaseIntentService service;

    /**
     * 본인 결제 의향 데이터 조회 (HomePage 디버그 표시 용).
     * exists=false면 아직 다이얼로그를 노출한 적이 없는 사용자.
     */
    @GetMapping
    public ResponseEntity<PurchaseIntentResponse> get(HttpServletRequest request) {
        String cookieId = (String) request.getAttribute(AnonymousCookieFilter.REQUEST_ATTR);
        return ResponseEntity.ok(service.get(cookieId));
    }

    /**
     * 다이얼로그가 열릴 때 호출.
     * - dialog_count++
     * - last_choice = 'NO' (그냥 닫는 경우 대비 미리 기본값 박음)
     */
    @PostMapping("/open")
    public ResponseEntity<PurchaseIntentResponse> open(HttpServletRequest request) {
        String cookieId = (String) request.getAttribute(AnonymousCookieFilter.REQUEST_ATTR);
        return ResponseEntity.ok(service.markOpened(cookieId));
    }

    /**
     * 사용자가 "예"를 누른 시점에 호출 — last_choice='YES'로 갱신.
     */
    @PostMapping("/yes")
    public ResponseEntity<PurchaseIntentResponse> yes(HttpServletRequest request) {
        String cookieId = (String) request.getAttribute(AnonymousCookieFilter.REQUEST_ATTR);
        return ResponseEntity.ok(service.markYes(cookieId));
    }
}
