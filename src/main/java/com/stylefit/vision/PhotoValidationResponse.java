package com.stylefit.vision;

import java.util.List;

public record PhotoValidationResponse(
	boolean valid,
	List<String> warnings
) {
}
