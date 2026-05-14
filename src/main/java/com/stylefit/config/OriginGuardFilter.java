package com.stylefit.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.URI;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * CSRF 대응 — state-changing 요청(POST/PUT/PATCH/DELETE)에 대해 Origin/Referer 가 허용 목록에 있는지 확인한다.
 *
 * 이유:
 * - 본 프로젝트는 STATELESS + 쿠키 인증이라 CSRF 토큰 방식이 부적합.
 * - SameSite=Strict 쿠키와 함께 Origin 헤더 화이트리스트로 cross-site POST 를 거른다.
 * - allowed-origins 가 비어 있으면(dev) 동일 호스트 요청만 통과시킨다(절대 모든 origin 통과 X).
 */
@Component
public class OriginGuardFilter extends OncePerRequestFilter {

    @Value("${stylefit.security.allowed-origins:}")
    private String allowedOriginsRaw;

    private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS");

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String method = request.getMethod();
        if (SAFE_METHODS.contains(method)) {
            filterChain.doFilter(request, response);
            return;
        }

        // multipart/file 업로드 등에서 origin 미전송 브라우저가 있으나 fetch/XHR 은 항상 전송.
        // referer 도 함께 보고, 둘 다 없으면 차단.
        String origin = request.getHeader("Origin");
        String referer = request.getHeader("Referer");
        String candidate = origin != null ? origin : extractOriginFromReferer(referer);

        Set<String> allowed = parseOrigins(allowedOriginsRaw);
        if (allowed.isEmpty()) {
            // dev 모드 — 동일 호스트(scheme://host:port)면 통과
            String selfOrigin = request.getScheme() + "://" + request.getHeader("Host");
            if (candidate != null && candidate.equalsIgnoreCase(selfOrigin)) {
                filterChain.doFilter(request, response);
                return;
            }
            // 동일 호스트가 아니면 Vite 프록시·모바일 동일 Wi-Fi 등은 보통 origin == host 라
            // 여기까지 안 옴. fallback 으로 candidate 가 null 인 경우만 허용(같은 도메인 SSR 호출 등).
            if (candidate == null) {
                filterChain.doFilter(request, response);
                return;
            }
        } else {
            if (candidate != null && allowed.contains(normalizeOrigin(candidate))) {
                filterChain.doFilter(request, response);
                return;
            }
        }

        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"error\":\"forbidden_origin\"}");
    }

    private static Set<String> parseOrigins(String raw) {
        if (raw == null || raw.isBlank()) return Set.of();
        return new HashSet<>(Arrays.asList(raw.split(",")))
                .stream()
                .map(String::trim)
                .map(OriginGuardFilter::normalizeOrigin)
                .filter(s -> !s.isEmpty())
                .collect(java.util.stream.Collectors.toUnmodifiableSet());
    }

    private static String normalizeOrigin(String origin) {
        if (origin == null) return "";
        String s = origin.trim();
        if (s.endsWith("/")) s = s.substring(0, s.length() - 1);
        return s.toLowerCase();
    }

    private static String extractOriginFromReferer(String referer) {
        if (referer == null || referer.isBlank()) return null;
        try {
            URI uri = URI.create(referer);
            if (uri.getScheme() == null || uri.getHost() == null) return null;
            int port = uri.getPort();
            return port < 0
                    ? uri.getScheme() + "://" + uri.getHost()
                    : uri.getScheme() + "://" + uri.getHost() + ":" + port;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
