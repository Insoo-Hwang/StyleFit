package com.stylefit.vision;

import java.io.IOException;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/photos")
public class PhotoValidationController {

	private final PhotoValidationService photoValidationService;

	public PhotoValidationController(PhotoValidationService photoValidationService) {
		this.photoValidationService = photoValidationService;
	}

	@PostMapping("/validate")
	public PhotoValidationResponse validate(@RequestParam("file") MultipartFile file) throws IOException {
		return photoValidationService.validate(file);
	}
}
