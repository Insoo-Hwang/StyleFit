package com.stylefit.ratelimit;

import com.stylefit.settings.SettingsService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class RateLimitService {

    private final ApiCallQuotaRepository globalRepository;
    private final ActorQuotaRepository actorRepository;
    private final SettingsService settingsService;

    /**
     * 쿠키(사용자) 일일 한도. 기본 5회.
     * 쿠키를 새로 발급해 무한 재시도하는 사용자가 글로벌 카운터를 다 소진하는 것을 막는다.
     */
    @Value("${stylefit.ratelimit.per-cookie-daily:5}")
    private int perCookieDaily;

    /**
     * IP 일일 한도. 기본 10회.
     * 쿠키 변경으로 우회하려는 사용자에 대한 2차 방어선.
     */
    @Value("${stylefit.ratelimit.per-ip-daily:10}")
    private int perIpDaily;

    public int getDailyLimit() {
        return settingsService.getReportDaily();
    }

    public int getPerCookieDaily() {
        return perCookieDaily;
    }

    public int getPerIpDaily() {
        return perIpDaily;
    }

    /**
     * 글로벌 + per-cookie + per-IP 3개 카운터를 모두 통과해야 1건을 소모한다.
     * 하나라도 한도 초과면 false 반환 + 모든 카운터 변경 롤백.
     */
    @Transactional
    public boolean tryConsume(String cookieId, String ip) {
        if (!tryConsumeGlobal()) return false;
        if (cookieId != null && !cookieId.isBlank()) {
            if (!tryConsumeActor(ActorQuota.Scope.COOKIE, cookieId, perCookieDaily)) {
                throw new RateLimitExceededException();
            }
        }
        if (ip != null && !ip.isBlank()) {
            if (!tryConsumeActor(ActorQuota.Scope.IP, ip, perIpDaily)) {
                throw new RateLimitExceededException();
            }
        }
        return true;
    }

    private boolean tryConsumeGlobal() {
        LocalDate today = LocalDate.now();
        int dailyLimit = settingsService.getReportDaily();
        Optional<ApiCallQuota> found = globalRepository.findById(today);
        if (found.isEmpty()) {
            globalRepository.save(ApiCallQuota.first(today));
            return true;
        }
        ApiCallQuota quota = found.get();
        if (quota.getCallCount() >= dailyLimit) {
            return false;
        }
        quota.increment();
        return true;
    }

    private boolean tryConsumeActor(ActorQuota.Scope scope, String actorKey, int limit) {
        LocalDate today = LocalDate.now();
        ActorQuota.Key key = new ActorQuota.Key();
        key.setScope(scope);
        key.setActorKey(actorKey);
        key.setQuotaDay(today);
        Optional<ActorQuota> found = actorRepository.findById(key);
        if (found.isEmpty()) {
            actorRepository.save(ActorQuota.first(scope, actorKey, today));
            return true;
        }
        ActorQuota quota = found.get();
        if (quota.getCallCount() >= limit) {
            return false;
        }
        quota.increment();
        return true;
    }

    /**
     * actor 한도가 막혔을 때 글로벌 카운터를 롤백하기 위한 unchecked exception.
     * 호출자(AnalysisService)는 잡아서 429 응답으로 변환.
     */
    public static class RateLimitExceededException extends RuntimeException {
        public RateLimitExceededException() {
            super("per-actor rate limit exceeded");
        }
    }
}
