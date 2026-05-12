package com.stylefit.behavior;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserBehaviorService {

    private final UserBehaviorRepository repository;

    public UserBehaviorResponse get(String cookieId) {
        return repository.findById(cookieId)
                .map(UserBehaviorResponse::of)
                .orElseGet(UserBehaviorResponse::none);
    }

    /** 결과 페이지 스크롤 도달 — index가 더 클 때만 갱신(최대값 보존). */
    @Transactional
    public UserBehaviorResponse markScroll(String cookieId, String section, int index) {
        UserBehavior b = load(cookieId);
        if (b.getMaxScrollIndex() == null || index > b.getMaxScrollIndex()) {
            b.setMaxScrollSection(section);
            b.setMaxScrollIndex((short) index);
            repository.save(b);
        }
        return UserBehaviorResponse.of(b);
    }

    /** 사진 첨부→제출 사이 소요 ms — 마지막 값으로 덮어쓰기. */
    @Transactional
    public UserBehaviorResponse markPhotoDwell(String cookieId, int ms) {
        UserBehavior b = load(cookieId);
        b.setLastPhotoDwellMs(ms);
        repository.save(b);
        return UserBehaviorResponse.of(b);
    }

    /** 검증 실패 — 누적 카운트 증가. */
    @Transactional
    public UserBehaviorResponse markAnalysisFailed(String cookieId) {
        UserBehavior b = load(cookieId);
        b.setFailedAttempts(b.getFailedAttempts() + 1);
        repository.save(b);
        return UserBehaviorResponse.of(b);
    }

    /** 결과 페이지 진입 — 누적 카운트 증가. */
    @Transactional
    public UserBehaviorResponse markResultRevisit(String cookieId) {
        UserBehavior b = load(cookieId);
        b.setResultRevisitCount(b.getResultRevisitCount() + 1);
        repository.save(b);
        return UserBehaviorResponse.of(b);
    }

    /** 마지막 세션 사진 교체 횟수 — 덮어쓰기. */
    @Transactional
    public UserBehaviorResponse markPhotoReplaced(String cookieId, int count) {
        UserBehavior b = load(cookieId);
        b.setLastPhotoReplaced(count);
        repository.save(b);
        return UserBehaviorResponse.of(b);
    }

    private UserBehavior load(String cookieId) {
        return repository.findById(cookieId).orElseGet(() -> UserBehavior.of(cookieId));
    }
}
