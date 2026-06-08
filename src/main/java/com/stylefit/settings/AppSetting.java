package com.stylefit.settings;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * 런타임에 어드민이 변경할 수 있는 key-value 설정.
 * application.properties 의 @Value 는 "기본값(seed)"으로만 쓰이고,
 * 이 테이블에 행이 있으면 그 값이 우선한다. (재시작해도 유지)
 */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "app_setting")
public class AppSetting {

    @Id
    @Column(name = "setting_key", length = 64)
    private String settingKey;

    @Column(name = "setting_value", length = 200, nullable = false)
    private String settingValue;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    protected void touch() {
        updatedAt = LocalDateTime.now();
    }

    public static AppSetting of(String key, String value) {
        AppSetting s = new AppSetting();
        s.settingKey = key;
        s.settingValue = value;
        return s;
    }
}
