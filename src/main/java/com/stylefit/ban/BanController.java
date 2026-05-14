package com.stylefit.ban;

import com.stylefit.auth.AnonymousCookieFilter;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Slf4j
@RestController
@RequestMapping("/api/ban")
@RequiredArgsConstructor
public class BanController {

    private final BanService banService;

    /**
     * 현재 요청의 쿠키/IP가 차단 목록에 있는지 확인.
     * 사진 첨부 페이지(UploadPage) 마운트 시 호출되어 차단 여부를 판단한다.
     */
    @GetMapping("/check")
    public ResponseEntity<BanCheckResponse> check(HttpServletRequest request) {
        String cookieId = (String) request.getAttribute(AnonymousCookieFilter.REQUEST_ATTR);
        String ip = banService.extractClientIp(request);
        boolean banned = banService.isBanned(cookieId, ip);
        log.info("ban check: cookieId={} ip={} banned={}", cookieId, ip, banned);
        return ResponseEntity.ok(BanCheckResponse.of(banned));
    }
}
