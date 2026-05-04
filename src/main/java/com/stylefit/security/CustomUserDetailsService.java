package com.stylefit.security;

import com.stylefit.user.UserAccount;
import com.stylefit.user.UserAccountRepository;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class CustomUserDetailsService implements UserDetailsService {

	private final UserAccountRepository userAccountRepository;

	public CustomUserDetailsService(UserAccountRepository userAccountRepository) {
		this.userAccountRepository = userAccountRepository;
	}

	@Override
	public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
		UserAccount userAccount = userAccountRepository.findByEmail(email)
			.orElseThrow(() -> new UsernameNotFoundException("User not found: " + email));

		return org.springframework.security.core.userdetails.User.builder()
			.username(userAccount.getEmail())
			.password(userAccount.getPassword())
			.roles(userAccount.getRole().name())
			.build();
	}
}
