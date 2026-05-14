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

        if (userId == null) {
            userId = UUID.randomUUID().toString();
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
