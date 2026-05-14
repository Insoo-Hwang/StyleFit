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
    private List<String> validationWarnings;

    public static AnalysisResponse photoRequired() {
        return builder().status("PHOTO_REQUIRED").build();
    }

    public static AnalysisResponse processing() {
        return builder().status("PROCESSING").build();
    }

    public static AnalysisResponse completed(String resultJson, String reportImageUrl, boolean reportImageCached) {
        return builder()
                .status("COMPLETED")
                .result(resultJson)
                .reportImageUrl(reportImageUrl)
                .reportImageCached(reportImageCached)
                .build();
    }

    public static AnalysisResponse validationFailed(List<String> warnings) {
        return builder()
                .status("VALIDATION_FAILED")
                .validationWarnings(warnings)
                .build();
    }
}
