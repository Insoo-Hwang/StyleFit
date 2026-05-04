package com.stylefit.config;

import org.springframework.context.annotation.Configuration;

import jakarta.annotation.PostConstruct;

@Configuration
public class OpenCvConfig {

	@PostConstruct
	void loadOpenCv() {
		nu.pattern.OpenCV.loadLocally();
	}
}
