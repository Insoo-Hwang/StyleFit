package com.stylefit.product;

public record ProductResponse(
	ProductType type,
	String name,
	String description
) {
}
