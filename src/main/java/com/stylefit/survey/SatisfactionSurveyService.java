package com.stylefit.survey;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

@Service
@RequiredArgsConstructor
public class SatisfactionSurveyService {

    private static final int COMMENT_MAX = 300;

    private final SatisfactionSurveyRepository repository;

    public SatisfactionSurveyResponse get(String cookieId) {
        return repository.findById(cookieId)
                .map(SatisfactionSurveyResponse::of)
                .orElseGet(SatisfactionSurveyResponse::none);
    }

    @Transactional
    public SatisfactionSurveyResponse upsert(String cookieId, SatisfactionSurveyRequest req) {
        Short rating = req.getRating();
        if (rating == null || rating < 1 || rating > 5) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "별점은 1~5 사이여야 합니다.");
        }

        Gender gender = req.getGender();
        if (gender == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "성별을 선택해주세요.");
        }

        String comment = req.getComment();
        if (comment != null) {
            comment = comment.trim();
            if (comment.isEmpty()) comment = null;
            else if (comment.length() > COMMENT_MAX) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "코멘트는 최대 " + COMMENT_MAX + "자까지 작성할 수 있습니다.");
            }
        }

        final Short finalRating = rating;
        final Gender finalGender = gender;
        final String finalComment = comment;
        Optional<SatisfactionSurvey> existing = repository.findById(cookieId);
        SatisfactionSurvey entity = existing.orElseGet(
                () -> SatisfactionSurvey.of(cookieId, finalRating, finalGender, finalComment));
        entity.setRating(finalRating);
        entity.setGender(finalGender);
        entity.setComment(finalComment);
        repository.save(entity);

        return SatisfactionSurveyResponse.of(entity);
    }
}
