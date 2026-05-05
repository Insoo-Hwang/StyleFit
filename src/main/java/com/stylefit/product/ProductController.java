package com.stylefit.product;

import java.util.List;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/products")
public class ProductController {

	@GetMapping
	public List<ProductResponse> products() {
		return List.of(
			new ProductResponse(
				ProductType.PERSONAL_COLOR_DIAGNOSIS,
				"퍼스널 컬러 진단",
				"얼굴 사진을 기반으로 퍼스널 컬러 진단 결과를 제공합니다."
			),
			new ProductResponse(
				ProductType.STYLING_REPORT,
				"스타일링 리포트",
				"얼굴 사진과 진단 정보를 바탕으로 스타일링 리포트를 제공합니다."
			)
		);
	}
}
