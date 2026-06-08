package com.stylefit.settings;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.concurrent.ConcurrentHashMap;

/**
 * 런타임 변경 가능한 운영 설정의 단일 진입점.
 * - DB(app_setting)에 값이 있으면 그 값, 없으면 application.properties 기본값.
 * - 읽은 값은 메모리에 캐시하고, 어드민이 변경하면 캐시를 갱신한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SettingsService {

    /** 서버 전체 일일 AI 호출 한도. */
    public static final String KEY_REPORT_DAILY = "ratelimit.report-daily";
    /** 인당(쿠키당) 누적 진단 횟수 한도. */
    public static final String KEY_MAX_DIAGNOSIS = "diagnosis.max-per-cookie";

    private final AppSettingRepository repository;

    @Value("${stylefit.ratelimit.report-daily:50}")
    private int defaultReportDaily;

    @Value("${stylefit.diagnosis.max-per-cookie:5}")
    private int defaultMaxDiagnosis;

    private final ConcurrentHashMap<String, Integer> cache = new ConcurrentHashMap<>();

    public int getReportDaily() {
        return getInt(KEY_REPORT_DAILY, defaultReportDaily);
    }

    public int getMaxDiagnosisPerCookie() {
        return getInt(KEY_MAX_DIAGNOSIS, defaultMaxDiagnosis);
    }

    @Transactional(readOnly = true)
    public int getInt(String key, int defaultValue) {
        Integer cached = cache.get(key);
        if (cached != null) return cached;
        int resolved = repository.findById(key)
                .map(s -> parseOr(s.getSettingValue(), defaultValue))
                .orElse(defaultValue);
        cache.put(key, resolved);
        return resolved;
    }

    /** 어드민이 설정을 변경한다. DB에 영속화하고 캐시를 갱신. */
    @Transactional
    public void setInt(String key, int value) {
        AppSetting entity = repository.findById(key).orElseGet(() -> AppSetting.of(key, String.valueOf(value)));
        entity.setSettingValue(String.valueOf(value));
        repository.save(entity);
        cache.put(key, value);
        log.info("setting updated: {}={}", key, value);
    }

    private static int parseOr(String raw, int fallback) {
        try {
            return Integer.parseInt(raw.trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }
}
