-- StyleFit PostgreSQL DDL
-- H2(개발)에서 PostgreSQL(운영)으로 전환 시 이 파일로 테이블 생성

CREATE TABLE analysis_result (
    id                 BIGSERIAL       PRIMARY KEY,
    cookie_id          VARCHAR(100)    NOT NULL,
    product_code       VARCHAR(50)     NOT NULL DEFAULT 'PERSONAL_COLOR_DIAGNOSIS',
    status             VARCHAR(20)     NOT NULL DEFAULT 'PROCESSING',
    -- 인당 누적 진단 횟수. 인당 진단 한도(기본 5회)의 기준값.
    -- 결과 삭제(soft reset) 시에도 보존되어 삭제→재진단으로 한도를 우회할 수 없다.
    diagnosis_count    INTEGER         NOT NULL DEFAULT 0,
    result_json        JSONB,
    -- 최초 분석 시 AI 리포트 모듈에서 받은 이미지를 ./report-images/ 에 저장하고
    -- 파일명만 여기에 보관한다. 다음 조회부터는 다시 다운로드하지 않고 이 파일을 재사용.
    report_image_path  VARCHAR(500),
    -- AI 분석 원본 응답 JSON. 리포트 이미지 생성 AI 호출 시 그대로 전달.
    raw_result_json    TEXT,
    -- 사용자가 업로드한 얼굴 원본 이미지를 ./face-images/ 에 저장하고 파일명만 보관.
    -- AI 모델 학습 및 어드민 검토용. 공개 URL 없음(정적 핸들러 미등록).
    face_image_path    VARCHAR(500),
    -- 마지막 submit-photo 요청의 클라이언트 IP — 어드민에서 cookie↔ip 페어 차단할 때 사용
    last_ip            VARCHAR(45),
    created_at         TIMESTAMP       NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP       NOT NULL DEFAULT NOW(),

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
    cookie_id  VARCHAR(100) PRIMARY KEY,
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
    cookie_id     VARCHAR(100)  PRIMARY KEY,
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
    cookie_id             VARCHAR(100) PRIMARY KEY,
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


-- =========================================================================
-- 차단 사용자 (밴 리스트)
-- =========================================================================
-- 악성 사용자 차단용. cookie_id 또는 ip_address 중 하나(또는 둘 다)로 매칭.
-- 둘 다 NULL 허용, PK 없음 — 운영자가 수동으로 INSERT.
-- 한 사용자에 대해 cookie와 ip를 각각의 행으로 넣어도 되고, 한 행에 둘 다 넣어도 됨.
CREATE TABLE banned_user (
    cookie_id   VARCHAR(100),
    ip_address  VARCHAR(45),                -- IPv4(15) / IPv6(45) 둘 다 수용
    reason      VARCHAR(200),
    created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_banned_user_cookie_id  ON banned_user (cookie_id)  WHERE cookie_id  IS NOT NULL;
CREATE INDEX idx_banned_user_ip_address ON banned_user (ip_address) WHERE ip_address IS NOT NULL;


-- =========================================================================
-- 일일 API 호출 한도 (리포트 생성 모듈 — 서버 전체 글로벌 카운터)
-- =========================================================================
-- /api/analysis/submit-photo 의 하루 호출 총합을 50회로 제한(쿠키 단위가 아님).
-- 하루 1행만 만들어지며(quota_day PK), 자정 넘어가면 새 행이 생기고 이전 행은 그대로 남아 히스토리로 활용.
CREATE TABLE api_call_quota (
    quota_day   DATE      PRIMARY KEY,
    call_count  INTEGER   NOT NULL DEFAULT 0,
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_call_count_nonneg CHECK (call_count >= 0)
);

CREATE TRIGGER trg_api_call_quota_updated_at
    BEFORE UPDATE ON api_call_quota
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =========================================================================
-- 사용자(쿠키) / IP 단위 일일 호출 카운터
-- =========================================================================
-- 글로벌 카운터(api_call_quota)와 별도로, 한 사용자가 쿠키를 새로 발급해
-- 한도를 모두 소진하는 것을 막기 위한 2차 방어선.
-- scope: 'COOKIE' / 'IP', actor_key: 쿠키 UUID 또는 IP 문자열.
CREATE TABLE actor_quota (
    scope       VARCHAR(10)  NOT NULL,
    actor_key   VARCHAR(64)  NOT NULL,
    quota_day   DATE         NOT NULL,
    call_count  INTEGER      NOT NULL DEFAULT 0,
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW(),

    PRIMARY KEY (scope, actor_key, quota_day),
    CONSTRAINT chk_actor_scope CHECK (scope IN ('COOKIE', 'IP')),
    CONSTRAINT chk_actor_count_nonneg CHECK (call_count >= 0)
);

CREATE TRIGGER trg_actor_quota_updated_at
    BEFORE UPDATE ON actor_quota
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- =========================================================================
-- 결과 공유 토큰
-- =========================================================================
-- 본인 결과를 외부 사람에게 공유하기 위한 URL-safe 토큰.
-- 한 사용자(쿠키)당 1건의 active 토큰을 재사용한다 — 다시 공유 버튼을 눌러도 같은 토큰.
-- revoke 시 revoked_at 채워 비활성화 (행 삭제 안 함 — 같은 토큰 재사용 차단).
CREATE TABLE share_token (
    id                 BIGSERIAL    PRIMARY KEY,
    token              VARCHAR(64)  NOT NULL UNIQUE,
    cookie_id          VARCHAR(100) NOT NULL,
    analysis_result_id BIGINT       NOT NULL REFERENCES analysis_result(id) ON DELETE CASCADE,
    created_at         TIMESTAMP    NOT NULL DEFAULT NOW(),
    revoked_at         TIMESTAMP
);

CREATE INDEX idx_share_token_cookie_id ON share_token (cookie_id);
CREATE INDEX idx_share_token_active ON share_token (cookie_id) WHERE revoked_at IS NULL;


-- =========================================================================
-- 런타임 운영 설정 (어드민에서 변경)
-- =========================================================================
-- application.properties 의 값은 "기본값(seed)"으로만 쓰이고, 이 테이블에 행이 있으면 우선한다.
-- 현재 관리 키: 'ratelimit.report-daily'(일일 AI 호출 한도), 'diagnosis.max-per-cookie'(인당 진단 횟수 한도).
CREATE TABLE app_setting (
    setting_key   VARCHAR(64)  PRIMARY KEY,
    setting_value VARCHAR(200) NOT NULL,
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_app_setting_updated_at
    BEFORE UPDATE ON app_setting
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
