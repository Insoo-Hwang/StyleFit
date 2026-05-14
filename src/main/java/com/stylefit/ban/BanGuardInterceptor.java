package com.stylefit.ban;

import com.stylefit.auth.AnonymousCookieFilter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.io.IOException;

/**
 * 분석 모듈 API에 접근하는 요청을 인터셉트해 차단 목록(쿠키/IP)을 확인한다.
 * 매칭되면 403 응답으로 즉시 종료 — 분석 처리에 비용이 들어가지 않게 entry point에서 막는다.
 */
@Component
@RequiredArgsConstructor
public class BanGuardInterceptor implements HandlerInterceptor {

    private final BanService banService;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler)
            throws IOException {
        String cookieId = (String) request.getAttribute(AnonymousCookieFilter.REQUEST_ATTR);
        String ip = banService.extractClientIp(request);
        if (banService.isBanned(cookieId, ip)) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"error\":\"banned\",\"message\":\"차단된 사용자입니다.\"}");
            return false;
        }
        return true;
    }
}
