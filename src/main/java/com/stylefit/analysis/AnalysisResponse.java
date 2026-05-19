package com.stylefit.analysis;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonRawValue;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AnalysisResponse {

    private String status;

    // AI 분석 결과 JSON을 문자열 이스케이프 없이 그대로 embed
    @JsonRawValue
    private String result;

    private String reportImageUrl;
    // true  = DB에 보관된 파일을 재사용한 응답
    // false = 이번 호출에서 AI 모듈을 거쳐 새로 생성/저장된 이미지
    private Boolean reportImageCached;
    // true = 사용자 얼굴 이미지가 face-images/ 에 성공적으로 저장됨
    // false = 저장 실패 (분석 결과에는 영향 없음)
    private Boolean faceImageSaved;
    private List<String> validationWarnings;

    public static AnalysisResponse photoRequired() {
        return builder().status("PHOTO_REQUIRED").build();
    }

    public static AnalysisResponse processing() {
        return builder().status("PROCESSING").build();
    }

    public static AnalysisResponse completed(String resultJson, String reportImageUrl, Boolean reportImageCached, boolean faceImageSaved) {
        return builder()
                .status("COMPLETED")
                .result(resultJson)
                .reportImageUrl(reportImageUrl)
                .reportImageCached(reportImageCached)
                .faceImageSaved(faceImageSaved)
                .build();
    }

    public static AnalysisResponse validationFailed(List<String> warnings) {
        return builder()
                .status("VALIDATION_FAILED")
                .validationWarnings(warnings)
                .build();
    }
}
