package com.stylefit.share;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 결과 공유용 토큰. 한 cookie_id 당 하나만 보유(unique).
 * 공유자가 다시 공유 버튼을 눌러도 기존 토큰을 재사용한다.
 * revoke_at 이 set 되면 폐기된 것으로 간주해 GET 시 404 반환.
 */
@Entity
@Table(
    name = "share_token",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_share_token_value",
        columnNames = "token"
    )
)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ShareToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "token", nullable = false, length = 64, unique = true)
    private String token;

    /** 공유 발행자 쿠키 — 한 사용자당 1건 active 토큰 (revoke 후엔 새로 생성) */
    @Column(name = "cookie_id", nullable = false, length = 100)
    private String cookieId;

    @Column(name = "analysis_result_id", nullable = false)
    private Long analysisResultId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "revoked_at")
    private LocalDateTime revokedAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }

    public static ShareToken of(String token, String cookieId, Long analysisResultId) {
        ShareToken s = new ShareToken();
        s.token = token;
        s.cookieId = cookieId;
        s.analysisResultId = analysisResultId;
        return s;
    }

    public boolean isActive() {
        return revokedAt == null;
    }
}
