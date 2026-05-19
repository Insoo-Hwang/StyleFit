package com.stylefit.auth;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseCookie;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.UUID;

public class AnonymousCookieFilter extends OncePerRequestFilter {

    public static final String COOKIE_NAME = "stylefit_uid";
    public static final String REQUEST_ATTR = "anonymousUserId";

    private static final long MAX_AGE_SECONDS = 30L * 24 * 60 * 60; // 30일

    public enum SecureMode {
        /** 요청이 HTTPS 일 때만 Secure 부여 (dev 호환) */
        AUTO,
        /** 무조건 Secure 부여 (운영, HTTPS 강제 환경) */
        ALWAYS
    }

    private final SecureMode secureMode;

    public AnonymousCookieFilter() {
        this(SecureMode.AUTO);
    }

    public AnonymousCookieFilter(SecureMode secureMode) {
        this.secureMode = (secureMode == null) ? SecureMode.AUTO : secureMode;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String userId = extractCookie(request);

        // 기존 쿠키가 있으면 ref 포함 여부와 상관없이 절대 재발급하지 않는다.
        // ref 는 최초 발급 시 1회만 포함되며 이후 X-Ref 헤더가 와도 무시한다.
        if (userId == null) {
            String ref = sanitizeRef(request.getHeader("X-Ref"));
            String base = UUID.randomUUID().toString();
            userId = (ref != null) ? base + "_" + ref : base;
            boolean secure = resolveSecure(request);
            ResponseCookie cookie = ResponseCookie.from(COOKIE_NAME, userId)
                    .httpOnly(true)
                    .path("/")
                    .maxAge(MAX_AGE_SECONDS)
                    .sameSite("Strict")
                    .secure(secure)
                    .build();
            response.addHeader("Set-Cookie", cookie.toString());
        }

        request.setAttribute(REQUEST_ATTR, userId);
        filterChain.doFilter(request, response);
    }

    private boolean resolveSecure(HttpServletRequest request) {
        if (secureMode == SecureMode.ALWAYS) return true;
        // server.forward-headers-strategy=native 가 설정돼 있으면 isSecure() 가 XFP 를 반영함.
        return request.isSecure()
                || "https".equalsIgnoreCase(request.getHeader("X-Forwarded-Proto"));
    }

    /** UUID에는 언더스코어가 없으므로 '_' 이후가 ref suffix. [a-z0-9_-] 20자 이내만 허용. */
    private static String sanitizeRef(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String s = raw.toLowerCase().replaceAll("[^a-z0-9_\\-]", "");
        if (s.isEmpty()) return null;
        return s.length() > 20 ? s.substring(0, 20) : s;
    }

    private String extractCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        return Arrays.stream(cookies)
                .filter(c -> COOKIE_NAME.equals(c.getName()))
                .map(Cookie::getValue)
                .findFirst()
                .orElse(null);
    }
}
