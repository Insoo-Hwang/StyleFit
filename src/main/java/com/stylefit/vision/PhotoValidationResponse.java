package com.stylefit.vision;

import java.util.List;

public record PhotoValidationResponse(
	boolean valid,
	int faceCount,
	double faceAreaRatio,
	double brightness,
	List<String> warnings
) {
}
