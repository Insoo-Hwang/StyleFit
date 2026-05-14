package com.stylefit.ratelimit;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

import java.io.Serializable;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Objects;

/**
 * 사용자(쿠키) 또는 IP 단위 일일 호출 카운터.
 * - scope: COOKIE / IP
 * - actor_key: 쿠키 UUID 또는 IP 문자열
 * - quota_day: 날짜
 * (scope, actor_key, quota_day) 복합 PK — 자정 넘어가면 새 행이 생성된다.
 */
@Entity
@Table(name = "actor_quota")
@IdClass(ActorQuota.Key.class)
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ActorQuota {

    @Id
    @Enumerated(EnumType.STRING)
    @Column(name = "scope", nullable = false, length = 10)
    private Scope scope;

    @Id
    @Column(name = "actor_key", nullable = false, length = 64)
    private String actorKey;

    @Id
    @Column(name = "quota_day", nullable = false)
    private LocalDate quotaDay;

    @Column(name = "call_count", nullable = false)
    private int callCount;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public enum Scope { COOKIE, IP }

    public static ActorQuota first(Scope scope, String actorKey, LocalDate today) {
        ActorQuota q = new ActorQuota();
        q.scope = scope;
        q.actorKey = actorKey;
        q.quotaDay = today;
        q.callCount = 1;
        return q;
    }

    public void increment() {
        this.callCount++;
    }

    @Getter
    @Setter
    @NoArgsConstructor
    public static class Key implements Serializable {
        private Scope scope;
        private String actorKey;
        private LocalDate quotaDay;

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof Key k)) return false;
            return scope == k.scope
                    && Objects.equals(actorKey, k.actorKey)
                    && Objects.equals(quotaDay, k.quotaDay);
        }

        @Override
        public int hashCode() {
            return Objects.hash(scope, actorKey, quotaDay);
        }
    }
}
