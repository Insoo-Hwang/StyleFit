package com.stylefit.auth;

import java.time.Instant;

public record LoginResponse(
	String accessToken,
	String tokenType,
	Instant expiresAt
) {
}
