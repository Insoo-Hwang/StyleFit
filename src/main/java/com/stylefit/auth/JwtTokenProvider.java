package com.stylefit.auth;

import java.time.Instant;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.stereotype.Component;

@Component
public class JwtTokenProvider {

	private final JwtEncoder jwtEncoder;
	private final String issuer;
	private final long expirationSeconds;

	public JwtTokenProvider(
		JwtEncoder jwtEncoder,
		@Value("${jwt.issuer}") String issuer,
		@Value("${jwt.expiration-seconds}") long expirationSeconds
	) {
		this.jwtEncoder = jwtEncoder;
		this.issuer = issuer;
		this.expirationSeconds = expirationSeconds;
	}

	public LoginResponse createToken(Authentication authentication) {
		Instant now = Instant.now();
		Instant expiresAt = now.plusSeconds(expirationSeconds);
		List<String> roles = authentication.getAuthorities().stream()
			.map(GrantedAuthority::getAuthority)
			.toList();

		JwtClaimsSet claims = JwtClaimsSet.builder()
			.issuer(issuer)
			.issuedAt(now)
			.expiresAt(expiresAt)
			.subject(authentication.getName())
			.claim("roles", roles)
			.build();

		JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
		String accessToken = jwtEncoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
		return new LoginResponse(accessToken, "Bearer", expiresAt);
	}
}
