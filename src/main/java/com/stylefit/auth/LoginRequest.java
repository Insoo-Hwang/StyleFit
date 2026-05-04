package com.stylefit.auth;

public record LoginRequest(
	String email,
	String password
) {
}
