package com.stylefit.share;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ShareTokenRepository extends JpaRepository<ShareToken, Long> {

    Optional<ShareToken> findByToken(String token);

    /** 본인의 (active) 토큰. revoke 된 토큰도 포함 — 호출자가 isActive() 로 분기. */
    Optional<ShareToken> findFirstByCookieIdOrderByIdDesc(String cookieId);

    /** 결과 삭제 시 해당 쿠키의 공유 토큰을 모두 제거 (가리키던 결과가 사라지므로). */
    void deleteByCookieId(String cookieId);
}
