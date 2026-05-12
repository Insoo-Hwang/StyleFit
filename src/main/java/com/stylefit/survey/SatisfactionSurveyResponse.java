package com.stylefit.survey;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SatisfactionSurveyResponse {

    private boolean exists;
    private Short rating;
    private Gender gender;
    private String comment;

    public static SatisfactionSurveyResponse none() {
        return SatisfactionSurveyResponse.builder().exists(false).build();
    }

    public static SatisfactionSurveyResponse of(SatisfactionSurvey s) {
        return SatisfactionSurveyResponse.builder()
                .exists(true)
                .rating(s.getRating())
                .gender(s.getGender())
                .comment(s.getComment())
                .build();
    }
}
