package com.stylefit.config;

import java.util.Arrays;
import java.util.List;

import com.stylefit.auth.AnonymousCookieFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.AnonymousAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

	@Value("${stylefit.security.allowed-origins:}")
	private String allowedOriginsRaw;

	@Value("${stylefit.security.cookie-secure:auto}")
	private String cookieSecureMode;

	@Bean
	SecurityFilterChain securityFilterChain(HttpSecurity http,
											OriginGuardFilter originGuardFilter) throws Exception {
		AnonymousCookieFilter.SecureMode mode = "always".equalsIgnoreCase(cookieSecureMode)
				? AnonymousCookieFilter.SecureMode.ALWAYS
				: AnonymousCookieFilter.SecureMode.AUTO;
		return http
			.csrf(csrf -> csrf.disable())
			.cors(cors -> cors.configurationSource(corsConfigurationSource()))
			.headers(headers -> headers.frameOptions(frameOptions -> frameOptions.sameOrigin()))
			.sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
			.addFilterBefore(new AnonymousCookieFilter(mode), AnonymousAuthenticationFilter.class)
			.addFilterAfter(originGuardFilter, AnonymousCookieFilter.class)
			.authorizeHttpRequests(auth -> auth
				.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
				// /admin/** 는 어드민 SPA 라우트로 사용 중 (/admin, /admin/ban).
				// 백엔드 관리 API 는 /api/admin/** 에 있고 AdminAuthInterceptor 가 가드한다.
				.requestMatchers("/internal/**").denyAll()
				.anyRequest().permitAll()
			)
			.build();
	}

	@Bean
	CorsConfigurationSource corsConfigurationSource() {
		CorsConfiguration configuration = new CorsConfiguration();
		List<String> origins = parseOrigins(allowedOriginsRaw);
		if (origins.isEmpty()) {
			// dev 환경 (값 비어있음) — 모바일 동일 Wi-Fi 접속 등을 위해 패턴 허용.
			// 운영에선 stylefit.security.allowed-origins 로 명시적 도메인을 반드시 주입.
			configuration.setAllowedOriginPatterns(List.of("*"));
		} else {
			configuration.setAllowedOrigins(origins);
		}
		configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
		configuration.setAllowedHeaders(List.of("*"));
		configuration.setExposedHeaders(List.of("Authorization"));
		configuration.setAllowCredentials(true);

		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		source.registerCorsConfiguration("/**", configuration);
		return source;
	}

	private static List<String> parseOrigins(String raw) {
		if (raw == null || raw.isBlank()) return List.of();
		return Arrays.stream(raw.split(","))
			.map(String::trim)
			.filter(s -> !s.isEmpty())
			.toList();
	}
}
