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
    private List<String> validationWarnings;

    public static AnalysisResponse photoRequired() {
        return builder().status("PHOTO_REQUIRED").build();
    }

    public static AnalysisResponse processing() {
        return builder().status("PROCESSING").build();
    }

    public static AnalysisResponse completed(String resultJson, String reportImageUrl) {
        return builder()
                .status("COMPLETED")
                .result(resultJson)
                .reportImageUrl(reportImageUrl)
                .build();
    }

    public static AnalysisResponse validationFailed(List<String> warnings) {
        return builder()
                .status("VALIDATION_FAILED")
                .validationWarnings(warnings)
                .build();
    }
}
