package com.stylefit.vision;

import java.util.List;

public record PhotoValidationResponse(
	boolean valid,
	int faceCount,
	double brightness,
	List<String> warnings
) {
}
