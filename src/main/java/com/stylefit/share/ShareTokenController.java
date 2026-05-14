package com.stylefit.share;

import com.stylefit.auth.AnonymousCookieFilter;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/share")
@RequiredArgsConstructor
public class ShareTokenController {

    private final ShareTokenService service;

    /** 본인 결과 → 공유 토큰 발급(혹은 재사용) */
    @PostMapping("/create")
    public ResponseEntity<ShareTokenResponse> create(HttpServletRequest request) {
        String cookieId = (String) request.getAttribute(AnonymousCookieFilter.REQUEST_ATTR);
        return ResponseEntity.ok(service.createForOwner(cookieId));
    }

    /** 본인이 가진 active 토큰 조회 (없으면 token=null 빈 응답) */
    @GetMapping("/me")
    public ResponseEntity<ShareTokenResponse> mine(HttpServletRequest request) {
        String cookieId = (String) request.getAttribute(AnonymousCookieFilter.REQUEST_ATTR);
        String token = service.findMyToken(cookieId);
        return ResponseEntity.ok(ShareTokenResponse.forCreate(token));
    }

    /** 공유된 결과 조회 (토큰만 알면 누구나 볼 수 있음 — 검색엔진 인덱싱은 X-Robots-Tag로 차단) */
    @GetMapping("/{token}")
    public ResponseEntity<ShareTokenResponse> view(@PathVariable("token") String token,
                                                   HttpServletRequest request) {
        String cookieId = (String) request.getAttribute(AnonymousCookieFilter.REQUEST_ATTR);
        ShareTokenResponse body = service.view(token, cookieId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header("X-Robots-Tag", "noindex, nofollow")
                .body(body);
    }

    /** 본인 토큰 폐기 */
    @DeleteMapping("/{token}")
    public ResponseEntity<Void> revoke(@PathVariable("token") String token,
                                       HttpServletRequest request) {
        String cookieId = (String) request.getAttribute(AnonymousCookieFilter.REQUEST_ATTR);
        service.revoke(token, cookieId);
        return ResponseEntity.noContent().build();
    }
}
