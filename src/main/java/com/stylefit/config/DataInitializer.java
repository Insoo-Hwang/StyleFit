package com.stylefit.config;

import com.stylefit.user.Role;
import com.stylefit.user.UserAccount;
import com.stylefit.user.UserAccountRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class DataInitializer {

	@Bean
	CommandLineRunner seedUsers(UserAccountRepository userAccountRepository, PasswordEncoder passwordEncoder) {
		return args -> {
			if (userAccountRepository.count() > 0) {
				return;
			}

			userAccountRepository.save(new UserAccount(
				"user@stylefit.com",
				passwordEncoder.encode("user1234"),
				"StyleFit User",
				Role.USER
			));
			userAccountRepository.save(new UserAccount(
				"admin@stylefit.com",
				passwordEncoder.encode("admin1234"),
				"StyleFit Admin",
				Role.ADMIN
			));
		};
	}
}
