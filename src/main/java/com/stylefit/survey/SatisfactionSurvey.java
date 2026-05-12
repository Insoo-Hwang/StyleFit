package com.stylefit.survey;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
@Table(name = "satisfaction_survey")
public class SatisfactionSurvey {

    @Id
    @Column(name = "cookie_id", length = 36)
    private String cookieId;

    @Column(nullable = false)
    private Short rating;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Gender gender;

    @Column(length = 300)
    private String comment;

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

    public static SatisfactionSurvey of(String cookieId, short rating, Gender gender, String comment) {
        SatisfactionSurvey s = new SatisfactionSurvey();
        s.cookieId = cookieId;
        s.rating = rating;
        s.gender = gender;
        s.comment = comment;
        return s;
    }
}
