package com.stylefit.admin;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 어드민 인증 — 단일 비밀번호(서버 properties 평문) 검증.
 *
 * 보안 관련 사용자 결정 사항:
 * - 비밀번호는 application.properties 에 평문 보관 (사용자 요청).
 * - 운영자가 1명뿐인 MVP 단계라 사용자별 계정/RBAC 도입하지 않음.
 *
 * 세션:
 * - 로그인 성공 시 SecureRandom 토큰 발급 → in-memory Map 에 보관 → 쿠키로 클라이언트에 반환.
 * - 서버 재시작 시 모든 세션 무효화 (운영자 1명이라 수용 가능).
 * - TTL 12시간.
 */
@Slf4j
@Service
public class AdminAuthService {

    public static final String COOKIE_NAME = "stylefit_admin";
    private static final long TTL_SECONDS = 12L * 60 * 60;

    @Value("${stylefit.admin.password}")
    private String configuredPassword;

    private final SecureRandom random = new SecureRandom();

    /** token → expiresAt(epoch second). 만료된 항목은 검증 시점에 lazy 삭제. */
    private final Map<String, Long> sessions = new ConcurrentHashMap<>();

    public boolean verifyPassword(String input) {
        boolean matched = input != null && configuredPassword != null && input.equals(configuredPassword);
        // 디버깅용 — 운영 단계에선 length/match 만 남기거나 제거. raw 비밀번호는 절대 안 찍음.
        log.info("admin login attempt: inputLen={} configuredLen={} match={}",
                input == null ? -1 : input.length(),
                configuredPassword == null ? -1 : configuredPassword.length(),
                matched);
        return matched;
    }

    public String issueSession() {
        byte[] buf = new byte[24];
        random.nextBytes(buf);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(buf);
        sessions.put(token, Instant.now().getEpochSecond() + TTL_SECONDS);
        return token;
    }

    public long getTtlSeconds() {
        return TTL_SECONDS;
    }

    public boolean isValid(String token) {
        if (token == null) return false;
        Long exp = sessions.get(token);
        if (exp == null) return false;
        if (exp < Instant.now().getEpochSecond()) {
            sessions.remove(token);
            return false;
        }
        return true;
    }

    public void invalidate(String token) {
        if (token != null) sessions.remove(token);
    }

    public static String extractToken(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) return null;
        for (Cookie c : cookies) {
            if (COOKIE_NAME.equals(c.getName())) return c.getValue();
        }
        return null;
    }
}
