package com.stylefit.ban;

public record BanCheckResponse(boolean banned) {
    public static BanCheckResponse of(boolean banned) {
        return new BanCheckResponse(banned);
    }
}
