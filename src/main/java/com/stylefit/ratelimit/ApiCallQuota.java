package com.stylefit.ratelimit;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "api_call_quota")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ApiCallQuota {

    @Id
    @Column(name = "quota_day", nullable = false)
    private LocalDate quotaDay;

    @Column(name = "call_count", nullable = false)
    private int callCount;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    public static ApiCallQuota first(LocalDate today) {
        ApiCallQuota q = new ApiCallQuota();
        q.quotaDay = today;
        q.callCount = 1;
        return q;
    }

    public void increment() {
        this.callCount++;
    }
}
