package com.stylefit.ratelimit;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ActorQuotaRepository extends JpaRepository<ActorQuota, ActorQuota.Key> {
}
