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
