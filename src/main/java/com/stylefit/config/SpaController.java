package com.stylefit.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * SPA fallback — 알려진 프론트 라우트 + 알 수 없는 경로를 모두 index.html로 포워딩한다.
 * 프론트의 React Router가 매칭되지 않는 경로는 NotFoundPage로 렌더링한다.
 *
 * - `/{path:[^.]+}` : 단일 세그먼트의 점 없는 경로만 매칭 (정적 리소스인 `.css`/`.js`/`.png`는 제외)
 * - `/api/**`, `/h2-console/**` 는 @RestController / 서블릿 매핑이 더 구체적이라 먼저 매칭됨
 */
@Controller
public class SpaController {

    @GetMapping(value = {
            "/upload",
            "/loading",
            "/error",
            "/result",
            "/notfound",
            "/{path:[^.]+}",
            "/compare/{token:[^.]+}",
            "/admin",
            "/admin/ban"
    })
    public String forward() {
        return "forward:/index.html";
    }
}
