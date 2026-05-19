package com.stylefit.analysis;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(
    name = "analysis_result",
    uniqueConstraints = @UniqueConstraint(
        name = "uq_cookie_product",
        columnNames = {"cookie_id", "product_code"}
    )
)
public class AnalysisResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "cookie_id", nullable = false, length = 100)
    private String cookieId;

    @Column(name = "product_code", nullable = false, length = 50)
    private String productCode = "PERSONAL_COLOR_DIAGNOSIS";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AnalysisStatus status = AnalysisStatus.PROCESSING;

    @Column(name = "result_json", columnDefinition = "TEXT")
    private String resultJson;

    @Column(name = "report_image_path", length = 500)
    private String reportImagePath;

    /** 사용자 업로드 얼굴 원본 이미지 파일명 (./face-images/ 기준). AI 학습·어드민 검토용. */
    @Column(name = "face_image_path", length = 500)
    private String faceImagePath;

    /** 마지막 submit-photo 요청의 클라이언트 IP — 어드민 차단 화면에서 cookie↔ip 페어 매칭용 */
    @Column(name = "last_ip", length = 45)
    private String lastIp;

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

    public static AnalysisResult of(String cookieId) {
        AnalysisResult entity = new AnalysisResult();
        entity.cookieId = cookieId;
        return entity;
    }
}
