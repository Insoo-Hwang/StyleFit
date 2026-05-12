package com.stylefit.purchase;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PurchaseIntentService {

    private final PurchaseIntentRepository repository;

    public PurchaseIntentResponse get(String cookieId) {
        return repository.findById(cookieId)
                .map(PurchaseIntentResponse::of)
                .orElseGet(PurchaseIntentResponse::none);
    }

    /**
     * 다이얼로그가 열릴 때 호출 — count 증가 + last_choice를 기본 'NO'로 리셋.
     * (그냥 닫거나 백드롭 클릭 시에도 'NO'로 남도록)
     *
     * 단, 이미 'YES'를 누른 사용자는 이후 노출을 카운트하지 않는다.
     * MVP 단계의 결제 의향 측정은 "예를 누르기 전까지 몇 번 망설였는가"만 의미 있다.
     */
    @Transactional
    public PurchaseIntentResponse markOpened(String cookieId) {
        PurchaseIntent entity = repository.findById(cookieId)
                .orElseGet(() -> PurchaseIntent.of(cookieId));
        if (entity.getLastChoice() == PurchaseChoice.YES) {
            return PurchaseIntentResponse.of(entity);
        }
        entity.setDialogCount(entity.getDialogCount() + 1);
        entity.setLastChoice(PurchaseChoice.NO);
        repository.save(entity);
        return PurchaseIntentResponse.of(entity);
    }

    /**
     * "예" 클릭 시 호출 — last_choice='YES'.
     * 노출 이력이 없는 비정상 호출이면 count도 함께 1로 초기화한다(방어).
     */
    @Transactional
    public PurchaseIntentResponse markYes(String cookieId) {
        PurchaseIntent entity = repository.findById(cookieId)
                .orElseGet(() -> {
                    PurchaseIntent created = PurchaseIntent.of(cookieId);
                    created.setDialogCount(1);
                    return created;
                });
        entity.setLastChoice(PurchaseChoice.YES);
        repository.save(entity);
        return PurchaseIntentResponse.of(entity);
    }
}
