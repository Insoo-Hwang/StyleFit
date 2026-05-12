package com.stylefit.behavior;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UserBehaviorResponse {

    private boolean exists;
    private String maxScrollSection;
    private Short maxScrollIndex;
    private Integer lastPhotoDwellMs;
    private Integer failedAttempts;
    private Integer resultRevisitCount;
    private Integer lastPhotoReplaced;

    public static UserBehaviorResponse none() {
        return UserBehaviorResponse.builder().exists(false).build();
    }

    public static UserBehaviorResponse of(UserBehavior b) {
        return UserBehaviorResponse.builder()
                .exists(true)
                .maxScrollSection(b.getMaxScrollSection())
                .maxScrollIndex(b.getMaxScrollIndex())
                .lastPhotoDwellMs(b.getLastPhotoDwellMs())
                .failedAttempts(b.getFailedAttempts())
                .resultRevisitCount(b.getResultRevisitCount())
                .lastPhotoReplaced(b.getLastPhotoReplaced())
                .build();
    }
}
