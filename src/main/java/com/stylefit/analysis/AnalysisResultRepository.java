package com.stylefit.analysis;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AnalysisResultRepository extends JpaRepository<AnalysisResult, Long> {

    Optional<AnalysisResult> findByCookieIdAndProductCode(String cookieId, String productCode);
}
