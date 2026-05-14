package com.stylefit.share;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonRawValue;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ShareTokenResponse {

    /** 발급된 공유 토큰 (해당 응답이 발급/조회 응답일 때) */
    private String token;

    /** 분석 결과 JSON 원본 (조회 응답일 때만 채워짐) */
    @JsonRawValue
    private String result;

    /** 리포트 이미지 URL (조회 응답일 때만) */
    private String reportImageUrl;

    /** 공유 페이지에서 본인 진단 결과 비교 모드를 띄울지 여부 — 현재는 프론트가 별도 API 로 판단하므로 무시 가능 */
    private Boolean isOwner;

    public static ShareTokenResponse forCreate(String token) {
        return builder().token(token).build();
    }

    public static ShareTokenResponse forView(String resultJson, String reportImageUrl, boolean isOwner) {
        return builder()
                .result(resultJson)
                .reportImageUrl(reportImageUrl)
                .isOwner(isOwner)
                .build();
    }
}
