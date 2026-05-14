package com.stylefit.share;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ShareTokenRepository extends JpaRepository<ShareToken, Long> {

    Optional<ShareToken> findByToken(String token);

    /** 본인의 (active) 토큰. revoke 된 토큰도 포함 — 호출자가 isActive() 로 분기. */
    Optional<ShareToken> findFirstByCookieIdOrderByIdDesc(String cookieId);
}
