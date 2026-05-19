package com.stylefit.purchase;

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
@Table(name = "purchase_intent")
public class PurchaseIntent {

    @Id
    @Column(name = "cookie_id", length = 100)
    private String cookieId;

    @Enumerated(EnumType.STRING)
    @Column(name = "last_choice", nullable = false, length = 10)
    private PurchaseChoice lastChoice = PurchaseChoice.NO;

    @Column(name = "dialog_count", nullable = false)
    private Integer dialogCount = 0;

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

    public static PurchaseIntent of(String cookieId) {
        PurchaseIntent p = new PurchaseIntent();
        p.cookieId = cookieId;
        return p;
    }
}
