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

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String userId = extractCookie(request);

        if (userId == null) {
            userId = UUID.randomUUID().toString();
            ResponseCookie cookie = ResponseCookie.from(COOKIE_NAME, userId)
                    .httpOnly(true)
                    .path("/")
                    .maxAge(MAX_AGE_SECONDS)
                    .sameSite("Strict")
                    .build();
            response.addHeader("Set-Cookie", cookie.toString());
        }

        request.setAttribute(REQUEST_ATTR, userId);
        filterChain.doFilter(request, response);
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
