package com.stylefit.behavior;

import com.stylefit.auth.AnonymousCookieFilter;
import jakarta.servlet.http.HttpServletRequest;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.RequiredArgsConstructor;
import lombok.Setter;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/user-behavior")
@RequiredArgsConstructor
public class UserBehaviorController {

    private final UserBehaviorService service;

    @GetMapping
    public ResponseEntity<UserBehaviorResponse> get(HttpServletRequest request) {
        return ResponseEntity.ok(service.get(cookieOf(request)));
    }

    @PostMapping("/scroll")
    public ResponseEntity<UserBehaviorResponse> scroll(@RequestBody ScrollRequest body,
                                                       HttpServletRequest request) {
        return ResponseEntity.ok(service.markScroll(cookieOf(request), body.getSection(), body.getIndex()));
    }

    @PostMapping("/photo-dwell")
    public ResponseEntity<UserBehaviorResponse> photoDwell(@RequestBody MsRequest body,
                                                           HttpServletRequest request) {
        return ResponseEntity.ok(service.markPhotoDwell(cookieOf(request), body.getMs()));
    }

    @PostMapping("/analysis-failed")
    public ResponseEntity<UserBehaviorResponse> analysisFailed(HttpServletRequest request) {
        return ResponseEntity.ok(service.markAnalysisFailed(cookieOf(request)));
    }

    @PostMapping("/result-revisit")
    public ResponseEntity<UserBehaviorResponse> resultRevisit(HttpServletRequest request) {
        return ResponseEntity.ok(service.markResultRevisit(cookieOf(request)));
    }

    @PostMapping("/photo-replaced")
    public ResponseEntity<UserBehaviorResponse> photoReplaced(@RequestBody CountRequest body,
                                                              HttpServletRequest request) {
        return ResponseEntity.ok(service.markPhotoReplaced(cookieOf(request), body.getCount()));
    }

    private String cookieOf(HttpServletRequest request) {
        return (String) request.getAttribute(AnonymousCookieFilter.REQUEST_ATTR);
    }

    @Getter @Setter @NoArgsConstructor
    public static class ScrollRequest {
        private String section;
        private int index;
    }

    @Getter @Setter @NoArgsConstructor
    public static class MsRequest {
        private int ms;
    }

    @Getter @Setter @NoArgsConstructor
    public static class CountRequest {
        private int count;
    }
}
