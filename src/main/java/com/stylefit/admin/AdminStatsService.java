package com.stylefit.admin;

import com.stylefit.analysis.AnalysisResult;
import com.stylefit.analysis.AnalysisResultRepository;
import com.stylefit.analysis.AnalysisStatus;
import com.stylefit.behavior.UserBehavior;
import com.stylefit.behavior.UserBehaviorRepository;
import com.stylefit.purchase.PurchaseChoice;
import com.stylefit.purchase.PurchaseIntent;
import com.stylefit.purchase.PurchaseIntentRepository;
import com.stylefit.ratelimit.ApiCallQuota;
import com.stylefit.ratelimit.ApiCallQuotaRepository;
import com.stylefit.share.ShareToken;
import com.stylefit.share.ShareTokenRepository;
import com.stylefit.survey.Gender;
import com.stylefit.survey.SatisfactionSurvey;
import com.stylefit.survey.SatisfactionSurveyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminStatsService {

    private final AnalysisResultRepository analysisResultRepository;
    private final SatisfactionSurveyRepository satisfactionRepository;
    private final PurchaseIntentRepository purchaseRepository;
    private final UserBehaviorRepository behaviorRepository;
    private final ShareTokenRepository shareRepository;
    private final ApiCallQuotaRepository quotaRepository;
    private final JdbcTemplate jdbcTemplate;

    @Value("${stylefit.ratelimit.report-daily:50}")
    private int globalDailyLimit;

    @Transactional(readOnly = true)
    public Map<String, Object> summary() {
        Map<String, Object> out = new HashMap<>();

        List<AnalysisResult> analyses = analysisResultRepository.findAll();
        long total = analyses.size();
        long completed = analyses.stream().filter(a -> a.getStatus() == AnalysisStatus.COMPLETED).count();
        long processing = analyses.stream().filter(a -> a.getStatus() == AnalysisStatus.PROCESSING).count();
        long failed = analyses.stream().filter(a -> a.getStatus() == AnalysisStatus.FAILED).count();
        LocalDateTime startOfToday = LocalDate.now().atStartOfDay();
        long todayCompleted = analyses.stream()
                .filter(a -> a.getStatus() == AnalysisStatus.COMPLETED)
                .filter(a -> a.getUpdatedAt() != null && a.getUpdatedAt().isAfter(startOfToday))
                .count();
        out.put("analysis", Map.of(
                "total", total,
                "completed", completed,
                "processing", processing,
                "failed", failed,
                "todayCompleted", todayCompleted
        ));

        List<SatisfactionSurvey> surveys = satisfactionRepository.findAll();
        double avgRating = surveys.stream().mapToInt(s -> s.getRating() == null ? 0 : s.getRating())
                .average().orElse(0);
        long male = surveys.stream().filter(s -> s.getGender() == Gender.MALE).count();
        long female = surveys.stream().filter(s -> s.getGender() == Gender.FEMALE).count();
        long withComment = surveys.stream().filter(s -> s.getComment() != null && !s.getComment().isBlank()).count();
        out.put("survey", Map.of(
                "count", (long) surveys.size(),
                "avgRating", Math.round(avgRating * 100) / 100.0,
                "male", male,
                "female", female,
                "withComment", withComment
        ));

        List<PurchaseIntent> intents = purchaseRepository.findAll();
        long yes = intents.stream().filter(p -> p.getLastChoice() == PurchaseChoice.YES).count();
        long no = intents.stream().filter(p -> p.getLastChoice() == PurchaseChoice.NO).count();
        long totalDialogs = intents.stream().mapToInt(PurchaseIntent::getDialogCount).sum();
        out.put("purchase", Map.of(
                "count", (long) intents.size(),
                "yes", yes,
                "no", no,
                "yesRate", intents.isEmpty() ? 0.0 : Math.round((yes * 10000.0 / intents.size())) / 100.0,
                "totalDialogs", totalDialogs
        ));

        List<UserBehavior> behaviors = behaviorRepository.findAll();
        double avgMaxScroll = behaviors.stream()
                .map(UserBehavior::getMaxScrollIndex)
                .filter(java.util.Objects::nonNull)
                .mapToInt(Short::intValue).average().orElse(0);
        double avgPhotoDwell = behaviors.stream()
                .map(UserBehavior::getLastPhotoDwellMs)
                .filter(java.util.Objects::nonNull)
                .mapToInt(Integer::intValue).average().orElse(0);
        long totalFailed = behaviors.stream().mapToInt(UserBehavior::getFailedAttempts).sum();
        long totalRevisit = behaviors.stream().mapToInt(UserBehavior::getResultRevisitCount).sum();
        out.put("behavior", Map.of(
                "count", (long) behaviors.size(),
                "avgMaxScrollIndex", Math.round(avgMaxScroll * 100) / 100.0,
                "avgPhotoDwellMs", Math.round(avgPhotoDwell),
                "totalFailedAttempts", totalFailed,
                "totalResultRevisit", totalRevisit
        ));

        List<ShareToken> shares = shareRepository.findAll();
        long active = shares.stream().filter(ShareToken::isActive).count();
        long revoked = shares.size() - active;
        out.put("share", Map.of(
                "total", (long) shares.size(),
                "active", active,
                "revoked", revoked
        ));

        Long banned = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM banned_user", Long.class);
        out.put("banned", Map.of("count", banned == null ? 0L : banned));

        ApiCallQuota today = quotaRepository.findById(LocalDate.now()).orElse(null);
        out.put("quota", Map.of(
                "today", today == null ? 0 : today.getCallCount(),
                "globalDailyLimit", globalDailyLimit
        ));

        return out;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listSatisfaction() {
        return satisfactionRepository.findAll().stream()
                .sorted((a, b) -> b.getUpdatedAt().compareTo(a.getUpdatedAt()))
                .map(s -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("cookieId", maskCookie(s.getCookieId()));
                    m.put("rating", s.getRating());
                    m.put("gender", s.getGender() == null ? null : s.getGender().name());
                    m.put("comment", s.getComment());
                    m.put("updatedAt", s.getUpdatedAt());
                    return m;
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listPurchase() {
        return purchaseRepository.findAll().stream()
                .sorted((a, b) -> b.getUpdatedAt().compareTo(a.getUpdatedAt()))
                .map(p -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("cookieId", maskCookie(p.getCookieId()));
                    m.put("lastChoice", p.getLastChoice() == null ? null : p.getLastChoice().name());
                    m.put("dialogCount", p.getDialogCount());
                    m.put("updatedAt", p.getUpdatedAt());
                    return m;
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listBehavior() {
        return behaviorRepository.findAll().stream()
                .sorted((a, b) -> b.getUpdatedAt().compareTo(a.getUpdatedAt()))
                .map(b -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("cookieId", maskCookie(b.getCookieId()));
                    m.put("maxScrollSection", b.getMaxScrollSection());
                    m.put("maxScrollIndex", b.getMaxScrollIndex());
                    m.put("lastPhotoDwellMs", b.getLastPhotoDwellMs());
                    m.put("failedAttempts", b.getFailedAttempts());
                    m.put("resultRevisitCount", b.getResultRevisitCount());
                    m.put("lastPhotoReplaced", b.getLastPhotoReplaced());
                    m.put("updatedAt", b.getUpdatedAt());
                    return m;
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listBanned() {
        return jdbcTemplate.queryForList(
                "SELECT cookie_id, ip_address, reason, created_at " +
                "FROM banned_user ORDER BY created_at DESC"
        );
    }

    /**
     * 최근 활동한 사용자 목록 (analysis_result 기준).
     * cookie ↔ ip 페어를 한 행에 담아 어드민이 둘 다 또는 한 쪽만 차단할 수 있게 함.
     * 이미 차단된 cookie/ip 는 alreadyBanned 플래그로 표시.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> listRecentUsers(int limit) {
        List<AnalysisResult> rows = analysisResultRepository.findAll().stream()
                .sorted((a, b) -> b.getUpdatedAt().compareTo(a.getUpdatedAt()))
                .limit(limit)
                .toList();

        // 차단 매칭을 위해 banned_user 의 cookie/ip 셋을 한 번에 메모리로
        List<Map<String, Object>> banned = jdbcTemplate.queryForList(
                "SELECT cookie_id, ip_address FROM banned_user"
        );
        java.util.Set<String> bannedCookies = new java.util.HashSet<>();
        java.util.Set<String> bannedIps = new java.util.HashSet<>();
        for (Map<String, Object> b : banned) {
            Object c = b.get("cookie_id");
            Object i = b.get("ip_address");
            if (c != null) bannedCookies.add(c.toString());
            if (i != null) bannedIps.add(i.toString());
        }

        return rows.stream().map(r -> {
            Map<String, Object> m = new HashMap<>();
            m.put("cookieId", r.getCookieId());
            m.put("ip", r.getLastIp());
            m.put("status", r.getStatus() == null ? null : r.getStatus().name());
            m.put("updatedAt", r.getUpdatedAt());
            m.put("cookieBanned", bannedCookies.contains(r.getCookieId()));
            m.put("ipBanned", r.getLastIp() != null && bannedIps.contains(r.getLastIp()));
            return m;
        }).toList();
    }

    /**
     * 다중 차단 INSERT.
     * 각 item: { cookieId?, ip?, reason? } — 둘 중 적어도 하나는 채워져 있어야 함.
     * 중복 차단(이미 등록된 cookie/ip)은 그냥 한 행 더 추가 — banned_user 는 PK 없음.
     */
    @Transactional
    public int banMany(List<Map<String, String>> items) {
        if (items == null || items.isEmpty()) return 0;
        int inserted = 0;
        for (Map<String, String> it : items) {
            String cookieId = trimToNull(it.get("cookieId"));
            String ip = trimToNull(it.get("ip"));
            String reason = trimToNull(it.get("reason"));
            if (cookieId == null && ip == null) continue;
            jdbcTemplate.update(
                    "INSERT INTO banned_user (cookie_id, ip_address, reason) VALUES (?, ?, ?)",
                    cookieId, ip, reason
            );
            inserted++;
        }
        return inserted;
    }

    /** 단건 차단 해제. cookie+ip 모두 주어지면 별도 쿼리로 처리해 다른 사용자에게 영향을 주지 않는다. */
    @Transactional
    public int unban(String cookieId, String ip) {
        String c = trimToNull(cookieId);
        String i = trimToNull(ip);
        if (c == null && i == null) return 0;
        if (c != null && i != null) {
            // 이 쿠키가 포함된 모든 행 삭제 (cookie-only, cookie+ip 행 모두)
            int removed = jdbcTemplate.update("DELETE FROM banned_user WHERE cookie_id = ?", c);
            // cookie 없는 IP-only 행만 삭제 — 같은 IP를 가진 다른 사용자의 cookie+ip 행은 건드리지 않음
            removed += jdbcTemplate.update(
                    "DELETE FROM banned_user WHERE ip_address = ? AND cookie_id IS NULL", i);
            return removed;
        }
        if (c != null) {
            return jdbcTemplate.update("DELETE FROM banned_user WHERE cookie_id = ?", c);
        }
        return jdbcTemplate.update("DELETE FROM banned_user WHERE ip_address = ?", i);
    }

    private static String trimToNull(String s) {
        if (s == null) return null;
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listShares() {
        return shareRepository.findAll().stream()
                .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
                .map(s -> {
                    Map<String, Object> m = new HashMap<>();
                    m.put("token", s.getToken());
                    m.put("cookieId", maskCookie(s.getCookieId()));
                    m.put("analysisResultId", s.getAnalysisResultId());
                    m.put("createdAt", s.getCreatedAt());
                    m.put("revokedAt", s.getRevokedAt());
                    m.put("active", s.isActive());
                    return m;
                })
                .toList();
    }

    /**
     * 쿠키 ID 의 마지막 8자만 노출 — 원본 UUID 그대로 노출하면 어드민 누설 시 사용자 사칭 가능.
     */
    private static String maskCookie(String id) {
        if (id == null) return null;
        if (id.length() <= 8) return "***" + id;
        return "***" + id.substring(id.length() - 8);
    }
}
