package com.stylefit.survey;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class SatisfactionSurveyRequest {

    private Short rating;
    private Gender gender;
    private String comment;
}
