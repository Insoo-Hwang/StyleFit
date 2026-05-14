package com.stylefit.ratelimit;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;

public interface ApiCallQuotaRepository extends JpaRepository<ApiCallQuota, LocalDate> {
}
