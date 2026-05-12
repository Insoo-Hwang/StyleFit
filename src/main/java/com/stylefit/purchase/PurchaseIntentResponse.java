package com.stylefit.purchase;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PurchaseIntentResponse {

    private boolean exists;
    private PurchaseChoice lastChoice;
    private Integer dialogCount;

    public static PurchaseIntentResponse none() {
        return PurchaseIntentResponse.builder().exists(false).dialogCount(0).build();
    }

    public static PurchaseIntentResponse of(PurchaseIntent p) {
        return PurchaseIntentResponse.builder()
                .exists(true)
                .lastChoice(p.getLastChoice())
                .dialogCount(p.getDialogCount())
                .build();
    }
}
