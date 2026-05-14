package com.stylefit.ban;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class BanService {

    private final JdbcTemplate jdbcTemplate;

    /**
     * X-Forwarded-For / X-Real-IP 헤더를 신뢰할 프록시 IP 목록.
     * 비어 있으면 어떤 헤더도 신뢰하지 않고 항상 request.getRemoteAddr() 만 사용한다.
     * 운영(application-prod.properties)에서 Nginx/로드밸런서 IP 를 콤마 구분으로 주입.
     * 예: stylefit.security.trusted-proxies=127.0.0.1,10.0.0.5
     */
    @Value("${stylefit.security.trusted-proxies:}")
    private String trustedProxiesRaw;

    private volatile Set<String> trustedProxies = Set.of();

    @PostConstruct
    void initTrustedProxies() {
        if (trustedProxiesRaw == null || trustedProxiesRaw.isBlank()) {
            this.trustedProxies = Set.of();
            return;
        }
        this.trustedProxies = new HashSet<>(Arrays.asList(trustedProxiesRaw.split(","))).stream()
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
    }

    // cookie-only 행은 쿠키만, ip-only 행은 IP만, 두 필드 모두 있는 행은 두 값이 정확히 일치해야 차단.
    // 이렇게 해야 "쿠키+IP 차단"이 같은 IP의 다른 사용자를 collateral ban하지 않는다.
    private static final String COUNT_SQL =
            "SELECT COUNT(*) FROM banned_user " +
            "WHERE (cookie_id = ? AND ip_address IS NULL) " +
            "   OR (ip_address = ? AND cookie_id IS NULL) " +
            "   OR (cookie_id = ? AND ip_address = ?)";

    public boolean isBanned(String cookieId, String ipAddress) {
        if ((cookieId == null || cookieId.isBlank())
                && (ipAddress == null || ipAddress.isBlank())) {
            return false;
        }
        Integer count = jdbcTemplate.queryForObject(COUNT_SQL, Integer.class,
                cookieId, ipAddress, cookieId, ipAddress);
        return count != null && count > 0;
    }

    /**
     * 신뢰 프록시 IP 가 있을 때만 X-Forwarded-For / X-Real-IP 헤더를 사용한다.
     * 그렇지 않으면 헤더를 무시하고 직접 연결된 클라이언트 IP 를 반환 — 임의 사용자가
     * 헤더를 위조해 IP 밴을 우회하는 것을 막는다.
     */
    public String extractClientIp(HttpServletRequest request) {
        String remoteAddr = request.getRemoteAddr();
        if (trustedProxies.isEmpty() || remoteAddr == null || !trustedProxies.contains(remoteAddr)) {
            return remoteAddr;
        }
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            int comma = xff.indexOf(',');
            return (comma > 0 ? xff.substring(0, comma) : xff).trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return remoteAddr;
    }
}
