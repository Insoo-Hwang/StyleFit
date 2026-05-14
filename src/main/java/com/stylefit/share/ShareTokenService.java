package com.stylefit.share;

import com.stylefit.analysis.AnalysisResult;
import com.stylefit.analysis.AnalysisResultRepository;
import com.stylefit.analysis.AnalysisStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ShareTokenService {

    private static final String PRODUCT_CODE = "PERSONAL_COLOR_DIAGNOSIS";
    private static final String REPORT_URL_PREFIX = "/report-images/";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final ShareTokenRepository repository;
    private final AnalysisResultRepository analysisResultRepository;

    /**
     * 본인 결과로 공유 토큰을 발급한다. 기존 active 토큰 있으면 그대로 재사용 (토큰 폭증 방지).
     * COMPLETED 결과가 없으면 403.
     */
    @Transactional
    public ShareTokenResponse createForOwner(String cookieId) {
        AnalysisResult result = analysisResultRepository
                .findByCookieIdAndProductCode(cookieId, PRODUCT_CODE)
                .filter(r -> r.getStatus() == AnalysisStatus.COMPLETED)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.FORBIDDEN, "공유할 진단 결과가 없습니다."));

        Optional<ShareToken> existing = repository.findFirstByCookieIdOrderByIdDesc(cookieId);
        if (existing.isPresent() && existing.get().isActive()
                && existing.get().getAnalysisResultId().equals(result.getId())) {
            return ShareTokenResponse.forCreate(existing.get().getToken());
        }

        String token = generateToken();
        ShareToken entity = ShareToken.of(token, cookieId, result.getId());
        repository.save(entity);
        return ShareTokenResponse.forCreate(token);
    }

    /**
     * 공유받은 사람이 토큰으로 결과 조회.
     * revoke 된 토큰은 404 처럼 처리(존재하지 않음).
     * isOwner = 요청 cookieId 가 공유 발행자와 일치하는지 (비교 페이지 분기용).
     */
    @Transactional(readOnly = true)
    public ShareTokenResponse view(String token, String requesterCookieId) {
        ShareToken st = repository.findByToken(token)
                .filter(ShareToken::isActive)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "공유 링크가 존재하지 않거나 폐기되었습니다."));

        AnalysisResult ar = analysisResultRepository.findById(st.getAnalysisResultId())
                .filter(r -> r.getStatus() == AnalysisStatus.COMPLETED)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "공유된 결과가 존재하지 않습니다."));

        String stored = ar.getReportImagePath();
        String imageUrl = (stored != null) ? REPORT_URL_PREFIX + stored : null;
        boolean isOwner = requesterCookieId != null && requesterCookieId.equals(st.getCookieId());
        return ShareTokenResponse.forView(ar.getResultJson(), imageUrl, isOwner);
    }

    /** 본인 토큰 폐기. 토큰이 본인 소유가 아니면 404. */
    @Transactional
    public void revoke(String token, String cookieId) {
        ShareToken st = repository.findByToken(token)
                .filter(ShareToken::isActive)
                .filter(s -> s.getCookieId().equals(cookieId))
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "폐기할 공유 링크를 찾을 수 없습니다."));
        st.setRevokedAt(java.time.LocalDateTime.now());
        repository.save(st);
    }

    /** 본인이 발급한 active 토큰 조회 (없으면 null) */
    @Transactional(readOnly = true)
    public String findMyToken(String cookieId) {
        return repository.findFirstByCookieIdOrderByIdDesc(cookieId)
                .filter(ShareToken::isActive)
                .map(ShareToken::getToken)
                .orElse(null);
    }

    private String generateToken() {
        // URL-safe base64, 128 bit entropy, padding 제거
        byte[] buf = new byte[16];
        RANDOM.nextBytes(buf);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(buf);
    }
}
