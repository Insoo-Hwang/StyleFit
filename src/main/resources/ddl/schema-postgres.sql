-- StyleFit PostgreSQL DDL
-- H2(개발)에서 PostgreSQL(운영)으로 전환 시 이 파일로 테이블 생성

CREATE TABLE analysis_result (
    id           BIGSERIAL       PRIMARY KEY,
    cookie_id    VARCHAR(36)     NOT NULL,
    product_code VARCHAR(50)     NOT NULL DEFAULT 'PERSONAL_COLOR_DIAGNOSIS',
    status       VARCHAR(20)     NOT NULL DEFAULT 'PROCESSING',
    result_json  JSONB,
    created_at   TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP       NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_cookie_product UNIQUE (cookie_id, product_code),
    CONSTRAINT chk_status CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED'))
);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_analysis_result_updated_at
    BEFORE UPDATE ON analysis_result
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 쿠키 기준 조회 인덱스
CREATE INDEX idx_analysis_result_cookie_id ON analysis_result (cookie_id);


-- =========================================================================
-- 리포트 만족도 평가
-- =========================================================================
-- 한 쿠키당 1건만 존재 (cookie_id가 PK). 재제출은 UPDATE.
CREATE TABLE satisfaction_survey (
    cookie_id  VARCHAR(36)  PRIMARY KEY,
    rating     SMALLINT     NOT NULL,
    gender     VARCHAR(10)  NOT NULL,
    comment    VARCHAR(300),
    created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_rating_range CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT chk_gender CHECK (gender IN ('MALE', 'FEMALE'))
);

CREATE TRIGGER trg_satisfaction_survey_updated_at
    BEFORE UPDATE ON satisfaction_survey
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =========================================================================
-- 유료 리포트 결제 의향 (MVP 단계 — 결제 가치 검증용)
-- =========================================================================
-- "1,990원으로 이미지 리포트 받아보기" CTA → 결제 확인 다이얼로그.
-- 한 쿠키당 1건만 존재. 다이얼로그가 열릴 때마다 dialog_count++,
-- "예" 누르면 last_choice='YES', "아니오"/그냥 닫기는 'NO'.
CREATE TABLE purchase_intent (
    cookie_id     VARCHAR(36)   PRIMARY KEY,
    last_choice   VARCHAR(10)   NOT NULL DEFAULT 'NO',
    dialog_count  INTEGER       NOT NULL DEFAULT 0,
    created_at    TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP     NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_last_choice CHECK (last_choice IN ('YES', 'NO'))
);

CREATE TRIGGER trg_purchase_intent_updated_at
    BEFORE UPDATE ON purchase_intent
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =========================================================================
-- 사용자 행동 신호 (MVP 단계 — 결제 의향 결정 요인 분석용)
-- =========================================================================
-- GA로도 동일 이벤트를 보내지만, 홈 디버그 박스에서 즉시 확인하기 위해 DB에도 적재.
-- 한 쿠키당 1행, 새 이벤트 들어올 때마다 upsert로 필드 갱신.
CREATE TABLE user_behavior (
    cookie_id             VARCHAR(36)  PRIMARY KEY,
    max_scroll_section    VARCHAR(30),                  -- 결과 페이지 최대 도달 섹션 이름
    max_scroll_index      SMALLINT,                     -- 0~9 (섹션 순서 인덱스, 최대값 보존)
    last_photo_dwell_ms   INTEGER,                      -- 마지막 진단의 사진 첨부→제출 ms
    failed_attempts       INTEGER      NOT NULL DEFAULT 0,  -- 누적 검증 실패 횟수
    result_revisit_count  INTEGER      NOT NULL DEFAULT 0,  -- 결과 페이지 진입 횟수
    last_photo_replaced   INTEGER      NOT NULL DEFAULT 0,  -- 마지막 세션 사진 교체 횟수
    created_at            TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_user_behavior_updated_at
    BEFORE UPDATE ON user_behavior
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
