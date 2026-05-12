package com.stylefit.purchase;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PurchaseIntentRepository extends JpaRepository<PurchaseIntent, String> {
}
