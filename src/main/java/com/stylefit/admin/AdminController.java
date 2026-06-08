package com.stylefit.admin;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminController {

    private final AdminAuthService authService;
    private final AdminStatsService statsService;

    @PostMapping("/login")
    public ResponseEntity<Map<String, Object>> login(@RequestBody Map<String, String> body,
                                                      HttpServletRequest request) {
        String password = body == null ? null : body.get("password");
        if (!authService.verifyPassword(password)) {
            return ResponseEntity.status(401).body(Map.of("error", "invalid_password"));
        }
        String token = authService.issueSession();
        boolean secure = request.isSecure()
                || "https".equalsIgnoreCase(request.getHeader("X-Forwarded-Proto"));
        ResponseCookie cookie = ResponseCookie.from(AdminAuthService.COOKIE_NAME, token)
                .httpOnly(true)
                .path("/")
                .maxAge(authService.getTtlSeconds())
                .sameSite("Strict")
                .secure(secure)
                .build();
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie.toString())
                .body(Map.of("ok", true));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, Object>> logout(HttpServletRequest request) {
        String token = AdminAuthService.extractToken(request);
        authService.invalidate(token);
        ResponseCookie clear = ResponseCookie.from(AdminAuthService.COOKIE_NAME, "")
                .httpOnly(true)
                .path("/")
                .maxAge(0)
                .sameSite("Strict")
                .build();
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, clear.toString())
                .body(Map.of("ok", true));
    }

    /** 로그인 상태 확인 — 인터셉터가 통과시켰다면 OK */
    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> me() {
        return ResponseEntity.ok(Map.of("authenticated", true));
    }

    @GetMapping("/stats/summary")
    public ResponseEntity<Map<String, Object>> summary() {
        return ResponseEntity.ok(statsService.summary());
    }

    @GetMapping("/stats/satisfaction")
    public ResponseEntity<List<Map<String, Object>>> satisfaction() {
        return ResponseEntity.ok(statsService.listSatisfaction());
    }

    @GetMapping("/stats/purchase-intent")
    public ResponseEntity<List<Map<String, Object>>> purchaseIntent() {
        return ResponseEntity.ok(statsService.listPurchase());
    }

    @GetMapping("/stats/behavior")
    public ResponseEntity<List<Map<String, Object>>> behavior() {
        return ResponseEntity.ok(statsService.listBehavior());
    }

    @GetMapping("/stats/banned")
    public ResponseEntity<List<Map<String, Object>>> banned() {
        return ResponseEntity.ok(statsService.listBanned());
    }

    @GetMapping("/stats/shares")
    public ResponseEntity<List<Map<String, Object>>> shares() {
        return ResponseEntity.ok(statsService.listShares());
    }

    /** ?ref= 파라미터 기준 유입 경로 분석 (제출·완료·완료율). */
    @GetMapping("/stats/acquisition")
    public ResponseEntity<List<Map<String, Object>>> acquisition() {
        return ResponseEntity.ok(statsService.acquisitionBreakdown());
    }

    /** 최근 진단 활동 기준 사용자 목록 (cookie + lastIp 페어). 차단 화면 데이터 소스. */
    @GetMapping("/stats/recent-users")
    public ResponseEntity<List<Map<String, Object>>> recentUsers(
            @RequestParam(name = "limit", defaultValue = "100") int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 500));
        return ResponseEntity.ok(statsService.listRecentUsers(safeLimit));
    }

    /** 운영 설정 현재값 조회 — { reportDaily, maxDiagnosisPerCookie } */
    @GetMapping("/settings")
    public ResponseEntity<Map<String, Object>> getSettings() {
        return ResponseEntity.ok(statsService.getSettings());
    }

    /** 운영 설정 변경 — body 에 포함된 키만 갱신. 변경 후 현재값 반환. */
    @PutMapping("/settings")
    public ResponseEntity<Map<String, Object>> updateSettings(@RequestBody Map<String, Object> body) {
        return ResponseEntity.ok(statsService.updateSettings(body));
    }

    /** 다중 차단. body: { items: [{cookieId?, ip?, reason?}, ...] } */
    @PostMapping("/ban")
    public ResponseEntity<Map<String, Object>> banMany(@RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked")
        List<Map<String, String>> items = (List<Map<String, String>>) body.get("items");
        int inserted = statsService.banMany(items);
        return ResponseEntity.ok(Map.of("inserted", inserted));
    }

    /** 차단 해제 (어드민 BanPage 에서 이미 차단된 행을 토글할 때) */
    @DeleteMapping("/ban")
    public ResponseEntity<Map<String, Object>> unban(@RequestParam(required = false) String cookieId,
                                                      @RequestParam(required = false) String ip) {
        int removed = statsService.unban(cookieId, ip);
        return ResponseEntity.ok(Map.of("removed", removed));
    }
}
