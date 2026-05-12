package com.stylefit.behavior;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "user_behavior")
public class UserBehavior {

    @Id
    @Column(name = "cookie_id", length = 36)
    private String cookieId;

    @Column(name = "max_scroll_section", length = 30)
    private String maxScrollSection;

    @Column(name = "max_scroll_index")
    private Short maxScrollIndex;

    @Column(name = "last_photo_dwell_ms")
    private Integer lastPhotoDwellMs;

    @Column(name = "failed_attempts", nullable = false)
    private Integer failedAttempts = 0;

    @Column(name = "result_revisit_count", nullable = false)
    private Integer resultRevisitCount = 0;

    @Column(name = "last_photo_replaced", nullable = false)
    private Integer lastPhotoReplaced = 0;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public static UserBehavior of(String cookieId) {
        UserBehavior b = new UserBehavior();
        b.cookieId = cookieId;
        return b;
    }
}
