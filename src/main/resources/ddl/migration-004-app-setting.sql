-- 기존 운영 DB에 app_setting 테이블 추가 (어드민에서 런타임 변경하는 운영 설정 저장소)
-- 행이 없으면 application.properties 기본값을 사용하므로, 생성만 해두면 즉시 동작한다.
CREATE TABLE IF NOT EXISTS app_setting (
    setting_key   VARCHAR(64)  PRIMARY KEY,
    setting_value VARCHAR(200) NOT NULL,
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- updated_at 자동 갱신 트리거 (set_updated_at 함수는 schema-postgres.sql 에서 이미 정의됨)
DROP TRIGGER IF EXISTS trg_app_setting_updated_at ON app_setting;
CREATE TRIGGER trg_app_setting_updated_at
    BEFORE UPDATE ON app_setting
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
